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
let clientesCache = [];

// Registro do Service Worker para o PWA
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js").catch((err) => {
            console.error("Erro ao registrar Service Worker:", err);
        });
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
    return Math.floor(diferencaMs / MS_POR_DIA);
}

// Monitora login, prazo de 30 dias corridos, status da assinatura e identidade da empresa
auth.onAuthStateChanged(async (user) => {
    const loginOverlay = document.getElementById("loginOverlay");
    const bloqueioOverlay = document.getElementById("bloqueioOverlay");
    const appLayout = document.getElementById("appLayout");

    if (!user) {
        usuarioAtual = null;
        clienteEditando = null;
        clientesCache = [];
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
        } else {
            dados = Object.assign(dados, doc.data());

            // Se ainda não tem criadoEm (ex.: conta criada antes dessa regra), define agora
            if (!dados.criadoEm) {
                await empresaRef.set(
                    { criadoEm: firebase.firestore.FieldValue.serverTimestamp() },
                    { merge: true }
                );
                dados.criadoEm = new Date();
            }

            const diasCorridos = calcularDiasCorridos(dados.criadoEm);
            const venceuPrazo30Dias =
                diasCorridos > PRAZO_DIAS_ASSINATURA &&
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
        }

        if (dados.status && dados.status !== "ativa" && dados.status !== "vitalicio") {
            if (bloqueioOverlay) bloqueioOverlay.style.display = "flex";
            if (appLayout) appLayout.style.display = "none";
            return;
        }

        aplicarIdentidade(dados.nome, dados.subtitulo);
        if (bloqueioOverlay) bloqueioOverlay.style.display = "none";
        if (appLayout) appLayout.style.display = "flex";

        await carregarClientes();
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
        btnEditar.textContent = "Editar";
        btnEditar.addEventListener("click", () => {
            editarCliente(cliente.id, cliente.nome || "", cliente.telefone || "", cliente.email || "");
        });

        const btnExcluir = document.createElement("button");
        btnExcluir.type = "button";
        btnExcluir.textContent = "Excluir";
        btnExcluir.style.marginLeft = "8px";
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

    const secao = document.getElementById("gestaoClientes");
    if (secao) secao.scrollIntoView({ behavior: "smooth" });
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
