import { useMemo } from "react";

/**
 * Calcula o score de completude do atendimento (0–100) e lista os critérios.
 * Pesos conforme spec:
 *   resultado       20%
 *   qualificacao    20%
 *   dor_principal   20%
 *   urgencia        15%
 *   observacao      15%
 *   proxima_acao    10%
 */
const CRITERIOS = [
  { key: "resultado",    label: "Resultado",      peso: 20, check: (f) => !!f.resultado },
  { key: "qualificacao", label: "Qualificação",   peso: 20, check: (f) => !!f.status_lead && f.status_lead !== "" },
  { key: "dor_principal",label: "Dor principal",  peso: 20, check: (f) => !!f.dor_principal },
  { key: "urgencia",     label: "Urgência",       peso: 15, check: (f) => !!f.urgencia },
  { key: "observacao",   label: "Observação",     peso: 15, check: (f) => !!(f.observacao && f.observacao.length > 5) },
  { key: "proxima_acao", label: "Próxima ação",   peso: 10, check: (f) => !!(f.agendar_proximo_contato || f.agendar_reuniao) },
];

export function useQualidadeAtendimento(formData) {
  return useMemo(() => {
    let score = 0;
    const itens = CRITERIOS.map((c) => {
      const ok = c.check(formData);
      if (ok) score += c.peso;
      return { ...c, ok };
    });
    return { score, itens };
  }, [
    formData.resultado,
    formData.status_lead,
    formData.dor_principal,
    formData.urgencia,
    formData.observacao,
    formData.agendar_proximo_contato,
    formData.agendar_reuniao,
  ]);
}