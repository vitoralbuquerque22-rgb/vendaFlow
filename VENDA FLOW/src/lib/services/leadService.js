/**
 * leadService — toda lógica de acesso a Lead e LeadScore passa por aqui.
 * Páginas e componentes NUNCA importam base44.entities.Lead diretamente.
 */
import { base44 } from "@/api/base44Client";

const Leads     = () => base44.entities.Lead;
const LeadScores = () => base44.entities.LeadScore;

// ── Queries ─────────────────────────────────────────────────
export async function listarLeads(empresaId, { apenasDoSDR, sdrEmail } = {}) {
  if (!empresaId) return [];
  const todos = await Leads().filter({ empresaId }, "-created_date", 10000);
  if (apenasDoSDR && sdrEmail) {
    return todos.filter(l => l.sdr_responsavel === sdrEmail || !l.sdr_responsavel);
  }
  return todos;
}

export async function listarTodosLeads(empresaId) {
  if (!empresaId) return [];
  return Leads().filter({ empresaId }, "-created_date");
}

export async function listarLeadScores(empresaId) {
  if (!empresaId) return [];
  return LeadScores().filter({ empresaId });
}

export async function buscarLeadPorId(leadId) {
  if (!leadId) return null;
  const results = await Leads().filter({ id: leadId });
  return results[0] || null;
}

// ── Mutations ────────────────────────────────────────────────
export async function criarLead(dados) {
  return Leads().create(dados);
}

export async function atualizarLead(id, dados) {
  return Leads().update(id, dados);
}

export async function excluirLead(id) {
  return base44.functions.invoke('excluirLeadCascata', { leadId: id });
}

export async function listarAtividadesDoLead(leadId, { limit = 100 } = {}) {
  if (!leadId) return [];
  return base44.entities.Atividade.filter({ lead_id: leadId }, "-created_date", limit);
}

export async function listarTarefasDoLead(leadId, { limit = 50 } = {}) {
  if (!leadId) return [];
  return base44.entities.Tarefa.filter({ lead_id: leadId }, "-created_date", limit);
}

export async function listarLeadScoreDoLead(leadId) {
  if (!leadId) return null;
  const results = await base44.entities.LeadScore.filter({ lead_id: leadId });
  return results[0] || null;
}

export async function listarRespostasDiagnostico(leadId) {
  if (!leadId) return [];
  return base44.entities.RespostaDiagnostico.filter({ lead_id: leadId }, "-created_date");
}

// Alias mantido por compatibilidade com chamadores existentes
export const buscarLeadPorIdDireto = buscarLeadPorId;

export async function liberarLockLead(id) {
  return Leads().update(id, {
    is_locked_for_call: false,
    lock_agent_email: null,
    call_session_id: null,
    lock_at: null,
  });
}

export async function bloquearLead(id, agentEmail, callSessionId) {
  return Leads().update(id, {
    is_locked_for_call: true,
    lock_agent_email: agentEmail,
    call_session_id: callSessionId || null,
    lock_at: new Date().toISOString(),
  });
}

export async function listarLeadsPorTelefone(empresaId, telefone) {
  if (!empresaId || !telefone) return [];
  return Leads().filter({ empresaId, telefone });
}

export async function listarLeadsPorStatus(empresaId, status) {
  if (!empresaId || !status) return [];
  return Leads().filter({ empresaId, status }, "-created_date");
}

export async function listarLeadsPorSDR(empresaId, sdrEmail) {
  if (!empresaId || !sdrEmail) return [];
  return Leads().filter({ empresaId, sdr_responsavel: sdrEmail }, "-created_date");
}

export async function listarLeadsPorCloser(empresaId, closerEmail) {
  if (!empresaId || !closerEmail) return [];
  return Leads().filter({ empresaId, closer_responsavel: closerEmail }, "-created_date");
}

export async function bulkCriarLeads(lista) {
  if (!lista?.length) return [];
  return Leads().bulkCreate(lista);
}

/**
 * Paginação server-side — chama a backend function buscarLeadsPaginados.
 * Retorna { leads, total, totalPaginas, pagina, contadores }
 */
export async function buscarLeadsPaginados(params) {
  const res = await base44.functions.invoke('buscarLeadsPaginados', params);
  return res.data;
}