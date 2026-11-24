// COLE AQUI A CONFIGURAÇÃO DO SEU PROJETO FIREBASE
const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    projectId: "SEU_PROJETO",
    storageBucket: "SEU_PROJETO.appspot.com",
    messagingSenderId: "SEU_SENDER_ID",
    appId: "SEU_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let usuarioAtual = null;
let clienteEditando = null;
let clientesCache = [];

// Registra o Service Worker para PWA
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").catch(err => console.error("Erro SW:", err));
    });
}

// Monitora estado de autenticação
auth.onAuthStateChanged(async (user) => {
    const loginOverlay = document.getElementById("loginOverlay");
    const bloqueioOverlay = document.getElementById("bloqueioOverlay");
    const appLayout = document.getElementById("appLayout");

    if (!user) {
        usuarioAtual = null;
        loginOverlay.style.display = "flex";
        bloqueioOverlay.style.display = "none";
        appLayout.style.display = "none";
        return;
    }

    usuarioAtual = user;
    loginOverlay.style.display = "none";

    try {
        const empresaRef = db.collection("empresas").doc(user.uid);
        const doc = await empresaRef.get();

        if (!doc.exists) {
            // Cria perfil inicial da empresa no primeiro acesso
            await empresaRef.set({
                nome: "MULTITECH",
                subtitulo: "Gestão Inteligente para Pequenos Negócios",
                status: "ativa",
                criadoEm: firebase.firestore.FieldValue.serverTimestamp()
            });
            aplicarIdentidade("MULTITECH", "Gestão Inteligente para Pequenos Negócios");
            bloqueioOverlay.style.display = "none";
            appLayout.style.display = "flex";
        } else {
            const dados = doc.data();
            if (dados.status && dados.status !== "ativa") {
                bloqueioOverlay.style.display = "flex";
                appLayout.style.display = "none";
                return;
            }
            aplicarIdentidade(
                dados.nome || "MULTITECH",
                dados.subtitulo || "Gestão Inteligente para Pequenos Negócios"
            );
            bloqueioOverlay.style.display = "none";
            appLayout.style.display = "flex";
        }

        carregarClientes();
    } catch (erro) {
        console.error("Erro ao validar empresa:", erro);
        alert("Erro ao conectar ao servidor.");
    }
});

async function fazerLogin() {
    const email = document.getElementById("loginEmail").value.trim();
    const senha = document.getElementById("loginSenha").value;
    const erroEl = document.getElementById("loginErro");
    erroEl.textContent = "";

    if (!email || !senha) {
        erroEl.textContent = "Preencha e-mail e senha.";
        return;
    }

    try {
        await auth.signInWithEmailAndPassword(email, senha);
    } catch (erro) {
        erroEl.textContent = "E-mail ou senha inválidos.";
    }
}

function fazerLogout() {
    auth.signOut();
}

function aplicarIdentidade(nome, subtitulo) {
    document.getElementById("nomeEmpresaSidebar").textContent = nome;
    document.getElementById("subtituloEmpresaSidebar").textContent = subtitulo;
    document.getElementById("logoLetra").textContent = nome.trim().charAt(0).toUpperCase() || "M";
    document.title = `${nome} - Dashboard`;

    document.getElementById("inputNomeEmpresa").value = nome;
    document.getElementById("inputSubtituloEmpresa").value = subtitulo;
}

async function salvarConfiguracoesEmpresa() {
    if (!usuarioAtual) return;
    const nome = document.getElementById("inputNomeEmpresa").value.trim() || "MULTITECH";
    const subtitulo = document.getElementById("inputSubtituloEmpresa").value.trim() || "Gestão Inteligente para Pequenos Negócios";

    try {
        await db.collection("empresas").doc(usuarioAtual.uid).set(
            { nome, subtitulo },
            { merge: true }
        );
        aplicarIdentidade(nome, subtitulo);
        alert("Identidade da empresa atualizada!");
    } catch (erro) {
        console.error("Erro ao salvar identidade:", erro);
        alert("Erro ao salvar configurações.");
    }
}

async function cadastrarCliente() {
    if (!usuarioAtual) return;

    const nome = document.getElementById("nomeCliente").value.trim();
    const telefone = document.getElementById("telefoneCliente").value.trim();
    const email = document.getElementById("emailCliente").value.trim();

    if (!nome || !telefone || !email) {
        alert("Preencha todos os campos.");
        return;
    }

    const refClientes = db.collection("empresas").doc(usuarioAtual.uid).collection("clientes");

    try {
        if (clienteEditando) {
            await refClientes.doc(clienteEditando).update({ nome, telefone, email });
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

        carregarClientes();
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
            .orderBy("nome")
            .get();

        clientesCache = [];
        snapshot.forEach(doc => {
            clientesCache.push({ id: doc.id, ...doc.data() });
        });

        const totalElement = document.getElementById("totalClientes");
        if (totalElement) {
            totalElement.textContent = `${clientesCache.length} cadastrados`;
        }

        renderizarClientes(clientesCache);
    } catch (erro) {
        console.error("Erro ao carregar clientes:", erro);
    }
}

function renderizarClientes(listaDados) {
    const lista = document.getElementById("listaClientes");
    lista.innerHTML = "";

    listaDados.forEach(cliente => {
        const item = document.createElement("div");
        item.className = "cliente-item";

        const strong = document.createElement("strong");
        strong.textContent = cliente.nome;

        const info = document.createElement("div");
        info.innerHTML = `<br>📞 ${cliente.telefone || ""}<br>📧 ${cliente.email || ""}<br><br>`;

        const btnEditar = document.createElement("button");
        btnEditar.textContent = "Editar";
        btnEditar.onclick = () => editarCliente(cliente.id, cliente.nome, cliente.telefone, cliente.email);

        const btnExcluir = document.createElement("button");
        btnExcluir.textContent = "Excluir";
        btnExcluir.style.marginLeft = "8px";
        btnExcluir.onclick = () => excluirCliente(cliente.id);

        item.appendChild(strong);
        item.appendChild(info);
        item.appendChild(btnEditar);
        item.appendChild(btnExcluir);
        lista.appendChild(item);
    });
}

async function excluirCliente(id) {
    if (!usuarioAtual || !confirm("Deseja realmente excluir este cliente?")) return;

    try {
        await db.collection("empresas").doc(usuarioAtual.uid).collection("clientes").doc(id).delete();
        alert("Cliente excluído com sucesso!");
        carregarClientes();
    } catch (erro) {
        console.error("Erro ao excluir:", erro);
    }
}

function editarCliente(id, nome, telefone, email) {
    clienteEditando = id;
    document.getElementById("nomeCliente").value = nome;
    document.getElementById("telefoneCliente").value = telefone;
    document.getElementById("emailCliente").value = email;
    document.getElementById("gestaoClientes").scrollIntoView({ behavior: "smooth" });
}

function filtrarClientes() {
    const texto = document.getElementById("buscarCliente").value.toLowerCase();
    const filtrados = clientesCache.filter(c =>
        (c.nome || "").toLowerCase().includes(texto) ||
        (c.telefone || "").toLowerCase().includes(texto) ||
        (c.email || "").toLowerCase().includes(texto)
    );
    renderizarClientes(filtrados);
}

function exportarClientesJSON() {
    const blob = new Blob([JSON.stringify(clientesCache, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clientes-backup.json";
    a.click();
    URL.revokeObjectURL(url);
}

function mostrarSecao(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
}
