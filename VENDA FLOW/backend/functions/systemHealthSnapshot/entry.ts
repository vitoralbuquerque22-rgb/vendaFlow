/**
 * systemHealthSnapshot — Sprint 7.8
 *
 * Problema 6: percentil relativo entre tenants (benchmark)
 * Problema 7: SLA compliance por categoria
 * Problema 8: error budget (meta 99.9%)
 */
import { createClientFromRequest } from "../../src/sdk.ts";

const ERROR_BUDGET_TARGET = 0.1; // 0,1% = meta 99,9% uptime

export default async (req) => {
  try {
    const api = createClientFromRequest(req);
    const user   = await api.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const empresaId = user?.empresaAtualId;
    const isAdmin   = user?.role === "admin";

    const hoje  = new Date().toISOString().slice(0, 10);
    const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    // JUSTIFICATIVA: Agregação de métricas de observabilidade — admin global lê cross-tenant,
    // usuário comum lê apenas seu tenant. asServiceRole necessário pois SystemMetric não tem
    // RLS de leitura configurada por usuário (é preenchida pelo ingestSystemMetrics do frontend).
    // Nunca escrevem dados de usuário — apenas leitura de métricas de sistema.
    const allMetrics = isAdmin && !empresaId
      ? await api.asServiceRole.entities.SystemMetric.list()
      : await api.asServiceRole.entities.SystemMetric.filter({ empresaId });

    const recent = allMetrics.filter((m) => m.dia === hoje || m.dia === ontem);
    if (!recent.length) return Response.json({ ok: true, snapshot: null });

    // ── Disponibilidade real ──────────────────────────────────
    const totalCount   = recent.reduce((s, m) => s + (m.count  || 0), 0);
    const totalSuccess = recent.reduce((s, m) => s + ((m.count || 0) - (m.errors || 0)), 0);
    const totalErrors  = recent.reduce((s, m) => s + (m.errors || 0), 0);
    const uptimeGeral  = totalCount > 0 ? parseFloat(((totalSuccess / totalCount) * 100).toFixed(2)) : 100;

    // Problema 8: error budget
    const actual_error_pct = parseFloat((100 - uptimeGeral).toFixed(3));
    const errorBudget = {
      meta_pct:       ERROR_BUDGET_TARGET,
      consumido_pct:  actual_error_pct,
      restante_pct:   parseFloat(Math.max(0, ERROR_BUDGET_TARGET - actual_error_pct).toFixed(3)),
      esgotado:       actual_error_pct >= ERROR_BUDGET_TARGET,
    };

    // Latência (mediana dos p95 horários — problema 2 resolvido via histograma no ingest)
    const lats   = recent.filter((m) => m.latencia_p95_ms > 0).map((m) => m.latencia_p95_ms);
    const latP95 = lats.length ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : 0;
    const latsP50= recent.filter((m) => m.latencia_p50_ms > 0).map((m) => m.latencia_p50_ms);
    const latP50 = latsP50.length ? Math.round(latsP50.reduce((a, b) => a + b, 0) / latsP50.length) : 0;

    // ── Por categoria com SLA compliance (Problema 7) ─────────
    const porCategoria = {};
    for (const m of recent) {
      const c = porCategoria[m.categoria] || (porCategoria[m.categoria] = {
        count: 0, errors: 0, lats: [], sla_ok: 0, sla_total: 0,
      });
      c.count     += m.count  || 0;
      c.errors    += m.errors || 0;
      c.sla_ok    += m.sla_ok_count     || 0;
      c.sla_total += (m.count || 0) - (m.errors || 0);
      if (m.latencia_p95_ms) c.lats.push(m.latencia_p95_ms);
    }

    const categorias = Object.entries(porCategoria).map(([cat, v]) => ({
      categoria: cat,
      count:     v.count,
      errors:    v.errors,
      uptime:    v.count > 0 ? parseFloat((((v.count - v.errors) / v.count) * 100).toFixed(2)) : 100,
      lat_p95:   v.lats.length ? Math.round(v.lats.reduce((a, b) => a + b, 0) / v.lats.length) : 0,
      // Problema 7: SLA compliance real
      sla_compliance_pct: v.sla_total > 0
        ? parseFloat(((v.sla_ok / v.sla_total) * 100).toFixed(2))
        : null, // null = sem SLA definido para esta categoria
    }));

    // ── Tech data (top erros / lentidões / tenants) ───────────
    const porOp = {};
    for (const m of recent) {
      const k = `${m.categoria}::${m.operacao}`;
      const o = porOp[k] || (porOp[k] = { categoria: m.categoria, operacao: m.operacao, lats: [], errors: 0, count: 0 });
      o.count  += m.count  || 0;
      o.errors += m.errors || 0;
      if (m.latencia_p95_ms) o.lats.push(m.latencia_p95_ms);
    }
    const topLentidoes = Object.values(porOp)
      .map((v) => ({ label: `${v.categoria}/${v.operacao}`, p95: v.lats.length ? Math.round(v.lats.reduce((a,b)=>a+b,0)/v.lats.length) : 0 }))
      .sort((a, b) => b.p95 - a.p95).slice(0, 10);

    const topErros = Object.values(porOp)
      .filter((v) => v.errors > 0)
      .map((v) => ({ label: `${v.categoria}/${v.operacao}`, errors: v.errors, count: v.count }))
      .sort((a, b) => b.errors - a.errors).slice(0, 10);

    // Problema 6: benchmark entre tenants (só admin)
    let topTenants = [], tenantBenchmark = null;
    if (isAdmin) {
      const porTenant = {};
      for (const m of allMetrics.filter((m2) => m2.dia === hoje || m2.dia === ontem)) {
        const t = porTenant[m.empresaId] || (porTenant[m.empresaId] = { empresaId: m.empresaId, count: 0, errors: 0 });
        t.count  += m.count  || 0;
        t.errors += m.errors || 0;
      }
      const sorted = Object.values(porTenant).sort((a, b) => b.count - a.count);
      topTenants = sorted.slice(0, 10);

      // Problema 6: percentil do tenant atual entre todos os tenants
      if (empresaId) {
        const counts = sorted.map((t) => t.count);
        const myCount= porTenant[empresaId]?.count || 0;
        const rank   = counts.filter((c) => c > myCount).length;
        const pct    = sorted.length > 0 ? Math.round(((sorted.length - rank) / sorted.length) * 100) : 50;
        tenantBenchmark = { percentil: pct, label: pct >= 90 ? "Top 10%" : pct >= 75 ? "Top 25%" : pct >= 50 ? "Top 50%" : "Abaixo da mediana" };
      }
    }

    const status = uptimeGeral >= 99 ? "saudavel" : uptimeGeral >= 95 ? "degradado" : "critico";

    return Response.json({ ok: true, snapshot: {
      empresaId: empresaId || "global",
      gerado_em: new Date().toISOString(),
      status,
      uptime_geral: uptimeGeral,
      total_sucesso: totalSuccess,
      total_operacoes: totalCount,
      total_erros: totalErrors,
      taxa_erro_pct: parseFloat(((totalErrors / Math.max(totalCount, 1)) * 100).toFixed(2)),
      latencia_p50_ms: latP50,
      latencia_p95_ms: latP95,
      // Problema 8
      error_budget: errorBudget,
      // Problema 7
      categorias,
      top_lentidoes: topLentidoes,
      top_erros: topErros,
      top_tenants: topTenants,
      // Problema 6
      tenant_benchmark: tenantBenchmark,
    }});
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};
