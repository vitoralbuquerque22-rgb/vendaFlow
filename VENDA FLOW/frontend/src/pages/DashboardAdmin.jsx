import { useState } from "react";
import { api } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import {
  Building2, Users, UserCheck, CalendarClock, CheckCircle2,
  DollarSign, Target, TrendingUp, TrendingDown, Sparkles,
  ChevronDown, Activity, XCircle, Loader2, Clock,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { usePermissions } from "@/components/hooks/usePermissions";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { carregarMapaNomes } from "@/lib/services/equipeService";

const tooltipStyle = {
  backgroundColor: "#0d1428",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: "12px",
  color: "#e2e8f0",
  fontSize: "12px",
  boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
  colorScheme: "dark",
};

const tooltipItemStyle = { color: "#e2e8f0" };
const tooltipLabelStyle = { color: "#94a3b8" };

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20, scale: 0.97, filter: "blur(8px)" },
  animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
  transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] },
});

// ─── MetricCard ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, hint, icon: Icon, glow, trend, delay = 0 }) {
  return (
    <motion.div {...fadeUp(delay)}
      className="group relative rounded-3xl overflow-hidden cursor-default transition-all duration-300 hover:-translate-y-1"
      style={{
        background: "linear-gradient(180deg, rgba(12,18,38,0.88) 0%, rgba(7,11,25,0.94) 100%)",
        border: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(18px)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
        padding: "22px",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.border = "1px solid rgba(66,165,255,0.22)";
        e.currentTarget.style.boxShadow = `0 0 36px ${glow || "rgba(66,165,255,0.14)"}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.border = "1px solid rgba(255,255,255,0.06)";
        e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.35)";
      }}
    >
      {/* glow orb */}
      <div className="absolute pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ top: "-45%", right: "-20%", width: 180, height: 180, background: `radial-gradient(circle, ${glow || "rgba(66,165,255,0.12)"}, transparent 70%)`, filter: "blur(10px)" }} />

      <div className="relative z-10 flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: glow ? `${glow.replace("0.14", "0.15")}` : "rgba(66,165,255,0.12)", border: `1px solid ${glow || "rgba(66,165,255,0.2)"}` }}>
            <Icon className="w-4 h-4 text-sky-300" />
          </div>
          <span className="text-xs font-medium" style={{ color: "#7F8BA7" }}>{label}</span>
        </div>
        <p className="text-2xl font-bold tracking-tight text-white">{value}</p>
        <div className="flex items-center justify-between gap-2">
          {hint && <span className="text-xs" style={{ color: "#4B5878" }}>{hint}</span>}
          {trend && (
            <div className="flex items-center gap-0.5 text-xs font-semibold"
              style={{ color: trend.up ? "#6ee7b7" : "#fda4af" }}>
              {trend.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {trend.value}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── ConversionCard ───────────────────────────────────────────────────────────
function ConversionCard({ label, value, glow, delay = 0 }) {
  return (
    <motion.div {...fadeUp(delay)}
      className="relative rounded-3xl overflow-hidden flex flex-col items-center justify-center gap-4 transition-all duration-300 hover:-translate-y-1 cursor-default"
      style={{
        background: "linear-gradient(180deg, rgba(10,16,34,0.95) 0%, rgba(7,11,25,0.94) 100%)",
        border: "1px solid rgba(255,255,255,0.05)",
        backdropFilter: "blur(18px)",
        padding: "36px",
        textAlign: "center",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 0 42px ${glow || "rgba(66,165,255,0.12)"}`; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ""; }}
    >
      <div className="absolute pointer-events-none"
        style={{ top: "-30%", left: "50%", transform: "translateX(-50%)", width: 180, height: 180, background: `radial-gradient(circle, ${glow || "rgba(66,165,255,0.18)"}, transparent 70%)`, filter: "blur(12px)" }} />
      <div className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: `radial-gradient(circle, ${glow || "rgba(66,165,255,0.2)"}, transparent 70%)`, border: `1px solid ${glow || "rgba(66,165,255,0.2)"}` }}>
        <Target className="w-6 h-6 text-sky-300" />
      </div>
      <p className="relative z-10 text-xs font-medium" style={{ color: "#7F8BA7" }}>{label}</p>
      <p className="relative z-10 text-4xl font-extrabold text-white tracking-tight">{value}%</p>
    </motion.div>
  );
}

// ─── ChartCard ────────────────────────────────────────────────────────────────
function ChartCard({ title, icon: Icon, glow, children, delay = 0 }) {
  return (
    <motion.div {...fadeUp(delay)}
      className="group relative rounded-[28px] overflow-hidden transition-all duration-300 hover:-translate-y-1"
      style={{
        background: "linear-gradient(180deg, rgba(12,18,38,0.88) 0%, rgba(7,11,25,0.96) 100%)",
        border: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(18px)",
        padding: "26px",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.border = "1px solid rgba(139,92,246,0.22)";
        e.currentTarget.style.boxShadow = "0 0 38px rgba(139,92,246,0.14)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.border = "1px solid rgba(255,255,255,0.06)";
        e.currentTarget.style.boxShadow = "";
      }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: glow ? `${glow.replace("0.14","0.15")}` : "rgba(139,92,246,0.12)", border: `1px solid ${glow || "rgba(139,92,246,0.2)"}` }}>
          <Icon className="w-4 h-4 text-violet-300" />
        </div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

// ─── SummaryItem ──────────────────────────────────────────────────────────────
function SummaryItem({ label, value, color }) {
  return (
    <div className="text-center p-4 rounded-2xl transition-all duration-200 hover:-translate-y-0.5"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: "#4B5878" }}>{label}</p>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardAdmin() {
  const [periodo, setPeriodo] = useState("30");
  const { isSuperAdmin } = usePermissions();
  const { empresaId } = useEmpresaAtual();
  const { data: mapaNomes = new Map() } = useQuery({
    queryKey: ["mapaNomes", empresaId],
    queryFn: () => carregarMapaNomes(empresaId),
    enabled: !!empresaId,
    staleTime: 120000,
  });

  const { data: user } = useQuery({ queryKey: ["me"], queryFn: () => api.auth.me() });

  // Queries só disparam após confirmar que é super admin — evita full table scan por usuários não autorizados
  const { data: empresas = [], isLoading: loadingEmpresas } = useQuery({ queryKey: ["all-empresas"], queryFn: () => api.entities.Empresa.list(), enabled: isSuperAdmin });
  const { data: vinculos = [], isLoading: loadingVinculos } = useQuery({ queryKey: ["all-vinculos"], queryFn: () => api.entities.VinculoEmpresa.list(), enabled: isSuperAdmin });
  const { data: leads = [], isLoading: loadingLeads } = useQuery({ queryKey: ["all-leads"], queryFn: () => api.entities.Lead.list("-created_date", 10000), enabled: isSuperAdmin });
  const { data: atividades = [], isLoading: loadingAtividades } = useQuery({ queryKey: ["all-atividades"], queryFn: () => api.entities.Atividade.list("-created_date", 5000), enabled: isSuperAdmin });
  const { data: tarefas = [], isLoading: loadingTarefas } = useQuery({ queryKey: ["all-tarefas"], queryFn: () => api.entities.Tarefa.list("-created_date", 5000), enabled: isSuperAdmin });

  const isLoading = loadingEmpresas || loadingVinculos || loadingLeads || loadingAtividades || loadingTarefas;

  const pageBg = "radial-gradient(circle at top left, rgba(66,165,255,0.14) 0%, transparent 28%), radial-gradient(circle at top right, rgba(139,92,246,0.12) 0%, transparent 32%), linear-gradient(180deg, #050816 0%, #060B1C 100%)";

  if (user && !isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: pageBg }}>
        <div className="rounded-3xl p-10 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <XCircle className="w-10 h-10 mx-auto mb-4 text-rose-400" />
          <p style={{ color: "#7F8BA7" }}>Acesso restrito a administradores globais</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: pageBg }}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-sky-400" />
          <p style={{ color: "#7F8BA7" }}>Carregando dados globais...</p>
        </div>
      </div>
    );
  }

  // ─── Dados ──────────────────────────────────────────────────────────────────
  const dataInicio = subDays(new Date(), parseInt(periodo));
  const dataFim = new Date();
  const inRange = (d) => isWithinInterval(new Date(d), { start: startOfDay(dataInicio), end: endOfDay(dataFim) });
  const leadsFiltrados = leads.filter((l) => inRange(l.created_date));

  const empresasAtivas = empresas.filter((e) => e.statusPlano === "ativo").length;
  const empresasInativas = empresas.filter((e) => e.statusPlano !== "ativo").length;
  const vinculosAtivos = vinculos.filter((v) => v.status === "ativo");
  const totalSDRs = vinculosAtivos.filter((v) => v.papel === "sdr").length;
  const totalClosers = vinculosAtivos.filter((v) => v.papel === "closer").length;
  const totalGestores = vinculosAtivos.filter((v) => v.papel === "gestor").length;
  const totalAdminsEmpresa = vinculosAtivos.filter((v) => v.papel === "admin").length;
  const totalVendedores = vinculosAtivos.length;
  const totalLeads = leads.length;
  const reunioesAgendadas = leads.filter((l) => l.status === "reuniao_agendada" || l.status === "reuniao_realizada").length;
  const reunioesRealizadas = leads.filter((l) => l.status === "reuniao_realizada").length;
  const vendasRealizadas = tarefas.filter((t) => t.resultado_venda === "venda_realizada").length;
  const receitaPotencial = leads.filter((l) => l.status === "reuniao_realizada" || l.status === "qualificado").reduce((acc, l) => acc + (l.valor_potencial || 0), 0);
  const taxaLeadParaReuniao = totalLeads > 0 ? ((reunioesAgendadas / totalLeads) * 100).toFixed(1) : "0.0";
  const taxaReuniaoParaVenda = reunioesAgendadas > 0 ? ((vendasRealizadas / reunioesAgendadas) * 100).toFixed(1) : "0.0";
  const taxaConversaoGeral = totalLeads > 0 ? ((vendasRealizadas / totalLeads) * 100).toFixed(1) : "0.0";
  const tarefasRealizadas = tarefas.filter((t) => t.status === "concluida").length;
  const produtividadeGeral = tarefas.length > 0 ? ((tarefasRealizadas / tarefas.length) * 100).toFixed(1) : "0.0";

  const empresasPorPlano = [
    { name: "Starter", value: empresas.filter((e) => e.plano === "starter").length, fill: "#60a5fa" },
    { name: "Pro", value: empresas.filter((e) => e.plano === "pro").length, fill: "#a78bfa" },
    { name: "Enterprise", value: empresas.filter((e) => e.plano === "enterprise").length, fill: "#fbbf24" },
  ];

  const vendedoresPorPapel = [
    { name: "SDRs", value: totalSDRs },
    { name: "Closers", value: totalClosers },
    { name: "Gestores", value: totalGestores },
    { name: "Admins", value: totalAdminsEmpresa },
  ];

  const leadsPorEmpresa = empresas
    .map((e) => ({ nome: e.nome?.substring(0, 15) || "—", leads: leads.filter((l) => l.empresaId === e.id).length }))
    .sort((a, b) => b.leads - a.leads).slice(0, 10);

  const leadsPorStatus = [
    { name: "Novos", value: leads.filter((l) => l.status === "novo").length, fill: "#64748b" },
    { name: "Cadência", value: leads.filter((l) => l.status === "em_cadencia").length, fill: "#60a5fa" },
    { name: "Respondeu", value: leads.filter((l) => l.status === "respondeu").length, fill: "#a78bfa" },
    { name: "Reun. Ag.", value: leads.filter((l) => l.status === "reuniao_agendada").length, fill: "#fbbf24" },
    { name: "Reun. Real.", value: leads.filter((l) => l.status === "reuniao_realizada").length, fill: "#34d399" },
    { name: "Desqualif.", value: leads.filter((l) => l.status === "desqualificado" || l.status === "sem_interesse").length, fill: "#f87171" },
  ];

  const atividadesPorDia = [];
  const leadsPorDia = [];
  for (let i = 29; i >= 0; i--) {
    const dia = subDays(new Date(), i);
    const diaStr = format(dia, "yyyy-MM-dd");
    atividadesPorDia.push({ dia: format(dia, "dd/MM"), value: atividades.filter((a) => format(new Date(a.created_date), "yyyy-MM-dd") === diaStr).length });
    leadsPorDia.push({ dia: format(dia, "dd/MM"), value: leads.filter((l) => format(new Date(l.created_date), "yyyy-MM-dd") === diaStr).length });
  }
  const evolucao = atividadesPorDia.map((item, i) => ({ dia: item.dia, atividades: item.value, leads: leadsPorDia[i].value }));

  // ─── Tempo em modo manual por usuário ────────────────────────────────────
  const atividadesModoManual = atividades.filter((a) => a.tipo === 'modo_manual');
  const tempoManualPorUser = {};
  atividadesModoManual.forEach((a) => {
    const user = a.sdr_email || '—';
    if (!tempoManualPorUser[user]) {
      tempoManualPorUser[user] = { email: user, segundos: 0, count: 0 };
    }
    tempoManualPorUser[user].segundos += a.tma_segundos || a.duracao_segundos || 0;
    tempoManualPorUser[user].count += 1;
  });
  const tempoManualChart = Object.values(tempoManualPorUser)
    .map((item) => ({
      usuario: mapaNomes.get((item.email || '').toLowerCase()) || item.email.split('@')[0] || item.email,
      minutos: Math.round(item.segundos / 60),
      count: item.count,
    }))
    .sort((a, b) => b.minutos - a.minutos)
    .slice(0, 8);

  return (
    <div className="min-h-screen font-sans text-white" style={{ background: pageBg }}>
      {/* Noise */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.025]"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />

      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute rounded-full" style={{ width: 500, height: 500, top: -80, left: "20%", background: "rgba(66,165,255,0.08)", filter: "blur(140px)" }} />
        <div className="absolute rounded-full" style={{ width: 400, height: 400, top: "30%", right: 0, background: "rgba(139,92,246,0.08)", filter: "blur(120px)" }} />
      </div>

      <div className="relative z-10 p-6 md:p-10 space-y-7">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <motion.div {...fadeUp(0.08)} className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-[20px] flex items-center justify-center flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, rgba(66,165,255,0.22), rgba(139,92,246,0.22))",
                border: "1px solid rgba(66,165,255,0.18)",
                boxShadow: "0 0 30px rgba(66,165,255,0.18)",
              }}>
              <Sparkles className="w-6 h-6 text-sky-300" />
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-extrabold tracking-[-0.03em]"
                style={{ background: "linear-gradient(90deg, #FFFFFF 0%, #A5B4FC 50%, #60A5FA 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Dashboard Admin Global
              </h1>
              <p className="text-sm mt-1" style={{ color: "#7F8BA7" }}>Visão geral de todas as empresas e métricas do sistema</p>
            </div>
          </div>

          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-52 rounded-full h-12 text-sm font-semibold"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#D8E1F3", backdropFilter: "blur(14px)" }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="15">Últimos 15 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        {/* ── Metric Cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricCard label="Empresas Ativas"    value={empresasAtivas}   hint={`${empresasInativas} inativas`}                   icon={Building2}    glow="rgba(66,165,255,0.14)"  trend={{ value: "+12%", up: true }}  delay={0.14} />
          <MetricCard label="Total de Leads"     value={totalLeads.toLocaleString()} hint={`${leadsFiltrados.length} no período`}  icon={Users}        glow="rgba(139,92,246,0.14)"  trend={{ value: "+24%", up: true }}  delay={0.18} />
          <MetricCard label="Vendedores Ativos"  value={totalVendedores}  hint={`${totalSDRs} SDRs · ${totalClosers} Closers`}    icon={UserCheck}    glow="rgba(34,211,238,0.14)"                                       delay={0.22} />
          <MetricCard label="Reuniões Agendadas" value={reunioesAgendadas} hint={`${reunioesRealizadas} realizadas`}               icon={CalendarClock} glow="rgba(251,191,36,0.14)" trend={{ value: "-3%", up: false }}  delay={0.26} />
          <MetricCard label="Vendas Realizadas"  value={vendasRealizadas} hint="Total do sistema"                                  icon={CheckCircle2} glow="rgba(52,211,153,0.14)"                                       delay={0.30} />
          <MetricCard label="Receita Potencial"  value={`R$ ${(receitaPotencial/1000).toFixed(0)}k`} hint="Leads qualificados"    icon={DollarSign}   glow="rgba(251,113,133,0.14)"  trend={{ value: "+0%", up: true }}  delay={0.34} />
        </div>

        {/* ── Conversion Cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <ConversionCard label="Taxa Lead → Reunião"  value={taxaLeadParaReuniao}  glow="rgba(66,165,255,0.18)"  delay={0.22} />
          <ConversionCard label="Taxa Reunião → Venda" value={taxaReuniaoParaVenda} glow="rgba(139,92,246,0.18)"  delay={0.28} />
          <ConversionCard label="Conversão Geral"       value={taxaConversaoGeral}   glow="rgba(27,231,161,0.18)"  delay={0.34} />
        </div>

        {/* ── Charts row 1 ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ChartCard title="Empresas por Plano" icon={Building2} glow="rgba(66,165,255,0.14)" delay={0.32}>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={empresasPorPlano} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                    {empresasPorPlano.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-5 mt-2">
              {empresasPorPlano.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.fill }} />
                  <span className="text-xs" style={{ color: "#7F8BA7" }}>{item.name}</span>
                </div>
              ))}
            </div>
          </ChartCard>

          <ChartCard title="Vendedores por Papel" icon={Users} glow="rgba(139,92,246,0.14)" delay={0.36}>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vendedoresPorPapel} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#4B5878" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#4B5878" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Bar dataKey="value" name="Quantidade" radius={[10, 10, 0, 0]} fill="url(#barGradPremium)"
                    style={{ filter: "drop-shadow(0 -4px 20px rgba(217,119,255,0.35))" }} />
                  <defs>
                    <linearGradient id="barGradPremium" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0%" stopColor="#9333ea" />
                      <stop offset="100%" stopColor="#d977ff" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        {/* ── Charts row 2 ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ChartCard title="Top Empresas por Leads" icon={TrendingUp} glow="rgba(52,211,153,0.14)" delay={0.38}>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadsPorEmpresa} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" stroke="#4B5878" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis dataKey="nome" type="category" stroke="#4B5878" fontSize={10} tickLine={false} axisLine={false} width={100} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Bar dataKey="leads" fill="url(#barGradGreen)" radius={[0, 10, 10, 0]} />
                  <defs>
                    <linearGradient id="barGradGreen" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#059669" />
                      <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Leads por Status" icon={Activity} glow="rgba(251,191,36,0.14)" delay={0.42}>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={leadsPorStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}
                    label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ""}>
                    {leadsPorStatus.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2">
              {leadsPorStatus.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: item.fill }} />
                  <span className="text-xs" style={{ color: "#7F8BA7" }}>{item.name}</span>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>

        {/* ── Tempo em Modo Manual ─────────────────────────────────────────── */}
        {tempoManualChart.length > 0 && (
          <ChartCard title="Tempo em Modo Manual por Usuário" icon={Clock} glow="rgba(251,191,36,0.14)" delay={0.44}>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tempoManualChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="usuario" stroke="#4B5878" fontSize={11} tickLine={false} axisLine={false} angle={-45} textAnchor="end" height={80} />
                  <YAxis stroke="#4B5878" fontSize={11} tickLine={false} axisLine={false} label={{ value: "Minutos", angle: -90, position: "insideLeft" }} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} formatter={(value) => `${value} min`} />
                  <Bar dataKey="minutos" name="Minutos em Modo Manual" radius={[10, 10, 0, 0]} fill="url(#barGradOrange)"
                    style={{ filter: "drop-shadow(0 -4px 20px rgba(251,191,36,0.35))" }} />
                  <defs>
                    <linearGradient id="barGradOrange" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#fbbf24" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        )}

        {/* ── Evolução 30 dias ─────────────────────────────────────────────── */}
        <ChartCard title="Evolução — Últimos 30 Dias" icon={Activity} glow="rgba(34,211,238,0.14)" delay={0.46}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucao} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="lineGradA" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#60a5fa" /><stop offset="100%" stopColor="#67e8f9" />
                  </linearGradient>
                  <linearGradient id="lineGradL" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor="#a78bfa" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="dia" stroke="#4B5878" fontSize={10} tickLine={false} axisLine={false} interval={4} />
                <YAxis stroke="#4B5878" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ color: "#7F8BA7", fontSize: 12 }} />
                <Line type="monotone" dataKey="atividades" name="Atividades" stroke="url(#lineGradA)" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="leads" name="Novos Leads" stroke="url(#lineGradL)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* ── Resumo do Sistema ─────────────────────────────────────────────── */}
        <motion.div {...fadeUp(0.50)}
          className="rounded-[28px] p-7"
          style={{
            background: "linear-gradient(180deg, rgba(12,18,38,0.88) 0%, rgba(7,11,25,0.96) 100%)",
            border: "1px solid rgba(255,255,255,0.06)",
            backdropFilter: "blur(18px)",
          }}>
          <h2 className="text-sm font-semibold text-white mb-5">Resumo do Sistema</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <SummaryItem label="Total Empresas"    value={empresas.length}                  color="#e2e8f0" />
            <SummaryItem label="Empresas Ativas"   value={empresasAtivas}                   color="#34d399" />
            <SummaryItem label="Vendedores Totais" value={totalVendedores}                  color="#e2e8f0" />
            <SummaryItem label="Leads Totais"      value={totalLeads.toLocaleString()}      color="#60a5fa" />
            <SummaryItem label="Atividades Totais" value={atividades.length.toLocaleString()} color="#fbbf24" />
            <SummaryItem label="Produtividade"     value={`${produtividadeGeral}%`}         color="#a78bfa" />
          </div>
        </motion.div>

      </div>
    </div>
  );
}