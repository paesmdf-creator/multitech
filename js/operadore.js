// js/operadores.js
// Gerencia os operadores internos dentro do mesmo login da empresa (empresas/{uid}/operadores)

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  PERFIS_INTERNOS,
  obterPlano,
  aplicarPermissoesNaInterface
} from "./planos-permissoes.js";

const STORAGE_KEY_PREFIX = "multitech_operador_ativo_";

async function gerarHashPin(pin) {
  const limpo = String(pin || "").trim();
  if (!limpo) return "";
  const encoder = new TextEncoder();
  const data = encoder.encode(limpo);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export class GerenciadorOperadores {
  constructor(db, uidEmpresa, planoInicial = "starter") {
    this.db = db;
    this.uid = uidEmpresa;
    this.plano = obterPlano(planoInicial);
    this.operadores = [];
    this.operadorAtivo = null;
    this._pendentePinId = null;
    this._eventosConfigurados = false;
  }

  async iniciar() {
    this._configurarEventosUI();

    const empresaSnap = await getDoc(doc(this.db, "empresas", this.uid));
    const planoSalvo = empresaSnap.exists() ? empresaSnap.data().plano : this.plano.id;
    this.plano = obterPlano(planoSalvo);

    await this.carregarOperadores();

    if (this.operadores.length === 0) {
      const adminInicial = await this.criarOperadorInterno(
        {
          nome: "Administrador",
          loginInterno: "admin",
          perfil: "admin",
          pin: ""
        },
        true
      );
      this.definirOperadorAtivo(adminInicial);
      this.renderizarTabelaOperadores();
      return;
    }

    const ativos = this.operadores.filter((op) => op.ativo !== false);
    const listaParaEscolha = ativos.length > 0 ? ativos : this.operadores;

    if (
      this.plano.maxUsuariosInternos === 1 ||
      (listaParaEscolha.length === 1 && !listaParaEscolha[0].pinHash)
    ) {
      this.definirOperadorAtivo(listaParaEscolha[0]);
      this.renderizarTabelaOperadores();
      return;
    }

    const salvoId = sessionStorage.getItem(STORAGE_KEY_PREFIX + this.uid);
    if (salvoId) {
      const encontrado = listaParaEscolha.find((op) => op.id === salvoId);
      if (encontrado) {
        this.definirOperadorAtivo(encontrado);
        this.renderizarTabelaOperadores();
        return;
      }
    }

    this.abrirModalSelecaoOperador();
    this.renderizarTabelaOperadores();
  }

  async carregarOperadores() {
    const colRef = collection(this.db, "empresas", this.uid, "operadores");
    const snap = await getDocs(colRef);
    this.operadores = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return this.operadores;
  }

  definirOperadorAtivo(operador) {
    this.operadorAtivo = operador;
    sessionStorage.setItem(STORAGE_KEY_PREFIX + this.uid, operador.id);

    const badge = document.getElementById("mt-operador-atual-badge");
    if (badge) {
      const perfilLabel = PERFIS_INTERNOS[operador.perfil]?.label || operador.perfil;
      badge.textContent = `${operador.nome} • ${perfilLabel}`;
    }

    aplicarPermissoesNaInterface(this.plano.id, operador);
    this.fecharModalSelecaoOperador();
    this.renderizarTabelaOperadores();

    document.dispatchEvent(
      new CustomEvent("multitech:operador-alterado", {
        detail: { operador, plano: this.plano }
      })
    );
  }

  async autenticarOperador(operadorId, pinDigitado = "") {
    const operador = this.operadores.find((op) => op.id === operadorId);
    if (!operador) throw new Error("Usuário interno não encontrado.");
    if (operador.ativo === false) throw new Error("Usuário interno desativado.");

    if (operador.pinHash) {
      const hashDigitado = await gerarHashPin(pinDigitado);
      if (hashDigitado !== operador.pinHash) {
        throw new Error("PIN interno incorreto.");
      }
    }

    this.definirOperadorAtivo(operador);
    return operador;
  }

  async criarOperadorInterno(
    { nome, loginInterno, perfil, pin = "", modulosExtras = [] },
    ignorarChecagemAdmin = false
  ) {
    if (!ignorarChecagemAdmin && this.operadorAtivo?.perfil !== "admin") {
      throw new Error("Apenas o Administrador pode cadastrar usuários internos.");
    }

    if (this.operadores.length >= this.plano.maxUsuariosInternos) {
      throw new Error(
        `Limite de ${this.plano.maxUsuariosInternos} usuário(s) atingido no plano ${this.plano.nome}.`
      );
    }

    if (!this.plano.perfisPermitidos.includes(perfil)) {
      throw new Error(`O perfil "${perfil}" não está disponível no plano ${this.plano.nome}.`);
    }

    const loginLimpo = String(loginInterno || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ".");

    if (!nome || !loginLimpo) {
      throw new Error("Preencha o nome e o login interno.");
    }

    if (this.operadores.some((op) => op.loginInterno === loginLimpo)) {
      throw new Error(`O login interno "${loginLimpo}" já existe.`);
    }

    const novoDoc = {
      nome: nome.trim(),
      loginInterno: loginLimpo,
      perfil,
      pinHash: await gerarHashPin(pin),
      modulosExtras,
      ativo: true,
      criadoEm: serverTimestamp()
    };

    const ref = await addDoc(collection(this.db, "empresas", this.uid, "operadores"), novoDoc);
    const criado = { id: ref.id, ...novoDoc };
    this.operadores.push(criado);
    this.renderizarTabelaOperadores();
    return criado;
  }

  async atualizarOperador(operadorId, dados) {
    if (this.operadorAtivo?.perfil !== "admin") {
      throw new Error("Apenas o Administrador pode editar usuários internos.");
    }

    const payload = { atualizadoEm: serverTimestamp() };
    if (dados.nome !== undefined) payload.nome = String(dados.nome).trim();
    if (dados.perfil !== undefined) {
      if (!this.plano.perfisPermitidos.includes(dados.perfil)) {
        throw new Error(`Perfil não permitido no plano ${this.plano.nome}.`);
      }
      payload.perfil = dados.perfil;
    }
    if (dados.ativo !== undefined) payload.ativo = Boolean(dados.ativo);
    if (dados.modulosExtras !== undefined) payload.modulosExtras = dados.modulosExtras;
    if (dados.pin !== undefined && String(dados.pin).trim() !== "") {
      payload.pinHash = await gerarHashPin(dados.pin);
    }

    await updateDoc(doc(this.db, "empresas", this.uid, "operadores", operadorId), payload);
    await this.carregarOperadores();
    this.renderizarTabelaOperadores();
  }

  obterAssinaturaAutoria() {
    return {
      operadorId: this.operadorAtivo?.id || "admin",
      operadorNome: this.operadorAtivo?.nome || "Administrador",
      operadorLogin: this.operadorAtivo?.loginInterno || "admin",
      operadorPerfil: this.operadorAtivo?.perfil || "admin"
    };
  }

  abrirModalSelecaoOperador() {
    const modal = document.getElementById("mt-modal-operadores");
    const lista = document.getElementById("mt-lista-operadores-login");
    const areaPin = document.getElementById("mt-area-pin");
    const erroPin = document.getElementById("mt-erro-pin");
    const inputPin = document.getElementById("mt-input-pin");

    if (!modal || !lista) return;

    this._pendentePinId = null;
    if (areaPin) areaPin.classList.add("hidden");
    if (erroPin) erroPin.textContent = "";
    if (inputPin) inputPin.value = "";

    const ativos = this.operadores.filter((op) => op.ativo !== false);

    lista.innerHTML = ativos
      .map((op) => {
        const perfilLabel = PERFIS_INTERNOS[op.perfil]?.label || op.perfil;
        const exigePin = Boolean(op.pinHash);
        return `
          <button type="button" class="op-card-btn" data-op-id="${op.id}" data-exige-pin="${exigePin}">
            <strong>${op.nome}</strong>
            <span>@${op.loginInterno} • ${perfilLabel}</span>
            <small>${exigePin ? "🔒 Requer PIN" : "Entrar agora"}</small>
          </button>
        `;
      })
      .join("");

    modal.classList.remove("hidden");
  }

  fecharModalSelecaoOperador() {
    const modal = document.getElementById("mt-modal-operadores");
    if (modal) modal.classList.add("hidden");
  }

  renderizarTabelaOperadores() {
    const container = document.getElementById("mt-tabela-operadores");
    const selectPerfil = document.getElementById("mt-op-perfil");
    const resumoLimite = document.getElementById("mt-resumo-limite-equipe");

    if (selectPerfil) {
      selectPerfil.innerHTML = this.plano.perfisPermitidos
        .map((perfilKey) => {
          const info = PERFIS_INTERNOS[perfilKey];
          return `<option value="${perfilKey}">${info ? info.label : perfilKey}</option>`;
        })
        .join("");
    }

    if (resumoLimite) {
      resumoLimite.textContent = `Plano ${this.plano.nome}: ${this.operadores.length} de ${this.plano.maxUsuariosInternos} usuário(s) cadastrado(s).`;
    }

    if (!container) return;

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Login</th>
            <th>Perfil</th>
            <th>PIN</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${this.operadores
            .map((op) => {
              const ativo = op.ativo !== false;
              const isAdminPrincipal = op.loginInterno === "admin" && op.perfil === "admin";
              return `
                <tr>
                  <td><strong>${op.nome}</strong></td>
                  <td>@${op.loginInterno}</td>
                  <td>
                    <select data-acao-perfil="${op.id}" ${isAdminPrincipal ? "disabled" : ""}>
                      ${this.plano.perfisPermitidos
                        .map(
                          (p) =>
                            `<option value="${p}" ${op.perfil === p ? "selected" : ""}>${
                              PERFIS_INTERNOS[p]?.label || p
                            }</option>`
                        )
                        .join("")}
                    </select>
                  </td>
                  <td>${op.pinHash ? "Configurado" : "Sem PIN"}</td>
                  <td>${ativo ? "Ativo" : "Inativo"}</td>
                  <td>
                    ${
                      isAdminPrincipal
                        ? `<small class="muted-text">Principal</small>`
                        : `<button type="button" class="btn btn-outline btn-sm" data-acao-status="${op.id}" data-proximo-status="${!ativo}">${
                            ativo ? "Desativar" : "Ativar"
                          }</button>`
                    }
                  </td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    `;
  }

  _configurarEventosUI() {
    if (this._eventosConfigurados) return;
    this._eventosConfigurados = true;

    const btnTrocar = document.getElementById("mt-btn-trocar-operador");
    if (btnTrocar) {
      btnTrocar.addEventListener("click", () => this.abrirModalSelecaoOperador());
    }

    const listaLogin = document.getElementById("mt-lista-operadores-login");
    const areaPin = document.getElementById("mt-area-pin");
    const inputPin = document.getElementById("mt-input-pin");
    const erroPin = document.getElementById("mt-erro-pin");
    const btnConfirmarPin = document.getElementById("mt-btn-confirmar-pin");

    if (listaLogin) {
      listaLogin.addEventListener("click", async (e) => {
        const card = e.target.closest("[data-op-id]");
        if (!card) return;
        const opId = card.getAttribute("data-op-id");
        const exigePin = card.getAttribute("data-exige-pin") === "true";
        if (erroPin) erroPin.textContent = "";

        if (exigePin) {
          this._pendentePinId = opId;
          if (areaPin) areaPin.classList.remove("hidden");
          if (inputPin) {
            inputPin.value = "";
            inputPin.focus();
          }
          return;
        }

        try {
          await this.autenticarOperador(opId, "");
        } catch (err) {
          if (erroPin) erroPin.textContent = err.message;
        }
      });
    }

    if (btnConfirmarPin) {
      btnConfirmarPin.addEventListener("click", async () => {
        if (!this._pendentePinId) return;
        try {
          await this.autenticarOperador(this._pendentePinId, inputPin?.value || "");
        } catch (err) {
          if (erroPin) erroPin.textContent = err.message;
        }
      });
    }

    const formNovo = document.getElementById("mt-form-novo-operador");
    const msgEquipe = document.getElementById("mt-msg-equipe");

    if (formNovo) {
      formNovo.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (msgEquipe) msgEquipe.textContent = "";

        const nome = document.getElementById("mt-op-nome")?.value || "";
        const loginInterno = document.getElementById("mt-op-login")?.value || "";
        const perfil = document.getElementById("mt-op-perfil")?.value || "atendente";
        const pin = document.getElementById("mt-op-pin")?.value || "";

        try {
          await this.criarOperadorInterno({ nome, loginInterno, perfil, pin });
          formNovo.reset();
          if (msgEquipe) {
            msgEquipe.style.color = "#15803d";
            msgEquipe.textContent = "Usuário interno cadastrado com sucesso.";
          }
        } catch (err) {
          if (msgEquipe) {
            msgEquipe.style.color = "#dc2626";
            msgEquipe.textContent = err.message;
          }
        }
      });
    }

    const tabelaContainer = document.getElementById("mt-tabela-operadores");
    if (tabelaContainer) {
      tabelaContainer.addEventListener("change", async (e) => {
        const select = e.target.closest("[data-acao-perfil]");
        if (!select) return;
        const opId = select.getAttribute("data-acao-perfil");
        try {
          await this.atualizarOperador(opId, { perfil: select.value });
        } catch (err) {
          alert(err.message);
          this.renderizarTabelaOperadores();
        }
      });

      tabelaContainer.addEventListener("click", async (e) => {
        const btn = e.target.closest("[data-acao-status]");
        if (!btn) return;
        const opId = btn.getAttribute("data-acao-status");
        const proximoStatus = btn.getAttribute("data-proximo-status") === "true";
        try {
          await this.atualizarOperador(opId, { ativo: proximoStatus });
        } catch (err) {
          alert(err.message);
        }
      });
    }
  }
}
