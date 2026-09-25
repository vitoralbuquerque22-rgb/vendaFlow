/**
 * Tenant Score — Sprint 7.7 Ajuste 8
 *
 * Calcula nota 0-100 de engajamento/saúde de cada tenant
 * com base em métricas operacionais.
 *
 * Critérios e pesos:
 *   uso_crm         20% — atividades registradas / leads ativos
 *   uso_cockpit     15% — sessões no cockpit
 *   uso_ia          15% — análises IA geradas
 *   followups       20% — tarefas concluídas no prazo
 *   qualidade       15% — score médio de qualidade
 *   conversao       10% — taxa reuniões agendadas / leads
 *   engajamento      5% — dias com atividade no mês
 */

export const TENANT_SCORE_WEIGHTS = {
  uso_crm:     0.20,
  uso_cockpit: 0.15,
  uso_ia:      0.15,
  followups:   0.20,
  qualidade:   0.15,
  conversao:   0.10,
  engajamento: 0.05,
};

/**
 * calcularTenantScore(metricas)
 *
 * metricas: {
 *   uso_crm:     0–100  (atividades/lead)
 *   uso_cockpit: 0–100  (sessões/semana)
 *   uso_ia:      0–100  (análises/semana)
 *   followups:   0–100  (% tarefas no prazo)
 *   qualidade:   0–100  (score médio)
 *   conversao:   0–100  (% leads convertidos)
 *   engajamento: 0–100  (% dias com atividade)
 * }
 */
export function calcularTenantScore(metricas) {
  let score = 0;
  for (const [key, peso] of Object.entries(TENANT_SCORE_WEIGHTS)) {
    const val = Math.min(100, Math.max(0, metricas[key] ?? 0));
    score += val * peso;
  }
  return Math.round(score);
}

export function classificarTenantScore(score) {
  if (score >= 85) return { label: "Excelente", color: "#22c55e", emoji: "🏆" };
  if (score >= 70) return { label: "Bom",       color: "#6366f1", emoji: "✅" };
  if (score >= 50) return { label: "Atenção",   color: "#f59e0b", emoji: "⚠️" };
  return              { label: "Crítico",    color: "#f87171", emoji: "🚨" };
}