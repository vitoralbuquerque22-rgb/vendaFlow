/**
 * useScoreQualidade — Sprint 7.5
 *
 * Separa COMPLETUDE de QUALIDADE (dois scores distintos):
 *
 *  Completude (0-100): "Preencheu tudo?"
 *    Cada campo tem peso binário (preenchido ou não).
 *
 *  Qualidade (0-100): "Preencheu bem?"
 *    Penaliza respostas rasas: observação curta, sem follow-up,
 *    temperatura não selecionada, probabilidade no default (50).
 */
import { useMemo } from "react";

// ── Critérios de COMPLETUDE ──────────────────────────────────
const CRITERIOS_COMPLETUDE = [
  { key: "resultado",     label: "Resultado",     peso: 20, check: (f) => !!f.resultado },
  { key: "qualificacao",  label: "Qualificação",  peso: 20, check: (f) => !!f.status_lead && f.status_lead !== "" },
  { key: "dor_principal", label: "Dor principal", peso: 20, check: (f) => !!f.dor_principal },
  { key: "urgencia",      label: "Urgência",      peso: 15, check: (f) => !!f.urgencia },
  { key: "observacao",    label: "Observação",    peso: 15, check: (f) => !!(f.observacao && f.observacao.trim().length > 5) },
  { key: "proxima_acao",  label: "Próxima ação",  peso: 10, check: (f) => !!(f.agendar_proximo_contato || f.agendar_reuniao) },
];

// ── Critérios de QUALIDADE ───────────────────────────────────
// Cada item tem: peso, check(f) → booleano (true = OK, false = penaliza)
const CRITERIOS_QUALIDADE = [
  {
    key: "obs_substancial",
    label: "Observação substancial",
    peso: 25,
    aviso: "Observação muito curta (< 30 chars)",
    check: (f) => !!(f.observacao && f.observacao.trim().length >= 30),
  },
  {
    key: "followup_criado",
    label: "Follow-up agendado",
    peso: 25,
    aviso: "Não criou follow-up",
    check: (f) => !!(f.agendar_proximo_contato || f.agendar_reuniao),
  },
  {
    key: "temperatura_definida",
    label: "Temperatura definida",
    peso: 20,
    aviso: "Temperatura não selecionada",
    check: (f) => !!f.temperatura,
  },
  {
    key: "probabilidade_ajustada",
    label: "Probabilidade ajustada",
    peso: 15,
    aviso: "Probabilidade no valor padrão (50%)",
    check: (f) => f.probabilidade_fechamento !== undefined && f.probabilidade_fechamento !== 50,
  },
  {
    key: "produto_vinculado",
    label: "Produto vinculado",
    peso: 15,
    aviso: "Nenhum produto selecionado",
    check: (f) => !!f.produto_id,
  },
];

export function useScoreQualidade(formData) {
  return useMemo(() => {
    // — Completude —
    let completude = 0;
    const itensCompletude = CRITERIOS_COMPLETUDE.map((c) => {
      const ok = c.check(formData);
      if (ok) completude += c.peso;
      return { ...c, ok };
    });

    // — Qualidade —
    let qualidade = 0;
    const itensQualidade = CRITERIOS_QUALIDADE.map((c) => {
      const ok = c.check(formData);
      if (ok) qualidade += c.peso;
      return { ...c, ok };
    });

    const avisos = itensQualidade.filter((i) => !i.ok).map((i) => i.aviso);

    return {
      completude,          // 0-100
      qualidade,           // 0-100
      itensCompletude,
      itensQualidade,
      avisos,              // strings dos pontos de melhoria
    };
  }, [
    formData.resultado,
    formData.status_lead,
    formData.dor_principal,
    formData.urgencia,
    formData.observacao,
    formData.agendar_proximo_contato,
    formData.agendar_reuniao,
    formData.temperatura,
    formData.probabilidade_fechamento,
    formData.produto_id,
  ]);
}