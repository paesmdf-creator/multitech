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

const ROOT_COLLECTION = "multitech_empresas";
const DEMO_EMPRESA_ID = "admin_geral_multitech";
const STORAGE_EMPRESA_KEY = "multitech_nome_empresa_custom";
const STORAGE_DIVULGACAO_KEY = "multitech_divulgacao_v1";

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
const operadorBadgeEl = document.getElementById("mt-operador-atual-badge");
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
let activeEmpresaId = DEMO_EMPRESA_ID;
let planoAtualId = "standard";
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

function obterNomeEmpresaSalvo() {
  try {
    return (localStorage.getItem(STORAGE_EMPRESA_KEY) || "").trim();
  } catch (_) {
    return "";
  }
}

function getNomeEmpresaAtual() {
  return obterNomeEmpresaSalvo() || empresaNomeEl?.textContent?.trim() || "Multitech";
}

function aplicarNomeEmpresaNaTela(nomePadrao) {
  if (!empresaNomeEl) return;
  const salvo = obterNomeEmpresaSalvo();
  empresaNomeEl.textContent = salvo || nomePadrao || "Multitech";
}

function garantirBotaoEditarEmpresa() {
  if (!empresaNomeEl || document.getElementById("mt-btn-editar-empresa")) return;

  const btnEditar = document.createElement("button");
  btnEditar.id = "mt-btn-editar-empresa";
  btnEditar.type = "button";
  btnEditar.textContent = "Editar nome";
  btnEditar.className = "btn btn-outline btn-sm";

  btnEditar.addEventListener("click", async () => {
    const atual = empresaNomeEl.textContent?.trim() || "Multitech";
    const novoNome = window.prompt("Digite o nome da empresa do cliente:", atual);
    if (!novoNome) return;

    const limpo = novoNome.trim();
    if (!limpo) return;

    empresaNomeEl.textContent = limpo;
    try {
      localStorage.setItem(STORAGE_EMPRESA_KEY, limpo);
    } catch (_) {}

    await setDoc(
      doc(db, ROOT_COLLECTION, activeEmpresaId),
      { nomeEmpresa: limpo, atualizadoEm: new Date().toISOString() },
      { merge: true }
    ).catch(() => {});

    renderSecoesDivulgacao();
  });

  empresaNomeEl.insertAdjacentElement("afterend", btnEditar);
}

function carregarEstadoDivulgacao() {
  const padrao = {
    whatsappNumero: "",
    portfolioDescricao: "Atendimento profissional, serviços sob medida e suporte direto para clientes.",
    portfolioItens: [
      { id: "p1", titulo: "Atendimento & Orçamento", resumo: "Diagnóstico rápido e proposta clara para o cliente." },
      { id: "p2", titulo: "Execução & Acompanhamento", resumo: "Equipe organizada com acompanhamento de etapas e prazos." }
    ],
    galeriaItens: [
      {
        id: "g1",
        titulo: "Post Divulgação - Serviços",
        legenda: "Agende seu atendimento de forma rápida e confirme direto no WhatsApp.",
        imagemUrl: ""
      }
    ]
  };

  try {
    const raw = localStorage.getItem(STORAGE_DIVULGACAO_KEY);
    if (!raw) return padrao;
    const parsed = JSON.parse(raw);
    return {
      whatsappNumero: String(parsed.whatsappNumero || ""),
      portfolioDescricao: String(parsed.portfolioDescricao || padrao.portfolioDescricao),
      portfolioItens: Array.isArray(parsed.portfolioItens) && parsed.portfolioItens.length
        ? parsed.portfolioItens
        : padrao.portfolioItens,
      galeriaItens: Array.isArray(parsed.galeriaItens) && parsed.galeriaItens.length
        ? parsed.galeriaItens
        : padrao.galeriaItens
    };
  } catch (_) {
    return padrao;
  }
}

function salvarEstadoDivulgacao(estado) {
  try {
    localStorage.setItem(STORAGE_DIVULGACAO_KEY, JSON.stringify(estado));
  } catch (_) {}
}

function limparTelefoneWhatsApp(num) {
  const digits = String(num || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function garantirSecoesDivulgacao() {
  const navList = sidebarEl?.querySelector(".nav-list");
  const mainContent = document.querySelector(".main-content");
  if (!navList || !mainContent) return;

  const extras = [
    {
      view: "portfolio",
      label: "Portfólio Divulgação",
      titulo: "Portfólio para Divulgação",
      html: `
        <div class="card">
          <h3>Apresentação Pública da Empresa</h3>
          <div class="form-grid">
            <label class="field">
              <span>Resumo do Portfólio</span>
              <input type="text" id="mt-port-desc" placeholder="Descrição breve para divulgar" />
            </label>
            <div class="form-actions">
              <button type="button" id="mt-btn-salvar-port-desc" class="btn btn-primary">Salvar Descrição</button>
            </div>
          </div>
          <p class="muted-text" style="margin-top:10px;">
            Link direto desta página: <strong id="mt-link-divulgacao-atual"></strong>
          </p>
        </div>

        <form id="mt-form-portfolio-item" class="card form-grid">
          <label class="field">
            <span>Título do Destaque / Serviço</span>
            <input type="text" id="mt-port-item-titulo" required placeholder="Ex: Instalação e Manutenção" />
          </label>
          <label class="field">
            <span>Detalhes para o Cliente</span>
            <input type="text" id="mt-port-item-resumo" required placeholder="Ex: Atendimento agendado com confirmação" />
          </label>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Adicionar ao Portfólio</button>
          </div>
        </form>

        <div id="mt-lista-portfolio" class="card table-wrap"></div>
      `
    },
    {
      view: "agendamento-whatsapp",
      label: "Agendamento WhatsApp",
      titulo: "Acesso do Cliente — Agendamento via WhatsApp",
      html: `
        <div class="card">
          <h3>Número WhatsApp da Empresa para Confirmação</h3>
          <div class="form-grid">
            <label class="field">
              <span>WhatsApp com DDD (ex: 13999999999)</span>
              <input type="tel" id="mt-wa-numero" placeholder="13999999999" />
            </label>
            <div class="form-actions">
              <button type="button" id="mt-btn-salvar-wa" class="btn btn-primary">Salvar WhatsApp</button>
            </div>
          </div>
        </div>

        <form id="mt-form-agendamento-wa" class="card form-grid">
          <label class="field">
            <span>Nome do Cliente Final</span>
            <input type="text" id="mt-ag-cliente" required placeholder="Nome do cliente" />
          </label>
          <label class="field">
            <span>Serviço Desejado</span>
            <input type="text" id="mt-ag-servico" required placeholder="Ex: Avaliação / Orçamento" />
          </label>
          <label class="field">
            <span>Data e Horário Preferido</span>
            <input type="text" id="mt-ag-datahora" required placeholder="Ex: Amanhã às 14h" />
          </label>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Gerar e Confirmar no WhatsApp</button>
          </div>
        </form>

        <div id="mt-resultado-wa" class="card"></div>
      `
    },
    {
      view: "galeria-redes",
      label: "Galeria Redes Sociais",
      titulo: "Galeria de Imagens para Redes Sociais",
      html: `
        <form id="mt-form-galeria" class="card form-grid">
          <label class="field">
            <span>Título da Arte / Post</span>
            <input type="text" id="mt-gal-titulo" required placeholder="Ex: Promoção da Semana" />
          </label>
          <label class="field">
            <span>URL da Imagem (opcional)</span>
            <input type="url" id="mt-gal-url" placeholder="https://..." />
          </label>
          <label class="field">
            <span>Legenda Pronta para Copiar</span>
            <input type="text" id="mt-gal-legenda" required placeholder="Texto para Instagram, Facebook ou WhatsApp" />
          </label>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Adicionar à Galeria</button>
          </div>
        </form>

        <div id="mt-grid-galeria" class="plans-grid"></div>
      `
    }
  ];

  for (const item of extras) {
    if (!navList.querySelector(`[data-view="${item.view}"]`)) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "nav-item";
      btn.dataset.view = item.view;
      btn.textContent = item.label;
      btn.addEventListener("click", () => alternarView(item.view));
      li.appendChild(btn);
      navList.appendChild(li);
    }

    if (!document.getElementById(`view-${item.view}`)) {
      const sec = document.createElement("section");
      sec.id = `view-${item.view}`;
      sec.className = "view-panel";
      sec.innerHTML = `
        <div class="section-header">
          <h2>${esc(item.titulo)}</h2>
        </div>
        ${item.html}
      `;
      mainContent.appendChild(sec);
    }
  }

  document.getElementById("mt-btn-salvar-port-desc")?.addEventListener("click", () => {
    const estado = carregarEstadoDivulgacao();
    estado.portfolioDescricao =
      document.getElementById("mt-port-desc")?.value.trim() || estado.portfolioDescricao;
    salvarEstadoDivulgacao(estado);
    renderSecoesDivulgacao();
  });

  document.getElementById("mt-form-portfolio-item")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const titulo = document.getElementById("mt-port-item-titulo")?.value.trim() || "";
    const resumo = document.getElementById("mt-port-item-resumo")?.value.trim() || "";
    if (!titulo || !resumo) return;
    const estado = carregarEstadoDivulgacao();
    estado.portfolioItens.push({
      id: `p_${Date.now()}`,
      titulo,
      resumo
    });
    salvarEstadoDivulgacao(estado);
    e.target.reset();
    renderSecoesDivulgacao();
  });

  document.getElementById("mt-btn-salvar-wa")?.addEventListener("click", () => {
    const estado = carregarEstadoDivulgacao();
    estado.whatsappNumero = document.getElementById("mt-wa-numero")?.value.trim() || "";
    salvarEstadoDivulgacao(estado);
    renderSecoesDivulgacao();
  });

  document.getElementById("mt-form-agendamento-wa")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const cliente = document.getElementById("mt-ag-cliente")?.value.trim() || "";
    const servico = document.getElementById("mt-ag-servico")?.value.trim() || "";
    const datahora = document.getElementById("mt-ag-datahora")?.value.trim() || "";
    if (!cliente || !servico || !datahora) return;

    const estado = carregarEstadoDivulgacao();
    const fone = limparTelefoneWhatsApp(estado.whatsappNumero);
    const empresa = getNomeEmpresaAtual();
    const texto = `Olá *${empresa}*, sou *${cliente}*. Gostaria de agendar *${servico}* para *${datahora}* e confirmar meu horário.`;
    const waUrl = fone
      ? `https://wa.me/${fone}?text=${encodeURIComponent(texto)}`
      : `https://wa.me/?text=${encodeURIComponent(texto)}`;

    const resEl = document.getElementById("mt-resultado-wa");
    if (resEl) {
      resEl.innerHTML = `
        <h3>Solicitação Pronta para Confirmação</h3>
        <p class="muted-text" style="margin-bottom:10px;">
          Cliente: <strong>${esc(cliente)}</strong> | Serviço: <strong>${esc(servico)}</strong> | Horário: <strong>${esc(datahora)}</strong>
        </p>
        <a href="${esc(waUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
          Abrir WhatsApp para Confirmar Horário
        </a>
      `;
    }
  });

  document.getElementById("mt-form-galeria")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const titulo = document.getElementById("mt-gal-titulo")?.value.trim() || "";
    const imagemUrl = document.getElementById("mt-gal-url")?.value.trim() || "";
    const legenda = document.getElementById("mt-gal-legenda")?.value.trim() || "";
    if (!titulo || !legenda) return;

    const estado = carregarEstadoDivulgacao();
    estado.galeriaItens.push({
      id: `g_${Date.now()}`,
      titulo,
      imagemUrl,
      legenda
    });
    salvarEstadoDivulgacao(estado);
    e.target.reset();
    renderSecoesDivulgacao();
  });

  document.addEventListener("click", (e) => {
    const delPort = e.target.closest("[data-del-port]");
    if (delPort) {
      const id = delPort.dataset.delPort;
      const estado = carregarEstadoDivulgacao();
      estado.portfolioItens = estado.portfolioItens.filter((x) => x.id !== id);
      salvarEstadoDivulgacao(estado);
      renderSecoesDivulgacao();
      return;
    }

    const delGal = e.target.closest("[data-del-gal]");
    if (delGal) {
      const id = delGal.dataset.delGal;
      const estado = carregarEstadoDivulgacao();
      estado.galeriaItens = estado.galeriaItens.filter((x) => x.id !== id);
      salvarEstadoDivulgacao(estado);
      renderSecoesDivulgacao();
      return;
    }

    const copyBtn = e.target.closest("[data-copy-legenda]");
    if (copyBtn) {
      const txt = copyBtn.dataset.copyLegenda || "";
      navigator.clipboard?.writeText(txt).catch(() => {});
      copyBtn.textContent = "Legenda copiada";
      setTimeout(() => {
        copyBtn.textContent = "Copiar legenda";
      }, 1500);
    }
  });
}

function renderSecoesDivulgacao() {
  const estado = carregarEstadoDivulgacao();
  const empresa = getNomeEmpresaAtual();

  const descInput = document.getElementById("mt-port-desc");
  if (descInput && document.activeElement !== descInput) {
    descInput.value = estado.portfolioDescricao;
  }

  const linkEl = document.getElementById("mt-link-divulgacao-atual");
  if (linkEl) {
    linkEl.textContent = `${window.location.origin}${window.location.pathname}`;
  }

  const listaPortEl = document.getElementById("mt-lista-portfolio");
  if (listaPortEl) {
    listaPortEl.innerHTML = `
      <p class="muted-text" style="margin-bottom:12px;">
        <strong>${esc(empresa)}:</strong> ${esc(estado.portfolioDescricao)}
      </p>
      <table>
        <thead><tr><th>Destaque / Serviço</th><th>Descrição</th><th>Ação</th></tr></thead>
        <tbody>
          ${estado.portfolioItens
            .map(
              (it) => `<tr>
                <td><strong>${esc(it.titulo)}</strong></td>
                <td>${esc(it.resumo)}</td>
                <td><button type="button" class="btn btn-outline btn-sm" data-del-port="${esc(it.id)}">Excluir</button></td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  const waInput = document.getElementById("mt-wa-numero");
  if (waInput && document.activeElement !== waInput) {
    waInput.value = estado.whatsappNumero;
  }

  const gridGalEl = document.getElementById("mt-grid-galeria");
  if (gridGalEl) {
    gridGalEl.innerHTML = estado.galeriaItens
      .map((card) => {
        const preview = card.imagemUrl
          ? `<img src="${esc(card.imagemUrl)}" alt="${esc(card.titulo)}" style="width:100%;height:140px;object-fit:cover;border-radius:10px;margin-bottom:10px;border:1px solid var(--borda);" />`
          : `<div style="width:100%;height:120px;border-radius:10px;margin-bottom:10px;background:var(--azul-fundo);border:1px solid var(--borda);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--azul-texto);padding:10px;text-align:center;">${esc(empresa)} — ${esc(card.titulo)}</div>`;

        return `
          <article class="plan-card">
            <div>
              ${preview}
              <h3>${esc(card.titulo)}</h3>
              <p class="muted-text">${esc(card.legenda)}</p>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button type="button" class="btn btn-primary btn-sm" data-copy-legenda="${esc(card.legenda)}">Copiar legenda</button>
              <button type="button" class="btn btn-outline btn-sm" data-del-gal="${esc(card.id)}">Excluir</button>
            </div>
          </article>
        `;
      })
      .join("");
  }
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

function abrirPainelDireto(empresaId, nomeEmpresa, emailEmpresa, planoId) {
  activeEmpresaId = empresaId || DEMO_EMPRESA_ID;
  planoAtualId = planoId || "standard";

  authScreenEl?.classList.add("hidden");
  appShellEl?.classList.remove("hidden");

  aplicarNomeEmpresaNaTela(nomeEmpresa || "Multitech");
  garantirBotaoEditarEmpresa();
  garantirSecoesDivulgacao();
  renderSecoesDivulgacao();

  if (empresaEmailEl) empresaEmailEl.textContent = emailEmpresa || "Administrador Geral";
  if (operadorBadgeEl) operadorBadgeEl.textContent = "Administrador Geral";

  renderPlanos();
  carregarTodosDados(activeEmpresaId).catch(() => {});
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
    abrirPainelDireto(DEMO_EMPRESA_ID, "Multitech", email || "Administrador Geral", planoAtualId);
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
    ).catch(() => {});
  } catch (err) {
    abrirPainelDireto(DEMO_EMPRESA_ID, nomeEmpresa, email, planoAtualId);
  }
});

btnSairEl?.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (_) {}
  appShellEl?.classList.add("hidden");
  authScreenEl?.classList.remove("hidden");
});

btnAtualizarEl?.addEventListener("click", async () => {
  await carregarTodosDados(activeEmpresaId);
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
        <div class="chart-track"><div class="chart-fill saida" style="width:${pctSaida}%"></div></div>
        <strong>${formatarMoeda(saidas)}</strong>
      </div>
      <div class="chart-row">
        <span>Saldo</span>
        <div class="chart-track"><div class="chart-fill saldo" style="width:${pctSaldo}%"></div></div>
        <strong>${formatarMoeda(saldo)}</strong>
      </div>
    </div>
  `;

  if (dashGraficoEl) dashGraficoEl.innerHTML = html;
  if (finGraficoEl) finGraficoEl.innerHTML = html;
}

function renderPlanos() {
  if (!gridPlanosEl) return;
  const planoAtivo = PLANOS_CATALOGO.find((p) => p.id === planoAtualId) || PLANOS_CATALOGO[1];
  if (planoBadgeEl) {
    planoBadgeEl.textContent = `Plano: ${planoAtivo.nome}`;
  }

  gridPlanosEl.innerHTML = PLANOS_CATALOGO.map((plano) => {
    const isAtual = plano.id === planoAtualId;
    return `
      <article class="plan-card ${isAtual ? "active-plan" : ""}">
        <div>
          <h3>${esc(plano.nome)}</h3>
          <div class="plan-price">${esc(plano.preco)}</div>
          <p class="muted-text">${esc(plano.descricao)}</p>
          <ul class="plan-features">
            <li>Até ${esc(plano.limiteOperadores)} operadores internos</li>
            <li>Clientes, serviços e gráfico financeiro</li>
            <li>Montagem de equipes e atalho PWA</li>
          </ul>
        </div>
        <button
          type="button"
          class="btn ${isAtual ? "btn-outline" : "btn-primary"} btn-full"
          data-selecionar-plano="${esc(plano.id)}"
        >
          ${isAtual ? "Plano Ativo" : "Ativar Este Plano"}
        </button>
      </article>
    `;
  }).join("");
}

gridPlanosEl?.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-selecionar-plano]");
  if (!btn) return;
  planoAtualId = btn.dataset.selecionarPlano;
  renderPlanos();
  if (currentUser) {
    await setDoc(
      doc(db, ROOT_COLLECTION, currentUser.uid),
      { planoId: planoAtualId, atualizadoEm: new Date().toISOString() },
      { merge: true }
    ).catch(() => {});
  }
});

async function listarSubcolecao(empresaId, sub) {
  try {
    const snap = await getDocs(collection(db, ROOT_COLLECTION, empresaId, sub));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (_) {
    return [];
  }
}

function renderClientes(itens) {
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

function renderServicos(itens) {
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

function renderFinanceiro(itens) {
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

function renderEquipes(itens) {
  if (!listaEquipesEl) return;
  if (!itens.length) {
    listaEquipesEl.innerHTML = `<p class="muted-text">Nenhuma equipe montada ainda.</p>`;
    return;
  }
  listaEquipesEl.innerHTML = `<table><thead><tr><th>Equipe</th><th>Líder</th><th>Integrantes</th><th>Turno / Alocação</th><th>Ação</th></tr></thead><tbody>${itens
    .map(
      (item) => `<tr>
        <td>${esc(item.nome)}</td>
        <td>${esc(item.lider)}</td>
        <td>${esc(item.membros)}</td>
        <td>${esc(item.turno)}</td>
        <td><button type="button" class="btn btn-outline btn-sm" data-del-col="equipes" data-del-id="${esc(item.id)}">Excluir</button></td>
      </tr>`
    )
    .join("")}</tbody></table>`;
}

async function carregarTodosDados(empresaId) {
  const [clientes, servicos, financeiro, equipes] = await Promise.all([
    listarSubcolecao(empresaId, "clientes"),
    listarSubcolecao(empresaId, "servicos"),
    listarSubcolecao(empresaId, "financeiro"),
    listarSubcolecao(empresaId, "equipes")
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

  renderGraficoFinanceiro(receitas, saidas);
  renderClientes(clientes);
  renderServicos(servicos);
  renderFinanceiro(financeiro);
  renderEquipes(equipes);
}

formClienteEl?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("mt-cli-nome")?.value.trim() || "";
  const telefone = document.getElementById("mt-cli-telefone")?.value.trim() || "";
  const obs = document.getElementById("mt-cli-obs")?.value.trim() || "";
  if (!nome) return;
  await addDoc(collection(db, ROOT_COLLECTION, activeEmpresaId, "clientes"), {
    nome,
    telefone,
    obs,
    criadoEm: new Date().toISOString()
  }).catch(() => {});
  formClienteEl.reset();
  await carregarTodosDados(activeEmpresaId);
});

formServicoEl?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const titulo = document.getElementById("mt-srv-titulo")?.value.trim() || "";
  const cliente = document.getElementById("mt-srv-cliente")?.value.trim() || "";
  const valor = Number(document.getElementById("mt-srv-valor")?.value || 0);
  const status = document.getElementById("mt-srv-status")?.value || "Em andamento";
  if (!titulo) return;
  await addDoc(collection(db, ROOT_COLLECTION, activeEmpresaId, "servicos"), {
    titulo,
    cliente,
    valor,
    status,
    criadoEm: new Date().toISOString()
  }).catch(() => {});
  formServicoEl.reset();
  await carregarTodosDados(activeEmpresaId);
});

formLancamentoEl?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const descricao = document.getElementById("mt-fin-desc")?.value.trim() || "";
  const tipo = document.getElementById("mt-fin-tipo")?.value || "entrada";
  const valor = Number(document.getElementById("mt-fin-valor")?.value || 0);
  if (!descricao || valor <= 0) return;
  await addDoc(collection(db, ROOT_COLLECTION, activeEmpresaId, "financeiro"), {
    descricao,
    tipo,
    valor,
    criadoEm: new Date().toISOString()
  }).catch(() => {});
  formLancamentoEl.reset();
  await carregarTodosDados(activeEmpresaId);
});

formMontarEquipeEl?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("mt-eq-nome")?.value.trim() || "";
  const lider = document.getElementById("mt-eq-lider")?.value.trim() || "";
  const membros = document.getElementById("mt-eq-membros")?.value.trim() || "";
  const turno = document.getElementById("mt-eq-turno")?.value.trim() || "";
  if (!nome || !lider) return;
  await addDoc(collection(db, ROOT_COLLECTION, activeEmpresaId, "equipes"), {
    nome,
    lider,
    membros,
    turno,
    criadoEm: new Date().toISOString()
  }).catch(() => {});
  formMontarEquipeEl.reset();
  await carregarTodosDados(activeEmpresaId);
});

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-del-col][data-del-id]");
  if (!btn) return;
  const col = btn.dataset.delCol;
  const id = btn.dataset.delId;
  await deleteDoc(doc(db, ROOT_COLLECTION, activeEmpresaId, col, id)).catch(() => {});
  await carregarTodosDados(activeEmpresaId);
});

// Abre direto no painel de administrador geral sem travar caso não haja sessão ativa
abrirPainelDireto(DEMO_EMPRESA_ID, "Multitech", "Administrador Geral", planoAtualId);

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (!user) return;
  try {
    const snap = await getDoc(doc(db, ROOT_COLLECTION, user.uid));
    const data = snap.exists() ? snap.data() : {};
    abrirPainelDireto(
      user.uid,
      data.nomeEmpresa || "Multitech",
      user.email || "Administrador Geral",
      data.planoId || planoAtualId
    );
  } catch (_) {
    abrirPainelDireto(user.uid, "Multitech", user.email || "Administrador Geral", planoAtualId);
  }
});
