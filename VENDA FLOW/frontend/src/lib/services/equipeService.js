/**
 * equipeService — toda lógica de acesso a Equipe e VinculoEmpresa passa por aqui.
 */
import { api } from "@/api/client";

const Equipes   = () => api.entities.Equipe;
const Vinculos  = () => api.entities.VinculoEmpresa;
const Produtos  = () => api.entities.Produto;
const Formularios = () => api.entities.Formulario;

export async function listarEquipes(empresaId) {
  if (!empresaId) return [];
  return Equipes().filter({ empresaId });
}

export async function listarTodasEquipes(empresaId) {
  if (!empresaId) return [];
  return Equipes().filter({ empresaId });
}

export async function criarEquipe(dados) {
  return Equipes().create(dados);
}

export async function atualizarEquipe(id, dados) {
  return Equipes().update(id, dados);
}

export async function excluirEquipe(id) {
  return Equipes().delete(id);
}

export async function listarVinculos(empresaId) {
  if (!empresaId) return [];
  return Vinculos().filter({ empresaId, status: "ativo" });
}

export async function listarProdutos(empresaId, { apenasAtivos = true } = {}) {
  if (!empresaId) return [];
  const filtro = { empresaId };
  if (apenasAtivos) filtro.ativo = true;
  return Produtos().filter(filtro);
}

export async function listarFormularios(empresaId, { apenasAtivos = true } = {}) {
  if (!empresaId) return [];
  const filtro = { empresaId };
  if (apenasAtivos) filtro.ativo = true;
  return Formularios().filter(filtro);
}

export async function listarClosers(empresaId) {
  if (!empresaId) return [];
  const vinculos = await Vinculos().filter({ empresaId, status: "ativo" });
  const mapaNomes = await carregarMapaNomes(empresaId);
  return vinculos
    .filter(v => ["closer", "gestor", "admin", "super_admin", "gerente_empresa", "supervisor"].includes(v.papel))
    .map(v => {
      const emailLower = (v.userEmail || '').toLowerCase();
      return {
        id: v.userEmail,
        email: v.userEmail,
        full_name: v.userName?.trim() || mapaNomes.get(emailLower) || v.userEmail.split("@")[0],
        role: v.papel,
      };
    });
}

export async function criarVinculo(dados) {
  return Vinculos().create(dados);
}

export async function atualizarVinculo(id, dados) {
  return Vinculos().update(id, dados);
}

export async function excluirVinculo(id) {
  return Vinculos().delete(id);
}

export async function buscarVinculo(empresaId, userEmail) {
  if (!empresaId || !userEmail) return null;
  const results = await Vinculos().filter({ empresaId, userEmail, status: "ativo" });
  return results[0] || null;
}

export async function listarVinculosPorEmail(userEmail) {
  if (!userEmail) return [];
  return Vinculos().filter({ userEmail, status: "ativo" });
}

/** Carrega mapa email→nome a partir dos UserProfiles da empresa */
export async function carregarMapaNomes(empresaId) {
  if (!empresaId) return new Map();
  try {
    const profiles = await api.entities.UserProfile.filter({ empresa_id: empresaId });
    const mapa = new Map();
    for (const p of profiles) {
      if (p.user_email) {
        const nome = p.user_name?.trim() || p.apelido?.trim() || null;
        if (nome) mapa.set(p.user_email.toLowerCase(), nome);
      }
    }
    return mapa;
  } catch {
    return new Map();
  }
}

/** Resolve nome por email usando o mapa de nomes */
export function resolverNomePorEmail(email, mapaNomes) {
  if (!email) return 'Usuário';
  const nome = mapaNomes?.get(email.toLowerCase());
  return nome || email.split('@')[0];
}

/** Converte vinculos em objetos de usuário leves (sem precisar chamar User) — deduplicado por email */
export function vinculosParaUsuarios(vinculos, mapaNomes = new Map()) {
  const seen = new Map();
  for (const v of vinculos) {
    if (!seen.has(v.userEmail)) {
      const emailLower = (v.userEmail || '').toLowerCase();
      seen.set(v.userEmail, {
        id: v.userEmail,
        email: v.userEmail,
        full_name: v.userName?.trim() || mapaNomes.get(emailLower) || v.userEmail.split("@")[0],
        papel: v.papel,
        foto_perfil: null,
      });
    }
  }
  return Array.from(seen.values());
}