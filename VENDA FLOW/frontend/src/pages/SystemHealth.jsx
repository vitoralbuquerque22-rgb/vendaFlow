/**
 * System Health — consolidado (inclui TechDashboard + ProfilerTools)
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { obs } from "@/lib/observability/observabilityService";
import { COCKPIT_SLA } from "@/lib/cockpitSla";
import { SESSION_TRACE_ID } from "@/lib/observability/observabilityService";
import { motion } from "framer-motion";
import {
  RefreshCw, CheckCircle, AlertTriangle, XCircle, Activity, Zap, Bug, Building2,
  ShieldCheck, CircleDot, TrendingUp, Database, Trash2, Info, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import UserAnalyticsPanel from "@/components/profiler/UserAnalyticsPanel";
import SmokeTest3CPlus from "@/components/profiler/SmokeTest3CPlus";

// ─── Constants ────────────────────────────────────────────────
const CATEGORIA_LABEL = {
  cockpit: "Cockpit", ia: "IA / Resumos", analytics: "Analytics",
  crm: "CRM", dashboard: "Dashboard", timeline: "Timeline",
};
const SEVERITY_COLORS = { critical: "#f87171", high: "#fb923c", medium: "#f59e0b", low: "#22c55e" };
const SEVERITY_LABELS = { critical: "🔴 CRITICAL", high: "🟠 HIGH", medium: "🟡 MEDIUM", low: "🟢 LOW" };
const SLA_LABELS = {
  modal_open:    `Modal < ${COCKPIT_SLA.modal_open_ms}ms`,
  timeline_load: `Timeline < ${COCKPIT_SLA.timeline_load_ms}ms`,
  wizard_change: `Wizard < ${COCKPIT_SLA.wizard_change_ms}ms`,
  save:          `Save < ${COCKPIT_SLA.save_ms}ms`,
  ia_summary:    `IA < ${COCKPIT_SLA.ia_summary_ms}ms`,
};
const ERROR_BUDGET_TARGET = 0.1;

function uptimeSeverity(pct) {
  if (pct >= 99) return "low";
  if (pct >= 97) return "medium";
  if (pct >= 95) return "high";
  return "critical";
}

// ─── Shared Sub-components ────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = {
    saudavel:  { icon: CheckCircle,   color: "text-emerald-400", label: "Sistema saudável" },
    degradado: { icon: AlertTriangle, color: "text-amber-400",   label: "Degradado" },
    critico:   { icon: XCircle,       color: "text-red-400",     label: "Crítico" },
  }[status] || { icon: Activity, color: "text-slate-400", label: "Desconhecido" };
  const Icon = cfg.icon;
  return (
    <span className={`flex items-center gap-1.5 text-sm font-semibold ${cfg.color}`}>
      <Icon className="w-4 h-4" /> {cfg.label}
    </span>
  );
}

function UptimeBar({ pct }) {
  const color = pct >= 99 ? "#22c55e" : pct >= 95 ? "#f59e0b" : "#f87171";
  return (
    <div className="h-1.5 rounded-full bg-slate-700/60 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
    </div>
  );
}

function KpiCard({ label, value, sub, color }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-5">
      <p className="text-xs text-slate-500 font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-slate-600 mt-1">{sub}</p>}
    </div>
  );
}

function CategoriaRow({ cat }) {
  const label = CATEGORIA_LABEL[cat.categoria] || cat.categoria;
  const sev   = uptimeSeverity(cat.uptime);
  const color = SEVERITY_COLORS[sev];
  return (
    <div className="py-3 border-b border-white/4 last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{label}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
            style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
            {SEVERITY_LABELS[sev]}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>ok: <span className="text-white font-medium">{(cat.count - cat.errors).toLocaleString("pt-BR")}</span></span>
          <span>total: <span className="text-white font-medium">{cat.count.toLocaleString("pt-BR")}</span></span>
          <span>p95: <span className="text-white font-medium">{cat.lat_p95}ms</span></span>
          <span className="font-bold" style={{ color }}>{cat.uptime}%</span>
        </div>
      </div>
      <UptimeBar pct={cat.uptime} />
    </div>
  );
}

function TopList({ title, icon: Icon, items, renderItem, emptyMsg }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-slate-400" />
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      {items?.length > 0
        ? items.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-white/4 last:border-0">
              <span className="text-xs text-slate-400 flex-1 truncate">{item.label}</span>
              {renderItem(item)}
            </div>
          ))
        : <p className="text-xs text-slate-600 text-center py-4">{emptyMsg}</p>
      }
    </div>
  );
}

// ─── Tab: System Health ───────────────────────────────────────
function TabSystemHealth({ snapshot, loading, lastFetch, onRefresh }) {
  const s = snapshot;
  return (
    <>
      {loading && <div className="flex items-center justify-center py-20"><RefreshCw className="w-6 h-6 text-slate-600 animate-spin" /></div>}
      {!loading && !s && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-slate-500 text-sm">Nenhuma métrica coletada ainda.</p>
          <p className="text-slate-600 text-xs">As métricas aparecem conforme os usuários utilizam o sistema.</p>
        </div>
      )}
      {!loading && s && (
        <>
          <div className="rounded-2xl border border-white/5 bg-slate-900/60 px-6 py-4 mb-6 flex items-center justify-between">
            <StatusBadge status={s.status} />
            <span className="text-xs text-slate-500">{lastFetch ? `Atualizado às ${lastFetch.toLocaleTimeString("pt-BR")}` : ""}</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <KpiCard label="Disponibilidade" value={`${s.uptime_geral}%`} sub={`${s.total_sucesso?.toLocaleString("pt-BR")} / ${s.total_operacoes?.toLocaleString("pt-BR")} ops`} color={s.uptime_geral >= 99 ? "#22c55e" : s.uptime_geral >= 95 ? "#f59e0b" : "#f87171"} />
            <KpiCard label="Latência p50" value={`${s.latencia_media_ms}ms`} sub="mediana global" color="#6366f1" />
            <KpiCard label="Latência p95" value={`${s.latencia_p95_ms}ms`} sub="percentil 95" color="#8b5cf6" />
            <KpiCard label="Taxa de erro" value={`${s.taxa_erro_pct}%`} sub={`${s.total_erros} erro(s)`} color={s.taxa_erro_pct > 1 ? "#f87171" : "#22c55e"} />
            <KpiCard label="Operações" value={s.total_operacoes?.toLocaleString("pt-BR")} sub="últimas 24h" color="#94a3b8" />
          </div>
          <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-5 mb-6">
            <h2 className="text-sm font-semibold text-white mb-3">SLA de referência</h2>
            <div className="flex flex-wrap gap-3">
              {Object.entries(SLA_LABELS).map(([k, v]) => (
                <span key={k} className="text-xs px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">{v}</span>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-5 mb-6">
            <h2 className="text-sm font-semibold text-white mb-1">Por subsistema</h2>
            <p className="text-xs text-slate-600 mb-4">Disponibilidade real (ok/total), p95 e severity</p>
            {s.categorias?.length > 0
              ? [...s.categorias].sort((a, b) => a.uptime - b.uptime).map((cat) => <CategoriaRow key={cat.categoria} cat={cat} />)
              : <p className="text-xs text-slate-600 text-center py-4">Nenhuma categoria com dados.</p>}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <TopList title="Top 10 Lentidões" icon={Zap} items={s.top_lentidoes}
              renderItem={(item) => <span className="text-xs font-bold ml-3" style={{ color: item.p95 > 2000 ? "#f87171" : item.p95 > 800 ? "#f59e0b" : "#22c55e" }}>{item.p95}ms p95</span>}
              emptyMsg="Nenhuma lentidão detectada" />
            <TopList title="Top 10 Erros" icon={Bug} items={s.top_erros}
              renderItem={(item) => <div className="flex items-center gap-2 ml-3"><span className="text-xs text-red-400 font-bold">{item.errors} erros</span><span className="text-[10px] text-slate-600">/{item.count} total</span></div>}
              emptyMsg="Nenhum erro registrado 🟢" />
            <TopList title="Top 10 Tenants" icon={Building2} items={s.top_tenants?.length ? s.top_tenants : []}
              renderItem={(item) => <span className="text-xs text-slate-300 font-medium ml-3">{item.count?.toLocaleString("pt-BR")} ops</span>}
              emptyMsg="Dados disponíveis apenas para Admin Global" />
          </div>
        </>
      )}
    </>
  );
}

// ─── Tab: Tech Dashboard ──────────────────────────────────────
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
        <span className="font-bold" style={{ color }}>{budget.consumido_pct.toFixed(3)}% / {ERROR_BUDGET_TARGET}%</span>
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

function TabTechDashboard({ snapshot, loading, cbState }) {
  const s = snapshot;
  return (
    <>
      {loading && <div className="flex items-center justify-center py-20"><RefreshCw className="w-6 h-6 text-slate-600 animate-spin" /></div>}
      {!loading && !s && <p className="text-slate-500 text-sm text-center py-20">Nenhum dado disponível ainda.</p>}
      {!loading && s && (
        <div className="space-y-4">
          {s.error_budget && (
            <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-5">
              <SectionTitle icon={ShieldCheck} title="Error Budget" sub="Meta: 99,9% uptime → 0,1% erros tolerados/mês" />
              <ErrorBudgetBar budget={s.error_budget} />
            </div>
          )}
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-5">
              <SectionTitle icon={Zap} title="Top Lentidões" sub="p95 por operação" />
              <TopTable items={s.top_lentidoes} cols={[{ key: "p95", format: (v) => `${v}ms`, color: (item) => item.p95 > 2000 ? "#f87171" : item.p95 > 800 ? "#f59e0b" : "#22c55e" }]} emptyMsg="Sem lentidões detectadas 🟢" />
            </div>
            <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-5">
              <SectionTitle icon={Bug} title="Top Erros" sub="por operação" />
              <TopTable items={s.top_erros} cols={[{ key: "errors", color: () => "#f87171" }, { key: "count", format: (v) => `/${v}`, color: () => "#475569" }]} emptyMsg="Nenhum erro registrado 🟢" />
            </div>
            <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-5">
              <SectionTitle icon={Building2} title="Top Tenants" sub={s.tenant_benchmark ? `Seu tenant: ${s.tenant_benchmark.label}` : "Volume de operações"} />
              <TopTable items={s.top_tenants} cols={[{ key: "count", format: (v) => v?.toLocaleString("pt-BR"), color: () => "#6366f1" }]} emptyMsg="Disponível apenas para Admin Global" />
              {s.tenant_benchmark && (
                <div className="mt-3 pt-3 border-t border-white/5 text-center">
                  <p className="text-xs text-slate-500">Seu percentil entre tenants</p>
                  <p className="text-lg font-bold text-indigo-400">Top {100 - s.tenant_benchmark.percentil + 1}%</p>
                  <p className="text-xs text-slate-600">{s.tenant_benchmark.label}</p>
                </div>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between mb-4">
              <SectionTitle icon={CircleDot} title="Circuit Breaker" sub="Eventos da sessão atual" />
              {cbState && (
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${cbState.open ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"}`}>
                  {cbState.open ? `🔴 ABERTO — reativa às ${cbState.reopensAt?.toLocaleTimeString("pt-BR")}` : `🟢 FECHADO (${cbState.failures}/5 falhas)`}
                </span>
              )}
            </div>
            {!cbState?.events?.length
              ? <p className="text-xs text-slate-600 text-center py-4">Nenhum evento de Circuit Breaker 🟢</p>
              : cbState.events.slice(-10).reverse().map((ev, i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5 border-b border-white/4 last:border-0">
                    <span className={`text-xs font-bold ${ev.type === "cb_opened" ? "text-red-400" : "text-emerald-400"}`}>{ev.type === "cb_opened" ? "🔴 ABERTO" : "🟢 FECHADO"}</span>
                    <span className="text-xs text-slate-600 font-mono">{new Date(ev.ts).toLocaleTimeString("pt-BR")}</span>
                  </div>
                ))}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Tab: Profiler Tools ──────────────────────────────────────
function PerformanceMonitor() {
  const [metrics, setMetrics] = useState([]);
  const [isRecording, setIsRecording] = useState(false);

  const startRecording = useCallback(() => {
    setIsRecording(true);
    setMetrics([]);
    const nav = performance.getEntriesByType("navigation")[0];
    const navMetrics = nav ? [
      { name: "DNS Lookup", value: Math.round(nav.domainLookupEnd - nav.domainLookupStart), unit: "ms", status: nav.domainLookupEnd - nav.domainLookupStart < 50 ? "good" : "warn" },
      { name: "TCP Connection", value: Math.round(nav.connectEnd - nav.connectStart), unit: "ms", status: nav.connectEnd - nav.connectStart < 100 ? "good" : "warn" },
      { name: "Time to First Byte", value: Math.round(nav.responseStart - nav.requestStart), unit: "ms", status: nav.responseStart - nav.requestStart < 200 ? "good" : "bad" },
      { name: "DOM Content Loaded", value: Math.round(nav.domContentLoadedEventEnd - nav.startTime), unit: "ms", status: nav.domContentLoadedEventEnd - nav.startTime < 1500 ? "good" : "warn" },
      { name: "Page Load Complete", value: Math.round(nav.loadEventEnd - nav.startTime), unit: "ms", status: nav.loadEventEnd - nav.startTime < 3000 ? "good" : "bad" },
    ] : [];
    const resources = performance.getEntriesByType("resource").slice(-20).map(r => ({
      name: r.name.split("/").pop().substring(0, 40) || r.name.substring(0, 40),
      value: Math.round(r.duration), unit: "ms", type: r.initiatorType,
      status: r.duration < 500 ? "good" : r.duration < 1500 ? "warn" : "bad",
    }));
    const memMetrics = [];
    if (performance.memory) {
      const mb = (b) => Math.round(b / 1024 / 1024);
      memMetrics.push(
        { name: "JS Heap Used", value: mb(performance.memory.usedJSHeapSize), unit: "MB", status: mb(performance.memory.usedJSHeapSize) < 50 ? "good" : "warn" },
        { name: "JS Heap Total", value: mb(performance.memory.totalJSHeapSize), unit: "MB", status: "info" },
        { name: "JS Heap Limit", value: mb(performance.memory.jsHeapSizeLimit), unit: "MB", status: "info" },
      );
    }
    setMetrics({ nav: navMetrics, resources, mem: memMetrics });
    setTimeout(() => setIsRecording(false), 800);
  }, []);

  useEffect(() => { startRecording(); }, []);

  const statusColor = (s) => ({ good: "text-emerald-400", warn: "text-amber-400", bad: "text-red-400", info: "text-sky-400" })[s] || "text-slate-400";
  const statusIcon = (s) => ({ good: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />, warn: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />, bad: <AlertTriangle className="w-3.5 h-3.5 text-red-400" />, info: <Info className="w-3.5 h-3.5 text-sky-400" /> })[s];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Performance do Navegador</h3>
          <p className="text-xs text-slate-500 mt-0.5">Métricas de carregamento e recursos da página atual</p>
        </div>
        <Button size="sm" onClick={startRecording} disabled={isRecording} className="bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 h-8 text-xs gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${isRecording ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>
      {metrics.nav?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Carregamento da Página</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {metrics.nav.map((m, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-1">
                <div className="flex items-center gap-1">{statusIcon(m.status)}<p className="text-[10px] text-slate-500 leading-tight">{m.name}</p></div>
                <p className={`text-lg font-bold ${statusColor(m.status)}`}>{m.value}<span className="text-xs font-normal ml-0.5">{m.unit}</span></p>
              </div>
            ))}
          </div>
        </div>
      )}
      {metrics.mem?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Memória JavaScript</p>
          <div className="grid grid-cols-3 gap-2">
            {metrics.mem.map((m, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-1">
                <div className="flex items-center gap-1">{statusIcon(m.status)}<p className="text-[10px] text-slate-500">{m.name}</p></div>
                <p className={`text-lg font-bold ${statusColor(m.status)}`}>{m.value}<span className="text-xs font-normal ml-0.5">{m.unit}</span></p>
              </div>
            ))}
          </div>
        </div>
      )}
      {metrics.resources?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Últimos Recursos Carregados</p>
          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  <th className="text-left text-slate-500 font-medium px-3 py-2">Recurso</th>
                  <th className="text-left text-slate-500 font-medium px-3 py-2">Tipo</th>
                  <th className="text-right text-slate-500 font-medium px-3 py-2">Duração</th>
                  <th className="text-center text-slate-500 font-medium px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {metrics.resources.map((r, i) => (
                  <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-3 py-1.5 text-slate-300 truncate max-w-[200px]">{r.name}</td>
                    <td className="px-3 py-1.5"><Badge className="text-[10px] bg-white/[0.05] text-slate-400 border-white/[0.08]">{r.type}</Badge></td>
                    <td className={`px-3 py-1.5 text-right font-mono font-semibold ${statusColor(r.status)}`}>{r.value}ms</td>
                    <td className="px-3 py-1.5 text-center">{statusIcon(r.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function DebugDiagnosticos() {
  const [expanded, setExpanded] = useState({});
  const { data: user } = useQuery({ queryKey: ["me"], queryFn: () => api.auth.me() });
  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  const envInfo = {
    "User Agent": navigator.userAgent, "Linguagem": navigator.language,
    "Online": navigator.onLine ? "Sim" : "Não", "Largura Viewport": `${window.innerWidth}px`,
    "Altura Viewport": `${window.innerHeight}px`, "Device Pixel Ratio": window.devicePixelRatio,
    "Fuso Horário": Intl.DateTimeFormat().resolvedOptions().timeZone, "Hora Local": format(new Date(), "dd/MM/yyyy HH:mm:ss"),
  };
  const sessionInfo = user ? { "Email": user.email, "Nome": user.full_name, "Role": user.role, "ID": user.id, "Empresa Atual": user.empresaAtualId || "—" } : {};
  const lsKeys = Object.keys(localStorage);
  const lsSize = lsKeys.reduce((acc, k) => acc + (localStorage.getItem(k)?.length || 0), 0);
  const lsInfo = { "Total de Chaves": lsKeys.length, "Tamanho Estimado": `${Math.round(lsSize / 1024)} KB`, "Chaves": lsKeys.join(", ") || "—" };
  const [consoleErrors, setConsoleErrors] = useState([]);
  useEffect(() => {
    const orig = console.error;
    console.error = (...args) => { setConsoleErrors(prev => [...prev.slice(-19), { msg: args.map(String).join(" "), ts: new Date().toISOString() }]); orig(...args); };
    return () => { console.error = orig; };
  }, []);
  const Section = ({ title, data, defaultOpen }) => {
    const isOpen = expanded[title] ?? defaultOpen;
    return (
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <button onClick={() => toggle(title)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors">
          <span className="text-sm font-semibold text-white">{title}</span>
          {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </button>
        {isOpen && (
          <div className="border-t border-white/[0.05] divide-y divide-white/[0.03]">
            {Object.entries(data).map(([k, v]) => (
              <div key={k} className="flex items-start justify-between px-4 py-2 hover:bg-white/[0.02]">
                <span className="text-xs text-slate-500 shrink-0 w-40">{k}</span>
                <span className="text-xs text-slate-300 text-right break-all font-mono">{String(v)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  return (
    <div className="space-y-4">
      <div><h3 className="text-sm font-semibold text-white">Debug &amp; Diagnóstico</h3><p className="text-xs text-slate-500 mt-0.5">Informações do ambiente, sessão e erros capturados</p></div>
      <Section title="🖥️ Ambiente do Navegador" data={envInfo} defaultOpen={true} />
      <Section title="👤 Sessão do Usuário" data={sessionInfo} defaultOpen={true} />
      <Section title="💾 Local Storage" data={lsInfo} defaultOpen={false} />
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <button onClick={() => toggle("errors")} className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">🐛 Erros Capturados</span>
            {consoleErrors.length > 0 && <Badge className="text-[10px] bg-red-500/15 text-red-400 border-red-500/20">{consoleErrors.length}</Badge>}
          </div>
          {expanded["errors"] ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </button>
        {expanded["errors"] && (
          <div className="border-t border-white/[0.05]">
            {consoleErrors.length === 0
              ? <div className="flex items-center gap-2 px-4 py-3 text-emerald-400 text-xs"><CheckCircle className="w-4 h-4" /> Nenhum erro capturado nesta sessão</div>
              : <div className="divide-y divide-white/[0.03] max-h-60 overflow-y-auto">
                  {consoleErrors.map((e, i) => (
                    <div key={i} className="px-4 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <Badge className="text-[10px] bg-red-500/10 text-red-400 border-red-500/20">ERROR</Badge>
                        <span className="text-[10px] text-slate-500">{format(new Date(e.ts), "HH:mm:ss")}</span>
                      </div>
                      <p className="text-xs text-red-300 font-mono break-all">{e.msg.substring(0, 300)}</p>
                    </div>
                  ))}
                </div>}
          </div>
        )}
      </div>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-xs font-semibold text-slate-400 mb-3">⚡ Ações de Debug</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => window.location.reload()} className="bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:bg-white/[0.08] h-8 text-xs gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Recarregar Página</Button>
          <Button size="sm" onClick={() => { localStorage.clear(); window.location.reload(); }} className="bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 h-8 text-xs gap-1.5"><Trash2 className="w-3.5 h-3.5" /> Limpar Cache Local</Button>
          <Button size="sm" onClick={() => { const d = { env: envInfo, session: sessionInfo, ls: lsInfo, errors: consoleErrors }; navigator.clipboard.writeText(JSON.stringify(d, null, 2)); }} className="bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 h-8 text-xs gap-1.5"><Database className="w-3.5 h-3.5" /> Copiar Diagnóstico</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
const TABS = [
  { id: "health",     label: "System Health",   icon: Activity,    color: "text-indigo-400" },
  { id: "tech",       label: "Tech Dashboard",  icon: ShieldCheck, color: "text-violet-400" },
  { id: "performance",label: "Performance",     icon: Zap,         color: "text-sky-400" },
  { id: "analytics",  label: "Analytics",       icon: TrendingUp,  color: "text-violet-400" },
  { id: "debug",      label: "Debug",           icon: Bug,         color: "text-amber-400" },
  { id: "smoketest",  label: "Smoke Test",      icon: Activity,    color: "text-violet-400" },
];

export default function SystemHealth() {
  const [tab, setTab]           = useState("health");
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [lastFetch, setLastFetch] = useState(null);
  const [cbState, setCbState]   = useState(null);

  const doFetch = async () => {
    setLoading(true);
    try {
      const res = await api.functions.invoke("systemHealthSnapshot", {});
      if (res?.data?.snapshot) { setSnapshot(res.data.snapshot); setLastFetch(new Date()); }
      setCbState(obs.getCircuitState());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { doFetch(); }, []);

  return (
    <div className="min-h-screen bg-[#070b12] p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Activity className="w-5 h-5 text-indigo-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">System Health</h1>
          </div>
          <p className="text-sm text-slate-500">Observabilidade, engenharia e ferramentas de diagnóstico</p>
          <p className="text-[10px] text-slate-700 mt-1 font-mono">trace_id: {SESSION_TRACE_ID}</p>
        </div>
        <button onClick={doFetch} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 border border-white/8 bg-white/3 hover:bg-white/6 hover:text-white transition-all disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 p-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] w-fit mb-6">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.id ? "bg-white/[0.08] text-white shadow" : "text-slate-500 hover:text-slate-300"}`}>
            <t.icon className={`w-4 h-4 ${tab === t.id ? t.color : ""}`} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {tab === "health"      && <TabSystemHealth snapshot={snapshot} loading={loading} lastFetch={lastFetch} onRefresh={doFetch} />}
        {tab === "tech"        && <TabTechDashboard snapshot={snapshot} loading={loading} cbState={cbState} />}
        {tab === "performance" && <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"><PerformanceMonitor /></div>}
        {tab === "analytics"   && <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"><UserAnalyticsPanel /></div>}
        {tab === "debug"       && <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"><DebugDiagnosticos /></div>}
        {tab === "smoketest"   && <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"><SmokeTest3CPlus /></div>}
      </motion.div>
    </div>
  );
}