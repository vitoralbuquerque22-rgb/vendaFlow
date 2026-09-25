/**
 * Centro de Inteligência Comercial
 * Consome CommercialInsights (snapshot agregado — atualizado a cada 30 min).
 */
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { createPageUrl } from "@/utils";
import {
  Flame, Clock, TrendingUp, TrendingDown, DollarSign,
  AlertTriangle, RefreshCw, Phone, User, ArrowRight,
  Calendar, Zap, Target,
} from "lucide-react";
import { classificarScore } from "@/lib/healthScoreConfig";
import moment from "moment";
import { carregarMapaNomes } from "@/lib/services/equipeService";

function fmtTelefone(tel) {
  if (!tel) return null;
  const d = String(tel).replace(/\D/g, "");
  if (d.length === 13) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,9)}-${d.slice(9)}`;
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  return tel;
}

const STATUS_LABEL = {
  novo: "Novo", em_cadencia: "Em cadência", reuniao_agendada: "Reunião agendada",
  em_negociacao: "Em negociação", qualificado: "Qualificado",
};

const TIPO_LABEL = {
  ligacao: "Ligação", whatsapp: "WhatsApp", reuniao: "Reunião", email: "E-mail", tarefa: "Tarefa",
};

function PageHeader({ atualizado_em, totalLeads, totalAtivos, onRefresh, refreshing }) {
  return (
    <div className="mb-8">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Centro de Inteligência Comercial</h1>
          <p className="text-sm text-slate-500 mt-1">
            {atualizado_em ? `Snapshot atualizado ${moment(atualizado_em).fromNow()}` : "Visão consolidada de riscos, oportunidades e performance"}
          </p>
        </div>
        <button onClick={onRefresh} disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 border border-white/8 bg-white/3 hover:bg-white/6 hover:text-white transition-all disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>
      {totalLeads > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MetricChip label="Total de leads" value={totalLeads} color="#6366f1" />
          <MetricChip label="Leads ativos" value={totalAtivos} color="#22c55e" />
          <MetricChip label="Taxa ativa" value={`${Math.round(totalAtivos / totalLeads * 100)}%`} color="#f59e0b" />
        </div>
      )}
    </div>
  );
}

function MetricChip({ label, value, color }) {
  return (
    <div className="rounded-xl border border-white/5 bg-slate-900/60 px-4 py-3 flex items-center gap-3">
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-bold text-white">{value}</p>
      </div>
    </div>
  );
}

function SectionCard({ icon: Icon, iconColor, title, count, children }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-slate-900/60 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${iconColor}18` }}>
          <Icon className="w-4 h-4" style={{ color: iconColor }} />
        </div>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {count !== undefined && (
          <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${iconColor}18`, color: iconColor }}>{count}</span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function EmptyState({ msg }) {
  return <p className="text-xs text-slate-600 text-center py-6">{msg || "Nenhum item 🎉"}</p>;
}

function LeadEsquecidoRow({ lead, index, onNavigate }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/3 last:border-0 group cursor-pointer hover:bg-white/2 rounded-lg px-1 -mx-1 transition-colors" onClick={() => onNavigate(lead.id)}>
      <div className="w-6 h-6 rounded-full bg-orange-500/15 flex items-center justify-center text-xs font-bold text-orange-400 flex-shrink-0">{index + 1}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">{lead.nome}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {lead.telefone && <span className="text-xs text-slate-500 flex items-center gap-1"><Phone className="w-2.5 h-2.5" />{fmtTelefone(lead.telefone)}</span>}
          {lead.sdr_nome && <span className="text-xs text-slate-600 flex items-center gap-1"><User className="w-2.5 h-2.5" />{lead.sdr_nome}</span>}
          {lead.status && STATUS_LABEL[lead.status] && <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{STATUS_LABEL[lead.status]}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">{lead.dias_sem_atividade}d</span>
        <ArrowRight className="w-3.5 h-3.5 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

function FollowupRow({ item, onNavigate }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/3 last:border-0 group cursor-pointer hover:bg-white/2 rounded-lg px-1 -mx-1 transition-colors" onClick={() => onNavigate(item.lead_id)}>
      <div className="w-7 h-7 rounded-lg bg-amber-500/12 flex items-center justify-center flex-shrink-0">
        <Calendar className="w-3.5 h-3.5 text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">{item.lead_nome}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-slate-500">{TIPO_LABEL[item.tipo] || item.tipo} · previsto {moment(item.data_prevista).format("DD/MM")}</span>
          {item.sdr_nome && <span className="text-xs text-slate-600 flex items-center gap-1"><User className="w-2.5 h-2.5" />{item.sdr_nome}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">{item.dias_atrasado}d atraso</span>
        <ArrowRight className="w-3.5 h-3.5 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

function OportunidadeRow({ op, onNavigate }) {
  const cls = classificarScore(op.score);
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/3 last:border-0 group cursor-pointer hover:bg-white/2 rounded-lg px-1 -mx-1 transition-colors" onClick={() => onNavigate(op.lead_id)}>
      <span className="text-base flex-shrink-0">{cls.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">{op.nome}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {op.sdr_nome && <span className="text-xs text-slate-600 flex items-center gap-1"><User className="w-2.5 h-2.5" />{op.sdr_nome}</span>}
          {op.proximo_passo && <span className="text-xs text-slate-500 truncate max-w-[140px]" title={op.proximo_passo}>{op.proximo_passo}</span>}
          {op.urgencia && <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 flex items-center gap-1"><Zap className="w-2.5 h-2.5" />{op.urgencia}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-sm font-bold flex-shrink-0" style={{ color: cls.color }}>{op.score}</span>
        <ArrowRight className="w-3.5 h-3.5 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

function SdrRow({ sdr, valueLabel, color, mapaNomes = new Map() }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/3 last:border-0">
      <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/8 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
        {sdr.nome?.charAt(0)?.toUpperCase() || sdr.email?.charAt(0)?.toUpperCase() || "?"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{sdr.nome || mapaNomes.get((sdr.email || '').toLowerCase()) || sdr.email?.split("@")[0]}</p>
        <p className="text-xs text-slate-500">{sdr.atendimentos} atendimentos (30d)</p>
      </div>
      <span className="text-sm font-bold flex-shrink-0 px-2 py-0.5 rounded-full text-xs" style={{ background: `${color}15`, color }}>{valueLabel(sdr)}</span>
    </div>
  );
}

function GargaloRow({ g }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/3 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-sm text-white">{g.label}</p>
          <span className="text-sm font-bold text-orange-400 ml-3 flex-shrink-0">{g.count}</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-700/60 overflow-hidden">
          <div className="h-full rounded-full bg-orange-500/70 transition-all" style={{ width: `${g.pct}%` }} />
        </div>
        <p className="text-xs text-slate-600 mt-1">{g.pct}% do total de leads</p>
      </div>
    </div>
  );
}

export default function InteligenciaComercial() {
  const { empresaId } = useEmpresaAtual();
  const { data: mapaNomes = new Map() } = useQuery({
    queryKey: ["mapaNomes", empresaId],
    queryFn: () => carregarMapaNomes(empresaId),
    enabled: !!empresaId,
    staleTime: 120000,
  });
  const navigate = useNavigate();
  const hoje = new Date().toISOString().slice(0, 10);

  const { data: snapshot, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["commercial-insights", empresaId, hoje],
    queryFn: async () => {
      if (!empresaId) return null;
      const rows = await api.entities.CommercialInsights.filter({ empresaId, dia: hoje });
      return rows?.[0] || null;
    },
    enabled: !!empresaId,
    staleTime: 1800000,
  });

  const handleRefresh = async () => {
    try { await api.functions.invoke("calcularCommercialInsights", { empresaId }); } catch {}
    refetch();
  };

  const navegarParaLead = (leadId) => {
    if (leadId) navigate(createPageUrl("Leads") + `?lead=${leadId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070b12] flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-slate-600 animate-spin" />
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="min-h-screen bg-[#070b12] flex items-center justify-center flex-col gap-4">
        <Target className="w-10 h-10 text-slate-700" />
        <p className="text-slate-500 text-sm">Nenhum snapshot disponível para hoje.</p>
        <button onClick={handleRefresh} disabled={isFetching}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          Gerar agora
        </button>
      </div>
    );
  }

  const leadsEsquecidos = snapshot.leads_esquecidos      || [];
  const followups       = snapshot.followups_atrasados   || [];
  const oportunidades   = snapshot.oportunidades_quentes || [];
  const gargalos        = snapshot.gargalos              || [];
  const sdrDestaque     = snapshot.sdr_destaque          || [];
  const sdrBaixaPerf    = snapshot.sdr_baixa_perf        || [];

  return (
    <div className="min-h-screen bg-[#070b12] p-6 lg:p-8">
      <PageHeader atualizado_em={snapshot.atualizado_em} totalLeads={snapshot.total_leads} totalAtivos={snapshot.total_leads_ativos} onRefresh={handleRefresh} refreshing={isFetching} />
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
        <SectionCard icon={Flame} iconColor="#f97316" title="Leads esquecidos" count={leadsEsquecidos.length}>
          {leadsEsquecidos.length > 0 ? leadsEsquecidos.slice(0, 8).map((lead, i) => <LeadEsquecidoRow key={lead.id || i} lead={lead} index={i} onNavigate={navegarParaLead} />) : <EmptyState msg="Nenhum lead esquecido 🎉" />}
        </SectionCard>
        <SectionCard icon={Clock} iconColor="#f59e0b" title="Follow-ups atrasados" count={followups.length}>
          {followups.length > 0 ? followups.slice(0, 8).map((item, i) => <FollowupRow key={item.id || i} item={item} onNavigate={navegarParaLead} />) : <EmptyState msg="Sem atrasos 🎉" />}
        </SectionCard>
        <SectionCard icon={DollarSign} iconColor="#22c55e" title="Oportunidades quentes" count={oportunidades.length}>
          {oportunidades.length > 0 ? oportunidades.map((op, i) => <OportunidadeRow key={op.lead_id || i} op={op} onNavigate={navegarParaLead} />) : <EmptyState msg="Nenhuma oportunidade quente ainda" />}
        </SectionCard>
        <SectionCard icon={TrendingUp} iconColor="#6366f1" title="SDR destaque (30 dias)">
          {sdrDestaque.length > 0 ? sdrDestaque.map((s) => <SdrRow key={s.email} sdr={s} valueLabel={(s) => `${s.conversoes} conv.`} color="#6366f1" mapaNomes={mapaNomes} />) : <EmptyState msg="Dados insuficientes" />}
        </SectionCard>
        <SectionCard icon={TrendingDown} iconColor="#f87171" title="Atenção: baixa performance">
          {sdrBaixaPerf.length > 0 ? sdrBaixaPerf.map((s) => <SdrRow key={s.email} sdr={s} valueLabel={(s) => `${s.taxa ?? 0}% conv.`} color="#f87171" mapaNomes={mapaNomes} />) : <EmptyState msg="Dados insuficientes" />}
        </SectionCard>
        <SectionCard icon={AlertTriangle} iconColor="#fb923c" title="Gargalos do funil">
          {gargalos.length > 0 ? gargalos.map((g) => <GargaloRow key={g.label} g={g} />) : <EmptyState msg="Funil saudável 🎉" />}
        </SectionCard>
      </div>
    </div>
  );
}