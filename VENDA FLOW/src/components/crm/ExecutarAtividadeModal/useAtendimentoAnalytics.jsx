import { useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";

/**
 * Hook de instrumentação do cockpit de atendimento.
 * Todos os eventos são fire-and-forget via base44.analytics.track.
 */
export function useAtendimentoAnalytics({ empresaId, leadId, userId, tarefa }) {
  const inicioRef = useRef(Date.now());

  const track = useCallback((eventName, extra = {}) => {
    const tempoTotal = Math.floor((Date.now() - inicioRef.current) / 1000);
    base44.analytics.track({
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