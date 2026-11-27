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
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { auth, db } from "./firebase-config.js";
import { GerenciadorOperadores } from "./operadores.js";
import * as planosModulo from "./planos-permissoes.js";

const ROOT_COLLECTION = "multitech_empresas";

const PLANOS_PADRAO = [
  {
    id: "basic",
    nome: "Basic",
    preco: "R$ 39,90",
    limiteOperadores: 2,
    descricao: "Operação essencial para início de atendimento e registro de clientes."
  },
  {
    id: "standard",
    nome: "Standard",
    preco: "R$ 59,90",
    limiteOperadores: 5,
    descricao: "Gestão do dia a dia com serviços, financeiro e formação de equipes."
  },
  {
    id: "advanced",
    nome: "Advanced",
    preco: "R$ 89,90",
    limiteOperadores: 12,
    descricao: "Controle ampliado com mais operadores, equipes e visão financeira."
  },
  {
    id: "premium",
    nome: "Premium",
    preco: "R$ 129,90",
    limiteOperadores: 99,
    descricao: "Capacidade máxima de operadores, equipes e recursos sem travas."
  }
];

function obterCatalogoPlanos() {
  const bruto =
    planosModulo.PLANOS ||
    planosModulo.planos ||
    planosModulo.CATALOGO_PLANOS ||
    null;

  if (!bruto) return PLANOS_PADRAO;

  const lista = Array.isArray(bruto)
    ? bruto
    : Object.entries(bruto).map(([chave, val]) => ({
        id: val?.id || chave,
        ...(typeof val === "object" ? val : {})
      }));

  if (!lista.length) return PLANOS_PADRAO;

  return lista.map((item, idx) => {
    const fallback = PLANOS_PADRAO[idx] || PLANOS_PADRAO[PLANOS_PADRAO.length - 1];
    const id = String(item.id || item.slug || fallback.id).toLowerCase();
    return {
      id,
      nome: item.nome || item.name || item.titulo || fallback.nome,
      preco: fallback.preco || item.preco || item.price || item.valor,
      limiteOperadores:
        typeof planosModulo.limiteOperadoresDoPlano === "function"
          ? planosModulo.limiteOperadoresDoPlano(id)
          : (item.limiteOperadores ?? item.maxOperadores ?? item.operadores ?? fallback.limiteOperadores),
      descricao: item.descricao || item.description || fallback.descricao
    };
  });
}

const PLANOS_CATALOGO = obterCatalogoPlanos();
