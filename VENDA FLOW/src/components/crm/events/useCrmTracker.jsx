/**
 * useCrmTracker — Hook único de tracking do CRM.
 * Substitui useAtendimentoAnalytics e chamadas diretas ao base44.analytics.
 *
 * Recursos:
 *  - Dedup por evento+atendimentoId (useRef Set) — idempotente, sem duplicatas
 *  - Payload multi-tenant obrigatório (tenant_id, user_id, lead_id, atendimento_id)
 *  - Todos os nomes de eventos via CRM_EVENTS — nunca strings literais
 *  - Fire-and-forget: nunca bloqueia a UI
 */
import { useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { CRM_EVENTS, buildCrmPayload } from "./crmEvents";

export { CRM_EVENTS };

export function useCrmTracker({ empresaId, userId, leadId, atendimentoId }) {
  const emittedRef = useRef(new Set());
  const inicioRef  = useRef(Date.now());
  // Correção 1: sessionId por instância — nova abertura = nova sessão, sem bloquear re-emissão
  const sessionId  = useRef(crypto.randomUUID());

  /**
   * track(event, extra)
   * event  — CRM_EVENTS.X (string constante)
   * extra  — propriedades adicionais opcionais
   */
  const track = useCallback((event, extra = {}) => {
    if (!event) return;
    if (!empresaId) return; // tenant obrigatório

    const payload = buildCrmPayload({
      empresaId,
      userId,      // Correção 2: user.id (não email) — email muda, id não
      leadId,
      atendimentoId,
      extra: {
        tempo_total_s: Math.floor((Date.now() - inicioRef.current) / 1000),
        ...extra,
      },
    });

    // Correção 3: analytics nunca quebra a UI — fire-and-forget via queueMicrotask
    queueMicrotask(() => {
      try {
        base44.analytics.track({ eventName: event, properties: payload });
      } catch (err) {
        console.error("[CRM analytics]", err);
      }
    });
  }, [empresaId, userId, leadId, atendimentoId]);

  /**
   * emitOnce(event, extra)
   * Garante idempotência: o mesmo evento só é emitido uma vez por sessão.
   * Chave de dedup: `${event}::${atendimentoId}`
   */
  const emitOnce = useCallback((event, extra = {}) => {
    // Correção 1: dedup inclui sessionId — nova abertura do modal = nova sessão
    const dedupKey = `${event}::${atendimentoId || "no-id"}::${sessionId.current}`;
    if (emittedRef.current.has(dedupKey)) return;
    emittedRef.current.add(dedupKey);
    track(event, extra);
  }, [track, atendimentoId]);

  /**
   * resetDedup()
   * Limpa o Set de eventos emitidos — chamar ao fechar/resetar o modal.
   */
  const resetDedup = useCallback(() => {
    emittedRef.current.clear();
    inicioRef.current = Date.now();
  }, []);

  return { track, emitOnce, resetDedup };
}