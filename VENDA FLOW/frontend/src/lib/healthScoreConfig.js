/**
 * Health Score Config — pesos configuráveis (Ajuste 5)
 * Altere os pesos aqui sem tocar na lógica de negócio.
 */
export const HEALTH_WEIGHTS = {
  lead_quente:          20,
  atendimento_recente:  20,
  followup:             15,
  qualificacao:         15,
  urgencia:             10,
  interesse:            10,
  engajamento:          10,
};

/**
 * Classificação por score (Ajuste 6)
 * 🔥 Prioridade máxima ≥ 85
 * 🟢 Alta prioridade   ≥ 70
 * 🟡 Prioridade média  ≥ 50
 * ⚪ Baixa prioridade  <  50
 */
export function classificarScore(score) {
  if (score >= 85) return { label: "Prioridade máxima", icon: "🔥", color: "#ef4444" };
  if (score >= 70) return { label: "Alta prioridade",   icon: "🟢", color: "#22c55e" };
  if (score >= 50) return { label: "Prioridade média",  icon: "🟡", color: "#f59e0b" };
  return            { label: "Baixa prioridade",        icon: "⚪", color: "#64748b" };
}