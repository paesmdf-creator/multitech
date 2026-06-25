const express = require("express");
const path = require("path");
const db = require("./database");
const app = express();
const PORT = 3000;

// permite receber JSON (futuro formulário)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// servir arquivos da pasta public
app.use(express.static(path.join(__dirname, "public")));

// rota principal
console.log("SERVIDOR CARREGADO COM SUCESSO");
app.use((req, res, next) => {
    console.log("REQ:", req.method, req.url);
    next();
});
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.post("/clientes", (req, res) => {

    const { nome, telefone, email } = req.body;

    db.run(
        `INSERT INTO clientes (nome, telefone, email)
         VALUES (?, ?, ?)`,
        [nome, telefone, email],
        function(err) {

            if (err) {
                return res.status(500).json({
                    erro: err.message
                });
            }

            res.json({
                sucesso: true,
                id: this.lastID
            });
        }
    );

});


app.get("/listar-clientes", (req, res) => {
    console.log("ROTA /listar-clientes ACESSADA");

    db.all("SELECT * FROM clientes", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ erro: err.message });
        }

        res.json(rows);
    });
});
// iniciar servidor
app.put("/clientes/:id", (req, res) => {

    const id = req.params.id;
    const { nome, telefone, email } = req.body;

    db.run(
        `UPDATE clientes
         SET nome = ?, telefone = ?, email = ?
         WHERE id = ?`,
        [nome, telefone, email, id],
        function(err) {

            if (err) {
                return res.status(500).json({
                    erro: err.message
                });
            }

            res.json({
                sucesso: true,
                mensagem: "Cliente atualizado com sucesso"
            });
        }
    );

});
app.delete("/clientes/:id", (req, res) => {
    const id = req.params.id;

    db.run(
        "DELETE FROM clientes WHERE id = ?",
        [id],
        function(err) {

            if (err) {
                return res.status(500).json({
                    erro: err.message
                });
            }

            res.json({
                sucesso: true,
                mensagem: "Cliente excluído com sucesso"
            });
        }
    );
});

// iniciar servidor
app.listen(3000, "0.0.0.0", () => {
  console.log("🚀 MultiTech rodando na porta 3000");
});