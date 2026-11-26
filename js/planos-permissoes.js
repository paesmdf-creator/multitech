// js/planos-permissoes.js
// Definição dos 4 planos (Starter, Profissional, Empresarial, Premium) e dos 4 perfis internos

export const PLANOS_MULTITECH = {
  starter: {
    id: "starter",
    nome: "Starter",
    preco: 39.9,
    precoTexto: "R$ 39,90",
    destaque: "Essencial",
    descricaoUsuarios: "1 usuário (Administrador)",
    maxUsuariosInternos: 1,
    perfisPermitidos: ["admin"],
    permissoesCustomizaveis: false,
    especificacoes: [
      "Cadastro de clientes",
      "Cadastro de serviços",
      "Agenda de atendimentos",
      "Portfólio digital",
      "Controle básico de receitas e despesas"
    ],
    modulos: [
      "clientes",
      "servicos",
      "agenda",
      "portfolio",
      "financeiro_basico"
    ]
  },
  profissional: {
    id: "profissional",
    nome: "Profissional",
    preco: 59.9,
    precoTexto: "R$ 59,90",
    destaque: "Mais completo p/ autônomos",
    descricaoUsuarios: "Até 2 usuários no mesmo login",
    maxUsuariosInternos: 2,
    perfisPermitidos: ["admin", "atendente"],
    permissoesCustomizaveis: false,
    especificacoes: [
      "Tudo do Starter",
      "Gestão financeira completa",
      "Planilha mensal automatizada",
      "Fluxo de caixa",
      "Relatórios financeiros",
      "Agendamento online pelos clientes",
      "Histórico de atendimentos",
      "Página comercial personalizada"
    ],
    modulos: [
      "clientes",
      "servicos",
      "agenda",
      "portfolio",
      "financeiro_basico",
      "financeiro_completo",
      "planilha_mensal",
      "fluxo_caixa",
      "relatorios_financeiros",
      "agendamento_online",
      "historico_atendimentos",
      "pagina_comercial"
    ]
  },
  empresarial: {
    id: "empresarial",
    nome: "Empresarial",
    preco: 89.9,
    precoTexto: "R$ 89,90",
    destaque: "Ideal para equipes",
    descricaoUsuarios: "Até 6 usuários no mesmo login",
    maxUsuariosInternos: 6,
    perfisPermitidos: ["admin", "gerente", "profissional", "atendente"],
    permissoesCustomizaveis: false,
    especificacoes: [
      "Tudo do Profissional",
      "Cadastro de funcionários",
      "Agenda por profissional",
      "Relatórios de desempenho",
      "Indicadores comerciais",
      "Controle de produtividade"
    ],
    modulos: [
      "clientes",
      "servicos",
      "agenda",
      "portfolio",
      "financeiro_basico",
      "financeiro_completo",
      "planilha_mensal",
      "fluxo_caixa",
      "relatorios_financeiros",
      "agendamento_online",
      "historico_atendimentos",
      "pagina_comercial",
      "cadastro_funcionarios",
      "agenda_por_profissional",
      "relatorios_desempenho",
      "indicadores_comerciais",
      "controle_produtividade"
    ]
  },
  premium: {
    id: "premium",
    nome: "Premium",
    preco: 129.9,
    precoTexto: "R$ 129,90",
    destaque: "Gestão avançada",
    descricaoUsuarios: "Gestão ampliada de usuários",
    maxUsuariosInternos: 99,
    perfisPermitidos: ["admin", "gerente", "profissional", "atendente"],
    permissoesCustomizaveis: true,
    especificacoes: [
      "Todos os recursos anteriores",
      "Indicadores gerenciais avançados",
      "Relatórios comparativos",
      "Gestão ampliada de usuários",
      "Recursos adicionais de administração"
    ],
    modulos: [
      "clientes",
      "servicos",
      "agenda",
      "portfolio",
      "financeiro_basico",
      "financeiro_completo",
      "planilha_mensal",
      "fluxo_caixa",
      "relatorios_financeiros",
      "agendamento_online",
      "historico_atendimentos",
      "pagina_comercial",
      "cadastro_funcionarios",
      "agenda_por_profissional",
      "relatorios_desempenho",
      "indicadores_comerciais",
      "controle_produtividade",
      "indicadores_gerenciais",
      "relatorios_comparativos",
      "gestao_usuarios",
      "admin_avancado"
    ]
  }
};

export const PERFIS_INTERNOS = {
  admin: {
    label: "Administrador",
    descricao: "Acesso total aos módulos do plano, usuários internos e configurações.",
    modulosPermitidos: "*"
  },
  gerente: {
    label: "Gerente",
    descricao: "Gestão operacional completa, equipe e relatórios de desempenho.",
    modulosPermitidos: [
      "clientes",
      "servicos",
      "agenda",
      "agenda_por_profissional",
      "portfolio",
      "financeiro_basico",
      "financeiro_completo",
      "planilha_mensal",
      "fluxo_caixa",
      "relatorios_financeiros",
      "historico_atendimentos",
      "relatorios_desempenho",
      "indicadores_comerciais",
      "controle_produtividade"
    ]
  },
  profissional: {
    label: "Profissional",
    descricao: "Agenda própria, histórico de atendimentos e atualização de serviços.",
    modulosPermitidos: [
      "clientes",
      "agenda",
      "agenda_por_profissional",
      "historico_atendimentos",
      "portfolio"
    ]
  },
  atendente: {
    label: "Atendente",
    descricao: "Cadastro de clientes, agendamentos e lançamentos básicos do dia.",
    modulosPermitidos: [
      "clientes",
      "servicos",
      "agenda",
      "agenda_por_profissional",
      "historico_atendimentos",
      "financeiro_basico"
    ]
  }
};

export function obterPlano(planoId) {
  const chave = String(planoId || "starter").toLowerCase();
  return PLANOS_MULTITECH[chave] || PLANOS_MULTITECH.starter;
}

export function podeAcessarModulo(planoId, operador, modulo) {
  const plano = obterPlano(planoId);
  if (!plano.modulos.includes(modulo)) return false;

  if (!operador || operador.perfil === "admin") return true;

  if (
    plano.permissoesCustomizaveis &&
    Array.isArray(operador.modulosExtras) &&
    operador.modulosExtras.length > 0
  ) {
    return operador.modulosExtras.includes(modulo);
  }

  const perfil = PERFIS_INTERNOS[operador.perfil];
  if (!perfil) return false;
  if (perfil.modulosPermitidos === "*") return true;

  return perfil.modulosPermitidos.includes(modulo);
}

export function aplicarPermissoesNaInterface(planoId, operador) {
  const plano = obterPlano(planoId);

  document.querySelectorAll("[data-modulo]").forEach((el) => {
    const modulo = el.getAttribute("data-modulo");
    const liberado = podeAcessarModulo(plano.id, operador, modulo);
    el.classList.toggle("hidden", !liberado);
  });

  const painelEquipe = document.getElementById("mt-painel-gestao-operadores");
  if (painelEquipe) {
    const isAdmin = operador?.perfil === "admin";
    const permiteMulti = plano.maxUsuariosInternos > 1;
    painelEquipe.classList.toggle("hidden", !(isAdmin && permiteMulti));
  }

  const btnTrocar = document.getElementById("mt-btn-trocar-operador");
  if (btnTrocar) {
    btnTrocar.classList.toggle("hidden", !(plano.maxUsuariosInternos > 1));
  }
}
