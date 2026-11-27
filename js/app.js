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

const authScreenEl = document.getElementById("mt-auth-screen");
const appShellEl = document.getElementById("mt-app-shell");
const tabLoginEl = document.getElementById("mt-tab-login");
const tabRegisterEl = document.getElementById("mt-tab-register");
const formLoginEl = document.getElementById("mt-form-login");
const formRegisterEl = document.getElementById("mt-form-register");
const authErroEl = document.getElementById("mt-auth-erro");

const empresaNomeEl = document.getElementById("mt-empresa-nome");
const empresaEmailEl = document.getElementById("mt-empresa-email");
const btnSairEl = document.getElementById("mt-btn-sair");
const btnMenuEl = document.getElementById("mt-btn-menu");
const sidebarEl = document.getElementById("mt-sidebar");
const btnInstalarEl = document.getElementById("mt-btn-instalar");
const btnAtualizarEl = document.getElementById("mt-btn-atualizar-dados");

const kpiClientesEl = document.getElementById("kpi-clientes");
const kpiServicosEl = document.getElementById("kpi-servicos");
const kpiReceitasEl = document.getElementById("kpi-receitas");
const kpiSaldoEl = document.getElementById("kpi-saldo");

const formClienteEl = document.getElementById("mt-form-cliente");
const listaClientesEl = document.getElementById("mt-lista-clientes");

const formServicoEl = document.getElementById("mt-form-servico");
const listaServicosEl = document.getElementById("mt-lista-servicos");

const formLancamentoEl = document.getElementById("mt-form-lancamento");
const listaFinanceiroEl = document.getElementById("mt-lista-financeiro");

let currentUser = null;
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
        planoId: "enterprise",
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

async function garantirDocumentoEmpresa(user) {
  const ref = doc(db, ROOT_COLLECTION, user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const payload = {
      nomeEmpresa: "Multitech Empresa",
      email: user.email || "",
      planoId: "enterprise",
      criadoEm: new Date().toISOString()
    };
    await setDoc(ref, payload, { merge: true });
    return payload;
  }
  const data = snap.data();
  if (!data.planoId) {
    await setDoc(ref, { planoId: "enterprise" }, { merge: true });
    data.planoId = "enterprise";
  }
  return data;
}

async function listarSubcolecao(empresaId, sub) {
  const snap = await getDocs(collection(db, ROOT_COLLECTION, empresaId, sub));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function renderClientes(empresaId, itens) {
  if (!listaClientesEl) return;
  if (!itens.length) {
    listaClientesEl.innerHTML = `<p class="muted-text">Nenhum cliente cadastrado ainda.</p>`;
    return;
  }
  listaClientesEl.innerHTML = `<table><thead><tr><th>Nome</th><th>Telefone</th><th>Observação</th><th>Ação</th></tr></thead><tbody>${itens
    .map(
      (item) => `<tr>
        <td>${esc(item.nome)}</td>
        <td>${esc(item.telefone)}</td>
        <td>${esc(item.obs)}</td>
        <td><button type="button" class="btn btn-outline btn-sm" data-del-col="clientes" data-del-id="${esc(item.id)}">Excluir</button></td>
      </tr>`
    )
    .join("")}</tbody></table>`;
}

function renderServicos(empresaId, itens) {
  if (!listaServicosEl) return;
  if (!itens.length) {
    listaServicosEl.innerHTML = `<p class="muted-text">Nenhum serviço ou pedido registrado.</p>`;
    return;
  }
  listaServicosEl.innerHTML = `<table><thead><tr><th>Serviço</th><th>Cliente</th><th>Valor</th><th>Status</th><th>Ação</th></tr></thead><tbody>${itens
    .map(
      (item) => `<tr>
        <td>${esc(item.titulo)}</td>
        <td>${esc(item.cliente)}</td>
        <td>${formatarMoeda(item.valor)}</td>
        <td>${esc(item.status)}</td>
        <td><button type="button" class="btn btn-outline btn-sm" data-del-col="servicos" data-del-id="${esc(item.id)}">Excluir</button></td>
      </tr>`
    )
    .join("")}</tbody></table>`;
}

function renderFinanceiro(empresaId, itens) {
  if (!listaFinanceiroEl) return;
  if (!itens.length) {
    listaFinanceiroEl.innerHTML = `<p class="muted-text">Nenhum lançamento financeiro registrado.</p>`;
    return;
  }
  listaFinanceiroEl.innerHTML = `<table><thead><tr><th>Descrição</th><th>Tipo</th><th>Valor</th><th>Ação</th></tr></thead><tbody>${itens
    .map(
      (item) => `<tr>
        <td>${esc(item.descricao)}</td>
        <td>${item.tipo === "saida" ? "Saída" : "Entrada"}</td>
        <td>${formatarMoeda(item.valor)}</td>
        <td><button type="button" class="btn btn-outline btn-sm" data-del-col="financeiro" data-del-id="${esc(item.id)}">Excluir</button></td>
      </tr>`
    )
    .join("")}</tbody></table>`;
}

async function carregarTodosDados(empresaId) {
  const [clientes, servicos, financeiro] = await Promise.all([
    listarSubcolecao(empresaId, "clientes"),
    listarSubcolecao(empresaId, "servicos"),
    listarSubcolecao(empresaId, "financeiro")
  ]);

  const receitas = financeiro
    .filter((i) => i.tipo !== "saida")
    .reduce((acc, i) => acc + (Number(i.valor) || 0), 0);

  const saidas = financeiro
    .filter((i) => i.tipo === "saida")
    .reduce((acc, i) => acc + (Number(i.valor) || 0), 0);

  if (kpiClientesEl) kpiClientesEl.textContent = String(clientes.length);
  if (kpiServicosEl) kpiServicosEl.textContent = String(servicos.length);
  if (kpiReceitasEl) kpiReceitasEl.textContent = formatarMoeda(receitas);
  if (kpiSaldoEl) kpiSaldoEl.textContent = formatarMoeda(receitas - saidas);

  renderClientes(empresaId, clientes);
  renderServicos(empresaId, servicos);
  renderFinanceiro(empresaId, financeiro);
}

formClienteEl?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;
  const nome = document.getElementById("mt-cli-nome")?.value.trim() || "";
  const telefone = document.getElementById("mt-cli-telefone")?.value.trim() || "";
  const obs = document.getElementById("mt-cli-obs")?.value.trim() || "";
  if (!nome) return;
  await addDoc(collection(db, ROOT_COLLECTION, currentUser.uid, "clientes"), {
    nome,
    telefone,
    obs,
    criadoEm: new Date().toISOString()
  });
  formClienteEl.reset();
  await carregarTodosDados(currentUser.uid);
});

formServicoEl?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;
  const titulo = document.getElementById("mt-srv-titulo")?.value.trim() || "";
  const cliente = document.getElementById("mt-srv-cliente")?.value.trim() || "";
  const valor = Number(document.getElementById("mt-srv-valor")?.value || 0);
  const status = document.getElementById("mt-srv-status")?.value || "Em andamento";
  if (!titulo) return;
  await addDoc(collection(db, ROOT_COLLECTION, currentUser.uid, "servicos"), {
    titulo,
    cliente,
    valor,
    status,
    criadoEm: new Date().toISOString()
  });
  formServicoEl.reset();
  await carregarTodosDados(currentUser.uid);
});

formLancamentoEl?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;
  const descricao = document.getElementById("mt-fin-desc")?.value.trim() || "";
  const tipo = document.getElementById("mt-fin-tipo")?.value || "entrada";
  const valor = Number(document.getElementById("mt-fin-valor")?.value || 0);
  if (!descricao || valor <= 0) return;
  await addDoc(collection(db, ROOT_COLLECTION, currentUser.uid, "financeiro"), {
    descricao,
    tipo,
    valor,
    criadoEm: new Date().toISOString()
  });
  formLancamentoEl.reset();
  await carregarTodosDados(currentUser.uid);
});

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-del-col][data-del-id]");
  if (!btn || !currentUser) return;
  const col = btn.dataset.delCol;
  const id = btn.dataset.delId;
  await deleteDoc(doc(db, ROOT_COLLECTION, currentUser.uid, col, id));
  await carregarTodosDados(currentUser.uid);
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (!user) {
    appShellEl?.classList.add("hidden");
    authScreenEl?.classList.remove("hidden");
    return;
  }

  authScreenEl?.classList.add("hidden");
  appShellEl?.classList.remove("hidden");

  const empresaData = await garantirDocumentoEmpresa(user);
  if (empresaNomeEl) empresaNomeEl.textContent = empresaData.nomeEmpresa || "Multitech";
  if (empresaEmailEl) empresaEmailEl.textContent = user.email || "";

  gerenciadorOperadores = new GerenciadorOperadores({
    db,
    empresaId: user.uid,
    planoId: empresaData.planoId || "enterprise"
  });
  await gerenciadorOperadores.iniciar();
  await carregarTodosDados(user.uid);
});
