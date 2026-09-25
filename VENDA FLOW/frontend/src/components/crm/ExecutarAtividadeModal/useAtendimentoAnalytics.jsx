import { useCallback, useRef } from "react";
import { api } from "@/api/client";

/**
 * Hook de instrumentação do cockpit de atendimento.
 * Todos os eventos são fire-and-forget via api.analytics.track.
 */
export function useAtendimentoAnalytics({ empresaId, leadId, userId, tarefa }) {
  const inicioRef = useRef(Date.now());

  const track = useCallback((eventName, extra = {}) => {
    const tempoTotal = Math.floor((Date.now() - inicioRef.current) / 1000);
    api.analytics.track({
      eventName,
      properties: {
        tenant_id: empresaId || "",
        lead_id: leadId || "",
        atendimento_id: tarefa?.id || "",
        user_id: userId || "",
        resultado: extra.resultado || "",
        temperatura: extra.temperatura || "",
        etapa: extra.etapa ?? null,
        tempo_total: tempoTotal,
        tma: extra.tma ?? 0,
        ...extra,
      },
    });
  }, [empresaId, leadId, userId, tarefa]);

  return { track, inicioRef };
}