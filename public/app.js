// Configuração do projeto Firebase - MultiTech
const firebaseConfig = {
    apiKey: "AIzaSyBJLqkQXG4WbgVb3msPf3PeXqxw_noOQ5o",
    authDomain: "multitech-b393c.firebaseapp.com",
    projectId: "multitech-b393c",
    storageBucket: "multitech-b393c.firebasestorage.app",
    messagingSenderId: "867560015873",
    appId: "1:867560015873:web:3e328ad252a968b5d89800",
    measurementId: "G-BZ81S6KM8N"
};

// Inicialização do Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
if (typeof firebase.analytics === "function") {
    firebase.analytics();
}

const PRAZO_DIAS_ASSINATURA = 30;
const MS_POR_DIA = 1000 * 60 * 60 * 24;

const PLANOS_PADRAO_TIERS = [
    {
        nome: "Plano Básico",
        nivel: "Básico",
        valor: 197.0,
        periodicidade: "Mensal",
        descricao: "Cadastro base, planilha orçamentária essencial e atendimento padrão."
    },
    {
        nome: "Plano Standard",
        nivel: "Standard",
        valor: 347.0,
        periodicidade: "Mensal",
        descricao: "Gestão completa de orçamentos, portfólio de divulgação e vouchers de fidelidade."
    },
    {
        nome: "Plano Premium",
        nivel: "Premium",
        valor: 597.0,
        periodicidade: "Mensal",
        descricao: "Pacote completo com prioridade de atendimento, planos avançados e destaque na vitrine."
    }
];

let usuarioAtual = null;
let clienteEditando = null;
let orcamentoEditando = null;
let planoEditando = null;
let portfolioEditando = null;

let clientesCache = [];
let orcamentosCache = [];
let planosCache = [];
let portfolioCache = [];
let vouchersCache = [];

let diasCorridosAtual = 0;
let statusAssinaturaAtual = "ativa";

// Registro do Service Worker para o PWA
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js").catch((err) => {
            console.error("Erro ao registrar Service Worker:", err);
        });
    });
}

function formatarMoeda(valor) {
    const numero = Number(valor) || 0;
    return numero.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function calcularDiasCorridos(criadoEm) {
    if (!criadoEm) return 0;

    let dataInicio = null;
    if (typeof criadoEm.toDate === "function") {
        dataInicio = criadoEm.toDate();
    } else if (criadoEm instanceof Date) {
        dataInicio = criadoEm;
    } else {
        dataInicio = new Date(criadoEm);
    }

    if (isNaN(dataInicio.getTime())) return 0;

    const diferencaMs = Date.now() - dataInicio.getTime();
    return Math.max(0, Math.floor(diferencaMs / MS_POR_DIA));
}

function atualizarIndicadorAssinatura() {
    const badge = document.getElementById("badgeAssinatura");
    const kpiCicloDias = document.getElementById("kpiCicloDias");
    const kpiDetalheCiclo = document.getElementById("kpiDetalheCiclo");

    if (statusAssinaturaAtual === "vitalicio") {
        if (badge) badge.textContent = "Assinatura: Vitalícia";
        if (kpiCicloDias) kpiCicloDias.textContent = "Vitalício";
        if (kpiDetalheCiclo) kpiDetalheCiclo.textContent = "Acesso liberado sem expiração";
        return;
    }

    const diasRestantes = Math.max(0, PRAZO_DIAS_ASSINATURA - diasCorridosAtual);

    if (badge) {
        badge.textContent = `Ciclo 30 dias: ${diasCorridosAtual}d corridos (${diasRestantes}d restantes)`;
    }
    if (kpiCicloDias) {
        kpiCicloDias.textContent = `${diasRestantes}d rest.`;
    }
    if (kpiDetalheCiclo) {
        kpiDetalheCiclo.textContent = `${diasCorridosAtual} de ${PRAZO_DIAS_ASSINATURA} dias corridos`;
    }
}

// Monitora login, prazo de 30 dias corridos, status da assinatura e identidade da empresa
auth.onAuthStateChanged(async (user) => {
    const loginOverlay = document.getElementById("loginOverlay");
    const bloqueioOverlay = document.getElementById("bloqueioOverlay");
    const appLayout = document.getElementById("appLayout");

    if (!user) {
        usuarioAtual = null;
        clienteEditando = null;
        orcamentoEditando = null;
        planoEditando = null;
        portfolioEditando = null;
        clientesCache = [];
        orcamentosCache = [];
        planosCache = [];
        portfolioCache = [];
        vouchersCache = [];
        if (loginOverlay) loginOverlay.style.display = "flex";
        if (bloqueioOverlay) bloqueioOverlay.style.display = "none";
        if (appLayout) appLayout.style.display = "none";
        return;
    }

    usuarioAtual = user;
    if (loginOverlay) loginOverlay.style.display = "none";

    try {
        const empresaRef = db.collection("empresas").doc(user.uid);
        const doc = await empresaRef.get();

        let dados = {
            nome: "MULTITECH",
            subtitulo: "Gestão Inteligente para Pequenos Negócios",
            status: "ativa",
            pagamentoConfirmado: false
        };

        if (!doc.exists) {
            await empresaRef.set({
                nome: dados.nome,
                subtitulo: dados.subtitulo,
                status: dados.status,
                pagamentoConfirmado: false,
                criadoEm: firebase.firestore.FieldValue.serverTimestamp()
            });
            diasCorridosAtual = 0;
            statusAssinaturaAtual = dados.status;
        } else {
            dados = Object.assign(dados, doc.data());

            if (!dados.criadoEm) {
                await empresaRef.set(
                    { criadoEm: firebase.firestore.FieldValue.serverTimestamp() },
                    { merge: true }
                );
                dados.criadoEm = new Date();
            }

            diasCorridosAtual = calcularDiasCorridos(dados.criadoEm);
            const venceuPrazo30Dias =
                diasCorridosAtual > PRAZO_DIAS_ASSINATURA &&
                dados.pagamentoConfirmado !== true &&
                dados.status !== "vitalicio";

            if (venceuPrazo30Dias && dados.status !== "bloqueada") {
                dados.status = "bloqueada";
                await empresaRef.set(
                    {
                        status: "bloqueada",
                        bloqueadoEm: firebase.firestore.FieldValue.serverTimestamp()
                    },
                    { merge: true }
                );
            }

            statusAssinaturaAtual = dados.status || "ativa";
        }

        if (statusAssinaturaAtual !== "ativa" && statusAssinaturaAtual !== "vitalicio") {
            if (bloqueioOverlay) bloqueioOverlay.style.display = "flex";
            if (appLayout) appLayout.style.display = "none";
            return;
        }

        aplicarIdentidade(dados.nome, dados.subtitulo);
        atualizarIndicadorAssinatura();

        if (bloqueioOverlay) bloqueioOverlay.style.display = "none";
        if (appLayout) appLayout.style.display = "flex";

        inicializarPlanilhaSeVazia();
        await Promise.all([
            carregarClientes(),
            carregarPlanos(),
            carregarOrcamentos(),
            carregarPortfolio(),
            carregarVouchers()
        ]);
        atualizarDashboard();
    } catch (erro) {
        console.error("Erro ao validar empresa:", erro);
        alert("Erro ao conectar ao banco de dados. Verifique o Firestore e suas regras.");
    }
});

async function fazerLogin() {
    const emailEl = document.getElementById("loginEmail");
    const senhaEl = document.getElementById("loginSenha");
    const erroEl = document.getElementById("loginErro");

    const email = emailEl ? emailEl.value.trim() : "";
    const senha = senhaEl ? senhaEl.value : "";

    if (erroEl) erroEl.textContent = "";

    if (!email || !senha) {
        if (erroEl) erroEl.textContent = "Preencha e-mail e senha.";
        return;
    }

    try {
        await auth.signInWithEmailAndPassword(email, senha);
    } catch (erro) {
        console.error("Erro no login:", erro);
        if (erroEl) erroEl.textContent = "E-mail ou senha inválidos.";
    }
}

async function fazerLogout() {
    try {
        await auth.signOut();
    } catch (erro) {
        console.error("Erro ao sair:", erro);
    }
}

function aplicarIdentidade(nome, subtitulo) {
    const nomeLimpo = (nome || "MULTITECH").trim() || "MULTITECH";
    const subtituloLimpo = (subtitulo || "Gestão Inteligente para Pequenos Negócios").trim();

    const nomeSidebar = document.getElementById("nomeEmpresaSidebar");
    const subSidebar = document.getElementById("subtituloEmpresaSidebar");
    const logoLetra = document.getElementById("logoLetra");
    const inputNome = document.getElementById("inputNomeEmpresa");
    const inputSub = document.getElementById("inputSubtituloEmpresa");

    if (nomeSidebar) nomeSidebar.textContent = nomeLimpo;
    if (subSidebar) subSidebar.textContent = subtituloLimpo;
    if (logoLetra) logoLetra.textContent = nomeLimpo.charAt(0).toUpperCase() || "M";
    document.title = `${nomeLimpo} - Dashboard`;

    if (inputNome) inputNome.value = nomeLimpo;
    if (inputSub) inputSub.value = subtituloLimpo;
}

async function salvarConfiguracoesEmpresa() {
    if (!usuarioAtual) return;

    const inputNome = document.getElementById("inputNomeEmpresa");
    const inputSub = document.getElementById("inputSubtituloEmpresa");

    const nome = inputNome && inputNome.value.trim() ? inputNome.value.trim() : "MULTITECH";
    const subtitulo = inputSub && inputSub.value.trim()
        ? inputSub.value.trim()
        : "Gestão Inteligente para Pequenos Negócios";

    try {
        await db.collection("empresas").doc(usuarioAtual.uid).set(
            { nome, subtitulo },
            { merge: true }
        );
        aplicarIdentidade(nome, subtitulo);
        alert("Identidade da empresa salva com sucesso!");
    } catch (erro) {
        console.error("Erro ao salvar configurações:", erro);
        alert("Erro ao salvar configurações da empresa.");
    }
}

/* ==================== DASHBOARD ==================== */
function atualizarDashboard() {
    atualizarIndicadorAssinatura();

    const kpiClientes = document.getElementById("kpiTotalClientes");
    const kpiTotalOrc = document.getElementById("kpiTotalOrcamentos");
    const kpiOrcAprov = document.getElementById("kpiOrcamentosAprovados");
    const kpiValorTotal = document.getElementById("kpiValorTotalOrcamentos");
    const kpiValorAprov = document.getElementById("kpiValorAprovado");
    const kpiModulos = document.getElementById("kpiResumoModulos");

    if (kpiClientes) kpiClientes.textContent = String(clientesCache.length);

    const aprovados = orcamentosCache.filter((o) => o.status === "Aprovado");
    const somaGeral = orcamentosCache.reduce((acc, o) => acc + (Number(o.totalGeral) || 0), 0);
    const somaAprovada = aprovados.reduce((acc, o) => acc + (Number(o.totalGeral) || 0), 0);

    if (kpiTotalOrc) kpiTotalOrc.textContent = String(orcamentosCache.length);
    if (kpiOrcAprov) kpiOrcAprov.textContent = `${aprovados.length} aprovados`;
    if (kpiValorTotal) kpiValorTotal.textContent = formatarMoeda(somaGeral);
    if (kpiValorAprov) kpiValorAprov.textContent = `Aprovado: ${formatarMoeda(somaAprovada)}`;
    if (kpiModulos) {
        kpiModulos.textContent = `${planosCache.length} / ${portfolioCache.length} / ${vouchersCache.length}`;
    }

    renderizarResumoDashboard();
}

function renderizarResumoDashboard() {
    const boxOrc = document.getElementById("resumoUltimosOrcamentos");
    const boxCli = document.getElementById("resumoUltimosClientes");

    if (boxOrc) {
        boxOrc.innerHTML = "";
        const ultimosOrc = orcamentosCache.slice(0, 4);
        if (ultimosOrc.length === 0) {
            boxOrc.innerHTML = '<p class="texto-vazio">Nenhum orçamento lançado ainda.</p>';
        } else {
            ultimosOrc.forEach((orc) => {
                const div = document.createElement("div");
                div.className = "item-resumo";
                div.innerHTML = `
                    <div>
                        <strong>${escaparHTML(orc.titulo || "Sem título")}</strong><br>
                        <small>${escaparHTML(orc.clienteNome || "Cliente não informado")} • ${escaparHTML(orc.status || "Rascunho")}</small>
                    </div>
                    <strong>${formatarMoeda(orc.totalGeral)}</strong>
                `;
                boxOrc.appendChild(div);
            });
        }
    }

    if (boxCli) {
        boxCli.innerHTML = "";
        const ultimosCli = clientesCache.slice(0, 4);
        if (ultimosCli.length === 0) {
            boxCli.innerHTML = '<p class="texto-vazio">Nenhum cliente cadastrado ainda.</p>';
        } else {
            ultimosCli.forEach((cli) => {
                const div = document.createElement("div");
                div.className = "item-resumo";
                div.innerHTML = `
                    <div>
                        <strong>${escaparHTML(cli.nome || "Cliente")}</strong><br>
                        <small>${escaparHTML(cli.telefone || "")}</small>
                    </div>
                    <small>${escaparHTML(cli.email || "")}</small>
                `;
                boxCli.appendChild(div);
            });
        }
    }
}

/* ==================== PLANOS (BÁSICO / STANDARD / PREMIUM) ==================== */
async function restaurarPlanosPadrao() {
    if (!usuarioAtual) return;
    if (!confirm("Adicionar os planos padrão Básico, Standard e Premium na sua lista?")) return;

    const refPlanos = db.collection("empresas").doc(usuarioAtual.uid).collection("planos");
    try {
        for (const p of PLANOS_PADRAO_TIERS) {
            await refPlanos.add({
                ...p,
                criadoEm: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        await carregarPlanos();
        atualizarDashboard();
        alert("Planos Básico, Standard e Premium adicionados!");
    } catch (erro) {
        console.error("Erro ao criar planos padrão:", erro);
        alert("Erro ao criar planos padrão.");
    }
}

async function salvarPlano() {
    if (!usuarioAtual) return;

    const nome = document.getElementById("planoNome")?.value.trim() || "";
    const nivel = document.getElementById("planoNivel")?.value || "Básico";
    const valor = Math.max(0, Number(document.getElementById("planoValor")?.value) || 0);
    const periodicidade = document.getElementById("planoPeriodicidade")?.value.trim() || "Mensal";
    const descricao = document.getElementById("planoDescricao")?.value.trim() || "";

    if (!nome) {
        alert("Informe o nome do plano ou serviço.");
        return;
    }

    const refPlanos = db.collection("empresas").doc(usuarioAtual.uid).collection("planos");
    const payload = { nome, nivel, valor, periodicidade, descricao };

    try {
        if (planoEditando) {
            await refPlanos.doc(planoEditando).update({
                ...payload,
                atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            await refPlanos.add({
                ...payload,
                criadoEm: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        planoEditando = null;
        document.getElementById("planoNome").value = "";
        document.getElementById("planoValor").value = "";
        document.getElementById("planoPeriodicidade").value = "";
        document.getElementById("planoDescricao").value = "";
        document.getElementById("btnSalvarPlano").textContent = "Salvar Plano";

        await carregarPlanos();
        atualizarDashboard();
    } catch (erro) {
        console.error("Erro ao salvar plano:", erro);
        alert("Erro ao salvar plano.");
    }
}

async function carregarPlanos() {
    if (!usuarioAtual) return;

    try {
        const snapshot = await db
            .collection("empresas")
            .doc(usuarioAtual.uid)
            .collection("planos")
            .get();

        planosCache = [];
        snapshot.forEach((doc) => planosCache.push({ id: doc.id, ...doc.data() }));

        if (planosCache.length === 0) {
            const refPlanos = db.collection("empresas").doc(usuarioAtual.uid).collection("planos");
            for (const p of PLANOS_PADRAO_TIERS) {
                const novoDoc = await refPlanos.add({
                    ...p,
                    criadoEm: firebase.firestore.FieldValue.serverTimestamp()
                });
                planosCache.push({ id: novoDoc.id, ...p });
            }
        }

        const badge = document.getElementById("totalPlanosBadge");
        if (badge) badge.textContent = `${planosCache.length} planos`;

        atualizarSelectPlanosOrcamento();
        renderizarPlanos();
    } catch (erro) {
        console.error("Erro ao carregar planos:", erro);
    }
}

function atualizarSelectPlanosOrcamento() {
    const select = document.getElementById("selectPlanoRapido");
    if (!select) return;

    select.innerHTML = "";
    if (planosCache.length === 0) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "Nenhum plano cadastrado";
        select.appendChild(opt);
        return;
    }

    planosCache.forEach((p, idx) => {
        const opt = document.createElement("option");
        opt.value = String(idx);
        opt.textContent = `${p.nome} [${p.nivel || "Serviço"}] — ${formatarMoeda(p.valor)}`;
        select.appendChild(opt);
    });
}

function inserirPlanoNaPlanilha() {
    const select = document.getElementById("selectPlanoRapido");
    const idx = Number(select?.value);
    const plano = planosCache[idx];
    if (!plano) {
        alert("Selecione um plano ou serviço válido.");
        return;
    }

    const linhas = document.querySelectorAll("#corpoItensPlanilha tr.linha-item-planilha");
    if (linhas.length === 1) {
        const descUnica = linhas[0].querySelector(".item-desc")?.value.trim();
        const valUnico = Number(linhas[0].querySelector(".item-valor")?.value) || 0;
        if (!descUnica && valUnico === 0) {
            linhas[0].querySelector(".item-desc").value = `${plano.nome} (${plano.nivel || "Serviço"})`;
            linhas[0].querySelector(".item-unid").value = plano.periodicidade || "serv";
            linhas[0].querySelector(".item-qtd").value = 1;
            linhas[0].querySelector(".item-valor").value = Number(plano.valor) || 0;
            recalcularTotaisPlanilha();
            return;
        }
    }

    adicionarLinhaItem({
        descricao: `${plano.nome} (${plano.nivel || "Serviço"})`,
        unidade: plano.periodicidade || "serv",
        quantidade: 1,
        valorUnitario: Number(plano.valor) || 0
    });
}

function renderizarPlanos() {
    const lista = document.getElementById("listaPlanos");
    if (!lista) return;
    lista.innerHTML = "";

    planosCache.forEach((plano) => {
        const card = document.createElement("div");
        card.className = "modulo-card";
        card.innerHTML = `
            <div class="card-topo">
                <strong>${escaparHTML(plano.nome)}</strong>
                <span class="status-pill">${escaparHTML(plano.nivel || "Serviço")}</span>
            </div>
            <div>Valor: <strong>${formatarMoeda(plano.valor)}</strong> • ${escaparHTML(plano.periodicidade || "Mensal")}</div>
            <div>${escaparHTML(plano.descricao || "")}</div>
        `;

        const acoes = document.createElement("div");
        acoes.className = "acoes-card";

        const btnOrc = document.createElement("button");
        btnOrc.type = "button";
        btnOrc.className = "btn-primario";
        btnOrc.textContent = "Usar no Orçamento";
        btnOrc.addEventListener("click", () => {
            mostrarSecao("planilhaOrcamentaria");
            adicionarLinhaItem({
                descricao: `${plano.nome} (${plano.nivel || "Serviço"})`,
                unidade: plano.periodicidade || "serv",
                quantidade: 1,
                valorUnitario: Number(plano.valor) || 0
            });
        });

        const btnEditar = document.createElement("button");
        btnEditar.type = "button";
        btnEditar.className = "btn-secundario";
        btnEditar.textContent = "Editar";
        btnEditar.addEventListener("click", () => {
            planoEditando = plano.id;
            document.getElementById("planoNome").value = plano.nome || "";
            document.getElementById("planoNivel").value = plano.nivel || "Básico";
            document.getElementById("planoValor").value = plano.valor || 0;
            document.getElementById("planoPeriodicidade").value = plano.periodicidade || "";
            document.getElementById("planoDescricao").value = plano.descricao || "";
            document.getElementById("btnSalvarPlano").textContent = "Atualizar Plano";
            mostrarSecao("planosServicos");
        });

        const btnExcluir = document.createElement("button");
        btnExcluir.type = "button";
        btnExcluir.className = "btn-remover-linha";
        btnExcluir.textContent = "Excluir";
        btnExcluir.addEventListener("click", async () => {
            if (!confirm("Excluir este plano?")) return;
            await db.collection("empresas").doc(usuarioAtual.uid).collection("planos").doc(plano.id).delete();
            await carregarPlanos();
            atualizarDashboard();
        });

        acoes.appendChild(btnOrc);
        acoes.appendChild(btnEditar);
        acoes.appendChild(btnExcluir);
        card.appendChild(acoes);
        lista.appendChild(card);
    });
}

/* ==================== PLANILHA ORÇAMENTÁRIA ==================== */
function inicializarPlanilhaSeVazia() {
    const tbody = document.getElementById("corpoItensPlanilha");
    if (!tbody) return;
    if (tbody.children.length === 0) {
        adicionarLinhaItem({ descricao: "", unidade: "un", quantidade: 1, valorUnitario: 0 });
    }
    recalcularTotaisPlanilha();
}

function adicionarLinhaItem(item = {}) {
    const tbody = document.getElementById("corpoItensPlanilha");
    if (!tbody) return;

    const tr = document.createElement("tr");
    tr.className = "linha-item-planilha";

    const tdDesc = document.createElement("td");
    const inputDesc = document.createElement("input");
    inputDesc.type = "text";
    inputDesc.className = "item-desc";
    inputDesc.placeholder = "Ex.: Plano Standard / Serviço escolhido";
    inputDesc.value = item.descricao || "";
    tdDesc.appendChild(inputDesc);

    const tdUnid = document.createElement("td");
    const inputUnid = document.createElement("input");
    inputUnid.type = "text";
    inputUnid.className = "item-unid";
    inputUnid.value = item.unidade || "un";
    tdUnid.appendChild(inputUnid);

    const tdQtd = document.createElement("td");
    const inputQtd = document.createElement("input");
    inputQtd.type = "number";
    inputQtd.className = "item-qtd";
    inputQtd.step = "0.01";
    inputQtd.min = "0";
    inputQtd.value = item.quantidade !== undefined ? item.quantidade : 1;
    inputQtd.addEventListener("input", recalcularTotaisPlanilha);
    tdQtd.appendChild(inputQtd);

    const tdValor = document.createElement("td");
    const inputValor = document.createElement("input");
    inputValor.type = "number";
    inputValor.className = "item-valor";
    inputValor.step = "0.01";
    inputValor.min = "0";
    inputValor.value = item.valorUnitario !== undefined ? item.valorUnitario : 0;
    inputValor.addEventListener("input", recalcularTotaisPlanilha);
    tdValor.appendChild(inputValor);

    const tdSubtotal = document.createElement("td");
    tdSubtotal.className = "subtotal-celula";
    tdSubtotal.textContent = formatarMoeda(0);

    const tdAcao = document.createElement("td");
    const btnRemover = document.createElement("button");
    btnRemover.type = "button";
    btnRemover.className = "btn-remover-linha";
    btnRemover.textContent = "Remover";
    btnRemover.addEventListener("click", () => {
        if (tbody.children.length > 1) {
            tr.remove();
            recalcularTotaisPlanilha();
        } else {
            inputDesc.value = "";
            inputUnid.value = "un";
            inputQtd.value = 1;
            inputValor.value = 0;
            recalcularTotaisPlanilha();
        }
    });
    tdAcao.appendChild(btnRemover);

    tr.appendChild(tdDesc);
    tr.appendChild(tdUnid);
    tr.appendChild(tdQtd);
    tr.appendChild(tdValor);
    tr.appendChild(tdSubtotal);
    tr.appendChild(tdAcao);

    tbody.appendChild(tr);
    recalcularTotaisPlanilha();
}

function coletarItensPlanilha() {
    const linhas = document.querySelectorAll("#corpoItensPlanilha tr.linha-item-planilha");
    const itens = [];
    let subtotalItens = 0;

    linhas.forEach((tr) => {
        const descricao = tr.querySelector(".item-desc")?.value.trim() || "";
        const unidade = tr.querySelector(".item-unid")?.value.trim() || "un";
        const quantidade = Number(tr.querySelector(".item-qtd")?.value) || 0;
        const valorUnitario = Number(tr.querySelector(".item-valor")?.value) || 0;
        const subtotal = Math.max(0, quantidade * valorUnitario);

        const celulaSubtotal = tr.querySelector(".subtotal-celula");
        if (celulaSubtotal) {
            celulaSubtotal.textContent = formatarMoeda(subtotal);
        }

        if (descricao || quantidade > 0 || valorUnitario > 0) {
            itens.push({ descricao, unidade, quantidade, valorUnitario, subtotal });
            subtotalItens += subtotal;
        }
    });

    return { itens, subtotalItens };
}

function recalcularTotaisPlanilha() {
    const { subtotalItens } = coletarItensPlanilha();
    const descontoEl = document.getElementById("orcDesconto");
    const desconto = Math.max(0, Number(descontoEl?.value) || 0);
    const totalGeral = Math.max(0, subtotalItens - desconto);

    const subEl = document.getElementById("planilhaSubtotal");
    const descEl = document.getElementById("planilhaDesconto");
    const totEl = document.getElementById("planilhaTotalGeral");

    if (subEl) subEl.textContent = formatarMoeda(subtotalItens);
    if (descEl) descEl.textContent = formatarMoeda(desconto);
    if (totEl) totEl.textContent = formatarMoeda(totalGeral);

    return { subtotalItens, desconto, totalGeral };
}

function limparFormularioOrcamento() {
    orcamentoEditando = null;
    document.getElementById("orcTitulo").value = "";
    document.getElementById("orcClienteNome").value = "";
    document.getElementById("orcStatus").value = "Rascunho";
    document.getElementById("orcDesconto").value = "0";
    document.getElementById("btnSalvarOrcamento").textContent = "Salvar Orçamento";

    const tbody = document.getElementById("corpoItensPlanilha");
    if (tbody) {
        tbody.innerHTML = "";
        adicionarLinhaItem({ descricao: "", unidade: "un", quantidade: 1, valorUnitario: 0 });
    }
    recalcularTotaisPlanilha();
}

function prepararNovoOrcamento() {
    limparFormularioOrcamento();
    mostrarSecao("planilhaOrcamentaria");
    document.getElementById("orcTitulo")?.focus();
}

async function salvarOrcamento() {
    if (!usuarioAtual) return;

    const titulo = document.getElementById("orcTitulo")?.value.trim() || "";
    const clienteNome = document.getElementById("orcClienteNome")?.value.trim() || "";
    const status = document.getElementById("orcStatus")?.value || "Rascunho";
    const { itens, subtotalItens, desconto, totalGeral } = recalcularTotaisPlanilha();

    if (!titulo) {
        alert("Informe o título do orçamento.");
        return;
    }

    if (itens.length === 0) {
        alert("Adicione pelo menos um item ou serviço na planilha.");
        return;
    }

    const refOrcamentos = db.collection("empresas").doc(usuarioAtual.uid).collection("orcamentos");
    const payload = { titulo, clienteNome, status, itens, subtotalItens, desconto, totalGeral };

    try {
        if (orcamentoEditando) {
            await refOrcamentos.doc(orcamentoEditando).update({
                ...payload,
                atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            await refOrcamentos.add({
                ...payload,
                criadoEm: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        alert("Orçamento salvo com sucesso!");
        limparFormularioOrcamento();
        await carregarOrcamentos();
        atualizarDashboard();
    } catch (erro) {
        console.error("Erro ao salvar orçamento:", erro);
        alert("Erro ao salvar orçamento na nuvem.");
    }
}

async function carregarOrcamentos() {
    if (!usuarioAtual) return;

    try {
        const snapshot = await db
            .collection("empresas")
            .doc(usuarioAtual.uid)
            .collection("orcamentos")
            .get();

        orcamentosCache = [];
        snapshot.forEach((doc) => orcamentosCache.push({ id: doc.id, ...doc.data() }));

        orcamentosCache.sort((a, b) => {
            const ta = a.criadoEm?.toMillis ? a.criadoEm.toMillis() : 0;
            const tb = b.criadoEm?.toMillis ? b.criadoEm.toMillis() : 0;
            return tb - ta;
        });

        const badge = document.getElementById("totalOrcamentosBadge");
        if (badge) badge.textContent = `${orcamentosCache.length} salvos`;

        filtrarOrcamentos();
    } catch (erro) {
        console.error("Erro ao carregar orçamentos:", erro);
    }
}

function filtrarOrcamentos() {
    const termo = document.getElementById("buscarOrcamento")?.value.toLowerCase().trim() || "";
    if (!termo) {
        renderizarOrcamentos(orcamentosCache);
        return;
    }

    const filtrados = orcamentosCache.filter((o) =>
        (o.titulo || "").toLowerCase().includes(termo) ||
        (o.clienteNome || "").toLowerCase().includes(termo) ||
        (o.status || "").toLowerCase().includes(termo)
    );

    renderizarOrcamentos(filtrados);
}

function renderizarOrcamentos(listaDados) {
    const lista = document.getElementById("listaOrcamentos");
    if (!lista) return;
    lista.innerHTML = "";

    if (listaDados.length === 0) {
        lista.innerHTML = '<p class="texto-vazio">Nenhum orçamento encontrado.</p>';
        return;
    }

    listaDados.forEach((orc) => {
        const card = document.createElement("div");
        card.className = "orcamento-card";

        const classeStatus =
            orc.status === "Aprovado"
                ? "status-aprovado"
                : orc.status === "Enviado"
                ? "status-enviado"
                : "";

        const qtdItens = Array.isArray(orc.itens) ? orc.itens.length : 0;

        card.innerHTML = `
            <div class="card-topo">
                <strong>${escaparHTML(orc.titulo || "Sem título")}</strong>
                <span class="status-pill ${classeStatus}">${escaparHTML(orc.status || "Rascunho")}</span>
            </div>
            <div>Cliente: <strong>${escaparHTML(orc.clienteNome || "Não informado")}</strong></div>
            <div>Itens/Serviços: ${qtdItens} • Total: <strong>${formatarMoeda(orc.totalGeral)}</strong></div>
        `;

        const acoes = document.createElement("div");
        acoes.className = "acoes-card";

        const btnEditar = document.createElement("button");
        btnEditar.type = "button";
        btnEditar.className = "btn-secundario";
        btnEditar.textContent = "Abrir / Editar";
        btnEditar.addEventListener("click", () => carregarOrcamentoNoFormulario(orc));

        const btnExcluir = document.createElement("button");
        btnExcluir.type = "button";
        btnExcluir.className = "btn-remover-linha";
        btnExcluir.textContent = "Excluir";
        btnExcluir.addEventListener("click", async () => {
            if (!confirm("Excluir este orçamento?")) return;
            await db.collection("empresas").doc(usuarioAtual.uid).collection("orcamentos").doc(orc.id).delete();
            if (orcamentoEditando === orc.id) limparFormularioOrcamento();
            await carregarOrcamentos();
            atualizarDashboard();
        });

        acoes.appendChild(btnEditar);
        acoes.appendChild(btnExcluir);
        card.appendChild(acoes);
        lista.appendChild(card);
    });
}

function carregarOrcamentoNoFormulario(orc) {
    orcamentoEditando = orc.id;
    document.getElementById("orcTitulo").value = orc.titulo || "";
    document.getElementById("orcClienteNome").value = orc.clienteNome || "";
    document.getElementById("orcStatus").value = orc.status || "Rascunho";
    document.getElementById("orcDesconto").value = orc.desconto || 0;
    document.getElementById("btnSalvarOrcamento").textContent = "Atualizar Orçamento";

    const tbody = document.getElementById("corpoItensPlanilha");
    if (tbody) {
        tbody.innerHTML = "";
        const itens = Array.isArray(orc.itens) && orc.itens.length > 0
            ? orc.itens
            : [{ descricao: "", unidade: "un", quantidade: 1, valorUnitario: 0 }];
        itens.forEach((item) => adicionarLinhaItem(item));
    }

    recalcularTotaisPlanilha();
    mostrarSecao("planilhaOrcamentaria");
}

function exportarOrcamentosJSON() {
    const blob = new Blob([JSON.stringify(orcamentosCache, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "orcamentos-backup.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/* ==================== CLIENTES ==================== */
function atualizarSugestoesClientes() {
    const datalist = document.getElementById("sugestoesClientes");
    if (!datalist) return;
    datalist.innerHTML = "";
    clientesCache.forEach((cli) => {
        if (!cli.nome) return;
        const opt = document.createElement("option");
        opt.value = cli.nome;
        datalist.appendChild(opt);
    });
}

async function cadastrarCliente() {
    if (!usuarioAtual) return;

    const nome = document.getElementById("nomeCliente")?.value.trim() || "";
    const telefone = document.getElementById("telefoneCliente")?.value.trim() || "";
    const email = document.getElementById("emailCliente")?.value.trim() || "";

    if (!nome || !telefone || !email) {
        alert("Preencha todos os campos.");
        return;
    }

    const refClientes = db.collection("empresas").doc(usuarioAtual.uid).collection("clientes");

    try {
        if (clienteEditando) {
            await refClientes.doc(clienteEditando).update({
                nome,
                telefone,
                email,
                atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            await refClientes.add({
                nome,
                telefone,
                email,
                criadoEm: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        alert("Cliente salvo com sucesso!");
        clienteEditando = null;
        document.getElementById("nomeCliente").value = "";
        document.getElementById("telefoneCliente").value = "";
        document.getElementById("emailCliente").value = "";

        await carregarClientes();
        atualizarDashboard();
    } catch (erro) {
        console.error("Erro ao salvar cliente:", erro);
        alert("Erro ao salvar cliente na nuvem.");
    }
}

async function carregarClientes() {
    if (!usuarioAtual) return;

    try {
        const snapshot = await db
            .collection("empresas")
            .doc(usuarioAtual.uid)
            .collection("clientes")
            .get();

        clientesCache = [];
        snapshot.forEach((doc) => clientesCache.push({ id: doc.id, ...doc.data() }));

        clientesCache.sort((a, b) =>
            (a.nome || "").localeCompare(b.nome || "", "pt-BR", { sensitivity: "base" })
        );

        const totalElement = document.getElementById("totalClientes");
        if (totalElement) totalElement.textContent = `${clientesCache.length} cadastrados`;

        atualizarSugestoesClientes();
        filtrarClientes();
    } catch (erro) {
        console.error("Erro ao carregar clientes:", erro);
    }
}

function renderizarClientes(listaDados) {
    const lista = document.getElementById("listaClientes");
    if (!lista) return;
    lista.innerHTML = "";

    listaDados.forEach((cliente) => {
        const item = document.createElement("div");
        item.className = "cliente-item";
        item.innerHTML = `
            <strong>${escaparHTML(cliente.nome || "")}</strong>
            <div>📞 ${escaparHTML(cliente.telefone || "")}</div>
            <div>📧 ${escaparHTML(cliente.email || "")}</div>
        `;

        const acoes = document.createElement("div");
        acoes.className = "acoes-card";

        const btnEditar = document.createElement("button");
        btnEditar.type = "button";
        btnEditar.className = "btn-secundario";
        btnEditar.textContent = "Editar";
        btnEditar.addEventListener("click", () => {
            clienteEditando = cliente.id;
            document.getElementById("nomeCliente").value = cliente.nome || "";
            document.getElementById("telefoneCliente").value = cliente.telefone || "";
            document.getElementById("emailCliente").value = cliente.email || "";
            mostrarSecao("gestaoClientes");
        });

        const btnExcluir = document.createElement("button");
        btnExcluir.type = "button";
        btnExcluir.className = "btn-remover-linha";
        btnExcluir.textContent = "Excluir";
        btnExcluir.addEventListener("click", async () => {
            if (!confirm("Deseja realmente excluir este cliente?")) return;
            await db.collection("empresas").doc(usuarioAtual.uid).collection("clientes").doc(cliente.id).delete();
            if (clienteEditando === cliente.id) clienteEditando = null;
            await carregarClientes();
            atualizarDashboard();
        });

        acoes.appendChild(btnEditar);
        acoes.appendChild(btnExcluir);
        item.appendChild(acoes);
        lista.appendChild(item);
    });
}

function filtrarClientes() {
    const texto = document.getElementById("buscarCliente")?.value.toLowerCase().trim() || "";
    if (!texto) {
        renderizarClientes(clientesCache);
        return;
    }

    const filtrados = clientesCache.filter((c) =>
        (c.nome || "").toLowerCase().includes(texto) ||
        (c.telefone || "").toLowerCase().includes(texto) ||
        (c.email || "").toLowerCase().includes(texto)
    );

    renderizarClientes(filtrados);
}

function exportarClientesJSON() {
    const dadosExportacao = clientesCache.map(({ id, nome, telefone, email }) => ({
        id,
        nome: nome || "",
        telefone: telefone || "",
        email: email || ""
    }));
    const blob = new Blob([JSON.stringify(dadosExportacao, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "clientes-backup.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/* ==================== PORTFÓLIO DIGITAL & GALERIA ==================== */
function comprimirImagemArquivo(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const maxDim = 700;
                let w = img.width;
                let h = img.height;
                if (w > maxDim || h > maxDim) {
                    if (w > h) {
                        h = Math.round((h * maxDim) / w);
                        w = maxDim;
                    } else {
                        w = Math.round((w * maxDim) / h);
                        h = maxDim;
                    }
                }
                const canvas = document.createElement("canvas");
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL("image/jpeg", 0.72));
            };
            img.onerror = reject;
            img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function salvarItemPortfolio() {
    if (!usuarioAtual) return;

    const titulo = document.getElementById("portTitulo")?.value.trim() || "";
    const categoria = document.getElementById("portCategoria")?.value || "Prestação de Serviço";
    const urlInput = document.getElementById("portImagemUrl")?.value.trim() || "";
    const arquivoInput = document.getElementById("portImagemArquivo");
    const descricao = document.getElementById("portDescricao")?.value.trim() || "";

    if (!titulo) {
        alert("Informe o título do trabalho para o portfólio.");
        return;
    }

    let imagem = urlInput;
    if (arquivoInput && arquivoInput.files && arquivoInput.files[0]) {
        imagem = await comprimirImagemArquivo(arquivoInput.files[0]);
    } else if (!imagem && portfolioEditando) {
        const existente = portfolioCache.find((p) => p.id === portfolioEditando);
        imagem = existente?.imagem || "";
    }

    const refPortfolio = db.collection("empresas").doc(usuarioAtual.uid).collection("portfolio");
    const payload = { titulo, categoria, imagem, descricao };

    try {
        if (portfolioEditando) {
            await refPortfolio.doc(portfolioEditando).update({
                ...payload,
                atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            await refPortfolio.add({
                ...payload,
                criadoEm: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        portfolioEditando = null;
        document.getElementById("portTitulo").value = "";
        document.getElementById("portImagemUrl").value = "";
        if (arquivoInput) arquivoInput.value = "";
        document.getElementById("portDescricao").value = "";
        document.getElementById("btnSalvarPortfolio").textContent = "Publicar no Portfólio";

        await carregarPortfolio();
        atualizarDashboard();
    } catch (erro) {
        console.error("Erro ao salvar portfólio:", erro);
        alert("Erro ao salvar item no portfólio.");
    }
}

async function carregarPortfolio() {
    if (!usuarioAtual) return;

    try {
        const snapshot = await db
            .collection("empresas")
            .doc(usuarioAtual.uid)
            .collection("portfolio")
            .get();

        portfolioCache = [];
        snapshot.forEach((doc) => portfolioCache.push({ id: doc.id, ...doc.data() }));

        const badge = document.getElementById("totalPortfolioBadge");
        if (badge) badge.textContent = `${portfolioCache.length} itens`;

        renderizarPortfolio();
    } catch (erro) {
        console.error("Erro ao carregar portfólio:", erro);
    }
}

function renderizarPortfolio() {
    const lista = document.getElementById("listaPortfolio");
    if (!lista) return;
    lista.innerHTML = "";

    if (portfolioCache.length === 0) {
        lista.innerHTML = '<p class="texto-vazio">Nenhum trabalho publicado no portfólio ainda.</p>';
        return;
    }

    portfolioCache.forEach((item) => {
        const card = document.createElement("div");
        card.className = "modulo-card";

        const imgHtml = item.imagem
            ? `<img src="${escaparHTML(item.imagem)}" alt="${escaparHTML(item.titulo)}" class="foto-portfolio">`
            : "";

        card.innerHTML = `
            ${imgHtml}
            <div class="card-topo">
                <strong>${escaparHTML(item.titulo)}</strong>
                <span class="status-pill">${escaparHTML(item.categoria || "Serviço")}</span>
            </div>
            <div>${escaparHTML(item.descricao || "")}</div>
        `;

        const acoes = document.createElement("div");
        acoes.className = "acoes-card";

        const btnDivulgar = document.createElement("button");
        btnDivulgar.type = "button";
        btnDivulgar.className = "btn-primario";
        btnDivulgar.textContent = "Copiar p/ Redes";
        btnDivulgar.addEventListener("click", () => {
            const textoDivulgacao = `${item.titulo} (${item.categoria}) — ${item.descricao || "Confira este serviço!"}`;
            navigator.clipboard?.writeText(textoDivulgacao);
            alert("Texto de divulgação copiado para a área de transferência!");
        });

        const btnExcluir = document.createElement("button");
        btnExcluir.type = "button";
        btnExcluir.className = "btn-remover-linha";
        btnExcluir.textContent = "Excluir";
        btnExcluir.addEventListener("click", async () => {
            if (!confirm("Remover este item do portfólio?")) return;
            await db.collection("empresas").doc(usuarioAtual.uid).collection("portfolio").doc(item.id).delete();
            await carregarPortfolio();
            atualizarDashboard();
        });

        acoes.appendChild(btnDivulgar);
        acoes.appendChild(btnExcluir);
        card.appendChild(acoes);
        lista.appendChild(card);
    });
}

/* ==================== VOUCHERS POR FIDELIDADE ==================== */
async function salvarVoucher() {
    if (!usuarioAtual) return;

    const codigo = (document.getElementById("voucherCodigo")?.value.trim() || "").toUpperCase();
    const tipo = document.getElementById("voucherTipo")?.value || "percentual";
    const valor = Math.max(0, Number(document.getElementById("voucherValor")?.value) || 0);
    const cliente = document.getElementById("voucherCliente")?.value.trim() || "Todos os clientes";
    const descricao = document.getElementById("voucherDescricao")?.value.trim() || "Fidelidade";

    if (!codigo || valor <= 0) {
        alert("Informe um código e um valor de desconto maior que zero.");
        return;
    }

    try {
        await db.collection("empresas").doc(usuarioAtual.uid).collection("vouchers").add({
            codigo,
            tipo,
            valor,
            cliente,
            descricao,
            status: "Disponível",
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });

        document.getElementById("voucherCodigo").value = "";
        document.getElementById("voucherValor").value = "";
        document.getElementById("voucherCliente").value = "";
        document.getElementById("voucherDescricao").value = "";

        await carregarVouchers();
        atualizarDashboard();
    } catch (erro) {
        console.error("Erro ao salvar voucher:", erro);
        alert("Erro ao criar voucher.");
    }
}

async function carregarVouchers() {
    if (!usuarioAtual) return;

    try {
        const snapshot = await db
            .collection("empresas")
            .doc(usuarioAtual.uid)
            .collection("vouchers")
            .get();

        vouchersCache = [];
        snapshot.forEach((doc) => vouchersCache.push({ id: doc.id, ...doc.data() }));

        const badge = document.getElementById("totalVouchersBadge");
        if (badge) badge.textContent = `${vouchersCache.length} vouchers`;

        renderizarVouchers();
    } catch (erro) {
        console.error("Erro ao carregar vouchers:", erro);
    }
}

function renderizarVouchers() {
    const lista = document.getElementById("listaVouchers");
    if (!lista) return;
    lista.innerHTML = "";

    if (vouchersCache.length === 0) {
        lista.innerHTML = '<p class="texto-vazio">Nenhum voucher de fidelidade cadastrado.</p>';
        return;
    }

    vouchersCache.forEach((v) => {
        const card = document.createElement("div");
        card.className = "modulo-card";
        const beneficioTexto = v.tipo === "percentual" ? `${v.valor}% OFF` : formatarMoeda(v.valor);
        const classeStatus = v.status === "Resgatado" ? "status-resgatado" : "status-disponivel";

        card.innerHTML = `
            <div class="card-topo">
                <strong>🎟 ${escaparHTML(v.codigo)}</strong>
                <span class="status-pill ${classeStatus}">${escaparHTML(v.status || "Disponível")}</span>
            </div>
            <div>Benefício: <strong>${escaparHTML(beneficioTexto)}</strong></div>
            <div>Cliente: ${escaparHTML(v.cliente || "Todos os clientes")}</div>
            <div>${escaparHTML(v.descricao || "")}</div>
        `;

        const acoes = document.createElement("div");
        acoes.className = "acoes-card";

        const btnAplicar = document.createElement("button");
        btnAplicar.type = "button";
        btnAplicar.className = "btn-primario";
        btnAplicar.textContent = "Aplicar no Orçamento";
        btnAplicar.addEventListener("click", () => {
            const { subtotalItens } = recalcularTotaisPlanilha();
            const descontoCalculado = v.tipo === "percentual"
                ? (subtotalItens * (Number(v.valor) || 0)) / 100
                : Number(v.valor) || 0;
            document.getElementById("orcDesconto").value = descontoCalculado.toFixed(2);
            recalcularTotaisPlanilha();
            mostrarSecao("planilhaOrcamentaria");
        });

        const btnStatus = document.createElement("button");
        btnStatus.type = "button";
        btnStatus.className = "btn-secundario";
        btnStatus.textContent = v.status === "Resgatado" ? "Marcar Disponível" : "Marcar Resgatado";
        btnStatus.addEventListener("click", async () => {
            const novoStatus = v.status === "Resgatado" ? "Disponível" : "Resgatado";
            await db.collection("empresas").doc(usuarioAtual.uid).collection("vouchers").doc(v.id).update({
                status: novoStatus
            });
            await carregarVouchers();
        });

        const btnExcluir = document.createElement("button");
        btnExcluir.type = "button";
        btnExcluir.className = "btn-remover-linha";
        btnExcluir.textContent = "Excluir";
        btnExcluir.addEventListener("click", async () => {
            if (!confirm("Excluir este voucher?")) return;
            await db.collection("empresas").doc(usuarioAtual.uid).collection("vouchers").doc(v.id).delete();
            await carregarVouchers();
            atualizarDashboard();
        });

        acoes.appendChild(btnAplicar);
        acoes.appendChild(btnStatus);
        acoes.appendChild(btnExcluir);
        card.appendChild(acoes);
        lista.appendChild(card);
    });
}

function mostrarSecao(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
}

function escaparHTML(texto) {
    return String(texto || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
