/**
 * Lead Health Score — Sprint 7.5 (revisado Ajustes 5 & 6)
 *
 * Pesos configuráveis em lib/healthScoreConfig.js
 * Classificação de 4 níveis em classificarScore()
 */
import { HEALTH_WEIGHTS, classificarScore } from "./healthScoreConfig";

export function calcularHealthScore(lead, atividades = []) {
  if (!lead) return null;

  const W = HEALTH_WEIGHTS;
  const fatores = [];
  let score = 0;

  // Lead quente
  const quente = lead.temperatura === "quente";
  if (quente) score += W.lead_quente;
  fatores.push({ label: "Lead quente", pts: W.lead_quente, ok: quente });

  // Atendimento recente (< 3 dias)
  const ultimaAtiv = atividades
    .map((a) => new Date(a.created_date || 0))
    .sort((a, b) => b - a)[0];
  const diasSemAtiv = ultimaAtiv
    ? Math.floor((Date.now() - ultimaAtiv.getTime()) / 86400000)
    : 999;
  const recente = diasSemAtiv < 3;
  if (recente) score += W.atendimento_recente;
  fatores.push({ label: "Atendimento recente", pts: W.atendimento_recente, ok: recente });

  // Follow-up criado
  const temFollowup = !!(lead.proximo_passo && lead.proximo_passo.trim());
  if (temFollowup) score += W.followup;
  fatores.push({ label: "Follow-up criado", pts: W.followup, ok: temFollowup });

  // Qualificação completa
  const qualificado = !!(lead.dor_principal || lead.observacoes) && !!(lead.urgencia);
  if (qualificado) score += W.qualificacao;
  fatores.push({ label: "Qualificação completa", pts: W.qualificacao, ok: qualificado });

  // Urgência imediata
  const urgImediata = lead.urgencia === "imediata" || lead.urgencia === "alta";
  if (urgImediata) score += W.urgencia;
  fatores.push({ label: "Urgência imediata", pts: W.urgencia, ok: urgImediata });

  // Interesse alto
  const interesseAlto = (lead.probabilidade_fechamento ?? 0) >= 70;
  if (interesseAlto) score += W.interesse;
  fatores.push({ label: "Interesse alto", pts: W.interesse, ok: interesseAlto });

  // Engajamento
  const engajado = (lead.total_ligacoes ?? 0) >= 2;
  if (engajado) score += W.engajamento;
  fatores.push({ label: "Engajamento", pts: W.engajamento, ok: engajado });

  const classificacao = classificarScore(score);

  return {
    score,
    label: classificacao.label,
    color: classificacao.color,
    icon:  classificacao.icon,
    fatores,
  };
}