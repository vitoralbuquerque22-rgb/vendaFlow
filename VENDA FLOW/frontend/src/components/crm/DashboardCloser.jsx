import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listarLeads } from "@/lib/services/leadService";
import { listarTarefas } from "@/lib/services/tarefaService";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { format, isToday, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExternalLink, TrendingUp, Trophy, Calendar, DollarSign, Target, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const ESTAGIOS = [
  { key: "reuniao_agendada",  label: "Reunião Confirmada", color: "#78716c", bg: "rgba(120,113,108,0.15)", border: "rgba(120,113,108,0.3)" },
  { key: "reuniao_realizada", label: "Reunião Realizada",  color: "#f97316", bg: "rgba(249,115,22,0.15)",  border: "rgba(249,115,22,0.3)" },
  { key: "proposta_enviada",  label: "Proposta Enviada",   color: "#f59e0b", bg: "rgba(245,158,11,0.15)",  border: "rgba(245,158,11,0.3)" },
  { key: "em_negociacao",     label: "Em Negociação",      color: "#eab308", bg: "rgba(234,179,8,0.15)",   border: "rgba(234,179,8,0.3)" },
];

function KpiCard({ label, value, icon: Icon, color = "blue", sub }) {
  const colors = {
    blue:    { bg: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.3)",  text: "#60a5fa" },
    emerald: { bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.3)",  text: "#34d399" },
    amber:   { bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.3)",  text: "#fbbf24" },
    violet:  { bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.3)", text: "#a78bfa" },
    rose:    { bg: "rgba(251,113,133,0.12)", border: "rgba(251,113,133,0.3)", text: "#fb7185" },
    orange:  { bg: "rgba(251,146,60,0.12)",  border: "rgba(251,146,60,0.3)",  text: "#fb923c" },
  };
  const c = colors[color] || colors.blue;
  return (
    <div className="rounded-2xl p-4" style={{ background: "rgba(15,23,42,0.8)", border: `1px solid ${c.border}` }}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: c.bg }}>
          <Icon className="w-4 h-4" style={{ color: c.text }} />
        </div>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function DashboardCloser({ userEmail, filtroVendedor }) {
  const { empresaId } = useEmpresaAtual();
  const emailFiltro = filtroVendedor !== "todos" ? filtroVendedor : userEmail;

  const { data: allLeads = [] } = useQuery({
    queryKey: ["leads-dashboard-closer", empresaId],
    queryFn: () => listarLeads(empresaId),
    enabled: !!empresaId,
    refetchInterval: 60_000,
  });

  const { data: allTarefas = [] } = useQuery({
    queryKey: ["tarefas-dashboard-closer", empresaId],
    queryFn: () => listarTarefas(empresaId),
    enabled: !!empresaId,
    refetchInterval: 60_000,
  });

  const leads = useMemo(() =>
    emailFiltro ? allLeads.filter(l => l.closer_responsavel === emailFiltro || l.sdr_responsavel === emailFiltro) : allLeads,
    [allLeads, emailFiltro]
  );

  const tarefas = useMemo(() =>
    emailFiltro ? allTarefas.filter(t => t.sdr_email === emailFiltro) : allTarefas,
    [allTarefas, emailFiltro]
  );

  const reunioesHoje = useMemo(() =>
    tarefas.filter(t => t.tipo === "reuniao" && isToday(new Date(t.data_prevista))),
    [tarefas]
  );

  const mesInicio = startOfMonth(new Date());

  const kpis = useMemo(() => {
    const pipeline = leads.filter(l => ESTAGIOS.map(e => e.key).includes(l.status));
    const ganhosMes = leads.filter(l => l.status === "fechado" && new Date(l.updated_date) >= mesInicio);
    const perdidosMes = leads.filter(l => l.status === "perdido" && new Date(l.updated_date) >= mesInicio);
    const totalReunioes = tarefas.filter(t => t.tipo === "reuniao").length;
    const taxaConversao = totalReunioes > 0 ? Math.round((ganhosMes.length / totalReunioes) * 100) : 0;
    const ticketMedio = ganhosMes.length > 0
      ? ganhosMes.reduce((s, l) => s + (l.valor_potencial || l.valor_proposta || 0), 0) / ganhosMes.length
      : 0;
    const valorPipeline = pipeline.reduce((s, l) => s + (l.valor_potencial || l.valor_proposta || 0), 0);

    const counts = {};
    ESTAGIOS.forEach(e => { counts[e.key] = 0; });
    pipeline.forEach(l => { if (counts[l.status] !== undefined) counts[l.status]++; });

    return { pipeline: pipeline.length, ganhosMes: ganhosMes.length, perdidosMes: perdidosMes.length, taxaConversao, ticketMedio, valorPipeline, counts };
  }, [leads, tarefas, mesInicio]);

  const formatMoeda = (v) => v > 0 ? `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}` : "—";

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Reuniões Hoje"    value={reunioesHoje.length}              icon={Calendar}    color="blue" />
        <KpiCard label="Em Pipeline"      value={kpis.pipeline}                    icon={BarChart3}   color="amber" />
        <KpiCard label="Ganhos do Mês"    value={kpis.ganhosMes}                   icon={Trophy}      color="emerald" sub={`${kpis.perdidosMes} perdidos`} />
        <KpiCard label="Taxa Conversão"   value={`${kpis.taxaConversao}%`}         icon={Target}      color="violet" sub="reunião → venda" />
        <KpiCard label="Ticket Médio"     value={formatMoeda(kpis.ticketMedio)}    icon={DollarSign}  color="orange" />
        <KpiCard label="Valor Pipeline"   value={formatMoeda(kpis.valorPipeline)}  icon={TrendingUp}  color="rose" />
      </div>

      {/* Funil horizontal */}
      <div className="rounded-2xl p-5" style={{ background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-bold text-white">Distribuição por Estágio</h3>
          <span className="text-xs text-slate-500">({kpis.pipeline} leads no pipeline)</span>
        </div>
        <div className="flex gap-2 mb-3 h-10">
          {ESTAGIOS.map(e => {
            const pct = kpis.pipeline > 0 ? (kpis.counts[e.key] / kpis.pipeline) * 100 : 0;
            if (pct === 0) return null;
            return (
              <div key={e.key} className="rounded-lg flex items-center justify-center text-xs font-bold text-white transition-all"
                style={{ width: `${Math.max(pct, 8)}%`, background: e.bg, border: `1px solid ${e.border}`, color: e.color }}
                title={`${e.label}: ${kpis.counts[e.key]}`}>
                {kpis.counts[e.key]}
              </div>
            );
          })}
          {kpis.pipeline === 0 && (
            <div className="flex-1 rounded-lg flex items-center justify-center text-xs text-slate-600" style={{ border: "1px dashed rgba(255,255,255,0.06)" }}>
              Pipeline vazio
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          {ESTAGIOS.map(e => (
            <div key={e.key} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: e.color }} />
              <span className="text-xs text-slate-400">{e.label}</span>
              <span className="text-xs font-bold" style={{ color: e.color }}>{kpis.counts[e.key]}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 ml-auto">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="text-xs text-slate-400">Ganhos</span>
            <span className="text-xs font-bold text-emerald-400">{kpis.ganhosMes}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
            <span className="text-xs text-slate-400">Perdidos</span>
            <span className="text-xs font-bold text-rose-400">{kpis.perdidosMes}</span>
          </div>
        </div>
      </div>

      {/* Reuniões de hoje */}
      <div className="rounded-2xl p-5" style={{ background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm font-bold text-white">Reuniões de Hoje</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-500/30 text-sky-300">{reunioesHoje.length}</span>
        </div>
        {reunioesHoje.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-6">Nenhuma reunião hoje.</p>
        ) : (
          <div className="space-y-2">
            {reunioesHoje.sort((a, b) => new Date(a.data_prevista) - new Date(b.data_prevista)).map(t => {
              const linkMeet = (t.observacao || "").match(/https:\/\/meet\.google\.com\/[^\s]+/)?.[0];
              const isRealizada = t.status === "concluida";
              const isCancelada = t.status === "cancelada";
              return (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="text-xs font-mono text-slate-400 w-12 flex-shrink-0">
                      {format(new Date(t.data_prevista), "HH:mm")}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{t.lead_nome || "—"}</p>
                      {t.lead_empresa && <p className="text-xs text-slate-500 truncate">{t.lead_empresa}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {linkMeet && (
                      <a href={linkMeet} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30 transition-colors">
                        <ExternalLink className="w-3 h-3" /> Meet
                      </a>
                    )}
                    <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium",
                      isRealizada ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300" :
                      isCancelada ? "bg-rose-500/20 border-rose-500/30 text-rose-300" :
                      "bg-sky-500/20 border-sky-500/30 text-sky-300"
                    )}>
                      {isRealizada ? "Realizada" : isCancelada ? "Cancelada" : "Agendada"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}