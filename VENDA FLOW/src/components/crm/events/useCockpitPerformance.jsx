/**
 * useCockpitPerformance — Mede latências críticas do Cockpit.
 *
 * Metas (SLA interno):
 *   modal_open_ms       < 300 ms
 *   timeline_load_ms    < 500 ms
 *   wizard_change_ms    < 100 ms
 *   save_ms             < 800 ms
 *   ia_summary_ms       < 2000 ms
 */
import { useRef, useCallback } from "react";
import { useCrmTracker, CRM_EVENTS } from "./useCrmTracker";
import { COCKPIT_SLA } from "@/lib/cockpitSla";
// Sprint 7.6: instrumentação de observabilidade
import { useObservability } from "@/lib/observability/useObservability";

const SLA = {
  [CRM_EVENTS.MODAL_ABERTO_MS]:        COCKPIT_SLA.modal_open_ms,
  [CRM_EVENTS.TIMELINE_LOAD_MS]:       COCKPIT_SLA.timeline_load_ms,
  [CRM_EVENTS.WIZARD_ETAPA_CHANGE_MS]: COCKPIT_SLA.wizard_change_ms,
  [CRM_EVENTS.SAVE_MS]:                COCKPIT_SLA.save_ms,
  [CRM_EVENTS.IA_SUMMARY_MS]:          COCKPIT_SLA.ia_summary_ms,
};

export function useCockpitPerformance(trackerCtx) {
  const { track }      = useCrmTracker(trackerCtx);
  const { measure }    = useObservability("cockpit");
  const stamps         = useRef({});

  const start = useCallback((label) => {
    stamps.current[label] = performance.now();
  }, []);

  const end = useCallback((event, label) => {
    const t0 = stamps.current[label];
    if (t0 === undefined) return;
    const ms = Math.round(performance.now() - t0);
    delete stamps.current[label];
    const sla    = SLA[event];
    const sla_ok = sla ? ms <= sla : null;
    // Analytics (CRM tracker)
    track(event, { ms, sla_ok });
    // Observabilidade (SystemMetric via ingestSystemMetrics)
    measure.end(label, t0, !sla_ok && sla_ok !== null);
  }, [track, measure]);

  return { start, end };
}