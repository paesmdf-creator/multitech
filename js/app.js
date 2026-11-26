// js/app.js
// Controlador principal do PWA Multitech com isolamento por empresa (empresas/{uid})

import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  PLANOS_MULTITECH,
  PERFIS_INTERNOS,
  obterPlano,
  aplicarPermissoesNaInterface
} from "./planos-permissoes.js";
import { GerenciadorOperadores } from "./operadore.js";
import { renderizarVitrinePlanos } from "./vitrine-plano.js";

let empresaUidAtual = null;
let dadosEmpresaAtual = null;
let gerenciadorOperadores = null;
let modoCadastroAuth = false;

const formatarMoeda = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

// Registro do Service Worker para PWA no GitHub Pages
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

// Renderiza vitrine pública antes do login
renderizarVitrinePlanos("vitrine-planos-publica", {
  planoAtual: null,
  onSelecionarPlano: (planoId) => {
    const selectPlano = document.getElementById("auth-plano");
    if (selectPlano) selectPlano.value = planoId;
    ativarAbaAuth("register");
  }
});

// Guia dos 4 perfis internos
function renderizarGuiaPerfis() {
  const guia = document.getElementById("guia-perfis-internos");
  if (!guia) return;
  guia.innerHTML = Object.entries(PERFIS_INTERNOS)
    .map(
      ([, info]) => `
      <div class="mini-card">
        <strong>${info.label}</strong>
        <p class="muted-text" style="margin:6px 0 0;">${info.descricao}</p>
      </div>
    `
    )
    .join("");
}
renderizarGuiaPerfis();

// Controle de abas da tela de entrada
function ativarAbaAuth(aba) {
  const tabLogin = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");
  const tabPlans = document.getElementById("tab-plans-public");
  const authForm = document.getElementById("auth-form");
  const publicPlansView = document.getElementById("public-plans-view");
  const campoEmpresa = document.getElementById("campo-nome-empresa");
  const campoPlano = document.getElementById("campo-plano-inicial");
  const submitBtn = document.getElementById("auth-submit-btn");

  tabLogin.classList.toggle("active", aba === "login");
  tabRegister.classList.toggle("active", aba === "register");
  tabPlans.classList.toggle("active", aba === "plans");

  const verPlanos = aba === "plans";
  authForm.classList.toggle("hidden", verPlanos);
  publicPlansView.classList.toggle("hidden", !verPlanos);

  modoCadastroAuth = aba === "register";
  campoEmpresa.classList.toggle("hidden", !modoCadastroAuth);
  campoPlano.classList.toggle("hidden", !modoCadastroAuth);
  submitBtn.textContent = modoCadastroAuth ? "Criar Conta da Empresa" : "Acessar Sistema";
}

document.getElementById("tab-login").addEventListener("click", () => ativarAbaAuth("login"));
document.getElementById("tab-register").addEventListener("click", () => ativarAbaAuth("register"));
document.getElementById("tab-plans-public").addEventListener("click", () => ativarAbaAuth("plans"));

// Envio do formulário de login ou cadastro da empresa
document.getElementById("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const erroEl = document.getElementById("auth-error");
  erroEl.textContent = "";

  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;

  try {
    if (modoCadastroAuth) {
      const nomeEmpresa = document.getElementById("auth-empresa").value.trim() || "Minha Empresa";
      const planoInicial = document.getElementById("auth-plano").value || "starter";
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "empresas", cred.user.uid), {
        nome: nomeEmpresa,
        email,
        plano: planoInicial,
        corPrimaria: "#0f172a",
        criadoEm: serverTimestamp()
      });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (err) {
    erroEl.textContent = err.message;
  }
});

document.getElementById("btn-logout-empresa").addEventListener("click", async () => {
  await signOut(auth);
});

// Navegação entre seções do sistema
document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    const viewName = btn.getAttribute("data-view");
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    document.querySelectorAll(".view-section").forEach((sec) => {
      sec.classList.toggle("hidden", sec.id !== `view-${viewName}`);
    });

    document.getElementById("page-title").textContent = btn.textContent.trim();
    document.getElementById("sidebar").classList.remove("open");

    if (gerenciadorOperadores) {
      aplicarPermissoesNaInterface(
        dadosEmpresaAtual?.plano || "starter",
        gerenciadorOperadores.operadorAtivo
      );
    }
  });
});

document.getElementById("btn-toggle-menu").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

function renderizarVitrineLogada(planoAtual) {
  renderizarVitrinePlanos("vitrine-planos-logada", {
    planoAtual,
    onSelecionarPlano: async (planoId) => {
      await updateDoc(doc(db, "empresas", empresaUidAtual), {
        plano: planoId,
        atualizadoEm: serverTimestamp()
      });
      await carregarDadosEmpresa();
      gerenciadorOperadores.plano = obterPlano(planoId);
      gerenciadorOperadores.renderizarTabelaOperadores();
      aplicarPermissoesNaInterface(planoId, gerenciadorOperadores.operadorAtivo);
      renderizarVitrineLogada(planoId);
      alert(`Plano alterado para ${PLANOS_MULTITECH[planoId].nome}!`);
    }
  });
}

// Observa sessão da empresa no Firebase Auth
onAuthStateChanged(auth, async (user) => {
  const authScreen = document.getElementById("auth-screen");
  const appShell = document.getElementById("app-shell");

  if (!user) {
    empresaUidAtual = null;
    dadosEmpresaAtual = null;
    gerenciadorOperadores = null;
    appShell.classList.add("hidden");
    authScreen.classList.remove("hidden");
    return;
  }

  empresaUidAtual = user.uid;
  authScreen.classList.add("hidden");
  appShell.classList.remove("hidden");

  await carregarDadosEmpresa();

  gerenciadorOperadores = new GerenciadorOperadores(db, empresaUidAtual, dadosEmpresaAtual.plano);
  await gerenciadorOperadores.iniciar();

  renderizarVitrineLogada(dadosEmpresaAtual.plano);

  await atualizarTodosDados();
});

document.addEventListener("multitech:operador-alterado", () => {
  atualizarTodosDados();
});

async function carregarDadosEmpresa() {
  const ref = doc(db, "empresas", empresaUidAtual);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    dadosEmpresaAtual = {
      nome: "Minha Empresa",
      plano: "starter",
      corPrimaria: "#0f172a"
    };
    await setDoc(ref, { ...dadosEmpresaAtual, criadoEm: serverTimestamp() });
  } else {
    dadosEmpresaAtual = snap.data();
  }

  const planoObj = obterPlano(dadosEmpresaAtual.plano);
  document.getElementById("empresa-nome-sidebar").textContent = dadosEmpresaAtual.nome || "Multitech";
  document.getElementById("empresa-plano-sidebar").textContent = `Plano ${planoObj.nome} (${planoObj.precoTexto})`;
  document.getElementById("cfg-nome-empresa").value = dadosEmpresaAtual.nome || "";
  document.getElementById("cfg-cor-primaria").value = dadosEmpresaAtual.corPrimaria || "#0f172a";
  document.getElementById("cfg-telefone").value = dadosEmpresaAtual.telefone || "";
  document.getElementById("cfg-cidade").value = dadosEmpresaAtual.cidade || "";
  document.getElementById("pagina-slogan").value = dadosEmpresaAtual.slogan || "";
  document.getElementById("pagina-destaque").value = dadosEmpresaAtual.destaquePagina || "";

  const linkAg = document.getElementById("link-agendamento-online");
  if (linkAg) {
    linkAg.textContent = `${window.location.origin}${window.location.pathname}?agendar=${empresaUidAtual}`;
  }

  if (dadosEmpresaAtual.corPrimaria) {
    document.documentElement.style.setProperty("--primary", dadosEmpresaAtual.corPrimaria);
  }
}

async function listarColecao(subcolecao) {
  const snap = await getDocs(collection(db, "empresas", empresaUidAtual, subcolecao));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function salvarEmColecao(subcolecao, payload) {
  const autoria = gerenciadorOperadores ? gerenciadorOperadores.obterAssinaturaAutoria() : {};
  await addDoc(collection(db, "empresas", empresaUidAtual, subcolecao), {
    ...payload,
    ...autoria,
    criadoEm: serverTimestamp()
  });
  await atualizarTodosDados();
}

// Formulário Clientes
document.getElementById("form-cliente").addEventListener("submit", async (e) => {
  e.preventDefault();
  await salvarEmColecao("clientes", {
    nome: document.getElementById("cliente-nome").value.trim(),
    telefone: document.getElementById("cliente-telefone").value.trim(),
    email: document.getElementById("cliente-email").value.trim(),
    observacoes: document.getElementById("cliente-observacoes").value.trim()
  });
  e.target.reset();
});

// Formulário Serviços
document.getElementById("form-servico").addEventListener("submit", async (e) => {
  e.preventDefault();
  await salvarEmColecao("servicos", {
    nome: document.getElementById("servico-nome").value.trim(),
    preco: Number(document.getElementById("servico-preco").value || 0),
    duracao: Number(document.getElementById("servico-duracao").value || 60),
    descricao: document.getElementById("servico-descricao").value.trim()
  });
  e.target.reset();
});

// Formulário Agenda
document.getElementById("form-agenda").addEventListener("submit", async (e) => {
  e.preventDefault();
  await salvarEmColecao("agenda", {
    cliente: document.getElementById("agenda-cliente").value.trim(),
    servico: document.getElementById("agenda-servico").value.trim(),
    dataHora: document.getElementById("agenda-data").value,
    profissional:
      document.getElementById("agenda-profissional").value.trim() ||
      gerenciadorOperadores?.operadorAtivo?.nome ||
      "Principal",
    status: document.getElementById("agenda-status").value
  });
  e.target.reset();
});

// Formulário Portfólio
document.getElementById("form-portfolio").addEventListener("submit", async (e) => {
  e.preventDefault();
  await salvarEmColecao("portfolio", {
    titulo: document.getElementById("portfolio-titulo").value.trim(),
    categoria: document.getElementById("portfolio-categoria").value.trim(),
    imagem: document.getElementById("portfolio-imagem").value.trim(),
    descricao: document.getElementById("portfolio-descricao").value.trim()
  });
  e.target.reset();
});

// Salvar Página Comercial
document.getElementById("btn-salvar-pagina").addEventListener("click", async () => {
  await updateDoc(doc(db, "empresas", empresaUidAtual), {
    slogan: document.getElementById("pagina-slogan").value.trim(),
    destaquePagina: document.getElementById("pagina-destaque").value.trim(),
    atualizadoEm: serverTimestamp()
  });
  alert("Página comercial atualizada!");
});

// Formulário Financeiro
document.getElementById("form-financeiro").addEventListener("submit", async (e) => {
  e.preventDefault();
  await salvarEmColecao("financeiro", {
    tipo: document.getElementById("fin-tipo").value,
    descricao: document.getElementById("fin-descricao").value.trim(),
    valor: Number(document.getElementById("fin-valor").value || 0),
    data: document.getElementById("fin-data").value
  });
  e.target.reset();
});

// Configurações da Empresa
document.getElementById("form-config-empresa").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("cfg-nome-empresa").value.trim();
  const corPrimaria = document.getElementById("cfg-cor-primaria").value;
  const telefone = document.getElementById("cfg-telefone").value.trim();
  const cidade = document.getElementById("cfg-cidade").value.trim();

  await updateDoc(doc(db, "empresas", empresaUidAtual), {
    nome,
    corPrimaria,
    telefone,
    cidade,
    atualizadoEm: serverTimestamp()
  });

  await carregarDadosEmpresa();
  document.getElementById("cfg-msg").style.color = "#15803d";
  document.getElementById("cfg-msg").textContent = "Configurações salvas com sucesso.";
});

async function atualizarTodosDados() {
  if (!empresaUidAtual) return;

  const [clientes, servicos, agenda, portfolio, financeiro] = await Promise.all([
    listarColecao("clientes"),
    listarColecao("servicos"),
    listarColecao("agenda"),
    listarColecao("portfolio"),
    listarColecao("financeiro")
  ]);

  const operador = gerenciadorOperadores?.operadorAtivo;
  const isProfissional = operador?.perfil === "profissional";

  const agendaFiltrada = isProfissional
    ? agenda.filter(
        (item) =>
          (item.profissional || "").toLowerCase() === (operador.nome || "").toLowerCase() ||
          item.operadorId === operador.id
      )
    : agenda;

  const entradas = financeiro
    .filter((f) => f.tipo === "entrada")
    .reduce((acc, f) => acc + Number(f.valor || 0), 0);
  const saidas = financeiro
    .filter((f) => f.tipo === "saida")
    .reduce((acc, f) => acc + Number(f.valor || 0), 0);
  const saldo = entradas - saidas;

  document.getElementById("kpi-clientes").textContent = clientes.length;
  document.getElementById("kpi-agenda").textContent = agendaFiltrada.length;
  document.getElementById("kpi-entradas").textContent = formatarMoeda(entradas);
  document.getElementById("kpi-saldo").textContent = formatarMoeda(saldo);

  document.getElementById("lista-clientes").innerHTML = `
    <table>
      <thead><tr><th>Nome</th><th>Telefone</th><th>Registrado por</th></tr></thead>
      <tbody>
        ${clientes
          .map(
            (c) => `
          <tr>
            <td><strong>${c.nome}</strong></td>
            <td>${c.telefone || "-"}</td>
            <td>${c.operadorNome || "Admin"}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;

  document.getElementById("lista-servicos").innerHTML = `
    <table>
      <thead><tr><th>Serviço</th><th>Valor</th><th>Duração</th></tr></thead>
      <tbody>
        ${servicos
          .map(
            (s) => `
          <tr>
            <td><strong>${s.nome}</strong></td>
            <td>${formatarMoeda(s.preco)}</td>
            <td>${s.duracao || 60} min</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;

  document.getElementById("lista-agenda").innerHTML = `
    <table>
      <thead><tr><th>Cliente</th><th>Serviço</th><th>Data/Hora</th><th>Profissional</th><th>Status</th><th>Por</th></tr></thead>
      <tbody>
        ${agendaFiltrada
          .map(
            (a) => `
          <tr>
            <td><strong>${a.cliente}</strong></td>
            <td>${a.servico}</td>
            <td>${a.dataHora || "-"}</td>
            <td>${a.profissional || "-"}</td>
            <td>${a.status || "Agendado"}</td>
            <td>${a.operadorNome || "Admin"}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;

  document.getElementById("lista-portfolio").innerHTML = portfolio
    .map(
      (p) => `
      <div class="mini-card">
        <strong>${p.titulo}</strong>
        <div class="muted-text">${p.categoria || ""}</div>
        <p style="margin:8px 0 0; font-size:13px;">${p.descricao || ""}</p>
      </div>
    `
    )
    .join("");

  document.getElementById("resumo-fluxo-caixa").innerHTML = `
    <div class="kpi-card"><span>Receitas</span><strong>${formatarMoeda(entradas)}</strong></div>
    <div class="kpi-card"><span>Despesas</span><strong>${formatarMoeda(saidas)}</strong></div>
    <div class="kpi-card"><span>Saldo Líquido</span><strong>${formatarMoeda(saldo)}</strong></div>
  `;

  document.getElementById("lista-financeiro").innerHTML = `
    <table>
      <thead><tr><th>Tipo</th><th>Descrição</th><th>Valor</th><th>Data</th><th>Por</th></tr></thead>
      <tbody>
        ${financeiro
          .map(
            (f) => `
          <tr>
            <td>${f.tipo === "entrada" ? "Entrada" : "Saída"}</td>
            <td>${f.descricao}</td>
            <td>${formatarMoeda(f.valor)}</td>
            <td>${f.data || "-"}</td>
            <td>${f.operadorNome || "Admin"}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;

  document.getElementById("relatorio-financeiro-box").innerHTML = `
    <p>Total de entradas: <strong>${formatarMoeda(entradas)}</strong> | Total de saídas: <strong>${formatarMoeda(saidas)}</strong> | Resultado: <strong>${formatarMoeda(saldo)}</strong></p>
  `;

  document.getElementById("relatorio-desempenho-box").innerHTML = `
    <p>Total de atendimentos registrados: <strong>${agenda.length}</strong> | Serviços ativos: <strong>${servicos.length}</strong></p>
  `;

  document.getElementById("relatorio-comparativo-box").innerHTML = `
    <p>Ticket médio por lançamento de entrada: <strong>${formatarMoeda(
      financeiro.filter((f) => f.tipo === "entrada").length
        ? entradas / financeiro.filter((f) => f.tipo === "entrada").length
        : 0
    )}</strong></p>
  `;
}
