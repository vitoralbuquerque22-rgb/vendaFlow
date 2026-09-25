/**
 * atividadeService — toda lógica de acesso a Atividade passa por aqui.
 */
import { base44 } from "@/api/base44Client";

const Atividades = () => base44.entities.Atividade;

export async function listarAtividades(empresaId, { limit = 1000 } = {}) {
  if (!empresaId) return [];
  return Atividades().filter({ empresaId }, "-created_date", limit);
}

export async function criarAtividade(dados) {
  return Atividades().create(dados);
}

export async function listarTodasAtividades(empresaId, { sort = "-created_date", limit = 1000 } = {}) {
  if (!empresaId) return [];
  return Atividades().filter({ empresaId }, sort, limit);
}

export async function listarAtividadesPorSDR(empresaId, sdrEmail, { limit = 500 } = {}) {
  if (!empresaId || !sdrEmail) return [];
  return Atividades().filter({ empresaId, sdr_email: sdrEmail }, "-created_date", limit);
}

export async function listarAtividadesPorTipo(empresaId, tipo, { limit = 500 } = {}) {
  if (!empresaId || !tipo) return [];
  return Atividades().filter({ empresaId, tipo }, "-created_date", limit);
}

export async function atualizarAtividade(id, dados) {
  return Atividades().update(id, dados);
}

export async function excluirAtividade(id) {
  return Atividades().delete(id);
}

export async function listarAtividadesDoLead(leadId, { limit = 100 } = {}) {
  if (!leadId) return [];
  return Atividades().filter({ lead_id: leadId }, "-created_date", limit);
}