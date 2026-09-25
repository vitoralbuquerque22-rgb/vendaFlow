/**
 * cleanupSystemMetrics — Sprint 7.8
 *
 * Problema 1 CORRIGIDO: usa granularidade="hourly"/"daily"
 * para nunca apagar consolidados ao excluir > 90 dias.
 *
 * Política:
 *   < 7 dias     → mantém hourly intacto
 *   7-30 dias    → agrega hourly → daily, remove hourly
 *   30-90 dias   → mantém daily intacto
 *   > 90 dias    → exclui APENAS daily (hourly já foram removidos na janela 7-30d)
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

function diasAtras(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function mergeBuckets(registros) {
  const b = { b0_100: 0, b100_500: 0, b500_1000: 0, b1000_plus: 0 };
  for (const r of registros) {
    const rb = r.latency_buckets || {};
    b.b0_100    += rb.b0_100    || 0;
    b.b100_500  += rb.b100_500  || 0;
    b.b500_1000 += rb.b500_1000 || 0;
    b.b1000_plus+= rb.b1000_plus|| 0;
  }
  return b;
}

function percentilFromBuckets(buckets, total) {
  const target = Math.ceil(0.95 * total);
  let acc = 0;
  for (const [key, mid] of [["b0_100",50],["b100_500",300],["b500_1000",750],["b1000_plus",1500]]) {
    acc += buckets[key] || 0;
    if (acc >= target) return mid;
  }
  return 1500;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user   = await base44.auth.me();
    if (!user || user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const corte7d  = diasAtras(7);
    const corte30d = diasAtras(30);
    const corte90d = diasAtras(90);

    // JUSTIFICATIVA: Job sistêmico agendado — agrega métricas horárias em diárias e descarta
    // registros antigos (>90d). Opera cross-tenant sobre SystemMetric. Nunca exposto ao frontend.
    const all = await base44.asServiceRole.entities.SystemMetric.list();

    let deletados = 0, agregados = 0;

    // ── Fase 1: agrupar hourly de 7-30 dias → daily ──────────
    const paraAgregar = all.filter((m) =>
      m.granularidade === "hourly" && m.dia < corte7d && m.dia >= corte30d
    );

    const grupos = {};
    for (const m of paraAgregar) {
      const key = `${m.empresaId}::${m.dia}::${m.categoria}::${m.operacao}`;
      if (!grupos[key]) grupos[key] = { ref: m, registros: [] };
      grupos[key].registros.push(m);
    }

    for (const { ref, registros } of Object.values(grupos)) {
      const count  = registros.reduce((s, r) => s + (r.count  || 0), 0);
      const errors = registros.reduce((s, r) => s + (r.errors || 0), 0);
      const merged = mergeBuckets(registros);
      const latTotal = count - errors;
      const p95 = latTotal > 0 ? percentilFromBuckets(merged, latTotal) : 0;
      const uptime = count > 0 ? parseFloat(((count - errors) / count * 100).toFixed(2)) : 100;
      const sla_ok = registros.reduce((s, r) => s + (r.sla_ok_count || 0), 0);
      const sla_comp = latTotal > 0 ? parseFloat(((sla_ok / latTotal) * 100).toFixed(2)) : 100;

      // Problema 1: granularidade="daily" protege este registro da exclusão de > 90d incorreta
      const existing = await base44.asServiceRole.entities.SystemMetric.filter({
        empresaId: ref.empresaId, dia: ref.dia, granularidade: "daily",
        categoria: ref.categoria, operacao: ref.operacao,
      });

      const doc = {
        empresaId: ref.empresaId, dia: ref.dia, hora: -1, granularidade: "daily",
        categoria: ref.categoria, operacao: ref.operacao,
        count, errors, latency_buckets: merged,
        latencia_p95_ms: p95, uptime_pct: uptime,
        sla_compliance_pct: sla_comp, sla_ok_count: sla_ok,
        atualizado_em: new Date().toISOString(),
      };

      if (existing?.[0]) {
        await base44.asServiceRole.entities.SystemMetric.update(existing[0].id, doc);
      } else {
        await base44.asServiceRole.entities.SystemMetric.create(doc);
      }

      for (const r of registros) {
        await base44.asServiceRole.entities.SystemMetric.delete(r.id);
        deletados++;
      }
      agregados++;
    }

    // ── Fase 2: excluir daily > 90 dias (hourly desta faixa já inexiste) ──
    const velhos = all.filter((m) => m.dia < corte90d && m.granularidade === "daily");
    for (const m of velhos) {
      await base44.asServiceRole.entities.SystemMetric.delete(m.id);
      deletados++;
    }

    return Response.json({ ok: true, deletados, agregados, executado_em: new Date().toISOString() });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});