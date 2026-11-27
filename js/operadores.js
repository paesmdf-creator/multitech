import {
  doc,
  collection,
  getDocs,
  addDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  PERFIS_INTERNOS,
  obterPerfisPermitidosNoPlano,
  limiteOperadoresDoPlano
} from "./planos-permissoes.js";

const ROOT_COLLECTION = "multitech_empresas";
const SESSAO_OP_KEY = "mt_operador_sessao_v1";

function escapar(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export class GerenciadorOperadores {
  constructor({ db, empresaId, planoId, limiteOperadores }) {
    this.db = db;
    this.empresaId = empresaId;
    this.planoId = planoId || "starter";
    this.limiteOperadores = limiteOperadores ?? limiteOperadoresDoPlano(this.planoId);

    this.operadores = [];
    this.operadorAtual = null;
    this.operadorPendentePin = null;

    this.badgeEl = document.getElementById("mt-operador-atual-badge");
    this.btnTrocarEl = document.getElementById("mt-btn-trocar-operador");
    this.modalEl = document.getElementById("mt-modal-operadores");
    this.listaLoginEl = document.getElementById("mt-lista-operadores-login");
    this.areaPinEl = document.getElementById("mt-area-pin");
    this.inputPinEl = document.getElementById("mt-input-pin");
    this.btnConfirmarPinEl = document.getElementById("mt-btn-confirmar-pin");
    this.erroPinEl = document.getElementById("mt-erro-pin");

    this.formNovoOpEl = document.getElementById("mt-form-novo-operador");
    this.selectPerfilEl = document.getElementById("mt-op-perfil");
    this.resumoLimiteEl = document.getElementById("mt-resumo-limite-equipe");
    this.msgEquipeEl = document.getElementById("mt-msg-equipe");
    this.tabelaOperadoresEl = document.getElementById("mt-tabela-operadores");

    this._bindEventos();
  }

  _colRef() {
    return collection(this.db, ROOT_COLLECTION, this.empresaId, "operadores");
  }

  _bindEventos() {
    if (this.btnTrocarEl) {
      this.btnTrocarEl.onclick = () => this.abrirModalSelecao();
    }

    if (this.btnConfirmarPinEl) {
      this.btnConfirmarPinEl.onclick = () => this._confirmarPin();
    }

    if (this.inputPinEl) {
      this.inputPinEl.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this._confirmarPin();
        }
      };
    }

    if (this.formNovoOpEl) {
      this.formNovoOpEl.onsubmit = (e) => this._cadastrarOperador(e);
    }

    if (this.tabelaOperadoresEl) {
      this.tabelaOperadoresEl.onclick = async (e) => {
        const btn = e.target.closest("[data-del-op]");
        if (!btn) return;
        const id = btn.dataset.delOp;
        await deleteDoc(doc(this.db, ROOT_COLLECTION, this.empresaId, "operadores", id));
        await this.carregarOperadores();
        this.renderizarGestao();
      };
    }
  }

  async iniciar() {
    await this.carregarOperadores();
    this.renderizarSelectPerfis();
    this.renderizarGestao();

    const salva = this._lerSessaoSalva();
    if (salva) {
      const encontrado = this.operadores.find((op) => op.id === salva.id);
      if (encontrado) {
        this._definirOperadorAtivo(encontrado);
        return;
      }
    }

    if (this.operadores.length > 0) {
      this.abrirModalSelecao();
    } else {
      this._definirOperadorAtivo({
        id: "admin-padrao",
        nome: "Administrador",
        login: "admin",
        perfil: "admin",
        pin: ""
      });
    }
  }

  async atualizarPlano(novoPlanoId) {
    this.planoId = novoPlanoId || "starter";
    this.limiteOperadores = limiteOperadoresDoPlano(this.planoId);
    this.renderizarSelectPerfis();
    this.renderizarGestao();
  }

  async carregarOperadores() {
    const snap = await getDocs(this._colRef());
    this.operadores = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  renderizarSelectPerfis() {
    if (!this.selectPerfilEl) return;
    const permitidos = obterPerfisPermitidosNoPlano(this.planoId);
    this.selectPerfilEl.innerHTML = permitidos
      .map((chave) => {
        const nome = PERFIS_INTERNOS[chave]?.nome || chave;
        return `<option value="${escapar(chave)}">${escapar(nome)}</option>`;
      })
      .join("");
  }

  renderizarGestao() {
    if (this.resumoLimiteEl) {
      this.resumoLimiteEl.textContent = `Usuários internos cadastrados: ${this.operadores.length} de ${this.limiteOperadores} permitidos no plano.`;
    }

    if (!this.tabelaOperadoresEl) return;
    if (!this.operadores.length) {
      this.tabelaOperadoresEl.innerHTML = `<p class="muted-text">Nenhum usuário interno adicional cadastrado. O acesso principal funciona como Administrador.</p>`;
      return;
    }

    this.tabelaOperadoresEl.innerHTML = `<table><thead><tr><th>Nome</th><th>Login</th><th>Perfil</th><th>PIN</th><th>Ação</th></tr></thead><tbody>${this.operadores
      .map((op) => {
        const perfilNome = PERFIS_INTERNOS[op.perfil]?.nome || op.perfil;
        return `<tr>
          <td>${escapar(op.nome)}</td>
          <td>${escapar(op.login)}</td>
          <td>${escapar(perfilNome)}</td>
          <td>${op.pin ? "Configurado" : "Sem PIN"}</td>
          <td><button type="button" class="btn btn-outline btn-sm" data-del-op="${escapar(op.id)}">Remover</button></td>
        </tr>`;
      })
      .join("")}</tbody></table>`;
  }

  async _cadastrarOperador(e) {
    e.preventDefault();
    if (this.msgEquipeEl) this.msgEquipeEl.textContent = "";

    if (this.operadores.length >= this.limiteOperadores) {
      if (this.msgEquipeEl) {
        this.msgEquipeEl.textContent = `Limite de ${this.limiteOperadores} usuários internos atingido para o plano atual.`;
      }
      return;
    }

    const nome = document.getElementById("mt-op-nome")?.value.trim() || "";
    const login = document.getElementById("mt-op-login")?.value.trim() || "";
    const perfil = this.selectPerfilEl?.value || "operador";
    const pin = document.getElementById("mt-op-pin")?.value.trim() || "";

    if (!nome || !login) return;

    await addDoc(this._colRef(), {
      nome,
      login,
      perfil,
      pin,
      criadoEm: new Date().toISOString()
    });

    this.formNovoOpEl.reset();
    await this.carregarOperadores();
    this.renderizarGestao();
    if (this.msgEquipeEl) {
      this.msgEquipeEl.textContent = "Usuário interno adicionado com sucesso.";
    }
  }

  abrirModalSelecao() {
    if (!this.modalEl || !this.listaLoginEl) return;
    this.operadorPendentePin = null;
    if (this.areaPinEl) this.areaPinEl.classList.add("hidden");
    if (this.erroPinEl) this.erroPinEl.textContent = "";
    if (this.inputPinEl) this.inputPinEl.value = "";

    const opcoes = [
      { id: "admin-padrao", nome: "Administrador (Conta Principal)", login: "admin", perfil: "admin", pin: "" },
      ...this.operadores
    ];

    this.listaLoginEl.innerHTML = opcoes
      .map((op) => {
        const perfilNome = PERFIS_INTERNOS[op.perfil]?.nome || op.perfil;
        return `<button type="button" class="op-card-btn" data-sel-op="${escapar(op.id)}">
          <strong>${escapar(op.nome)}</strong>
          <span class="muted-text">@${escapar(op.login)} · ${escapar(perfilNome)}${op.pin ? " · PIN obrigatório" : ""}</span>
        </button>`;
      })
      .join("");

    this.listaLoginEl.onclick = (ev) => {
      const btn = ev.target.closest("[data-sel-op]");
      if (!btn) return;
      const id = btn.dataset.selOp;
      const escolhido = opcoes.find((item) => item.id === id);
      if (!escolhido) return;

      if (escolhido.pin) {
        this.operadorPendentePin = escolhido;
        if (this.erroPinEl) this.erroPinEl.textContent = "";
        if (this.inputPinEl) {
          this.inputPinEl.value = "";
          this.inputPinEl.focus();
        }
        if (this.areaPinEl) this.areaPinEl.classList.remove("hidden");
      } else {
        this._definirOperadorAtivo(escolhido);
      }
    };

    this.modalEl.classList.remove("hidden");
  }

  _confirmarPin() {
    if (!this.operadorPendentePin || !this.inputPinEl) return;
    const digitado = this.inputPinEl.value.trim();
    if (digitado === String(this.operadorPendentePin.pin)) {
      const op = this.operadorPendentePin;
      this.operadorPendentePin = null;
      this._definirOperadorAtivo(op);
    } else if (this.erroPinEl) {
      this.erroPinEl.textContent = "PIN incorreto. Tente novamente.";
    }
  }

  _definirOperadorAtivo(op) {
    this.operadorAtual = op;
    try {
      sessionStorage.setItem(
        `${SESSAO_OP_KEY}_${this.empresaId}`,
        JSON.stringify({ id: op.id, nome: op.nome, perfil: op.perfil })
      );
    } catch (_) {}

    if (this.badgeEl) {
      const perfilNome = PERFIS_INTERNOS[op.perfil]?.nome || op.perfil;
      this.badgeEl.textContent = `${op.nome} (${perfilNome})`;
    }
    if (this.btnTrocarEl) {
      this.btnTrocarEl.classList.remove("hidden");
    }
    if (this.modalEl) {
      this.modalEl.classList.add("hidden");
    }
  }

  _lerSessaoSalva() {
    try {
      const raw = sessionStorage.getItem(`${SESSAO_OP_KEY}_${this.empresaId}`);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  limparSessaoOperador() {
    this.operadorAtual = null;
    try {
      sessionStorage.removeItem(`${SESSAO_OP_KEY}_${this.empresaId}`);
    } catch (_) {}
  }
}
