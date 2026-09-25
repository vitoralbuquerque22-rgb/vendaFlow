/**
 * ingestSystemMetrics — Sprint 7.8
 *
 * Problema 2: histogramas de latência (evita média de percentis)
 * Problema 1: granularidade = "hourly" em novos registros
 * Problema 7: sla_compliance_pct por operação
 * Problema 8: error_budget_consumed_pct
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

// SLA por operação (ms) — mesmos valores do cockpitSla
const SLA_OPS = {
  modal_open:    300,
  timeline_load: 500,
  wizard_change: 100,
  save:          800,
  ia_summary:    2000,
};

// Error budget meta = 99,9% uptime → 0,1% erros permitidos
const ERROR_BUDGET_TARGET_PCT = 0.1;

function toBucket(ms) {
  if (ms <= 100)  return "b0_100";
  if (ms <= 500)  return "b100_500";
  if (ms <= 1000) return "b500_1000";
  return "b1000_plus";
}

function percentilFromBuckets(buckets, total) {
  // Estima p95 a partir do histograma — evita média de percentis (Problema 2)
  const target = Math.ceil(0.95 * total);
  let acc = 0;
  const order = [
    ["b0_100", 50], ["b100_500", 300], ["b500_1000", 750], ["b1000_plus", 1500]
  ];
  for (const [key, midpoint] of order) {
    acc += buckets[key] || 0;
    if (acc >= target) return midpoint;
  }
  return 1500;
}

function mergeBuckets(a, b) {
  return {
    b0_100:    (a.b0_100    || 0) + (b.b0_100    || 0),
    b100_500:  (a.b100_500  || 0) + (b.b100_500  || 0),
    b500_1000: (a.b500_1000 || 0) + (b.b500_1000 || 0),
    b1000_plus:(a.b1000_plus|| 0) + (b.b1000_plus|| 0),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user   = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { items = [] } = await req.json().catch(() => ({}));
    if (!items.length) return Response.json({ ok: true, ingested: 0 });

    const empresaId = user?.empresaAtualId;
    if (!empresaId) return Response.json({ ok: true, ingested: 0 });

    const hoje = new Date().toISOString().slice(0, 10);
    const hora = new Date().getHours();

    // Agrupar por (categoria, operacao)
    const grupos = {};
    for (const item of items) {
      const key = `${item.categoria}::${item.operacao}`;
      if (!grupos[key]) {
        grupos[key] = {
          categoria: item.categoria, operacao: item.operacao,
          latencias: [], errors: 0, sla_ok: 0,
          buckets: { b0_100: 0, b100_500: 0, b500_1000: 0, b1000_plus: 0 },
        };
      }
      if (item.isError) {
        grupos[key].errors++;
      } else {
        grupos[key].latencias.push(item.ms);
        grupos[key].buckets[toBucket(item.ms)]++;
        const sla = SLA_OPS[item.operacao];
        if (sla && item.ms <= sla) grupos[key].sla_ok++;
      }
    }

    for (const g of Object.values(grupos)) {
      // JUSTIFICATIVA: Ingestão de métricas de observabilidade do frontend — precisa fazer
      // upsert por (empresaId, dia, hora, categoria, operacao). O token do usuário não tem
      // permissão de escrita em SystemMetric (entidade de telemetria, não de negócio).
      const existing = await base44.asServiceRole.entities.SystemMetric.filter({
        empresaId, dia: hoje, hora, granularidade: "hourly",
        categoria: g.categoria, operacao: g.operacao,
      });

      const prev       = existing?.[0] || {};
      const count      = (prev.count  || 0) + g.latencias.length + g.errors;
      const errors     = (prev.errors || 0) + g.errors;
      const mergedBkts = mergeBuckets(prev.latency_buckets || {}, g.buckets);
      const latTotal   = count - errors;

      // Problema 2: percentil a partir do histograma acumulado
      const p95 = latTotal > 0 ? percentilFromBuckets(mergedBkts, latTotal) : 0;
      const p50 = latTotal > 0 ? percentilFromBuckets(
        { ...mergedBkts, b0_100: mergedBkts.b0_100 }, Math.ceil(0.5 * latTotal)
      ) : 0;

      // Problema 7: SLA compliance
      const sla_ok_total   = (prev.sla_ok_count || 0) + g.sla_ok;
      const sla_compliance  = latTotal > 0 ? parseFloat(((sla_ok_total / latTotal) * 100).toFixed(2)) : 100;

      // Problema 8: error budget
      const uptime          = count > 0 ? (count - errors) / count * 100 : 100;
      const actual_error_pct = 100 - uptime;
      const error_budget_pct = parseFloat(((actual_error_pct / ERROR_BUDGET_TARGET_PCT) * 100).toFixed(2));

      const doc = {
        empresaId, dia: hoje, hora, granularidade: "hourly",
        categoria: g.categoria, operacao: g.operacao,
        count, errors,
        latency_buckets: mergedBkts,
        latencia_p50_ms: p50,
        latencia_p95_ms: p95,
        latencia_max_ms: Math.max(prev.latencia_max_ms || 0, ...g.latencias),
        uptime_pct: parseFloat(uptime.toFixed(2)),
        sla_compliance_pct:        sla_compliance,
        error_budget_consumed_pct: error_budget_pct,
        sla_ok_count: sla_ok_total,
        sla_violacoes: count - errors - sla_ok_total,
        atualizado_em: new Date().toISOString(),
      };

      if (existing?.[0]) {
        await base44.asServiceRole.entities.SystemMetric.update(existing[0].id, doc);
      } else {
        await base44.asServiceRole.entities.SystemMetric.create(doc);
      }
    }

    return Response.json({ ok: true, ingested: items.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});