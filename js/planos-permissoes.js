export const PLANOS_MULTITECH = {
  starter: {
    id: "starter",
    nome: "Starter",
    precoMensal: 39.9,
    limiteOperadores: 2,
    destaque: false,
    badge: "Essencial",
    perfis: ["admin", "operador"],
    modulos: ["clientes", "servicos", "agenda", "financeiro_basico"],
    recursos: [
      "Até 2 usuários internos no mesmo login",
      "Cadastro de clientes e serviços",
      "Agenda de atendimentos",
      "Financeiro básico (entradas e saídas)"
    ]
  },
  profissional: {
    id: "profissional",
    nome: "Profissional",
    precoMensal: 59.9,
    limiteOperadores: 5,
    destaque: true,
    badge: "Mais escolhido",
    perfis: ["admin", "gestor", "operador"],
    modulos: [
      "clientes",
      "servicos",
      "agenda",
      "agenda_por_profissional",
      "portfolio",
      "financeiro_basico",
      "fluxo_caixa",
      "relatorios_financeiros"
    ],
    recursos: [
      "Até 5 usuários internos no mesmo login",
      "Agenda por profissional e portfólio",
      "Fluxo de caixa e relatórios financeiros",
      "Perfis internos Admin, Gestor e Operador"
    ]
  },
  empresarial: {
    id: "empresarial",
    nome: "Empresarial",
    precoMensal: 89.9,
    limiteOperadores: 12,
    destaque: false,
    badge: "Equipes",
    perfis: ["admin", "gestor", "financeiro", "operador"],
    modulos: [
      "clientes",
      "servicos",
      "agenda",
      "agenda_por_profissional",
      "agendamento_online",
      "portfolio",
      "pagina_comercial",
      "financeiro_basico",
      "fluxo_caixa",
      "relatorios_financeiros",
      "relatorios_desempenho",
      "gestao_usuarios"
    ],
    recursos: [
      "Até 12 usuários internos no mesmo login",
      "Página comercial e agendamento online",
      "Relatórios de desempenho e gestão de equipe",
      "Perfil interno Financeiro dedicado"
    ]
  },
  premium: {
    id: "premium",
    nome: "Premium",
    precoMensal: 129.9,
    limiteOperadores: 30,
    destaque: false,
    badge: "Completo",
    perfis: ["admin", "gestor", "financeiro", "operador"],
    modulos: [
      "clientes",
      "servicos",
      "agenda",
      "agenda_por_profissional",
      "agendamento_online",
      "portfolio",
      "pagina_comercial",
      "financeiro_basico",
      "fluxo_caixa",
      "relatorios_financeiros",
      "relatorios_desempenho",
      "relatorios_comparativos",
      "gestao_usuarios"
    ],
    recursos: [
      "Até 30 usuários internos no mesmo login",
      "Todos os módulos e relatórios comparativos",
      "Indicadores gerenciais avançados"
    ]
  }
};

export const PERFIS_INTERNOS = {
  admin: {
    nome: "Administrador",
    descricao: "Acesso total às configurações, equipe, planos e lançamentos da empresa."
  },
  gestor: {
    nome: "Gestor",
    descricao: "Gerencia clientes, serviços, agenda, portfólio e relatórios operacionais."
  },
  financeiro: {
    nome: "Financeiro",
    descricao: "Foco em lançamentos financeiros, fluxo de caixa e relatórios financeiros."
  },
  operador: {
    nome: "Operador",
    descricao: "Atendimento diário, cadastro de clientes e atualização da agenda."
  }
};

export function obterPlano(planoId) {
  return PLANOS_MULTITECH[planoId] || PLANOS_MULTITECH.starter;
}

export function obterPerfisPermitidosNoPlano(planoId) {
  return obterPlano(planoId).perfis || ["admin", "operador"];
}

export function podeUsarModulo(planoId, modulo) {
  if (!modulo) return true;
  const plano = obterPlano(planoId);
  return Array.isArray(plano.modulos) && plano.modulos.includes(modulo);
}

export function limiteOperadoresDoPlano(planoId) {
  return obterPlano(planoId).limiteOperadores ?? 2;
}
