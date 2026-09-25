/**
 * useObservability — Sprint 7.8
 * Problema 3: suporte a span por atendimento/ação
 * Problema 5: separação entre operação e tech (não muda aqui — só serviço)
 */
import { useCallback, useEffect } from "react";
import { obs, SEVERITY_MAP, operationSpan } from "./observabilityService";

/**
 * useObservability(categoria, atendimentoId?)
 *
 * atendimentoId: quando informado, cada measure.end() usa um span
 * vinculado ao atendimento — rastreável ponta-a-ponta (Problema 3).
 */
export function useObservability(categoria, atendimentoId = null) {
  useEffect(() => { obs.start(); }, []);

  const measure = {
    start: useCallback(() => performance.now(), []),

    end: useCallback((operacao, t0, isError = false, severity) => {
      const ms   = Math.round(performance.now() - t0);
      const sev  = severity ?? (isError ? (SEVERITY_MAP[operacao] ?? "medium") : "low");
      // Problema 3: cria span por operação, vinculado ao atendimentoId
      const span = operationSpan(atendimentoId);
      obs.record(categoria, operacao, ms, isError, sev, span);
      return ms;
    }, [categoria, atendimentoId]),
  };

  const trackError = useCallback((operacao, severity) => {
    const sev  = severity ?? SEVERITY_MAP[operacao] ?? "medium";
    const span = operationSpan(atendimentoId);
    obs.recordError(categoria, operacao, sev, span);
  }, [categoria, atendimentoId]);

  return { measure, trackError };
}