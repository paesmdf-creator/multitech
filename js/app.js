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
  collection,
  getDocs,
  addDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { auth, db } from "./firebase-config.js";
import { GerenciadorOperadores } from "./operadores.js";

const ROOT_COLLECTION = "multitech_empresas";

const PLANOS_CATALOGO = [
  {
    id: "basic",
    nome: "Basic",
    preco: "R$ 39,90",
    limiteOperadores: 2,
    descricao: "Operação essencial para início de atendimento e registro de clientes."
  },
  {
    id: "standard",
    nome: "Standard",
    preco: "R$ 59,90",
    limiteOperadores: 5,
    descricao: "Gestão do dia a dia com serviços, financeiro e formação de equipes."
  },
  {
    id: "advanced",
    nome: "Advanced",
    preco: "R$ 89,90",
    limiteOperadores: 12,
    descricao: "Controle ampliado com mais operadores, equipes e visão financeira."
  },
  {
    id: "premium",
    nome: "Premium",
    preco: "R$ 129,90",
    limiteOperadores: 99,
    descricao: "Capacidade máxima de operadores, equipes e recursos sem travas."
  }
];

function limiteOperadoresDoPlano(planoId) {
  const encontrado = PLANOS_CATALOGO.find((p) => p.id === String(planoId || "").toLowerCase());
  return encontrado ? encontrado.limiteOperadores : 99;
}

const authScreenEl = document.getElementById("mt-auth-screen");
const appShellEl = document.getElementById("mt-app-shell");
const tabLoginEl = document.getElementById("mt-tab-login");
const tabRegisterEl = document.getElementById("mt-tab-register");
const formLoginEl = document.getElementById("mt-form-login");
const formRegisterEl = document.getElementById("mt-form-register");
const authErroEl = document.getElementById("mt-auth-erro");

const empresaNomeEl = document.getElementById("mt-empresa-nome");
const empresaEmailEl = document.getElementById("mt-empresa-email");
const planoBadgeEl = document.getElementById("mt-plano-atual-badge");
const btnSairEl = document.getElementById("mt-btn-sair");
const btnMenuEl = document.getElementById("mt-btn-menu");
const sidebarEl = document.getElementById("mt-sidebar");
const btnInstalarEl = document.getElementById("mt-btn-instalar");
const btnAtualizarEl = document.getElementById("mt-btn-atualizar-dados");

const kpiClientesEl = document.getElementById("kpi-clientes");
const kpiServicosEl = document.getElementById("kpi-servicos");
const kpiReceitasEl = document.getElementById("kpi-receitas");
const kpiSaldoEl = document.getElementById("kpi-saldo");

const dashGraficoEl = document.getElementById("mt-dash-grafico");
const finGraficoEl = document.getElementById("mt-fin-grafico");

const formClienteEl = document.getElementById("mt-form-cliente");
const listaClientesEl = document.getElementById("mt-lista-clientes");

const formServicoEl = document.getElementById("mt-form-servico");
const listaServicosEl = document.getElementById("mt-lista-servicos");

const formLancamentoEl = document.getElementById("mt-form-lancamento");
const listaFinanceiroEl = document.getElementById("mt-lista-financeiro");

const formMontarEquipeEl = document.getElementById("mt-form-montar-equipe");
const listaEquipesEl = document.getElementById("mt-lista-equipes");
const gridPlanosEl = document.getElementById("mt-grid-planos");

let currentUser = null;
let planoAtualId = "standard";
let gerenciadorOperadores = null;
let deferredInstallPrompt = null;

function esc(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatarMoeda(valor) {
  const num = Number(valor) || 0;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function alternarAbaAuth(modo) {
  const isLogin = modo === "login";
  tabLoginEl?.classList.toggle("active", isLogin);
  tabRegisterEl?.classList.toggle("active", !isLogin);
  formLoginEl?.classList.toggle("hidden", !isLogin);
  formRegisterEl?.classList.toggle("hidden", isLogin);
  if (authErroEl) authErroEl.textContent = "";
}

function alternarView(viewName) {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });
  document.querySelectorAll(".view-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `view-${viewName}`);
  });
  sidebarEl?.classList.remove("open");
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  btnInstalarEl?.classList.remove("hidden");
});

btnInstalarEl?.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  btnInstalarEl.classList.add("hidden");
});

tabLoginEl?.addEventListener("click", () => alternarAbaAuth("login"));
tabRegisterEl?.addEventListener("click", () => alternarAbaAuth("register"));
btnMenuEl?.addEventListener("click", () => sidebarEl?.classList.toggle("open"));

document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => alternarView(btn.dataset.view));
});

formLoginEl?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (authErroEl) authErroEl.textContent = "";
  const email = document.getElementById("mt-login-email")?.value.trim() || "";
  const senha = document.getElementById("mt-login-senha")?.value || "";
  try {
    await signInWithEmailAndPassword(auth, email, senha);
  } catch (err) {
    if (authErroEl) authErroEl.textContent = `Falha ao entrar: ${err.message}`;
  }
});

formRegisterEl?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (authErroEl) authErroEl.textContent = "";
  const nomeEmpresa = document.getElementById("mt-reg-empresa")?.value.trim() || "Minha Empresa";
  const email = document.getElementById("mt-reg-email")?.value.trim() || "";
  const senha = document.getElementById("mt-reg-senha")?.value || "";
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, senha);
    await setDoc(
      doc(db, ROOT_COLLECTION, cred.user.uid),
      {
        nomeEmpresa,
        email,
        planoId: "standard",
        atualizadoEm: new Date().toISOString()
      },
      { merge: true }
    );
  } catch (err) {
    if (authErroEl) authErroEl.textContent = `Falha ao criar conta: ${err.message}`;
  }
});

btnSairEl?.addEventListener("click", async () => {
  gerenciadorOperadores?.limparSessaoOperador();
  await signOut(auth);
});

btnAtualizarEl?.addEventListener("click", async () => {
  if (currentUser) {
    await carregarTodosDados(currentUser.uid);
  }
});

function renderGraficoFinanceiro(receitas, saidas) {
  const saldo = receitas - saidas;
  const maxVal = Math.max(receitas, saidas, Math.abs(saldo), 1);
  const pctEntrada = Math.min(100, Math.round((receitas / maxVal) * 100));
  const pctSaida = Math.min(100, Math.round((saidas / maxVal) * 100));
  const pctSaldo = Math.min(100, Math.round((Math.max(0, saldo) / maxVal) * 100));

  const html = `
    <div class="chart-bars">
      <div class="chart-row">
        <span>Entradas</span>
        <div class="chart-track"><div class="chart-fill entrada" style="width:${pctEntrada}%"></div></div>
        <strong>${formatarMoeda(receitas)}</strong>
      </div>
      <div class="chart-row">
        <span>Saídas</span>
        <div class="chart-track
