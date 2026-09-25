/**
 * telefoniaService — toda lógica de acesso a CallSession, Integracao e UserProfile
 * passa por aqui. Componentes NUNCA acessam essas entidades diretamente.
 */
import { api } from "@/api/client";

const CallSessions  = () => api.entities.CallSession;
const Integracoes   = () => api.entities.Integracao;
const UserProfiles  = () => api.entities.UserProfile;

// ── CallSession ──────────────────────────────────────────────

export async function buscarCallSessionAtiva(empresaId, sdrEmail) {
  if (!empresaId || !sdrEmail) return null;
  const sessoes = await CallSessions().filter({ empresaId, sdr_email: sdrEmail, status: "answered" });
  if (!sessoes.length) return null;
  return sessoes.sort((a, b) => new Date(b.iniciada_em || 0) - new Date(a.iniciada_em || 0))[0];
}

export async function buscarCallSessionPorId(id) {
  if (!id) return null;
  const results = await CallSessions().filter({ id });
  return results[0] || null;
}

export async function buscarCallSessionPorTelefone(empresaId, telefone) {
  if (!empresaId || !telefone) return [];
  return CallSessions().filter({ empresaId, lead_telefone: telefone });
}

export async function listarCallSessions(empresaId, { sdrEmail, status, limit = 100 } = {}) {
  if (!empresaId) return [];
  const filtro = { empresaId };
  if (sdrEmail) filtro.sdr_email = sdrEmail;
  if (status) filtro.status = status;
  return CallSessions().filter(filtro, "-created_date", limit);
}

export async function criarCallSession(dados) {
  return CallSessions().create(dados);
}

export async function atualizarCallSession(id, dados) {
  return CallSessions().update(id, dados);
}

// ── Integracao ───────────────────────────────────────────────

export async function buscarIntegracaoTelefonia(empresaId) {
  if (!empresaId) return null;
  const integracoes = await Integracoes().filter({ empresaId, tipo: "telefonia", ativa: true });
  return integracoes.find(i => i.configuracao?.fornecedor === "3cplus") || null;
}

export async function listarIntegracoes(empresaId, { tipo } = {}) {
  if (!empresaId) return [];
  const filtro = { empresaId };
  if (tipo) filtro.tipo = tipo;
  return Integracoes().filter(filtro);
}

export async function criarIntegracao(dados) {
  return Integracoes().create(dados);
}

export async function atualizarIntegracao(id, dados) {
  return Integracoes().update(id, dados);
}

export async function excluirIntegracao(id) {
  return Integracoes().delete(id);
}

// ── UserProfile ──────────────────────────────────────────────

export async function buscarUserProfile(userEmail) {
  if (!userEmail) return null;
  const profiles = await UserProfiles().filter({ user_email: userEmail });
  return profiles[0] || null;
}

export async function listarUserProfiles(empresaId) {
  if (!empresaId) return [];
  // UserProfile não tem empresaId — listagem global filtrada no front por vínculo
  return UserProfiles().list();
}

export async function criarUserProfile(dados) {
  return UserProfiles().create(dados);
}

export async function atualizarUserProfile(id, dados) {
  return UserProfiles().update(id, dados);
}

export async function excluirUserProfile(id) {
  return UserProfiles().delete(id);
}