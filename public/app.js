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

let usuarioAtual = null;
let clienteEditando = null;
let orcamentoEditando = null;
let clientesCache = [];
let orcamentosCache = [];
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
        clientesCache = [];
        orcamentosCache = [];
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
        await Promise.all([carregarClientes(), carregarOrcamentos()]);
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

    if (kpiClientes) kpiClientes.textContent = String(clientesCache.length);

    const aprovados = orcamentosCache.filter((o) => o.status === "Aprovado");
    const somaGeral = orcamentosCache.reduce((acc, o) => acc + (Number(o.totalGeral) || 0), 0);
    const somaAprovada = aprovados.reduce((acc, o) => acc + (Number(o.totalGeral) || 0), 0);

    if (kpiTotalOrc) kpiTotalOrc.textContent = String(orcamentosCache.length);
    if (kpiOrcAprov) kpiOrcAprov.textContent = `${aprovados.length} aprovados`;
    if (kpiValorTotal) kpiValorTotal.textContent = formatarMoeda(somaGeral);
    if (kpiValorAprov) kpiValorAprov.textContent = `Aprovado: ${formatarMoeda(somaAprovada)}`;

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
    inputDesc.placeholder = "Ex.: Mão de obra / Material / Serviço";
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
    const tituloEl = document.getElementById("orcTitulo");
    const clienteEl = document.getElementById("orcClienteNome");
    const statusEl = document.getElementById("orcStatus");
    const descontoEl = document.getElementById("orcDesconto");
    const tbody = document.getElementById("corpoItensPlanilha");
    const btnSalvar = document.getElementById("btnSalvarOrcamento");

    if (tituloEl) tituloEl.value = "";
    if (clienteEl) clienteEl.value = "";
    if (statusEl) statusEl.value = "Rascunho";
    if (descontoEl) descontoEl.value = "0";
    if (btnSalvar) btnSalvar.textContent = "Salvar Orçamento";

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
        alert("Adicione pelo menos um item na planilha orçamentária.");
        return;
    }

    const refOrcamentos = db
        .collection("empresas")
        .doc(usuarioAtual.uid)
        .collection("orcamentos");

    const payload = {
        titulo,
        clienteNome,
        status,
        itens,
        subtotalItens,
        desconto,
        totalGeral
    };

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
        snapshot.forEach((doc) => {
            orcamentosCache.push({ id: doc.id, ...doc.data() });
        });

        orcamentosCache.sort((a, b) => {
            const ta = a.criadoEm?.toMillis ? a.criadoEm.toMillis() : 0;
            const tb = b.criadoEm?.toMillis ? b.criadoEm.toMillis() : 0;
            return tb - ta;
        });

        const badge = document.getElementById("totalOrcamentosBadge");
        if (badge) {
            badge.textContent = `${orcamentosCache.length} salvos`;
        }

        filtrarOrcamentos();
    } catch (erro) {
        console.error("Erro ao carregar orçamentos:", erro);
        alert("Erro ao carregar os orçamentos.");
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
            <div class="orcamento-topo-card">
                <strong>${escaparHTML(orc.titulo || "Sem título")}</strong>
                <span class="status-pill ${classeStatus}">${escaparHTML(orc.status || "Rascunho")}</span>
            </div>
            <div>Cliente: <strong>${escaparHTML(orc.clienteNome || "Não informado")}</strong></div>
            <div>Itens na planilha: ${qtdItens}</div>
            <div>Total: <strong>${formatarMoeda(orc.totalGeral)}</strong></div>
        `;

        const acoes = document.createElement("div");
        acoes.style.marginTop = "10px";

        const btnEditar = document.createElement("button");
        btnEditar.type = "button";
        btnEditar.className = "btn-secundario";
        btnEditar.textContent = "Abrir / Editar";
        btnEditar.addEventListener("click", () => carregarOrcamentoNoFormulario(orc));

        const btnExcluir = document.createElement("button");
        btnExcluir.type = "button";
        btnExcluir.className = "btn-remover-linha";
        btnExcluir.style.marginLeft = "8px";
        btnExcluir.textContent = "Excluir";
        btnExcluir.addEventListener("click", () => excluirOrcamento(orc.id));

        acoes.appendChild(btnEditar);
        acoes.appendChild(btnExcluir);
        card.appendChild(acoes);

        lista.appendChild(card);
    });
}

function carregarOrcamentoNoFormulario(orc) {
    orcamentoEditando = orc.id;

    const tituloEl = document.getElementById("orcTitulo");
    const clienteEl = document.getElementById("orcClienteNome");
    const statusEl = document.getElementById("orcStatus");
    const descontoEl = document.getElementById("orcDesconto");
    const tbody = document.getElementById("corpoItensPlanilha");
    const btnSalvar = document.getElementById("btnSalvarOrcamento");

    if (tituloEl) tituloEl.value = orc.titulo || "";
    if (clienteEl) clienteEl.value = orc.clienteNome || "";
    if (statusEl) statusEl.value = orc.status || "Rascunho";
    if (descontoEl) descontoEl.value = orc.desconto || 0;
    if (btnSalvar) btnSalvar.textContent = "Atualizar Orçamento";

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

async function excluirOrcamento(id) {
    if (!usuarioAtual || !id) return;
    if (!confirm("Deseja realmente excluir este orçamento?")) return;

    try {
        await db
            .collection("empresas")
            .doc(usuarioAtual.uid)
            .collection("orcamentos")
            .doc(id)
            .delete();

        if (orcamentoEditando === id) {
            limparFormularioOrcamento();
        }

        await carregarOrcamentos();
        atualizarDashboard();
    } catch (erro) {
        console.error("Erro ao excluir orçamento:", erro);
        alert("Erro ao excluir orçamento.");
    }
}

function exportarOrcamentosJSON() {
    const blob = new Blob([JSON.stringify(orcamentosCache, null, 2)], {
        type: "application/json"
    });
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

    const nomeEl = document.getElementById("nomeCliente");
    const telefoneEl = document.getElementById("telefoneCliente");
    const emailEl = document.getElementById("emailCliente");

    const nome = nomeEl ? nomeEl.value.trim() : "";
    const telefone = telefoneEl ? telefoneEl.value.trim() : "";
    const email = emailEl ? emailEl.value.trim() : "";

    if (!nome || !telefone || !email) {
        alert("Preencha todos os campos.");
        return;
    }

    const refClientes = db
        .collection("empresas")
        .doc(usuarioAtual.uid)
        .collection("clientes");

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
        if (nomeEl) nomeEl.value = "";
        if (telefoneEl) telefoneEl.value = "";
        if (emailEl) emailEl.value = "";

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
        snapshot.forEach((doc) => {
            clientesCache.push({ id: doc.id, ...doc.data() });
        });

        clientesCache.sort((a, b) =>
            (a.nome || "").localeCompare(b.nome || "", "pt-BR", { sensitivity: "base" })
        );

        const totalElement = document.getElementById("totalClientes");
        if (totalElement) {
            totalElement.textContent = `${clientesCache.length} cadastrados`;
        }

        atualizarSugestoesClientes();
        filtrarClientes();
    } catch (erro) {
        console.error("Erro ao carregar clientes:", erro);
        alert("Erro ao carregar a lista de clientes.");
    }
}

function renderizarClientes(listaDados) {
    const lista = document.getElementById("listaClientes");
    if (!lista) return;

    lista.innerHTML = "";

    listaDados.forEach((cliente) => {
        const item = document.createElement("div");
        item.className = "cliente-item";

        const strong = document.createElement("strong");
        strong.textContent = cliente.nome || "";

        const br1 = document.createElement("br");
        const telLinha = document.createTextNode(`📞 ${cliente.telefone || ""}`);
        const br2 = document.createElement("br");
        const emailLinha = document.createTextNode(`📧 ${cliente.email || ""}`);
        const br3 = document.createElement("br");
        const br4 = document.createElement("br");

        const btnEditar = document.createElement("button");
        btnEditar.type = "button";
        btnEditar.className = "btn-secundario";
        btnEditar.textContent = "Editar";
        btnEditar.addEventListener("click", () => {
            editarCliente(cliente.id, cliente.nome || "", cliente.telefone || "", cliente.email || "");
        });

        const btnExcluir = document.createElement("button");
        btnExcluir.type = "button";
        btnExcluir.className = "btn-remover-linha";
        btnExcluir.style.marginLeft = "8px";
        btnExcluir.textContent = "Excluir";
        btnExcluir.addEventListener("click", () => {
            excluirCliente(cliente.id);
        });

        item.appendChild(strong);
        item.appendChild(br1);
        item.appendChild(telLinha);
        item.appendChild(br2);
        item.appendChild(emailLinha);
        item.appendChild(br3);
        item.appendChild(br4);
        item.appendChild(btnEditar);
        item.appendChild(btnExcluir);

        lista.appendChild(item);
    });
}

async function excluirCliente(id) {
    if (!usuarioAtual || !id) return;
    if (!confirm("Deseja realmente excluir este cliente?")) return;

    try {
        await db
            .collection("empresas")
            .doc(usuarioAtual.uid)
            .collection("clientes")
            .doc(id)
            .delete();

        if (clienteEditando === id) {
            clienteEditando = null;
            const nomeEl = document.getElementById("nomeCliente");
            const telefoneEl = document.getElementById("telefoneCliente");
            const emailEl = document.getElementById("emailCliente");
            if (nomeEl) nomeEl.value = "";
            if (telefoneEl) telefoneEl.value = "";
            if (emailEl) emailEl.value = "";
        }

        alert("Cliente excluído com sucesso!");
        await carregarClientes();
        atualizarDashboard();
    } catch (erro) {
        console.error("Erro ao excluir cliente:", erro);
        alert("Erro ao excluir cliente.");
    }
}

function editarCliente(id, nome, telefone, email) {
    clienteEditando = id;
    const nomeEl = document.getElementById("nomeCliente");
    const telefoneEl = document.getElementById("telefoneCliente");
    const emailEl = document.getElementById("emailCliente");

    if (nomeEl) nomeEl.value = nome;
    if (telefoneEl) telefoneEl.value = telefone;
    if (emailEl) emailEl.value = email;

    mostrarSecao("gestaoClientes");
}

function filtrarClientes() {
    const buscaEl = document.getElementById("buscarCliente");
    const texto = buscaEl ? buscaEl.value.toLowerCase().trim() : "";

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

    const blob = new Blob([JSON.stringify(dadosExportacao, null, 2)], {
        type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "clientes-backup.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
