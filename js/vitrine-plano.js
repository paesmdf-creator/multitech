// js/vitrine-planos.js
// Renderiza os 4 planos com suas especificações completas para contratação ou upgrade

import { PLANOS_MULTITECH, PERFIS_INTERNOS } from "./planos-permissoes.js";

export function renderizarVitrinePlanos(containerId, opcoes = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { planoAtual = null, onSelecionarPlano = null } = opcoes;
  const ordem = ["starter", "profissional", "empresarial", "premium"];

  container.innerHTML = ordem
    .map((planoId) => {
      const plano = PLANOS_MULTITECH[planoId];
      const isAtual = String(planoAtual || "").toLowerCase() === planoId;
      const perfisNomes = plano.perfisPermitidos
        .map((p) => PERFIS_INTERNOS[p]?.label || p)
        .join(", ");

      const specsHtml = plano.especificacoes
        .map((item) => `<li>✓ ${item}</li>`)
        .join("");

      return `
        <article class="plano-card ${planoId === "empresarial" ? "destaque" : ""}">
          <div>
            <span class="plano-badge">${plano.destaque}</span>
            <h4 class="plano-nome">${plano.nome}</h4>
            <div class="plano-preco">${plano.precoTexto}<span>/mês</span></div>
            <div class="plano-usuarios">👥 ${plano.descricaoUsuarios}</div>
            <div class="plano-perfis">Perfis: ${perfisNomes}</div>
            <ul class="plano-lista">${specsHtml}</ul>
          </div>
          <button
            type="button"
            class="btn ${planoId === "empresarial" ? "btn-secondary" : "btn-primary"} full-width"
            data-escolher-plano="${planoId}"
            ${isAtual ? "disabled" : ""}
          >
            ${isAtual ? "Plano atual" : `Escolher ${plano.nome}`}
          </button>
        </article>
      `;
    })
    .join("");

  if (typeof onSelecionarPlano === "function") {
    container.querySelectorAll("[data-escolher-plano]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const escolhido = btn.getAttribute("data-escolher-plano");
        onSelecionarPlano(escolhido, PLANOS_MULTITECH[escolhido]);
      });
    });
  }
}
