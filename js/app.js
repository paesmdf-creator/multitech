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
  addDoc,
  deleteDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  PLANOS_MULTITECH,
  PERFIS_INTERNOS,
  obterPlano,
  obterPerfisPermitidosNoPlano,
  podeUsarModulo,
  limiteOperadoresDoPlano
} from "./planos-permissoes.js";

import { GerenciadorOperadores } from "./operadores.js";
import { renderizarVitrinePlanos } from "./vitrine-planos.js";

const ROOT_COLLECTION = "multitech_empresas";

const authScreen = document.getElementById("auth-screen");
const appShell = document.getElementById("app-shell");
const authForm = document.getElementById("auth-form");
const authError = document.getElementById("auth-error");
const authSubmitBtn = document.getElementById("auth-submit-btn");

const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");
const tabPlansPublic = document.getElementById("tab-plans-public");
const publicPlansView = document.getElementById("public-plans-view");
const campoNomeEmpresa = document.getElementById("campo-nome-empresa");
const campoPlanoInicial = document.getElementById("campo-plano-inicial");

const empresaNomeSidebar = document.getElementById("empresa-nome-sidebar");
const empresaPlanoSidebar = document.getElementById("empresa-plano-sidebar");
const pageTitle = document.getElementById("page-title");
const sidebar = document.getElementById("sidebar");
const btnToggleMenu = document.getElementById("btn-toggle-menu");
const btnLogoutEmpresa = document.getElementById("btn-logout-empresa");

let modoAuth = "login";
let empresaAtualId = null;
let dadosEmpresa = null;
let gerenciadorOp = null;

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function escaparTexto(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function empresaDocRef(uid) {
  return doc(db, ROOT_COLLECTION, uid);
}

function subColRef(uid, subnome) {
  return collection(db, ROOT_COLLECTION, uid, subnome);
}

function configurarAbasAuth(modo) {
  modoAuth = modo;
  authError.textContent = "";

  tabLogin.classList.toggle("active", modo === "login");
  tabRegister.classList.toggle("active", modo === "register");
  tabPlansPublic.classList.toggle("active", modo === "plans");

  const mostrarPlanosPublicos = modo === "plans";
  publicPlansView.classList.toggle("hidden", !mostrarPlanosPublicos);
  authForm.classList.toggle("hidden", mostrarPlanosPublicos);

  if (!mostrarPlanosPublicos) {
    const ehCadastro = modo === "register";
    campoNomeEmpresa.classList.toggle("hidden", !ehCadastro);
    campoPlanoInicial.classList.toggle("hidden", !ehCadastro);
    document.getElementById("auth-empresa").required = ehCadastro;
    authSubmitBtn.textContent = ehCadastro ? "Criar Conta da Empresa" : "Acessar Sistema";
  } else {
    renderizarVitrinePlanos({
      containerId: "vitrine-planos-publica",
      planoAtivoId: null,
      modoPublico: true,
      onSelecionarPlano: (planoId) => {
        document.getElementById("auth-plano").value = planoId;
        configurarAbasAuth("register");
      }
    });
  }
}

tabLogin.addEventListener("click", () => configurarAbasAuth("login"));
tabRegister.addEventListener("click", () => configurarAbasAuth("register"));
tabPlansPublic.addEventListener("click", () => configurarAbasAuth("plans"));

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";
  authSubmitBtn.disabled = true;

  const email = document.getElementById("auth-email").value.trim();
  const senha = document.getElementById("auth-password").value;

  try {
    if (modoAuth === "register") {
      const nomeEmpresa = document.getElementById("auth-empresa").value.trim();
      const planoId = document.getElementById("auth-plano").value;

      const cred = await createUserWithEmailAndPassword(auth, email, senha);
      await setDoc(empresaDocRef(cred.user.uid), {
        sistema: "multitech",
        nomeEmpresa,
        email,
        planoId,
        corPrimaria: "#0f172a",
        telefone: "",
        cidade: "",
        slogan: "",
        destaque: "",
        criadoEm: new Date().toISOString()
      });
    } else {
      await signInWithEmailAndPassword(auth, email, senha);
    }
  } catch (err) {
    authError.textContent = "Falha na autenticação: " + (err?.message || "verifique e-mail e senha.");
  } finally {
    authSubmitBtn.disabled = false;
  }
});

btnLogoutEmpresa.addEventListener("click", async () => {
  if (gerenciadorOp) {
    gerenciadorOp.limparSessaoOperador();
  }
  await signOut(auth);
});

btnToggleMenu.addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    const view = btn.dataset.view;
    const modulo = btn.dataset.modulo;

    if (modulo && !podeUsarModulo(dadosEmpresa?.planoId, modulo)) {
      alert("Este recurso não está incluído no plano atual da empresa. Veja a aba Planos.");
      return;
    }

    ativarView(view, btn);
    sidebar.classList.remove("open");
  });
});

function ativarView(viewName, botaoAtivo = null) {
  document.querySelectorAll(".view-section").forEach((sec) => {
    sec.classList.add("hidden");
    sec.classList.remove("active");
  });

  const alvo = document.getElementById(`view-${viewName}`);
  if (alvo) {
    alvo.classList.remove("hidden");
    alvo.classList.add("active");
  }

  document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
  if (botaoAtivo) {
    botaoAtivo.classList.add("active");
  } else {
    const btnCorrespondente = document.querySelector(`.nav-item[data-view="${viewName}"]`);
    if (btnCorrespondente) btnCorrespondente.classList.add("active");
  }

  const titulos = {
    dashboard: "Dashboard",
    clientes: "Clientes",
    servicos: "Serviços",
    agenda: "Agenda",
    portfolio: "Portfólio & Página",
    financeiro: "Financeiro",
    relatorios: "Relatórios",
    equipe: "Equipe e Perfis",
    planos: "Planos",
    configuracoes: "Configurações"
  };
  pageTitle.textContent = titulos[viewName] || "Multitech";
}

function aplicarPermissoesNaInterface() {
  const planoId = dadosEmpresa?.planoId || "starter";
  const plano = obterPlano(planoId);

  empresaNomeSidebar.textContent = dadosEmpresa?.nomeEmpresa || "Multitech";
  empresaPlanoSidebar.textContent = `Plano ${plano.nome}`;

  if (dadosEmpresa?.corPrimaria) {
    document.documentElement.style.setProperty("--primary", dadosEmpresa.corPrimaria);
  }

  document.querySelectorAll("[data-modulo]").forEach((el) => {
    if (el.classList.contains("nav-item")) return;
    const mod = el.dataset.modulo;
    const permitido = podeUsarModulo(planoId, mod);
    el.classList.toggle("hidden", !permitido);
  });

  const linkAgendamento = document.getElementById("link-agendamento-online");
  if (linkAgendamento && empresaAtualId) {
    linkAgendamento.textContent = `${window.location.origin}${window.location.pathname}?empresa=${empresaAtualId}`;
  }

  renderizarGuiaPerfis();
  renderizarVitrinePlanos({
    containerId: "vitrine-planos-logada",
    planoAtivoId: planoId,
    modoPublico: false,
    onSelecionarPlano: async (novoPlanoId) => {
      if (!empresaAtualId) return;
      await updateDoc(empresaDocRef(empresaAtualId), { planoId: novoPlanoId });
      dadosEmpresa.planoId = novoPlanoId;
      aplicarPermissoesNaInterface();
      if (gerenciadorOp) {
        await gerenciadorOp.atualizarPlano(novoPlanoId);
      }
      alert(`Plano atualizado para ${obterPlano(novoPlanoId).nome}.`);
    }
  });
}

function renderizarGuiaPerfis() {
  const container = document.getElementById("guia-perfis-internos");
  if (!container) return;

  const permitidos = obterPerfisPermitidosNoPlano(dadosEmpresa?.planoId || "starter");
  container.innerHTML = Object.entries(PERFIS_INTERNOS)
    .map(([chave, info]) => {
      const liberado = permitidos.includes(chave);
      return `
        <div class="mini-card">
          <strong>${escaparTexto(info.nome)}</strong>
          <div class="muted-text">${liberado ? "Disponível no plano" : "Disponível em planos superiores"}</div>
          <p style="margin:8px 0 0;font-size:13px;">${escaparTexto(info.descricao || "")}</p>
        </div>
      `;
    })
    .join("");
}

async function carregarTodosDados() {
  if (!empresaAtualId) return;

  const [clientesSnap, servicosSnap, agendaSnap, portfolioSnap, financeiroSnap] = await Promise.all([
    getDocs(query(subColRef(empresaAtualId, "clientes"), orderBy("criadoEm", "desc"))).catch(() => getDocs(subColRef(empresaAtualId, "clientes"))),
    getDocs(subColRef(empresaAtualId, "servicos")),
    getDocs(subColRef(empresaAtualId, "agenda")),
    getDocs(subColRef(empresaAtualId, "portfolio")),
    getDocs(subColRef(empresaAtualId, "financeiro"))
  ]);

  const clientes = clientesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const servicos = servicosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const agenda = agendaSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const portfolio = portfolioSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const financeiro = financeiroSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const entradas = financeiro
    .filter((item) => item.tipo === "entrada")
    .reduce((acc, item) => acc + Number(item.valor || 0), 0);
  const saidas = financeiro
    .filter((item) => item.tipo === "saida")
    .reduce((acc, item) => acc + Number(item.valor || 0), 0);
  const saldo = entradas - saidas;

  document.getElementById("kpi-clientes").textContent = String(clientes.length);
  document.getElementById("kpi-agenda").textContent = String(agenda.length);
  document.getElementById("kpi-entradas").textContent = formatarMoeda(entradas);
  document.getElementById("kpi-saldo").textContent = formatarMoeda(saldo);

  const ultimosBox = document.getElementById("dashboard-ultimos-atendimentos");
  if (ultimosBox) {
    ultimosBox.innerHTML = agenda.length
      ? `<ul>${agenda
          .slice(0, 5)
          .map((a) => `<li><strong>${escaparTexto(a.cliente)}</strong> — ${escaparTexto(a.servico)} (${escaparTexto(a.status)})</li>`)
          .join("")}</ul>`
      : `<p class="muted-text">Nenhum atendimento registrado ainda.</p>`;
  }

  document.getElementById("lista-clientes").innerHTML = clientes.length
    ? `<table><thead><tr><th>Nome</th><th>Telefone</th><th>E-mail</th><th>Observações</th><th>Ação</th></tr></thead><tbody>${clientes
        .map(
          (c) => `<tr>
            <td>${escaparTexto(c.nome)}</td>
            <td>${escaparTexto(c.telefone)}</td>
            <td>${escaparTexto(c.email || "-")}</td>
            <td>${escaparTexto(c.observacoes || "-")}</td>
            <td><button type="button" class="btn btn-outline btn-sm" data-del-col="clientes" data-id="${c.id}">Excluir</button></td>
          </tr>`
        )
        .join("")}</tbody></table>`
    : `<p class="muted-text">Nenhum cliente cadastrado.</p>`;

  document.getElementById("lista-servicos").innerHTML = servicos.length
    ? `<table><thead><tr><th>Serviço</th><th>Valor</th><th>Duração</th><th>Descrição</th><th>Ação</th></tr></thead><tbody>${servicos
        .map(
          (s) => `<tr>
            <td>${escaparTexto(s.nome)}</td>
            <td>${formatarMoeda(s.preco)}</td>
            <td>${escaparTexto(s.duracao || 60)} min</td>
            <td>${escaparTexto(s.descricao || "-")}</td>
            <td><button type="button" class="btn btn-outline btn-sm" data-del-col="servicos" data-id="${s.id}">Excluir</button></td>
          </tr>`
        )
        .join("")}</tbody></table>`
    : `<p class="muted-text">Nenhum serviço cadastrado.</p>`;

  document.getElementById("lista-agenda").innerHTML = agenda.length
    ? `<table><thead><tr><th>Cliente</th><th>Serviço</th><th>Data/Hora</th><th>Profissional</th><th>Status</th><th>Ação</th></tr></thead><tbody>${agenda
        .map(
          (a) => `<tr>
            <td>${escaparTexto(a.cliente)}</td>
            <td>${escaparTexto(a.servico)}</td>
            <td>${escaparTexto(a.data || "-")}</td>
            <td>${escaparTexto(a.profissional || "-")}</td>
            <td>${escaparTexto(a.status || "Agendado")}</td>
            <td><button type="button" class="btn btn-outline btn-sm" data-del-col="agenda" data-id="${a.id}">Excluir</button></td>
          </tr>`
        )
        .join("")}</tbody></table>`
    : `<p class="muted-text">Nenhum agendamento cadastrado.</p>`;

  document.getElementById("lista-portfolio").innerHTML = portfolio.length
    ? portfolio
        .map(
          (p) => `<div class="mini-card">
            <strong>${escaparTexto(p.titulo)}</strong>
            <div class="muted-text">${escaparTexto(p.categoria)}</div>
            <p style="margin:8px 0 0;font-size:13px;">${escaparTexto(p.descricao || "")}</p>
          </div>`
        )
        .join("")
    : `<p class="muted-text">Nenhum item publicado no portfólio.</p>`;

  document.getElementById("lista-financeiro").innerHTML = financeiro.length
    ? `<table><thead><tr><th>Tipo</th><th>Descrição</th><th>Valor</th><th>Data</th><th>Ação</th></tr></thead><tbody>${financeiro
        .map(
          (f) => `<tr>
            <td>${f.tipo === "entrada" ? "Entrada" : "Saída"}</td>
            <td>${escaparTexto(f.descricao)}</td>
            <td>${formatarMoeda(f.valor)}</td>
            <td>${escaparTexto(f.data || "-")}</td>
            <td><button type="button" class="btn btn-outline btn-sm" data-del-col="financeiro" data-id="${f.id}">Excluir</button></td>
          </tr>`
        )
        .join("")}</tbody></table>`
    : `<p class="muted-text">Nenhum lançamento financeiro.</p>`;

  const fluxoBox = document.getElementById("resumo-fluxo-caixa");
  if (fluxoBox) {
    fluxoBox.innerHTML = `
      <div class="kpi-card"><span>Receitas</span><strong>${formatarMoeda(entradas)}</strong></div>
      <div class="kpi-card"><span>Despesas</span><strong>${formatarMoeda(saidas)}</strong></div>
      <div class="kpi-card"><span>Saldo Líquido</span><strong>${formatarMoeda(saldo)}</strong></div>
    `;
  }

  document.getElementById("relatorio-financeiro-box").innerHTML =
    `<p>Total de entradas: <strong>${formatarMoeda(entradas)}</strong> | Total de saídas: <strong>${formatarMoeda(saidas)}</strong> | Saldo: <strong>${formatarMoeda(saldo)}</strong></p>`;
  document.getElementById("relatorio-desempenho-box").innerHTML =
    `<p>Clientes ativos: <strong>${clientes.length}</strong> | Serviços cadastrados: <strong>${servicos.length}</strong> | Atendimentos na agenda: <strong>${agenda.length}</strong></p>`;
  document.getElementById("relatorio-comparativo-box").innerHTML =
    `<p>Ticket médio por lançamento de entrada: <strong>${formatarMoeda(
      financeiro.filter((f) => f.tipo === "entrada").length
        ? entradas / financeiro.filter((f) => f.tipo === "entrada").length
        : 0
    )}</strong></p>`;
}

document.getElementById("form-cliente").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!empresaAtualId) return;
  await addDoc(subColRef(empresaAtualId, "clientes"), {
    nome: document.getElementById("cliente-nome").value.trim(),
    telefone: document.getElementById("cliente-telefone").value.trim(),
    email: document.getElementById("cliente-email").value.trim(),
    observacoes: document.getElementById("cliente-observacoes").value.trim(),
    criadoEm: new Date().toISOString()
  });
  e.target.reset();
  await carregarTodosDados();
});

document.getElementById("form-servico").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!empresaAtualId) return;
  await addDoc(subColRef(empresaAtualId, "servicos"), {
    nome: document.getElementById("servico-nome").value.trim(),
    preco: Number(document.getElementById("servico-preco").value || 0),
    duracao: Number(document.getElementById("servico-duracao").value || 60),
    descricao: document.getElementById("servico-descricao").value.trim(),
    criadoEm: new Date().toISOString()
  });
  e.target.reset();
  await carregarTodosDados();
});

document.getElementById("form-agenda").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!empresaAtualId) return;
  await addDoc(subColRef(empresaAtualId, "agenda"), {
    cliente: document.getElementById("agenda-cliente").value.trim(),
    servico: document.getElementById("agenda-servico").value.trim(),
    data: document.getElementById("agenda-data").value,
    profissional: document.getElementById("agenda-profissional").value.trim(),
    status: document.getElementById("agenda-status").value,
    criadoEm: new Date().toISOString()
  });
  e.target.reset();
  await carregarTodosDados();
});

document.getElementById("form-portfolio").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!empresaAtualId) return;
  await addDoc(subColRef(empresaAtualId, "portfolio"), {
    titulo: document.getElementById("portfolio-titulo").value.trim(),
    categoria: document.getElementById("portfolio-categoria").value.trim(),
    imagem: document.getElementById("portfolio-imagem").value.trim(),
    descricao: document.getElementById("portfolio-descricao").value.trim(),
    criadoEm: new Date().toISOString()
  });
  e.target.reset();
  await carregarTodosDados();
});

document.getElementById("btn-salvar-pagina").addEventListener("click", async () => {
  if (!empresaAtualId) return;
  const slogan = document.getElementById("pagina-slogan").value.trim();
  const destaque = document.getElementById("pagina-destaque").value.trim();
  await updateDoc(empresaDocRef(empresaAtualId), { slogan, destaque });
  dadosEmpresa = { ...dadosEmpresa, slogan, destaque };
  alert("Página comercial salva.");
});

document.getElementById("form-financeiro").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!empresaAtualId) return;
  await addDoc(subColRef(empresaAtualId, "financeiro"), {
    tipo: document.getElementById("fin-tipo").value,
    descricao: document.getElementById("fin-descricao").value.trim(),
    valor: Number(document.getElementById("fin-valor").value || 0),
    data: document.getElementById("fin-data").value,
    criadoEm: new Date().toISOString()
  });
  e.target.reset();
  await carregarTodosDados();
});

document.getElementById("form-config-empresa").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!empresaAtualId) return;
  const nomeEmpresa = document.getElementById("cfg-nome-empresa").value.trim();
  const corPrimaria = document.getElementById("cfg-cor-primaria").value;
  const telefone = document.getElementById("cfg-telefone").value.trim();
  const cidade = document.getElementById("cfg-cidade").value.trim();

  await updateDoc(empresaDocRef(empresaAtualId), {
    nomeEmpresa,
    corPrimaria,
    telefone,
    cidade
  });

  dadosEmpresa = { ...dadosEmpresa, nomeEmpresa, corPrimaria, telefone, cidade };
  aplicarPermissoesNaInterface();
  document.getElementById("cfg-msg").textContent = "Configurações salvas com sucesso.";
});

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-del-col][data-id]");
  if (!btn || !empresaAtualId) return;
  const col = btn.dataset.delCol;
  const id = btn.dataset.id;
  await deleteDoc(doc(db, ROOT_COLLECTION, empresaAtualId, col, id));
  await carregarTodosDados();
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    empresaAtualId = null;
    dadosEmpresa = null;
    appShell.classList.add("hidden");
    authScreen.classList.remove("hidden");
    configurarAbasAuth("login");
    return;
  }

  empresaAtualId = user.uid;
  const snap = await getDoc(empresaDocRef(user.uid));

  if (snap.exists()) {
    dadosEmpresa = { planoId: "starter", ...snap.data() };
  } else {
    dadosEmpresa = {
      sistema: "multitech",
      nomeEmpresa: user.email?.split("@")[0] || "Empresa Multitech",
      email: user.email || "",
      planoId: "starter",
      corPrimaria: "#0f172a",
      telefone: "",
      cidade: "",
      slogan: "",
      destaque: ""
    };
    await setDoc(empresaDocRef(user.uid), dadosEmpresa);
  }

  document.getElementById("cfg-nome-empresa").value = dadosEmpresa.nomeEmpresa || "";
  document.getElementById("cfg-cor-primaria").value = dadosEmpresa.corPrimaria || "#0f172a";
  document.getElementById("cfg-telefone").value = dadosEmpresa.telefone || "";
  document.getElementById("cfg-cidade").value = dadosEmpresa.cidade || "";
  document.getElementById("pagina-slogan").value = dadosEmpresa.slogan || "";
  document.getElementById("pagina-destaque").value = dadosEmpresa.destaque || "";

  authScreen.classList.add("hidden");
  appShell.classList.remove("hidden");
  ativarView("dashboard");
  aplicarPermissoesNaInterface();

  gerenciadorOp = new GerenciadorOperadores({
    db,
    empresaId: user.uid,
    planoId: dadosEmpresa.planoId,
    limiteOperadores: limiteOperadoresDoPlano(dadosEmpresa.planoId)
  });
  await gerenciadorOp.iniciar();
  await carregarTodosDados();
});
