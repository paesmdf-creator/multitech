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
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { auth, db } from "./firebase-config.js";

const ROOT_COLLECTION = "multitech_empresas";
const DEMO_EMPRESA_ID = "admin_geral_multitech";
const STORAGE_EMPRESA_KEY = "multitech_nome_empresa_custom";
const STORAGE_DIVULGACAO_KEY = "multitech_divulgacao_v2";
const STORAGE_LOCAL_DB_KEY = "multitech_dados_locais_v2";

const PLANOS_CATALOGO = [
  {
    id: "basic",
    nome: "Basic",
    preco: "R$ 39,90",
    limiteOperadores: 2,
    descricao: "Operação essencial para cadastro de clientes, agenda e atendimentos."
  },
  {
    id: "standard",
    nome: "Standard",
    preco: "R$ 59,90",
    limiteOperadores: 5,
    descricao: "Gestão completa com serviços, financeiro visual, equipes e indicações."
  },
  {
    id: "advanced",
    nome: "Advanced",
    preco: "R$ 89,90",
    limiteOperadores: 12,
    descricao: "Controle ampliado com mais profissionais, equipes e visão financeira."
  },
  {
    id: "premium",
    nome: "Premium",
    preco: "R$ 129,90",
    limiteOperadores: 99,
    descricao: "Capacidade máxima de profissionais, equipes e recursos sem travas."
  }
];

const HORARIOS_PADRAO = [
  "08:00", "09:00", "10:00", "11:00",
  "14:00", "15:00", "16:00", "17:00", "18:00"
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
let modulosExtrasProntos = false;
let cacheClientes = [];
let cacheServicos = [];
let cacheFinanceiro = [];
let cacheEquipes = [];
let cacheAgendamentos = [];

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

function gerarCodigoCliente(seed = "") {
  const base = String(seed || "").replace(/\W/g, "").toUpperCase().slice(-4);
  const rand = Math.floor(100 + Math.random() * 900);
  return `CLI-${base || "MT"}-${rand}`;
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
    const novoNome = window.prompt("Digite o nome da empresa:", atual);
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
  const hoje = new Date().toISOString().slice(0, 10);
  const padrao = {
    whatsappNumero: "",
    metaIndicacoes: 5,
    premioVoucher: "1 voucher de benefício no próximo atendimento",
    diasAbertos: [hoje],
    horariosAbertos: [...HORARIOS_PADRAO],
    portfolioDescricao: "Atendimento organizado, agendamento rápido e acompanhamento direto com o cliente.",
    portfolioItens: [
      { id: "p1", titulo: "Atendimento & Avaliação", resumo: "Agendamento prático com confirmação pela empresa." },
      { id: "p2", titulo: "Serviços & Execução", resumo: "Acompanhamento de etapas, prazos e qualidade." }
    ],
    galeriaItens: [
      {
        id: "g1",
        titulo: "Divulgação & Agendamento",
        legenda: "Escolha seu dia e horário disponível e aguarde a confirmação da empresa.",
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
      metaIndicacoes: Math.max(1, Number(parsed.metaIndicacoes) || 5),
      premioVoucher: String(parsed.premioVoucher || padrao.premioVoucher),
      diasAbertos: Array.isArray(parsed.diasAbertos) && parsed.diasAbertos.length ? parsed.diasAbertos : [hoje],
      horariosAbertos: Array.isArray(parsed.horariosAbertos) && parsed.horariosAbertos.length ? parsed.horariosAbertos : [...HORARIOS_PADRAO],
      portfolioDescricao: String(parsed.portfolioDescricao || padrao.portfolioDescricao),
      portfolioItens: Array.isArray(parsed.portfolioItens) && parsed.portfolioItens.length ? parsed.portfolioItens : padrao.portfolioItens,
      galeriaItens: Array.isArray(parsed.galeriaItens) && parsed.galeriaItens.length ? parsed.galeriaItens : padrao.galeriaItens
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

function carregarBancoLocal(empresaId) {
  try {
    const raw = localStorage.getItem(`${STORAGE_LOCAL_DB_KEY}_${empresaId}`);
    if (!raw) return { clientes: [], servicos: [], financeiro: [], equipes: [], agendamentos: [] };
    const p = JSON.parse(raw);
    return {
      clientes: Array.isArray(p.clientes) ? p.clientes : [],
      servicos: Array.isArray(p.servicos) ? p.servicos : [],
      financeiro: Array.isArray(p.financeiro) ? p.financeiro : [],
      equipes: Array.isArray(p.equipes) ? p.equipes : [],
      agendamentos: Array.isArray(p.agendamentos) ? p.agendamentos : []
    };
  } catch (_) {
    return { clientes: [], servicos: [], financeiro: [], equipes: [], agendamentos: [] };
  }
}

function salvarBancoLocal(empresaId, dados) {
  try {
    localStorage.setItem(`${STORAGE_LOCAL_DB_KEY}_${empresaId}`, JSON.stringify(dados));
  } catch (_) {}
}

function limparTelefoneWhatsApp(num) {
  const digits = String(num || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function montarLinkAgendamentoCliente(cliente, refCodigo = "") {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("modo", "agendamento");
  url.searchParams.set("empresaId", activeEmpresaId);
  url.searchParams.set("empresaNome", getNomeEmpresaAtual());
  if (cliente?.codigoIndicacao) {
    url.searchParams.set("ref", cliente.codigoIndicacao);
  }
  if (cliente?.nome) {
    url.searchParams.set("cliente", cliente.nome);
  }
  if (cliente?.telefone) {
    url.searchParams.set("fone", cliente.telefone);
  }
  if (refCodigo) {
    url.searchParams.set("indicadoPor", refCodigo);
  }
  return url.toString();
}

function urlQrCode(textoLink) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=190x190&data=${encodeURIComponent(textoLink)}`;
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

function ajustarPlaceholderClienteNeutro() {
  const obsInput = document.getElementById("mt-cli-obs");
  if (obsInput) {
    obsInput.placeholder = "Observações, preferência de atendimento ou retorno";
  }
}

function renderGraficoFinanceiro(receitas, saidas) {
  const saldo = receitas - saidas;
  const maxVal = Math.max(receitas, saidas, Math.abs(saldo), 1);

  const hEntrada = Math.max(8, Math.round((receitas / maxVal) * 110));
  const hSaida = Math.max(8, Math.round((saidas / maxVal) * 110));
  const hSaldo = Math.max(8, Math.round((Math.abs(saldo) / maxVal) * 110));

  const totalMov = Math.max(receitas + saidas, 1);
  const pctReceita = Math.round((receitas / totalMov) * 100);
  const pctSaida = 100 - pctReceita;
  const raio = 42;
  const circ = 2 * Math.PI * raio;
  const dashEntrada = (pctReceita / 100) * circ;

  const html = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px;align-items:center;">
      <div style="background:var(--azul-claro);border:1px solid var(--borda);border-radius:14px;padding:14px;">
        <svg viewBox="0 0 300 175" width="100%" height="175" role="img" aria-label="Gráfico de colunas de entradas, saídas e saldo">
          <defs>
            <linearGradient id="gradEntrada" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#22C55E" />
              <stop offset="100%" stop-color="#15803D" />
            </linearGradient>
            <linearGradient id="gradSaida" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#EF4444" />
              <stop offset="100%" stop-color="#B91C1C" />
            </linearGradient>
            <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#F5D576" />
              <stop offset="100%" stop-color="#D4A738" />
            </linearGradient>
          </defs>
          <line x1="20" y1="138" x2="285" y2="138" stroke="#9AB4CA" stroke-width="1.5" />
          <line x1="20" y1="98" x2="285" y2="98" stroke="#D2E0EC" stroke-dasharray="4 4" stroke-width="1" />
          <line x1="20" y1="58" x2="285" y2="58" stroke="#D2E0EC" stroke-dasharray="4 4" stroke-width="1" />

          <rect x="36" y="${138 - hEntrada}" width="54" height="${hEntrada}" rx="8" fill="url(#gradEntrada)" />
          <text x="63" y="${Math.max(16, 132 - hEntrada)}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#1E354A">${esc(formatarMoeda(receitas))}</text>
          <text x="63" y="156" text-anchor="middle" font-size="11.5" font-weight="700" fill="#1E354A">Entradas</text>

          <rect x="123" y="${138 - hSaida}" width="54" height="${hSaida}" rx="8" fill="url(#gradSaida)" />
          <text x="150" y="${Math.max(16, 132 - hSaida)}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#1E354A">${esc(formatarMoeda(saidas))}</text>
          <text x="150" y="156" text-anchor="middle" font-size="11.5" font-weight="700" fill="#1E354A">Saídas</text>

          <rect x="210" y="${138 - hSaldo}" width="54" height="${hSaldo}" rx="8" fill="url(#gradSaldo)" />
          <text x="237" y="${Math.max(16, 132 - hSaldo)}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#1E354A">${esc(formatarMoeda(saldo))}</text>
          <text x="237" y="156" text-anchor="middle" font-size="11.5" font-weight="700" fill="#1E354A">Saldo</text>
        </svg>
      </div>

      <div style="background:var(--azul-claro);border:1px solid var(--borda);border-radius:14px;padding:14px;display:flex;align-items:center;gap:14px;">
        <svg viewBox="0 0 110 110" width="104" height="104" style="flex-shrink:0;" role="img" aria-label="Proporção entre entradas e saídas">
          <circle cx="55" cy="55" r="${raio}" fill="none" stroke="#EF4444" stroke-width="14" />
          <circle
            cx="55"
            cy="55"
            r="${raio}"
            fill="none"
            stroke="#16A34A"
            stroke-width="14"
            stroke-dasharray="${dashEntrada} ${circ}"
            transform="rotate(-90 55 55)"
          />
          <text x="55" y="52" text-anchor="middle" font-size="13" font-weight="800" fill="#1E354A">${pctReceita}%</text>
          <text x="55" y="67" text-anchor="middle" font-size="9.5" font-weight="700" fill="#536D84">ENTRADAS</text>
        </svg>
        <div style="display:flex;flex-direction:column;gap:8px;font-size:0.88rem;">
          <div><strong style="color:#15803D;">● Entradas:</strong> ${pctReceita}% (${esc(formatarMoeda(receitas))})</div>
          <div><strong style="color:#B91C1C;">● Saídas:</strong> ${pctSaida}% (${esc(formatarMoeda(saidas))})</div>
          <div><strong style="color:#A87D16;">● Saldo atual:</strong> ${esc(formatarMoeda(saldo))}</div>
        </div>
      </div>
    </div>
  `;

  if (dashGraficoEl) dashGraficoEl.innerHTML = html;
  if (finGraficoEl) finGraficoEl.innerHTML = html;
}

function calcularIndicacoesConcluidasPorCliente(cliente) {
  const cod = cliente.codigoIndicacao;
  if (!cod) return 0;
  return cacheClientes.filter(
    (c) => c.indicadoPorCodigo === cod && c.atendimentoConcluido === true
  ).length;
}

function renderCartaoQrCliente(cliente) {
  const boxEl = document.getElementById("mt-box-qrcode-cliente");
  if (!boxEl || !cliente) return;
  const estado = carregarEstadoDivulgacao();
  const link = montarLinkAgendamentoCliente(cliente);
  const qrImg = urlQrCode(link);
  const concluidas = calcularIndicacoesConcluidasPorCliente(cliente);
  const meta = estado.metaIndicacoes;
  const vouchersGanhos = Math.floor(concluidas / meta);

  boxEl.classList.remove("hidden");
  boxEl.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:18px;align-items:center;justify-content:space-between;">
      <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;">
        <img src="${esc(qrImg)}" alt="QR Code de ${esc(cliente.nome)}" width="150" height="150" style="border:1px solid var(--creme-borda);border-radius:12px;background:#fff;padding:6px;" />
        <div style="display:flex;flex-direction:column;gap:6px;max-width:460px;">
          <h3>Link e QR Code Pessoal — ${esc(cliente.nome)}</h3>
          <p class="muted-text">Código do cliente: <strong>${esc(cliente.codigoIndicacao)}</strong></p>
          <p class="muted-text">Indicações concluídas: <strong>${concluidas}/${meta}</strong> | Vouchers liberados: <strong>${vouchersGanhos}</strong> (${esc(estado.premioVoucher)})</p>
          <p class="muted-text" style="word-break:break-all;">Link: <span>${esc(link)}</span></p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;">
            <button type="button" class="btn btn-primary btn-sm" id="mt-btn-copiar-link-cli" data-link-cli="${esc(link)}">Copiar link</button>
            <a class="btn btn-outline btn-sm" href="${esc(qrImg)}" download="qrcode-${esc(cliente.codigoIndicacao)}.png">Baixar QR Code</a>
          </div>
        </div>
      </div>
    </div>
  `;
}

function garantirModulosExtras() {
  const navList = sidebarEl?.querySelector(".nav-list");
  const mainContent = document.querySelector(".main-content");
  if (!navList || !mainContent) return;

  const viewClientes = document.getElementById("view-clientes");
  if (viewClientes && !document.getElementById("mt-box-qrcode-cliente")) {
    const qrBox = document.createElement("div");
    qrBox.id = "mt-box-qrcode-cliente";
    qrBox.className = "card hidden";
    viewClientes.appendChild(qrBox);
  }

  const extras = [
    {
      view: "agendamento-whatsapp",
      label: "Agenda e WhatsApp",
      titulo: "Agenda Aberta, Confirmação e Retorno WhatsApp",
      html: `
        <div class="card">
          <h3>Configuração da Agenda Aberta e Programa de Indicação</h3>
          <div class="form-grid">
            <label class="field">
              <span>WhatsApp da Empresa com DDD</span>
              <input type="tel" id="mt-wa-numero" placeholder="13999999999" />
            </label>
            <label class="field">
              <span>Data Aberta para Agendamento</span>
              <input type="date" id="mt-ag-dia-aberto" />
            </label>
            <label class="field">
              <span>Meta de Indicações Concluídas p/ Voucher</span>
              <input type="number" min="1" id="mt-meta-indicacoes" placeholder="5" />
            </label>
            <label class="field">
              <span>Benefício / Voucher da Meta</span>
              <input type="text" id="mt-premio-voucher" placeholder="Ex: Desconto ou cortesia combinada" />
            </label>
            <div class="form-actions">
              <button type="button" id="mt-btn-salvar-config-ag" class="btn btn-primary">Salvar Configurações</button>
            </div>
          </div>
          <p class="muted-text" style="margin-top:10px;">
            Dias abertos ativos: <strong id="mt-dias-abertos-texto"></strong> | Horários padrão: <strong>${esc(HORARIOS_PADRAO.join(", "))}</strong>
          </p>
        </div>

        <div class="card">
          <h3>Solicitações de Agendamento (Confirmar, Alterar ou Recusar)</h3>
          <div id="mt-lista-agendamentos" class="table-wrap"></div>
        </div>

        <div id="mt-retorno-wa" class="card hidden"></div>
      `
    },
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
            Link base: <strong id="mt-link-divulgacao-atual"></strong>
          </p>
        </div>

        <form id="mt-form-portfolio-item" class="card form-grid">
          <label class="field">
            <span>Título do Destaque / Serviço</span>
            <input type="text" id="mt-port-item-titulo" required placeholder="Ex: Atendimento & Orçamento" />
          </label>
          <label class="field">
            <span>Detalhes para o Cliente</span>
            <input type="text" id="mt-port-item-resumo" required placeholder="Ex: Agendamento rápido e atendimento direto" />
          </label>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Adicionar ao Portfólio</button>
          </div>
        </form>

        <div id="mt-lista-portfolio" class="card table-wrap"></div>
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
            <input type="text" id="mt-gal-titulo" required placeholder="Ex: Agende seu horário" />
          </label>
          <label class="field">
            <span>URL da Imagem (opcional)</span>
            <input type="url" id="mt-gal-url" placeholder="https://..." />
          </label>
          <label class="field">
            <span>Legenda Pronta para Copiar</span>
            <input type="text" id="mt-gal-legenda" required placeholder="Texto para divulgar nas redes sociais" />
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

  ajustarPlaceholderClienteNeutro();

  if (modulosExtrasProntos) return;
  modulosExtrasProntos = true;

  document.getElementById("mt-btn-salvar-config-ag")?.addEventListener("click", () => {
    const estado = carregarEstadoDivulgacao();
    const waVal = document.getElementById("mt-wa-numero")?.value.trim();
    const diaVal = document.getElementById("mt-ag-dia-aberto")?.value.trim();
    const metaVal = Number(document.getElementById("mt-meta-indicacoes")?.value || 0);
    const premioVal = document.getElementById("mt-premio-voucher")?.value.trim();

    if (waVal !== undefined) estado.whatsappNumero = waVal;
    if (diaVal && !estado.diasAbertos.includes(diaVal)) {
      estado.diasAbertos.unshift(diaVal);
    }
    if (metaVal >= 1) estado.metaIndicacoes = metaVal;
    if (premioVal) estado.premioVoucher = premioVal;

    salvarEstadoDivulgacao(estado);
    renderAgendamentosPainel();
    renderSecoesDivulgacao();
  });

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
    estado.portfolioItens.push({ id: `p_${Date.now()}`, titulo, resumo });
    salvarEstadoDivulgacao(estado);
    e.target.reset();
    renderSecoesDivulgacao();
  });

  document.getElementById("mt-form-galeria")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const titulo = document.getElementById("mt-gal-titulo")?.value.trim() || "";
    const imagemUrl = document.getElementById("mt-gal-url")?.value.trim() || "";
    const legenda = document.getElementById("mt-gal-legenda")?.value.trim() || "";
    if (!titulo || !legenda) return;

    const estado = carregarEstadoDivulgacao();
    estado.galeriaItens.push({ id: `g_${Date.now()}`, titulo, imagemUrl, legenda });
    salvarEstadoDivulgacao(estado);
    e.target.reset();
    renderSecoesDivulgacao();
  });

  document.addEventListener("click", async (e) => {
    const btnQr = e.target.closest("[data-ver-qr-cliente]");
    if (btnQr) {
      const cli = cacheClientes.find((c) => c.id === btnQr.dataset.verQrCliente);
      if (cli) renderCartaoQrCliente(cli);
      return;
    }

    const btnConcluirAt = e.target.closest("[data-concluir-cliente]");
    if (btnConcluirAt) {
      const id = btnConcluirAt.dataset.concluirCliente;
      await atualizarCliente(id, { atendimentoConcluido: true });
      await carregarTodosDados(activeEmpresaId);
      return;
    }

    const btnCopyLinkCli = e.target.closest("#mt-btn-copiar-link-cli");
    if (btnCopyLinkCli) {
      const link = btnCopyLinkCli.dataset.linkCli || "";
      navigator.clipboard?.writeText(link).catch(() => {});
      btnCopyLinkCli.textContent = "Link copiado";
      setTimeout(() => { btnCopyLinkCli.textContent = "Copiar link"; }, 1500);
      return;
    }

    const btnAgAcao = e.target.closest("[data-ag-acao][data-ag-id]");
    if (btnAgAcao) {
      const acao = btnAgAcao.dataset.agAcao;
      const agId = btnAgAcao.dataset.agId;
      const ag = cacheAgendamentos.find((x) => x.id === agId);
      if (!ag) return;

      let novoStatus = ag.status;
      let novoHorario = ag.hora;
      let msgTexto = "";

      if (acao === "confirmar") {
        novoStatus = "Confirmado";
        msgTexto = `Olá ${ag.clienteNome}, seu agendamento em ${getNomeEmpresaAtual()} para ${ag.data} às ${ag.hora} foi CONFIRMADO.`;
      } else if (acao === "alterar") {
        const sugestao = window.prompt("Informe o novo dia/horário sugerido para o cliente:", `${ag.data} às ${ag.hora}`);
        if (!sugestao) return;
        novoStatus = "Alteração sugerida";
        novoHorario = sugestao.trim();
        msgTexto = `Olá ${ag.clienteNome}, sobre seu agendamento em ${getNomeEmpresaAtual()}, sugerimos ajustar para: ${novoHorario}. Podemos confirmar?`;
      } else if (acao === "recusar") {
        novoStatus = "Recusado";
        msgTexto = `Olá ${ag.clienteNome}, o horário de ${ag.data} às ${ag.hora} em ${getNomeEmpresaAtual()} não está disponível. Vamos combinar outro horário?`;
      }

      await atualizarAgendamento(agId, { status: novoStatus, hora: novoHorario });
      await carregarTodosDados(activeEmpresaId);

      const foneCli = limparTelefoneWhatsApp(ag.clienteTelefone);
      const waLink = foneCli
        ? `https://wa.me/${foneCli}?text=${encodeURIComponent(msgTexto)}`
        : `https://wa.me/?text=${encodeURIComponent(msgTexto)}`;

      const retEl = document.getElementById("mt-retorno-wa");
      if (retEl) {
        retEl.classList.remove("hidden");
        retEl.innerHTML = `
          <h3>Mensagem de Retorno Pronta (${esc(novoStatus)})</h3>
          <p class="muted-text" style="margin-bottom:10px;">${esc(msgTexto)}</p>
          <a href="${esc(waLink)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
            Enviar Retorno no WhatsApp
          </a>
        `;
      }
      return;
    }

    const delPort = e.target.closest("[data-del-port]");
    if (delPort) {
      const estado = carregarEstadoDivulgacao();
      estado.portfolioItens = estado.portfolioItens.filter((x) => x.id !== delPort.dataset.delPort);
      salvarEstadoDivulgacao(estado);
      renderSecoesDivulgacao();
      return;
    }

    const delGal = e.target.closest("[data-del-gal]");
    if (delGal) {
      const estado = carregarEstadoDivulgacao();
      estado.galeriaItens = estado.galeriaItens.filter((x) => x.id !== delGal.dataset.delGal);
      salvarEstadoDivulgacao(estado);
      renderSecoesDivulgacao();
      return;
    }

    const copyBtn = e.target.closest("[data-copy-legenda]");
    if (copyBtn) {
      navigator.clipboard?.writeText(copyBtn.dataset.copyLegenda || "").catch(() => {});
      copyBtn.textContent = "Legenda copiada";
      setTimeout(() => { copyBtn.textContent = "Copiar legenda"; }, 1500);
    }
  });
}

function renderAgendamentosPainel() {
  const el = document.getElementById("mt-lista-agendamentos");
  if (!el) return;

  const estado = carregarEstadoDivulgacao();
  const diasEl = document.getElementById("mt-dias-abertos-texto");
  if (diasEl) diasEl.textContent = estado.diasAbertos.join(", ");

  const waInput = document.getElementById("mt-wa-numero");
  if (waInput && document.activeElement !== waInput) waInput.value = estado.whatsappNumero;

  const metaInput = document.getElementById("mt-meta-indicacoes");
  if (metaInput && document.activeElement !== metaInput) metaInput.value = String(estado.metaIndicacoes);

  const premioInput = document.getElementById("mt-premio-voucher");
  if (premioInput && document.activeElement !== premioInput) premioInput.value = estado.premioVoucher;

  if (!cacheAgendamentos.length) {
    el.innerHTML = `<p class="muted-text">Nenhuma solicitação de agendamento recebida ainda.</p>`;
    return;
  }

  el.innerHTML = `<table><thead><tr><th>Cliente</th><th>Telefone</th><th>Dia / Horário</th><th>Indicação</th><th>Status</th><th>Ações</th></tr></thead><tbody>${cacheAgendamentos
    .map(
      (ag) => `<tr>
        <td><strong>${esc(ag.clienteNome)}</strong></td>
        <td>${esc(ag.clienteTelefone || "-")}</td>
        <td>${esc(ag.data)} — ${esc(ag.hora)}</td>
        <td>${esc(ag.indicadoPorCodigo || "Direto")}</td>
        <td><strong>${esc(ag.status || "Pendente")}</strong></td>
        <td style="display:flex;gap:6px;flex-wrap:wrap;">
          <button type="button" class="btn btn-primary btn-sm" data-ag-acao="confirmar" data-ag-id="${esc(ag.id)}">Confirmar</button>
          <button type="button" class="btn btn-outline btn-sm" data-ag-acao="alterar" data-ag-id="${esc(ag.id)}">Alterar</button>
          <button type="button" class="btn btn-outline btn-sm" data-ag-acao="recusar" data-ag-id="${esc(ag.id)}">Recusar</button>
        </td>
      </tr>`
    )
    .join("")}</tbody></table>`;
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
    linkEl.textContent = `${window.location.origin}${window.location.pathname}?modo=agendamento&empresaId=${encodeURIComponent(activeEmpresaId)}&empresaNome=${encodeURIComponent(empresa)}`;
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

async function renderModoAgendamentoCliente(params) {
  const empId = params.get("empresaId") || DEMO_EMPRESA_ID;
  const empNome = params.get("empresaNome") || getNomeEmpresaAtual();
  const indicadoPor = (params.get("ref") || params.get("indicadoPor") || "").trim();
  const cliParam = params.get("cliente") || "";
  const foneParam = params.get("fone") || "";

  const estado = carregarEstadoDivulgacao();
  const banco = carregarBancoLocal(empId);
  let ags = banco.agendamentos;
  try {
    const snap = await getDocs(collection(db, ROOT_COLLECTION, empId, "agendamentos"));
    if (!snap.empty) ags = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (_) {}

  document.body.innerHTML = `
    <div class="auth-wrapper">
      <div class="auth-card" style="max-width:560px;">
        <div class="brand-header">
          <div class="logo-mt">MT</div>
          <div>
            <h1>${esc(empNome)}</h1>
            <p class="muted-text">Agenda aberta — escolha dia e horário disponível</p>
          </div>
        </div>
        ${indicadoPor ? `<p class="muted-text" style="margin-bottom:12px;">Indicação registrada: <strong>${esc(indicadoPor)}</strong></p>` : ""}

        <form id="mt-form-cliente-publico" class="stack-form">
          <label class="field">
            <span>Seu Nome</span>
            <input type="text" id="pub-cli-nome" value="${esc(cliParam)}" required placeholder="Seu nome completo" />
          </label>
          <label class="field">
            <span>Seu WhatsApp com DDD</span>
            <input type="tel" id="pub-cli-fone" value="${esc(foneParam)}" required placeholder="13999999999" />
          </label>
          <label class="field">
            <span>Dia Disponível</span>
            <select id="pub-cli-dia">
              ${estado.diasAbertos.map((d) => `<option value="${esc(d)}">${esc(d)}</option>`).join("")}
            </select>
          </label>
          <label class="field">
            <span>Horário Disponível</span>
            <select id="pub-cli-hora">
              ${estado.horariosAbertos.map((h) => `<option value="${esc(h)}">${esc(h)}</option>`).join("")}
            </select>
          </label>
          <button type="submit" class="btn btn-primary btn-full">Solicitar Horário</button>
        </form>
        <p id="pub-cli-msg" class="muted-text" style="margin-top:12px;"></p>
      </div>
    </div>
  `;

  document.getElementById("mt-form-cliente-publico")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const clienteNome = document.getElementById("pub-cli-nome")?.value.trim() || "";
    const clienteTelefone = document.getElementById("pub-cli-fone")?.value.trim() || "";
    const data = document.getElementById("pub-cli-dia")?.value || "";
    const hora = document.getElementById("pub-cli-hora")?.value || "";
    if (!clienteNome || !data || !hora) return;

    const ocupado = ags.some(
      (a) => a.data === data && a.hora === hora && a.status !== "Recusado"
    );
    if (ocupado) {
      const msgEl = document.getElementById("pub-cli-msg");
      if (msgEl) msgEl.textContent = "Esse horário já foi reservado. Escolha outro horário disponível.";
      return;
    }

    const novoAg = {
      id: `ag_${Date.now()}`,
      clienteNome,
      clienteTelefone,
      data,
      hora,
      indicadoPorCodigo: indicadoPor,
      status: "Pendente",
      criadoEm: new Date().toISOString()
    };

    const atualBanco = carregarBancoLocal(empId);
    atualBanco.agendamentos.push(novoAg);
    if (indicadoPor && !atualBanco.clientes.some((c) => c.nome.toLowerCase() === clienteNome.toLowerCase())) {
      atualBanco.clientes.push({
        id: `cli_${Date.now()}`,
        nome: clienteNome,
        telefone: clienteTelefone,
        obs: `Indicado por ${indicadoPor}`,
        codigoIndicacao: gerarCodigoCliente(clienteNome),
        indicadoPorCodigo: indicadoPor,
        atendimentoConcluido: false
      });
    }
    salvarBancoLocal(empId, atualBanco);

    await addDoc(collection(db, ROOT_COLLECTION, empId, "agendamentos"), novoAg).catch(() => {});

    const foneEmp = limparTelefoneWhatsApp(estado.whatsappNumero);
    const textoEmp = `Olá ${empNome}, ${clienteNome} solicitou horário para ${data} às ${hora}${indicadoPor ? ` (ref: ${indicadoPor})` : ""}.`;
    const waUrl = foneEmp
      ? `https://wa.me/${foneEmp}?text=${encodeURIComponent(textoEmp)}`
      : `https://wa.me/?text=${encodeURIComponent(textoEmp)}`;

    const msgEl = document.getElementById("pub-cli-msg");
    if (msgEl) {
      msgEl.innerHTML = `Solicitação enviada como <strong>Pendente</strong>. <a href="${esc(waUrl)}" target="_blank" rel="noopener noreferrer">Avisar no WhatsApp</a>`;
    }
  });
}

function abrirPainelDireto(empresaId, nomeEmpresa, emailEmpresa, planoId) {
  activeEmpresaId = empresaId || DEMO_EMPRESA_ID;
  planoAtualId = planoId || "standard";

  authScreenEl?.classList.add("hidden");
  appShellEl?.classList.remove("hidden");

  aplicarNomeEmpresaNaTela(nomeEmpresa || "Multitech");
  garantirBotaoEditarEmpresa();
  garantirModulosExtras();
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
  } catch (_) {
    abrirPainelDireto(DEMO_EMPRESA_ID, "Multitech", email || "Administrador Geral", planoAtualId);
  }
});

formRegisterEl?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (authErroEl) authErroEl.textContent = "";
  const nomeEmpresa = document.getElementById("mt-reg-empresa")?.value.trim() || "Multitech";
  const email = document.getElementById("mt-reg-email")?.value.trim() || "";
  const senha = document.getElementById("mt-reg-senha")?.value || "";
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, senha);
    await setDoc(
      doc(db, ROOT_COLLECTION, cred.user.uid),
      { nomeEmpresa, email, planoId: "standard", atualizadoEm: new Date().toISOString() },
      { merge: true }
    ).catch(() => {});
  } catch (_) {
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
            <li>Até ${esc(plano.limiteOperadores)} membros / operadores</li>
            <li>Clientes, agenda aberta, QR Code e vouchers</li>
            <li>Gráfico financeiro, equipes e atalho PWA</li>
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
  const local = carregarBancoLocal(empresaId)[sub] || [];
  try {
    const snap = await getDocs(collection(db, ROOT_COLLECTION, empresaId, sub));
    if (snap.empty) return local;
    const remotos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const mapa = new Map();
    for (const item of [...local, ...remotos]) {
      mapa.set(item.id, item);
    }
    return Array.from(mapa.values());
  } catch (_) {
    return local;
  }
}

async function salvarItemSubcolecao(sub, payload) {
  const idGerado = payload.id || `${sub}_${Date.now()}`;
  const registro = { ...payload, id: idGerado };
  const banco = carregarBancoLocal(activeEmpresaId);
  banco[sub] = banco[sub] || [];
  banco[sub].push(registro);
  salvarBancoLocal(activeEmpresaId, banco);
  await setDoc(doc(db, ROOT_COLLECTION, activeEmpresaId, sub, idGerado), registro).catch(() => {});
}

async function atualizarCliente(id, patch) {
  const banco = carregarBancoLocal(activeEmpresaId);
  banco.clientes = (banco.clientes || []).map((c) => (c.id === id ? { ...c, ...patch } : c));
  salvarBancoLocal(activeEmpresaId, banco);
  await updateDoc(doc(db, ROOT_COLLECTION, activeEmpresaId, "clientes", id), patch).catch(() => {});
}

async function atualizarAgendamento(id, patch) {
  const banco = carregarBancoLocal(activeEmpresaId);
  banco.agendamentos = (banco.agendamentos || []).map((a) => (a.id === id ? { ...a, ...patch } : a));
  salvarBancoLocal(activeEmpresaId, banco);
  await updateDoc(doc(db, ROOT_COLLECTION, activeEmpresaId, "agendamentos", id), patch).catch(() => {});
}

function renderClientes(itens) {
  if (!listaClientesEl) return;
  if (!itens.length) {
    listaClientesEl.innerHTML = `<p class="muted-text">Nenhum cliente cadastrado ainda.</p>`;
    return;
  }

  const estado = carregarEstadoDivulgacao();
  const meta = estado.metaIndicacoes;

  listaClientesEl.innerHTML = `<table><thead><tr><th>Cliente</th><th>Telefone</th><th>Atendimento</th><th>Indicações / Voucher</th><th>Ações</th></tr></thead><tbody>${itens
    .map((item) => {
      const concluidas = calcularIndicacoesConcluidasPorCliente(item);
      const vouchers = Math.floor(concluidas / meta);
      const statusAt = item.atendimentoConcluido ? "Concluído" : "Em aberto";
      return `<tr>
        <td><strong>${esc(item.nome)}</strong><br><span class="muted-text">${esc(item.obs || "")}</span></td>
        <td>${esc(item.telefone || "-")}</td>
        <td>${esc(statusAt)}</td>
        <td><strong>${concluidas}/${meta}</strong> concl. (${vouchers} voucher)</td>
        <td style="display:flex;gap:6px;flex-wrap:wrap;">
          <button type="button" class="btn btn-primary btn-sm" data-ver-qr-cliente="${esc(item.id)}">Link &amp; QR</button>
          ${!item.atendimentoConcluido ? `<button type="button" class="btn btn-outline btn-sm" data-concluir-cliente="${esc(item.id)}">Concluir atendimento</button>` : ""}
          <button type="button" class="btn btn-outline btn-sm" data-del-col="clientes" data-del-id="${esc(item.id)}">Excluir</button>
        </td>
      </tr>`;
    })
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
  listaEquipesEl.innerHTML = `<table><thead><tr><th>Equipe</th><th>Responsável</th><th>Membros</th><th>Turno / Alocação</th><th>Ação</th></tr></thead><tbody>${itens
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
  const [clientes, servicos, financeiro, equipes, agendamentos] = await Promise.all([
    listarSubcolecao(empresaId, "clientes"),
    listarSubcolecao(empresaId, "servicos"),
    listarSubcolecao(empresaId, "financeiro"),
    listarSubcolecao(empresaId, "equipes"),
    listarSubcolecao(empresaId, "agendamentos")
  ]);

  cacheClientes = clientes.map((c) => ({
    ...c,
    codigoIndicacao: c.codigoIndicacao || gerarCodigoCliente(c.nome),
    atendimentoConcluido: Boolean(c.atendimentoConcluido)
  }));
  cacheServicos = servicos;
  cacheFinanceiro = financeiro;
  cacheEquipes = equipes;
  cacheAgendamentos = agendamentos;

  const receitas = financeiro
    .filter((i) => i.tipo !== "saida")
    .reduce((acc, i) => acc + (Number(i.valor) || 0), 0);

  const saidas = financeiro
    .filter((i) => i.tipo === "saida")
    .reduce((acc, i) => acc + (Number(i.valor) || 0), 0);

  if (kpiClientesEl) kpiClientesEl.textContent = String(cacheClientes.length);
  if (kpiServicosEl) kpiServicosEl.textContent = String(servicos.length);
  if (kpiReceitasEl) kpiReceitasEl.textContent = formatarMoeda(receitas);
  if (kpiSaldoEl) kpiSaldoEl.textContent = formatarMoeda(receitas - saidas);

  renderGraficoFinanceiro(receitas, saidas);
  renderClientes(cacheClientes);
  renderServicos(servicos);
  renderFinanceiro(financeiro);
  renderEquipes(equipes);
  renderAgendamentosPainel();
}

formClienteEl?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("mt-cli-nome")?.value.trim() || "";
  const telefone = document.getElementById("mt-cli-telefone")?.value.trim() || "";
  const obs = document.getElementById("mt-cli-obs")?.value.trim() || "";
  if (!nome) return;

  await salvarItemSubcolecao("clientes", {
    nome,
    telefone,
    obs,
    codigoIndicacao: gerarCodigoCliente(nome),
    indicadoPorCodigo: "",
    atendimentoConcluido: false,
    criadoEm: new Date().toISOString()
  });

  formClienteEl.reset();
  ajustarPlaceholderClienteNeutro();
  await carregarTodosDados(activeEmpresaId);
});

formServicoEl?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const titulo = document.getElementById("mt-srv-titulo")?.value.trim() || "";
  const cliente = document.getElementById("mt-srv-cliente")?.value.trim() || "";
  const valor = Number(document.getElementById("mt-srv-valor")?.value || 0);
  const status = document.getElementById("mt-srv-status")?.value || "Em andamento";
  if (!titulo) return;

  await salvarItemSubcolecao("servicos", {
    titulo,
    cliente,
    valor,
    status,
    criadoEm: new Date().toISOString()
  });

  formServicoEl.reset();
  await carregarTodosDados(activeEmpresaId);
});

formLancamentoEl?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const descricao = document.getElementById("mt-fin-desc")?.value.trim() || "";
  const tipo = document.getElementById("mt-fin-tipo")?.value || "entrada";
  const valor = Number(document.getElementById("mt-fin-valor")?.value || 0);
  if (!descricao || valor <= 0) return;

  await salvarItemSubcolecao("financeiro", {
    descricao,
    tipo,
    valor,
    criadoEm: new Date().toISOString()
  });

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

  await salvarItemSubcolecao("equipes", {
    nome,
    lider,
    membros,
    turno,
    criadoEm: new Date().toISOString()
  });

  formMontarEquipeEl.reset();
  await carregarTodosDados(activeEmpresaId);
});

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-del-col][data-del-id]");
  if (!btn) return;
  const col = btn.dataset.delCol;
  const id = btn.dataset.delId;

  const banco = carregarBancoLocal(activeEmpresaId);
  if (Array.isArray(banco[col])) {
    banco[col] = banco[col].filter((item) => item.id !== id);
    salvarBancoLocal(activeEmpresaId, banco);
  }

  await deleteDoc(doc(db, ROOT_COLLECTION, activeEmpresaId, col, id)).catch(() => {});
  await carregarTodosDados(activeEmpresaId);
});

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get("modo") === "agendamento") {
  renderModoAgendamentoCliente(urlParams).catch(() => {});
} else {
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
}
