/**
 * Observability Service — Sprint 7.8
 *
 * Problema 3: SESSION_TRACE_ID (sessão) + operationSpan() (atendimento/ação)
 * Problema 4: Circuit Breaker emite eventos cb_opened / cb_closed rastreáveis
 */

import { COCKPIT_SLA } from "@/lib/cockpitSla";

const FLUSH_INTERVAL_MS = 10_000;
const FLUSH_MAX_ITEMS   = 20;
const MAX_BUFFER        = 200;
const CB_MAX_FAILURES   = 5;
const CB_COOLDOWN_MS    = 300_000;

// ── Problema 3: trace hierárquico ────────────────────────────
// Nível 1 — sessão do browser (uma por aba/reload)
export const SESSION_TRACE_ID = crypto.randomUUID();

/**
 * operationSpan(atendimentoId?)
 * Retorna um span_id único por operação dentro de um atendimento.
 * Uso: const span = operationSpan(atendimentoId);
 *      obs.record(..., span);
 */
export function operationSpan(atendimentoId) {
  return {
    trace_id:   SESSION_TRACE_ID,
    span_id:    crypto.randomUUID(),          // único por ação
    parent_id:  atendimentoId || null,        // agrupa pelo atendimento
  };
}

class ObservabilityService {
  constructor() {
    this._buffer   = [];
    this._timer    = null;
    this._started  = false;
    this._cbFailures  = 0;
    this._cbOpenUntil = 0;
    // Problema 4: histórico de eventos do CB
    this._cbEvents = [];
  }

  start() {
    if (this._started) return;
    this._started = true;
    this._timer = setInterval(() => this._flush(), FLUSH_INTERVAL_MS);
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this._flush();
    });
  }

  stop() {
    clearInterval(this._timer);
    this._started = false;
  }

  /** record — agora aceita span opcional (Problema 3) */
  record(categoria, operacao, ms, isError = false, severity = "low", span = null) {
    if (this._buffer.length >= MAX_BUFFER) this._buffer.shift();
    this._buffer.push({
      categoria, operacao, ms, isError, severity,
      // Problema 3: trace + span
      trace_id: span?.trace_id  ?? SESSION_TRACE_ID,
      span_id:  span?.span_id   ?? null,
      parent_id:span?.parent_id ?? null,
      ts: Date.now(),
    });
    if (this._buffer.length >= FLUSH_MAX_ITEMS) this._flush();
  }

  recordError(categoria, operacao, severity = "medium", span = null) {
    this.record(categoria, operacao, 0, true, severity, span);
  }

  // ── Circuit Breaker ───────────────────────────────────────
  _circuitOpen() { return this._cbOpenUntil > Date.now(); }

  _onFlushSuccess() {
    if (this._cbFailures > 0 || this._cbOpenUntil > 0) {
      // Problema 4: emite evento cb_closed
      this._emitCbEvent("cb_closed");
    }
    this._cbFailures  = 0;
    this._cbOpenUntil = 0;
  }

  _onFlushFailure() {
    this._cbFailures++;
    if (this._cbFailures >= CB_MAX_FAILURES) {
      this._cbOpenUntil = Date.now() + CB_COOLDOWN_MS;
      this._cbFailures  = 0;
      // Problema 4: emite evento cb_opened
      this._emitCbEvent("cb_opened");
    }
  }

  // Problema 4: armazena evento CB — recuperável pelo painel
  _emitCbEvent(type) {
    const ev = { type, ts: Date.now(), reopensAt: this._cbOpenUntil };
    this._cbEvents.push(ev);
    if (this._cbEvents.length > 50) this._cbEvents.shift();
    // Tenta registrar na console para visibilidade imediata
    console.warn(`[Observability CB] ${type}`, ev);
  }

  _flush() {
    if (this._buffer.length === 0) return;
    if (this._circuitOpen()) return;

    const items = this._buffer.splice(0);
    queueMicrotask(async () => {
      try {
        const { base44 } = await import("@/api/base44Client");
        await base44.functions.invoke("ingestSystemMetrics", { items });
        this._onFlushSuccess();
      } catch {
        this._onFlushFailure();
        for (const item of items) {
          if (this._buffer.length < MAX_BUFFER) this._buffer.push(item);
        }
      }
    });
  }

  getCircuitState() {
    return {
      open:      this._circuitOpen(),
      failures:  this._cbFailures,
      reopensAt: this._cbOpenUntil ? new Date(this._cbOpenUntil) : null,
      events:    [...this._cbEvents],
    };
  }
}

export const obs = new ObservabilityService();

// ── SLA map ──────────────────────────────────────────────────
export const SLA_MAP = {
  modal_open:    COCKPIT_SLA.modal_open_ms,
  timeline_load: COCKPIT_SLA.timeline_load_ms,
  wizard_change: COCKPIT_SLA.wizard_change_ms,
  save:          COCKPIT_SLA.save_ms,
  ia_summary:    COCKPIT_SLA.ia_summary_ms,
};

export function isSlaViolation(operacao, ms) {
  const sla = SLA_MAP[operacao];
  return sla != null && ms > sla;
}

export const SEVERITY_MAP = {
  save:          "critical",
  modal_open:    "high",
  ia_summary:    "medium",
  timeline_load: "medium",
  wizard_change: "low",
  analytics:     "low",
};