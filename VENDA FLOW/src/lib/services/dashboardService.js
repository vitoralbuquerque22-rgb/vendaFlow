/**
 * dashboardService — toda lógica de acesso a métricas, insights e dados
 * agregados de dashboard passa por aqui.
 * Cobre: CommercialInsights, SdrDailyStats, ConfiguracaoMeta, MonitoramentoLog,
 * RelatorioPerformance, LogAcesso.
 */
import { base44 } from "@/api/base44Client";

const CommercialInsights  = () => base44.entities.CommercialInsights;
const SdrDailyStats       = () => base44.entities.SdrDailyStats;
const ConfiguracaoMetas   = () => base44.entities.ConfiguracaoMeta;
const MonitoramentoLogs   = () => base44.entities.MonitoramentoLog;
const RelatoriosPerf      = () => base44.entities.RelatorioPerformance;
const LogsAcesso          = () => base44.entities.LogAcesso;
const FaturamentoLeads    = () => base44.entities.FaturamentoLead;

// ── CommercialInsights ───────────────────────────────────────

export async function buscarInsightsDia(empresaId, dia) {
  if (!empresaId || !dia) return null;
  const results = await CommercialInsights().filter({ empresaId, dia });
  return results[0] || null;
}

export async function listarInsights(empresaId, { limit = 30 } = {}) {
  if (!empresaId) return [];
  return CommercialInsights().filter({ empresaId }, "-dia", limit);
}

export async function criarOuAtualizarInsights(empresaId, dia, dados) {
  const existing = await buscarInsightsDia(empresaId, dia);
  if (existing) return CommercialInsights().update(existing.id, dados);
  return CommercialInsights().create({ empresaId, dia, ...dados });
}

// ── SdrDailyStats ────────────────────────────────────────────

export async function listarStatsSdr(empresaId, { userEmail, limit = 60 } = {}) {
  if (!empresaId) return [];
  const filtro = { empresaId };
  if (userEmail) filtro.user_email = userEmail;
  return SdrDailyStats().filter(filtro, "-dia", limit);
}

export async function buscarStatsSdrDia(empresaId, userEmail, dia) {
  if (!empresaId || !userEmail || !dia) return null;
  const results = await SdrDailyStats().filter({ empresaId, user_email: userEmail, dia });
  return results[0] || null;
}

// ── ConfiguracaoMeta ─────────────────────────────────────────

export async function listarMetas(empresaId) {
  if (!empresaId) return [];
  return ConfiguracaoMetas().filter({ empresaId });
}

export async function criarMeta(dados) {
  return ConfiguracaoMetas().create(dados);
}

export async function atualizarMeta(id, dados) {
  return ConfiguracaoMetas().update(id, dados);
}

export async function excluirMeta(id) {
  return ConfiguracaoMetas().delete(id);
}

// ── MonitoramentoLog ─────────────────────────────────────────

export async function listarLogsMonitoramento(empresaId, { limit = 200 } = {}) {
  if (!empresaId) return [];
  return MonitoramentoLogs().filter({ empresaId }, "-created_date", limit);
}

export async function criarLogMonitoramento(dados) {
  return MonitoramentoLogs().create(dados);
}

// ── RelatorioPerformance ─────────────────────────────────────

export async function listarRelatoriosPerformance(empresaId, { limit = 50 } = {}) {
  if (!empresaId) return [];
  return RelatoriosPerf().filter({ empresaId }, "-created_date", limit);
}

export async function criarRelatorioPerformance(dados) {
  return RelatoriosPerf().create(dados);
}

// ── LogAcesso ────────────────────────────────────────────────

export async function listarLogsAcesso(empresaId, { limit = 100 } = {}) {
  if (!empresaId) return [];
  return LogsAcesso().filter({ empresaId }, "-created_date", limit);
}

// ── FaturamentoLead ──────────────────────────────────────────

export async function listarFaturamentos(empresaId, { leadId, limit = 100 } = {}) {
  if (!empresaId) return [];
  const filtro = { empresaId };
  if (leadId) filtro.lead_id = leadId;
  return FaturamentoLeads().filter(filtro, "-created_date", limit);
}

export async function criarFaturamento(dados) {
  return FaturamentoLeads().create(dados);
}

export async function atualizarFaturamento(id, dados) {
  return FaturamentoLeads().update(id, dados);
}