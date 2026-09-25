import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Zap, Activity, Bug, RefreshCw, Trash2,
  Database, TrendingUp,
  AlertTriangle, CheckCircle, Info, ChevronDown, ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import UserAnalyticsPanel from "@/components/profiler/UserAnalyticsPanel";
import SmokeTest3CPlus from "@/components/profiler/SmokeTest3CPlus";
import { usePermissions } from "@/components/hooks/usePermissions";

// ── Performance Monitor ───────────────────────────────────────
function PerformanceMonitor() {
  const [metrics, setMetrics] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const observerRef = useRef(null);

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
      value: Math.round(r.duration),
      unit: "ms",
      type: r.initiatorType,
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

  const statusColor = (s) => ({
    good: "text-emerald-400", warn: "text-amber-400", bad: "text-red-400", info: "text-sky-400"
  })[s] || "text-slate-400";

  const statusIcon = (s) => ({
    good: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />,
    warn: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
    bad: <AlertTriangle className="w-3.5 h-3.5 text-red-400" />,
    info: <Info className="w-3.5 h-3.5 text-sky-400" />
  })[s];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Performance do Navegador</h3>
          <p className="text-xs text-slate-500 mt-0.5">Métricas de carregamento e recursos da página atual</p>
        </div>
        <Button size="sm" onClick={startRecording} disabled={isRecording}
          className="bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 h-8 text-xs gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${isRecording ? "animate-spin" : ""}`} />
          Atualizar
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

// ── Debug / Diagnostics ───────────────────────────────────────
function DebugDiagnosticos() {
  const [expanded, setExpanded] = useState({});
  const { data: user } = useQuery({ queryKey: ["me"], queryFn: () => api.auth.me() });

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const envInfo = {
    "User Agent": navigator.userAgent,
    "Linguagem": navigator.language,
    "Online": navigator.onLine ? "Sim" : "Não",
    "Largura Viewport": `${window.innerWidth}px`,
    "Altura Viewport": `${window.innerHeight}px`,
    "Device Pixel Ratio": window.devicePixelRatio,
    "Fuso Horário": Intl.DateTimeFormat().resolvedOptions().timeZone,
    "Hora Local": format(new Date(), "dd/MM/yyyy HH:mm:ss"),
  };

  const sessionInfo = user ? {
    "Email": user.email,
    "Nome": user.full_name,
    "Role": user.role,
    "ID": user.id,
    "Empresa Atual": user.empresaAtualId || "—",
  } : {};

  const lsKeys = Object.keys(localStorage);
  const lsSize = lsKeys.reduce((acc, k) => acc + (localStorage.getItem(k)?.length || 0), 0);
  const lsInfo = {
    "Total de Chaves": lsKeys.length,
    "Tamanho Estimado": `${Math.round(lsSize / 1024)} KB`,
    "Chaves": lsKeys.join(", ") || "—",
  };

  const [consoleErrors, setConsoleErrors] = useState([]);
  useEffect(() => {
    const orig = console.error;
    console.error = (...args) => {
      setConsoleErrors(prev => [...prev.slice(-19), { msg: args.map(String).join(" "), ts: new Date().toISOString() }]);
      orig(...args);
    };
    return () => { console.error = orig; };
  }, []);

  const Section = ({ title, data, defaultOpen }) => {
    const isOpen = expanded[title] ?? defaultOpen;
    return (
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <button onClick={() => toggle(title)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors">
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
      <div>
        <h3 className="text-sm font-semibold text-white">Debug &amp; Diagnóstico</h3>
        <p className="text-xs text-slate-500 mt-0.5">Informações do ambiente, sessão e erros capturados</p>
      </div>

      <Section title="🖥️ Ambiente do Navegador" data={envInfo} defaultOpen={true} />
      <Section title="👤 Sessão do Usuário" data={sessionInfo} defaultOpen={true} />
      <Section title="💾 Local Storage" data={lsInfo} defaultOpen={false} />

      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <button onClick={() => toggle("errors")}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">🐛 Erros Capturados</span>
            {consoleErrors.length > 0 && (
              <Badge className="text-[10px] bg-red-500/15 text-red-400 border-red-500/20">{consoleErrors.length}</Badge>
            )}
          </div>
          {expanded["errors"] ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </button>
        {expanded["errors"] && (
          <div className="border-t border-white/[0.05]">
            {consoleErrors.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-3 text-emerald-400 text-xs">
                <CheckCircle className="w-4 h-4" /> Nenhum erro capturado nesta sessão
              </div>
            ) : (
              <div className="divide-y divide-white/[0.03] max-h-60 overflow-y-auto">
                {consoleErrors.map((e, i) => (
                  <div key={i} className="px-4 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <Badge className="text-[10px] bg-red-500/10 text-red-400 border-red-500/20">ERROR</Badge>
                      <span className="text-[10px] text-slate-500">{format(new Date(e.ts), "HH:mm:ss")}</span>
                    </div>
                    <p className="text-xs text-red-300 font-mono break-all">{e.msg.substring(0, 300)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-xs font-semibold text-slate-400 mb-3">⚡ Ações de Debug</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => window.location.reload()}
            className="bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:bg-white/[0.08] h-8 text-xs gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Recarregar Página
          </Button>
          <Button size="sm" onClick={() => { localStorage.clear(); window.location.reload(); }}
            className="bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 h-8 text-xs gap-1.5">
            <Trash2 className="w-3.5 h-3.5" /> Limpar Cache Local
          </Button>
          <Button size="sm" onClick={() => { const d = { env: envInfo, session: sessionInfo, ls: lsInfo, errors: consoleErrors }; navigator.clipboard.writeText(JSON.stringify(d, null, 2)); }}
            className="bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 h-8 text-xs gap-1.5">
            <Database className="w-3.5 h-3.5" /> Copiar Diagnóstico
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
const TABS = [
  { id: "performance", label: "Performance", icon: Zap, color: "text-sky-400" },
  { id: "analytics", label: "Analytics", icon: TrendingUp, color: "text-violet-400" },
  { id: "debug", label: "Debug", icon: Bug, color: "text-amber-400" },
  { id: "smoketest", label: "Smoke Test", icon: Activity, color: "text-violet-400" },
];

export default function ProfilerTools() {
  const [tab, setTab] = useState("performance");

  const { data: user, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.auth.me(),
  });

  const isSuperAdmin = user?.role === "super_admin" || user?.role === "admin";

  if (isLoading) return (
    <div className="flex items-center justify-center h-screen" style={{ background: "hsl(222 47% 4%)" }}>
      <div className="w-8 h-8 border-4 border-slate-700 border-t-sky-500 rounded-full animate-spin" />
    </div>
  );

  if (!isSuperAdmin) return (
    <div className="flex items-center justify-center h-screen" style={{ background: "hsl(222 47% 4%)" }}>
      <div className="text-center">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <p className="text-white font-semibold">Acesso restrito a administradores</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "hsl(222 47% 4%)" }}>
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Profiler Tools</h1>
            <p className="text-xs text-slate-500">Ferramentas de diagnóstico e análise — apenas admins</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] w-fit">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                tab === t.id
                  ? "bg-white/[0.08] text-white shadow"
                  : "text-slate-500 hover:text-slate-300"
              }`}>
              <t.icon className={`w-4 h-4 ${tab === t.id ? t.color : ""}`} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"
        >
          {tab === "performance" && <PerformanceMonitor />}
          {tab === "analytics" && <UserAnalyticsPanel />}
          {tab === "debug" && <DebugDiagnosticos />}
          {tab === "smoketest" && <SmokeTest3CPlus />}
        </motion.div>
      </div>
    </div>
  );
}