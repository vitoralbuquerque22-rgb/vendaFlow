/**
 * TechDashboard — Sprint 7.8 Problema 5
 * /TechDashboard — visão de Engenharia (separada do SystemHealth de Operação)
 *
 * Mostra: top erros, lentidões, gargalos, tenants pesados,
 *         SLA compliance, error budget e Circuit Breaker events.
 */
import { useState, useEffect } from "react";
import { api } from "@/api/client";
import { obs } from "@/lib/observability/observabilityService";
import { RefreshCw, Zap, Bug, Building2, ShieldCheck, CircleDot, Activity } from "lucide-react";

const ERROR_BUDGET_TARGET = 0.1;

function SectionTitle({ icon: IconComp, title, sub }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <IconComp className="w-4 h-4 text-slate-400" />
      <div>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {sub && <p className="text-[11px] text-slate-600">{sub}</p>}
      </div>
    </div>
  );
}

function TopTable({ items, cols, emptyMsg }) {
  if (!items?.length) return <p className="text-xs text-slate-600 text-center py-6">{emptyMsg}</p>;
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/4 last:border-0">
          <span className="text-xs text-slate-400 flex-1 truncate font-mono">{item.label}</span>
          <div className="flex items-center gap-3 ml-3">
            {cols.map((col) => (
              <span key={col.key} className="text-xs font-semibold" style={{ color: col.color?.(item) ?? "#94a3b8" }}>
                {col.format ? col.format(item[col.key]) : item[col.key]}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorBudgetBar({ budget }) {
  const consumoPct = Math.min((budget.consumido_pct / ERROR_BUDGET_TARGET) * 100, 100);
  const color = budget.esgotado ? "#f87171" : consumoPct > 70 ? "#f59e0b" : "#22c55e";
  return (
    <div>
      <div className="flex justify-between text-xs mb-2">
        <span className="text-slate-400">Meta: {ERROR_BUDGET_TARGET}% erro tolerado (99,9% uptime)</span>
        <span className="font-bold" style={{ color }}>
          {budget.consumido_pct.toFixed(3)}% / {ERROR_BUDGET_TARGET}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-700/60 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${consumoPct}%`, background: color }} />
      </div>
      <div className="flex justify-between text-[10px] text-slate-600 mt-1">
        <span>Consumido: {budget.consumido_pct.toFixed(3)}%</span>
        <span>Restante: {budget.restante_pct.toFixed(3)}%</span>
      </div>
    </div>
  );
}

function CbEvents({ events }) {
  if (!events?.length) return <p className="text-xs text-slate-600 text-center py-4">Nenhum evento de Circuit Breaker 🟢</p>;
  return (
    <div className="space-y-2">
      {events.slice(-10).reverse().map((ev, i) => (
        <div key={i} className="flex items-center gap-3 py-1.5 border-b border-white/4 last:border-0">
          <span className={`text-xs font-bold ${ev.type === "cb_opened" ? "text-red-400" : "text-emerald-400"}`}>
            {ev.type === "cb_opened" ? "🔴 ABERTO" : "🟢 FECHADO"}
          </span>
          <span className="text-xs text-slate-600 font-mono">
            {new Date(ev.ts).toLocaleTimeString("pt-BR")}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function TechDashboard() {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [cbState, setCbState]   = useState(null);

  const doFetch = async () => {
    setLoading(true);
    try {
      const res = await api.functions.invoke("systemHealthSnapshot", {});
      if (res?.data?.snapshot) setSnapshot(res.data.snapshot);
      setCbState(obs.getCircuitState());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { doFetch(); }, []);

  const s = snapshot;

  return (
    <div className="min-h-screen bg-[#070b12] p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Activity className="w-5 h-5 text-violet-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">Tech Dashboard</h1>
          </div>
          <p className="text-sm text-slate-500">Visão de Engenharia — SLA compliance, error budget, gargalos e Circuit Breaker</p>
        </div>
        <button onClick={doFetch} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 border border-white/8 bg-white/3 hover:bg-white/6 hover:text-white transition-all disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 text-slate-600 animate-spin" />
        </div>
      )}

      {!loading && !s && (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <p className="text-slate-500 text-sm">Nenhum dado disponível ainda.</p>
        </div>
      )}

      {!loading && s && (
        <div className="space-y-4">
          {/* Error Budget — Problema 8 */}
          {s.error_budget && (
            <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-5">
              <SectionTitle icon={ShieldCheck} title="Error Budget" sub="Meta: 99,9% uptime → 0,1% erros tolerados/mês" />
              <ErrorBudgetBar budget={s.error_budget} />
            </div>
          )}

          {/* SLA Compliance por categoria — Problema 7 */}
          <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-5">
            <SectionTitle icon={ShieldCheck} title="SLA Compliance" sub="% operações dentro do SLA por subsistema" />
            <div className="space-y-2">
              {s.categorias?.filter((c) => c.sla_compliance_pct != null).map((c) => {
                const color = c.sla_compliance_pct >= 99 ? "#22c55e" : c.sla_compliance_pct >= 95 ? "#f59e0b" : "#f87171";
                return (
                  <div key={c.categoria} className="flex items-center justify-between py-2 border-b border-white/4 last:border-0">
                    <span className="text-sm text-white capitalize">{c.categoria}</span>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="w-32 h-1.5 rounded-full bg-slate-700/60 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${c.sla_compliance_pct}%`, background: color }} />
                      </div>
                      <span className="font-bold w-14 text-right" style={{ color }}>{c.sla_compliance_pct}%</span>
                    </div>
                  </div>
                );
              })}
              {!s.categorias?.some((c) => c.sla_compliance_pct != null) && (
                <p className="text-xs text-slate-600 text-center py-4">SLA compliance disponível após operações com SLA definido.</p>
              )}
            </div>
          </div>

          {/* Top tabelas — Problema 5 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-5">
              <SectionTitle icon={Zap} title="Top Lentidões" sub="p95 por operação" />
              <TopTable
                items={s.top_lentidoes}
                cols={[{ key: "p95", format: (v) => `${v}ms`, color: (item) => item.p95 > 2000 ? "#f87171" : item.p95 > 800 ? "#f59e0b" : "#22c55e" }]}
                emptyMsg="Sem lentidões detectadas 🟢"
              />
            </div>
            <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-5">
              <SectionTitle icon={Bug} title="Top Erros" sub="por operação" />
              <TopTable
                items={s.top_erros}
                cols={[
                  { key: "errors", color: () => "#f87171" },
                  { key: "count",  format: (v) => `/${v}`, color: () => "#475569" },
                ]}
                emptyMsg="Nenhum erro registrado 🟢"
              />
            </div>
            <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-5">
              <SectionTitle
                icon={Building2}
                title="Top Tenants"
                sub={s.tenant_benchmark ? `Seu tenant: ${s.tenant_benchmark.label}` : "Volume de operações"}
              />
              <TopTable
                items={s.top_tenants}
                cols={[{ key: "count", format: (v) => v?.toLocaleString("pt-BR"), color: () => "#6366f1" }]}
                emptyMsg="Disponível apenas para Admin Global"
              />
              {/* Problema 6: benchmark percentil */}
              {s.tenant_benchmark && (
                <div className="mt-3 pt-3 border-t border-white/5 text-center">
                  <p className="text-xs text-slate-500">Seu percentil entre tenants</p>
                  <p className="text-lg font-bold text-indigo-400">Top {100 - s.tenant_benchmark.percentil + 1}%</p>
                  <p className="text-xs text-slate-600">{s.tenant_benchmark.label}</p>
                </div>
              )}
            </div>
          </div>

          {/* Circuit Breaker Events — Problema 4 */}
          <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between mb-4">
              <SectionTitle icon={CircleDot} title="Circuit Breaker" sub="Eventos da sessão atual" />
              {cbState && (
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${cbState.open ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"}`}>
                  {cbState.open ? `🔴 ABERTO — reativa às ${cbState.reopensAt?.toLocaleTimeString("pt-BR")}` : `🟢 FECHADO (${cbState.failures}/5 falhas)`}
                </span>
              )}
            </div>
            <CbEvents events={cbState?.events} />
          </div>
        </div>
      )}
    </div>
  );
}