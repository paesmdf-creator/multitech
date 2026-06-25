let clienteEditando = null;

window.onload = carregarClientes;

async function cadastrarCliente() {

    const nome = document.getElementById("nomeCliente").value;
    const telefone = document.getElementById("telefoneCliente").value;
    const email = document.getElementById("emailCliente").value;

    if (!nome || !telefone || !email) {
        alert("Preencha todos os campos.");
        return;
    }

    try {

        const url = clienteEditando ? `/clientes/${clienteEditando}` : "/clientes";
        const metodo = clienteEditando ? "PUT" : "POST";

        const resposta = await fetch(url, {
            method: metodo,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ nome, telefone, email })
        });

        const resultado = await resposta.json();

        if (resultado.sucesso) {

            alert("Cliente salvo com sucesso!");

            clienteEditando = null;

            document.getElementById("nomeCliente").value = "";
            document.getElementById("telefoneCliente").value = "";
            document.getElementById("emailCliente").value = "";

            carregarClientes();

        } else {
            alert("Erro ao salvar cliente.");
        }

    } catch (erro) {
        console.error("Erro:", erro);
        alert("Erro de conexão com o servidor.");
    }
}

async function carregarClientes() {
    try {

        const resposta = await fetch("http://localhost:3000/listar-clientes");
        const clientes = await resposta.json();
         const totalElement = document.getElementById("totalClientes");

        if (totalElement) {
            totalElement.textContent = `${clientes.length} cadastrados`;
        }

        const lista = document.getElementById("listaClientes");
        lista.innerHTML = "";

        clientes.forEach(cliente => {

            const item = document.createElement("div");
            item.className = "cliente-item";

            item.innerHTML = `
                <strong>${cliente.nome}</strong><br>
                📞 ${cliente.telefone || ""}<br>
                📧 ${cliente.email || ""}<br><br>

                <button onclick="editarCliente('${cliente.id}', '${cliente.nome}', '${cliente.telefone}', '${cliente.email}')">
                    Editar
                </button>

                <button onclick="excluirCliente('${cliente.id}')">
                    Excluir
                </button>
            `;

            lista.appendChild(item);
        });

    } catch (erro) {
        console.error("Erro ao carregar clientes:", erro);
    }
}

async function excluirCliente(id) {
    try {

        const resposta = await fetch(`http://localhost:3000/clientes/${id}`, {
            method: "DELETE"
        });

        if (resposta.ok) {
            alert("Cliente excluído com sucesso!");
            carregarClientes();
        }

    } catch (erro) {
        console.error("Erro:", erro);
    }
}

function editarCliente(id, nome, telefone, email) {

    clienteEditando = id;

    document.getElementById("nomeCliente").value = nome;
    document.getElementById("telefoneCliente").value = telefone;
    document.getElementById("emailCliente").value = email;

}
function filtrarClientes() {

    const texto = document.getElementById("buscarCliente").value.toLowerCase();

    const clientes = document.querySelectorAll(".cliente-item");

    clientes.forEach(cliente => {

        const conteudo = cliente.innerText.toLowerCase();

        if (conteudo.includes(texto)) {
            cliente.style.display = "";
        } else {
            cliente.style.display = "none";
        }
    });
}