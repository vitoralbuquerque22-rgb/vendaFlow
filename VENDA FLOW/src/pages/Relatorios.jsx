import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { listarTodosLeads } from "@/lib/services/leadService";
import { listarTodasAtividades } from "@/lib/services/atividadeService";
import { listarTodasEquipes } from "@/lib/services/equipeService";
import { listarEmpresasVendedoras } from "@/lib/services/empresaService";
import { listarMetas, listarFaturamentos, listarStatsSdr } from "@/lib/services/dashboardService";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { Users, Phone, Calendar, TrendingUp, Target, CheckCircle2, Download, Filter, MessageCircle, Mail, FileText, DollarSign, PhoneCall, Clock, Headphones } from "lucide-react";
import { format, subDays, startOfDay, endOfDay, isWithinInterval, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const COLORS = ["#ff6b35", "#ff8c42", "#10b981", "#22c55e", "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6"];
const CHART_COLORS = {
  primary: "#ff6b35",
  secondary: "#ff8c42", 
  success: "#10b981",
  danger: "#ef4444",
  info: "#3b82f6"
};

export default function Relatorios() {
  const { empresaId } = useEmpresaAtual();
  const [periodo, setPeriodo] = useState("30");
  const [filtroEquipe, setFiltroEquipe] = useState("todas");
  const [filtroVendedor, setFiltroVendedor] = useState("todos");
  const [filtroCampanha, setFiltroCampanha] = useState("todas");
  const [kpiSelecionado, setKpiSelecionado] = useState("leads");

  const { data: leads = [] } = useQuery({
    queryKey: ["leads-relatorios", empresaId],
    queryFn: () => listarTodosLeads(empresaId),
    enabled: !!empresaId,
  });

  const limitAtividades = periodo === "7" ? 1000 : periodo === "15" ? 2000 : periodo === "30" ? 3000 : periodo === "60" ? 5000 : 8000;

  const { data: atividades = [] } = useQuery({
    queryKey: ["atividades-report", empresaId, periodo],
    queryFn: () => listarTodasAtividades(empresaId, { sort: "-created_date", limit: limitAtividades }),
    enabled: !!empresaId,
  });

  const { data: equipes = [] } = useQuery({
    queryKey: ["equipes", empresaId],
    queryFn: () => listarTodasEquipes(empresaId),
    enabled: !!empresaId,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users-empresa", empresaId],
    queryFn: () => base44.entities.VinculoEmpresa.filter({ empresaId, status: "ativo" }).then(
      vinculos => vinculos.map(v => ({ id: v.userEmail, email: v.userEmail, full_name: v.userName || v.userEmail, role: v.papel }))
    ),
    enabled: !!empresaId,
  });

  const { data: empresasVendedoras = [] } = useQuery({
    queryKey: ["empresas-vendedoras"],
    queryFn: listarEmpresasVendedoras,
  });

  const { data: metasEmpresa = [] } = useQuery({
    queryKey: ["metas-empresa", empresaId],
    queryFn: () => listarMetas(empresaId),
    enabled: !!empresaId,
    staleTime: 5 * 60_000,
  });

  const metaConfig = metasEmpresa[0] || {};
  // Indica se há metas realmente configuradas (não padrões)
  const temMetaConfigurada = metasEmpresa.length > 0;

  const { data: faturamentos = [] } = useQuery({
    queryKey: ["faturamentos-relatorio", empresaId, periodo],
    queryFn: () => listarFaturamentos(empresaId, { limit: 5000 }),
    enabled: !!empresaId,
    staleTime: 5 * 60_000,
  });

  const { data: sdrStats = [] } = useQuery({
    queryKey: ["sdr-stats-relatorio", empresaId],
    queryFn: () => listarStatsSdr(empresaId, { limit: 2000 }),
    enabled: !!empresaId,
    staleTime: 5 * 60_000,
  });

  const { data: callSessions = [] } = useQuery({
    queryKey: ["call-sessions-relatorio", empresaId, periodo],
    queryFn: () => base44.entities.CallSession.filter({ empresaId }, "-created_date", limitAtividades),
    enabled: !!empresaId,
    staleTime: 5 * 60_000,
  });

  // Filtros por período
  const dataInicio = subDays(new Date(), parseInt(periodo));
  const dataFim = new Date();

  const sdrStatsFiltrados = sdrStats.filter(s => {
    if (!s.dia) return false;
    const dataStat = new Date(s.dia);
    return isWithinInterval(dataStat, { start: startOfDay(dataInicio), end: endOfDay(dataFim) });
  });

  const callSessionsFiltradas = callSessions.filter(cs => {
    if (!cs.created_date) return false;
    const dataCS = new Date(cs.created_date);
    return isWithinInterval(dataCS, { start: startOfDay(dataInicio), end: endOfDay(dataFim) });
  });

  const ligacoesCompletadas = callSessionsFiltradas.filter(cs => cs.status === 'answered' || cs.status === 'finished').length;
  const ligacoesNaoAtendidas = callSessionsFiltradas.filter(cs => cs.status === 'not_answered' || cs.status === 'busy' || cs.status === 'failed').length;
  const totalLigacoesReais = ligacoesCompletadas + ligacoesNaoAtendidas;
  const taxaAtendimento = totalLigacoesReais > 0 ? ((ligacoesCompletadas / totalLigacoesReais) * 100).toFixed(1) : 0;
  const duracaoTotal = callSessionsFiltradas.reduce((sum, cs) => sum + (cs.duracao_segundos || 0), 0);
  const duracaoMedia = ligacoesCompletadas > 0 ? Math.floor(duracaoTotal / ligacoesCompletadas) : 0;
  const duracaoMediaFormatada = duracaoMedia > 0 ? `${Math.floor(duracaoMedia / 60)}:${String(duracaoMedia % 60).padStart(2, '0')}` : '0:00';
  const duracaoTotalFormatada = duracaoTotal > 0 ? `${Math.floor(duracaoTotal / 3600)}h ${Math.floor((duracaoTotal % 3600) / 60)}min` : '0h 0min';

  const atividadesFiltradas = atividades.filter((a) => {
    const dataAtividade = new Date(a.created_date);
    const dentroPeríodo = isWithinInterval(dataAtividade, { start: startOfDay(dataInicio), end: endOfDay(dataFim) });
    const equipeOk = filtroEquipe === "todas" || a.equipe === filtroEquipe;
    const vendedorOk = filtroVendedor === "todos" || a.sdr_email === filtroVendedor;
    const campanhaOk = filtroCampanha === "todas" || a.campanha === filtroCampanha;
    return dentroPeríodo && equipeOk && vendedorOk && campanhaOk;
  });

  const leadsFiltrados = leads.filter((l) => {
    const dataLead = new Date(l.created_date);
    const dentroPeriodo = isWithinInterval(dataLead, { start: startOfDay(dataInicio), end: endOfDay(dataFim) });
    const equipeOk = filtroEquipe === "todas" || l.equipe === filtroEquipe;
    const vendedorOk = filtroVendedor === "todos" || l.sdr_responsavel === filtroVendedor;
    const campanhaOk = filtroCampanha === "todas" || l.campanha === filtroCampanha;
    return dentroPeriodo && equipeOk && vendedorOk && campanhaOk;
  });

  // Métricas gerais
  const totalLeads = leadsFiltrados.length;
  const reunioesAgendadas = leadsFiltrados.filter((l) => l.status === "reuniao_agendada" || l.status === "reuniao_realizada").length;
  const taxaConversao = totalLeads > 0 ? (reunioesAgendadas / totalLeads * 100).toFixed(1) : 0;

  const totalLigacoes = atividadesFiltradas.filter((a) => a.tipo === "ligacao").length;
  const totalWhatsApp = atividadesFiltradas.filter((a) => a.tipo === "whatsapp").length;
  const totalEmails = atividadesFiltradas.filter((a) => a.tipo === "email").length;

  // Métricas avançadas
  const leadsComValor = leadsFiltrados.filter((l) => l.valor_potencial > 0);
  const valorTotal = leadsComValor.reduce((sum, l) => sum + (l.valor_potencial || 0), 0);
  const ticketMedio = leadsComValor.length > 0 ? valorTotal / leadsComValor.length : 0;

  // Faturamento real (FaturamentoLead) — filtrado pelo período
  const faturamentosFiltrados = faturamentos.filter(f => {
    const dataFat = new Date(f.created_date);
    return isWithinInterval(dataFat, { start: startOfDay(dataInicio), end: endOfDay(dataFim) });
  });
  // Mapa lead_id → revenue_amount para cruzamento com leads
  const faturamentoPorLead = faturamentosFiltrados.reduce((acc, f) => {
    if (f.lead_id) acc[f.lead_id] = (acc[f.lead_id] || 0) + (f.revenue_amount || 0);
    return acc;
  }, {});
  const faturamentoReal = faturamentosFiltrados.reduce((sum, f) => sum + (f.revenue_amount || 0), 0);
  const temFaturamentoReal = faturamentoReal > 0;
  const ticketMedioReal = temFaturamentoReal && faturamentosFiltrados.length > 0
    ? faturamentoReal / faturamentosFiltrados.length
    : ticketMedio;

  // Ciclo de vendas médio (do novo até reunião realizada)
  const leadsComCiclo = leadsFiltrados.filter((l) => 
    l.status === "reuniao_realizada" && l.created_date && l.data_reuniao
  );
  const cicloMedio = leadsComCiclo.length > 0 
    ? leadsComCiclo.reduce((sum, l) => {
        const inicio = new Date(l.created_date);
        const fim = new Date(l.data_reuniao);
        return sum + differenceInDays(fim, inicio);
      }, 0) / leadsComCiclo.length
    : 0;

  // Taxa de conversão por etapa
  const novos = leadsFiltrados.filter((l) => l.status === "novo").length;
  const emCadencia = leadsFiltrados.filter((l) => l.status === "em_cadencia").length;
  const responderam = leadsFiltrados.filter((l) => l.status === "respondeu").length;
  const reunioesAg = leadsFiltrados.filter((l) => l.status === "reuniao_agendada").length;
  const reunioesReal = leadsFiltrados.filter((l) => l.status === "reuniao_realizada").length;
  const qualificados = leadsFiltrados.filter((l) => l.status === "qualificado").length;

  const taxaNovoParaCadencia = novos > 0 ? ((emCadencia + responderam + reunioesAg + reunioesReal + qualificados) / totalLeads * 100).toFixed(1) : 0;
  const taxaCadenciaParaResposta = emCadencia > 0 ? ((responderam + reunioesAg + reunioesReal + qualificados) / (emCadencia + responderam + reunioesAg + reunioesReal + qualificados) * 100).toFixed(1) : 0;
  const taxaRespostaParaReuniao = responderam > 0 ? ((reunioesAg + reunioesReal + qualificados) / (responderam + reunioesAg + reunioesReal + qualificados) * 100).toFixed(1) : 0;
  const taxaReuniaoParaQualificado = reunioesReal > 0 ? (qualificados / reunioesReal * 100).toFixed(1) : 0;

  // Campanhas únicas
  const campanhas = [...new Set(leads.map((l) => l.campanha).filter(Boolean))];

  // Dados por vendedor
  const dadosPorVendedor = users.map((user) => {
    const atividadesVendedor = atividadesFiltradas.filter((a) => a.sdr_email === user.email);
    const leadsVendedor = leadsFiltrados.filter((l) => l.sdr_responsavel === user.email);
    const reunioesVendedor = leadsVendedor.filter((l) => l.status === "reuniao_agendada" || l.status === "reuniao_realizada").length;

    const callsVendedor = callSessionsFiltradas.filter(cs => cs.sdr_email === user.email);
    const ligacoesReaisVendedor = callsVendedor.length;
    const atendidasVendedor = callsVendedor.filter(cs => cs.status === 'answered' || cs.status === 'finished').length;
    const duracaoTotalVendedor = callsVendedor.reduce((sum, cs) => sum + (cs.duracao_segundos || 0), 0);

    const statsVendedor = sdrStatsFiltrados.filter(s => s.user_email === user.email);
    const totalAtendimentos = statsVendedor.reduce((sum, s) => sum + (s.atendimentos || 0), 0);
    const totalConversoes = statsVendedor.reduce((sum, s) => sum + (s.conversoes || 0), 0);
    const taxaConversaoReal = totalAtendimentos > 0 ? ((totalConversoes / totalAtendimentos) * 100).toFixed(1) : null;

    return {
      nome: user.full_name || user.email,
      email: user.email,
      ligacoes: atividadesVendedor.filter((a) => a.tipo === "ligacao").length,
      whatsapp: atividadesVendedor.filter((a) => a.tipo === "whatsapp").length,
      emails: atividadesVendedor.filter((a) => a.tipo === "email").length,
      totalAtividades: atividadesVendedor.length,
      leads: leadsVendedor.length,
      reunioes: reunioesVendedor,
      conversao: leadsVendedor.length > 0 ? (reunioesVendedor / leadsVendedor.length * 100).toFixed(1) : 0,
      atendimentos: totalAtendimentos,
      conversoes: totalConversoes,
      taxaConversaoReal,
      ligacoesReais: ligacoesReaisVendedor,
      atendidasVendedor,
      duracaoTotalVendedor,
    };
  }).filter((v) => v.totalAtividades > 0 || v.leads > 0).sort((a, b) => b.totalAtividades - a.totalAtividades);

  // Dados por campanha
  const dadosPorCampanha = campanhas.map((campanha) => {
    const leadsC = leadsFiltrados.filter((l) => l.campanha === campanha);
    const atividadesC = atividadesFiltradas.filter((a) => a.campanha === campanha);
    const reunioesC = leadsC.filter((l) => l.status === "reuniao_agendada" || l.status === "reuniao_realizada").length;

    return {
      nome: campanha,
      leads: leadsC.length,
      atividades: atividadesC.length,
      reunioes: reunioesC,
      conversao: leadsC.length > 0 ? (reunioesC / leadsC.length * 100).toFixed(1) : 0,
    };
  }).sort((a, b) => b.leads - a.leads);

  // Dados por dia
  const atividadesPorDia = [];
  for (let i = parseInt(periodo) - 1; i >= 0; i--) {
    const dia = subDays(new Date(), i);
    const diaStr = format(dia, "yyyy-MM-dd");
    const atividadesDia = atividadesFiltradas.filter((a) => format(new Date(a.created_date), "yyyy-MM-dd") === diaStr);

    atividadesPorDia.push({
      dia: format(dia, "dd/MM"),
      ligacoes: atividadesDia.filter((a) => a.tipo === "ligacao").length,
      whatsapp: atividadesDia.filter((a) => a.tipo === "whatsapp").length,
      emails: atividadesDia.filter((a) => a.tipo === "email").length,
    });
  }

  // Funil de Vendas — apenas leads com cadência iniciada
  const totalLeadsGerados = leadsFiltrados.filter(l => l.status === "em_cadencia" || !!l.cadencia_id).length;
  const leadsConectados = atividadesFiltradas.filter(a => 
    a.resultado === "atendeu" || a.resultado === "respondeu" || a.tipo === "reuniao_agendada"
  ).map(a => a.lead_id).filter((v, i, a) => a.indexOf(v) === i).length;
  
  const leadsAgendados = leadsFiltrados.filter(l => 
    l.status === "reuniao_agendada" || l.status === "reuniao_realizada" || l.status === "qualificado"
  ).length;
  
  const reunioesAcontecidas = leadsFiltrados.filter(l => 
    l.status === "reuniao_realizada" || l.status === "qualificado"
  ).length;
  
  const propostasEnviadas = atividadesFiltradas.filter(a => 
    a.tipo === "enviar_contrato"
  ).map(a => a.lead_id).filter((v, i, a) => a.indexOf(v) === i).length;
  
  const vendidos = leadsFiltrados.filter(l => l.status === "qualificado").length;
  const receitaExibida = temFaturamentoReal ? faturamentoReal : (vendidos * ticketMedio);

  // Taxas de conversão
  const taxaConectado = totalLeadsGerados > 0 ? ((leadsConectados / totalLeadsGerados) * 100).toFixed(2) : 0;
  const taxaAgendamento = leadsConectados > 0 ? ((leadsAgendados / leadsConectados) * 100).toFixed(2) : 0;
  const taxaAcontecidas = leadsAgendados > 0 ? ((reunioesAcontecidas / leadsAgendados) * 100).toFixed(2) : 0;
  const taxaPropostas = reunioesAcontecidas > 0 ? ((propostasEnviadas / reunioesAcontecidas) * 100).toFixed(2) : 0;
  const taxaVendidos = propostasEnviadas > 0 ? ((vendidos / propostasEnviadas) * 100).toFixed(2) : 0;
  const taxaFinal = totalLeadsGerados > 0 ? ((vendidos / totalLeadsGerados) * 100).toFixed(2) : 0;
  
  const dadosFunil = [
    { name: "Leads", value: totalLeadsGerados, taxa: "100%", icone: "📞" },
    { name: "Conectado", value: leadsConectados, taxa: taxaConectado + "%", icone: "🔗" },
    { name: "Agendamentos", value: leadsAgendados, taxa: taxaAgendamento + "%", icone: "📅" },
    { name: "Acontecidas", value: reunioesAcontecidas, taxa: taxaAcontecidas + "%", icone: "✅" },
    { name: "Propostas", value: propostasEnviadas, taxa: taxaPropostas + "%", icone: "📄" },
    { name: "Vendidos", value: vendidos, taxa: taxaFinal + "%", icone: "💰" },
  ];

  // Somar metas cadastradas dos usuários (via meta_mensal)
  const metasTotais = users.reduce((acc, u) => {
    const m = u.meta_mensal || u.data?.meta_mensal || {};
    acc.leads += m.leads ?? 0;
    acc.ligacoes += m.ligacoes ?? 0;
    acc.reunioes_agendadas += m.reunioes_agendadas ?? 0;
    acc.reunioes_realizadas += m.reunioes_realizadas ?? 0;
    acc.vendas += m.vendas ?? 0;
    acc.receita += m.receita ?? 0;
    return acc;
  }, { leads: 0, ligacoes: 0, reunioes_agendadas: 0, reunioes_realizadas: 0, vendas: 0, receita: 0 });

  // KPIs com Metas reais cadastradas (ConfiguracaoMeta → metasTotais dos users → fallback fixo)
  const kpis = {
    leads: {
      nome: "Leads",
      realizado: totalLeadsGerados,
      necessario: metasTotais.leads || metaConfig.meta_leads || 100,
      usandoMetaConfigurada: !!(metasTotais.leads || metaConfig.meta_leads),
      cor: "#3b82f6"
    },
    mql: {
      nome: "MQL",
      realizado: leadsFiltrados.filter(l => l.status !== "desqualificado" && l.status !== "sem_interesse").length,
      necessario: metaConfig.meta_mql || Math.round((metasTotais.leads || metaConfig.meta_leads || 100) * 0.8),
      usandoMetaConfigurada: !!(metaConfig.meta_mql || metasTotais.leads || metaConfig.meta_leads),
      cor: "#10b981"
    },
    conexoes: {
      nome: "Conexões",
      realizado: leadsConectados,
      necessario: metasTotais.ligacoes || metaConfig.meta_conexoes || 60,
      usandoMetaConfigurada: !!(metasTotais.ligacoes || metaConfig.meta_conexoes),
      cor: "#f59e0b"
    },
    rm: {
      nome: "RM",
      realizado: leadsAgendados,
      necessario: metasTotais.reunioes_agendadas || metaConfig.meta_rm || 30,
      usandoMetaConfigurada: !!(metasTotais.reunioes_agendadas || metaConfig.meta_rm),
      cor: "#8b5cf6"
    },
    rr: {
      nome: "RR",
      realizado: reunioesAcontecidas,
      necessario: metasTotais.reunioes_realizadas || metaConfig.meta_rr || 25,
      usandoMetaConfigurada: !!(metasTotais.reunioes_realizadas || metaConfig.meta_rr),
      cor: "#ec4899"
    },
    vendas: {
      nome: "Vendas",
      realizado: vendidos,
      necessario: metasTotais.vendas || metaConfig.meta_quantidade_vendas || 15,
      usandoMetaConfigurada: !!(metasTotais.vendas || metaConfig.meta_quantidade_vendas),
      cor: "#ff6b35"
    }
  };

  const kpiAtual = kpis[kpiSelecionado];
  const gapKPI = kpiAtual.realizado - kpiAtual.necessario;
  const percentualKPI = kpiAtual.necessario > 0 ? ((kpiAtual.realizado / kpiAtual.necessario) * 100).toFixed(1) : 0;

  // Distribuição por origem
  const dadosPorOrigem = [
    { name: "Tráfego Pago", value: leadsFiltrados.filter((l) => l.origem === "trafego_pago").length },
    { name: "Indicação", value: leadsFiltrados.filter((l) => l.origem === "indicacao").length },
    { name: "Orgânico", value: leadsFiltrados.filter((l) => l.origem === "organico").length },
    { name: "Evento", value: leadsFiltrados.filter((l) => l.origem === "evento").length },
    { name: "Lista Fria", value: leadsFiltrados.filter((l) => l.origem === "lista_fria").length },
    { name: "Outro", value: leadsFiltrados.filter((l) => l.origem === "outro" || !l.origem).length },
  ].filter(item => item.value > 0);

  // Exportar CSV
  const exportarCSV = () => {
    const csvData = [
      ["Vendedor", "Ligações", "WhatsApp", "E-mails", "Total Atividades", "Leads", "Reuniões", "Conversão (%)"],
      ...dadosPorVendedor.map(v => [
        v.nome, v.ligacoes, v.whatsapp, v.emails, v.totalAtividades, v.leads, v.reunioes, v.conversao
      ])
    ];
    
    const csv = csvData.map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_vendas_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast.success("Relatório exportado em CSV");
  };

  // Exportar PDF (usando html2canvas + jspdf)
  const exportarPDF = async () => {
    const { default: html2canvas } = await import("html2canvas");
    const { default: jsPDF } = await import("jspdf");
    
    const elemento = document.getElementById("relatorio-content");
    if (!elemento) return;
    
    const canvas = await html2canvas(elemento, { backgroundColor: "#0f172a" });
    const imgData = canvas.toDataURL("image/png");
    
    const pdf = new jsPDF("p", "mm", "a4");
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
    pdf.save(`relatorio_vendas_${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast.success("Relatório exportado em PDF");
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Relatórios</h1>
          <p className="text-slate-400 mt-1">Análise detalhada de performance</p>
        </div>

        <div className="flex gap-2">
          <Button onClick={exportarCSV} variant="outline" className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white">
            <FileText className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
          <Button onClick={exportarPDF} variant="outline" className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white">
            <Download className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-slate-300 text-sm">Filtros:</span>
            </div>

            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-36 bg-slate-700 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="15">Últimos 15 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="60">Últimos 60 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filtroEquipe} onValueChange={setFiltroEquipe}>
              <SelectTrigger className="w-40 bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="Equipe" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="todas">Todas equipes</SelectItem>
                {equipes.map((e) => (
                  <SelectItem key={e.id} value={e.nome}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroVendedor} onValueChange={setFiltroVendedor}>
              <SelectTrigger className="w-44 bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="Vendedor" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="todos">Todos vendedores</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.email}>{u.full_name || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroCampanha} onValueChange={setFiltroCampanha}>
              <SelectTrigger className="w-44 bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="Campanha" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="todas">Todas campanhas</SelectItem>
                {campanhas.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div id="relatorio-content" className="space-y-6">
        {/* Investimento em Tráfego Pago */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "INVESTIMENTO META ADS" },
            { label: "INVESTIMENTO GOOGLE ADS" },
            { label: "INVESTIMENTO TOTAL" },
            { label: "TOTAL INVESTIDO" },
          ].map(({ label }) => (
            <Card key={label} className="bg-slate-900/80 border-slate-800">
              <CardContent className="p-5">
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">{label}</p>
                <p className="text-2xl font-bold text-white mb-3">R$ 0,00</p>
                <p className="text-xs text-slate-600 mb-2">Aguardando integração</p>
                <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                  <div className="bg-slate-700 h-full" style={{ width: '0%' }}></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Custos e Performance */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <DollarSign className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-slate-400 text-sm font-medium">Custo por Lead</p>
              </div>
              <p className="text-3xl font-bold text-blue-400">R$ 0,00</p>
              <p className="text-xs text-slate-500 mt-2">{totalLeads} leads gerados</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Calendar className="w-4 h-4 text-purple-400" />
                </div>
                <p className="text-slate-400 text-sm font-medium">Custo por Reunião</p>
              </div>
              <p className="text-3xl font-bold text-purple-400">R$ 0,00</p>
              <p className="text-xs text-slate-500 mt-2">{reunioesAgendadas} reuniões agendadas</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-slate-400 text-sm font-medium">Custo por Venda</p>
              </div>
              <p className="text-3xl font-bold text-emerald-400">R$ 0,00</p>
              <p className="text-xs text-slate-500 mt-2">{vendidos} vendas fechadas</p>
            </CardContent>
          </Card>
        </div>

        {/* Métricas de Telefonia */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-sky-500/10">
                  <Phone className="w-4 h-4 text-sky-400" />
                </div>
                <p className="text-slate-400 text-sm font-medium">Ligações Realizadas</p>
              </div>
              <p className="text-3xl font-bold text-sky-400">{totalLigacoesReais}</p>
              <p className="text-xs text-slate-500 mt-2">{ligacoesCompletadas} atendidas</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <PhoneCall className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-slate-400 text-sm font-medium">Taxa de Atendimento</p>
              </div>
              <p className="text-3xl font-bold text-emerald-400">{taxaAtendimento}%</p>
              <p className="text-xs text-slate-500 mt-2">{ligacoesNaoAtendidas} não atendidas</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-violet-500/10">
                  <Clock className="w-4 h-4 text-violet-400" />
                </div>
                <p className="text-slate-400 text-sm font-medium">Duração Média</p>
              </div>
              <p className="text-3xl font-bold text-violet-400">{duracaoMediaFormatada}</p>
              <p className="text-xs text-slate-500 mt-2">por ligação atendida</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Headphones className="w-4 h-4 text-amber-400" />
                </div>
                <p className="text-slate-400 text-sm font-medium">Tempo Total em Linha</p>
              </div>
              <p className="text-3xl font-bold text-amber-400">{duracaoTotalFormatada}</p>
              <p className="text-xs text-slate-500 mt-2">no período selecionado</p>
            </CardContent>
          </Card>
        </div>

        {/* Faturamento e Metas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-900/80 border-slate-800">
            <CardContent className="p-5">
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">FATURAMENTO TOTAL</p>
              <p className="text-2xl font-bold text-white mb-1">
                R$ {receitaExibida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <div className="mb-2">
                {temFaturamentoReal
                  ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">✓ Receita real</span>
                  : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">~ Estimativa</span>
                }
              </div>
              {(() => {
                const metaFat = metasTotais.receita || metaConfig.meta_faturamento_total;
                const metaFatVal = metaFat || 500000;
                return <>
                  <p className="text-xs text-emerald-500 mb-1">Meta: R$ {metaFatVal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                  <p className={`text-xs font-semibold mb-2 ${metaFat ? 'text-emerald-400' : 'text-amber-400'}`}>{metaFat ? '✓ Meta configurada' : '~ Meta padrão'}</p>
                  <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-500 to-green-400 h-full" style={{ width: `${Math.min((receitaExibida / metaFatVal) * 100, 100)}%` }}></div>
                  </div>
                </>;
              })()}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardContent className="p-5">
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">TICKET MÉDIO</p>
              <p className="text-2xl font-bold text-white mb-2">
                R$ {ticketMedioReal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              {(() => {
                const metaTicket = metaConfig.meta_ticket_medio || (metaConfig.meta_faturamento_total && metaConfig.meta_quantidade_vendas ? Math.round(metaConfig.meta_faturamento_total / metaConfig.meta_quantidade_vendas) : 0);
                const metaTicketVal = metaTicket || 25000;
                return <>
                  <p className="text-xs text-emerald-500 mb-1">Meta: R$ {metaTicketVal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                  <p className={`text-xs font-semibold mb-2 ${metaTicket ? 'text-emerald-400' : 'text-amber-400'}`}>{metaTicket ? '✓ Meta configurada' : '~ Meta padrão'}</p>
                  <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-500 to-green-400 h-full" style={{ width: `${Math.min((ticketMedioReal / metaTicketVal) * 100, 100)}%` }}></div>
                  </div>
                </>;
              })()}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardContent className="p-5">
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">QUANTIDADE DE VENDAS</p>
              <p className="text-2xl font-bold text-white mb-2">{vendidos}</p>
              {(() => {
                const metaVendas = metasTotais.vendas || metaConfig.meta_quantidade_vendas;
                const metaVendasVal = metaVendas || 20;
                return <>
                  <p className="text-xs text-emerald-500 mb-1">Meta: {metaVendasVal} vendas</p>
                  <p className={`text-xs font-semibold mb-2 ${metaVendas ? 'text-emerald-400' : 'text-amber-400'}`}>{metaVendas ? '✓ Meta configurada' : '~ Meta padrão'}</p>
                  <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-500 to-green-400 h-full" style={{ width: `${Math.min((vendidos / metaVendasVal) * 100, 100)}%` }}></div>
                  </div>
                </>;
              })()}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardContent className="p-5">
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">CONTRATOS A ASSINAR</p>
              <p className="text-2xl font-bold text-white mb-2">{propostasEnviadas}</p>
              <p className="text-xs text-slate-500 mb-2">Propostas enviadas</p>
              <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full" style={{ width: `${Math.min((propostasEnviadas / 30) * 100, 100)}%` }}></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos Principais */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Funil Visual */}
          <Card className="bg-gradient-to-br from-[#0a0e1a] to-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#ff6b35]"></div>
                Funil de Vendas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-8 h-[500px]">
                {/* Funil SVG - Lado Esquerdo */}
                <div className="w-1/3 h-full flex items-center justify-center">
                  <svg viewBox="0 0 200 400" className="w-full h-full">
                    <defs>
                      <linearGradient id="funnelGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style={{ stopColor: '#ff6b35', stopOpacity: 1 }} />
                        <stop offset="100%" style={{ stopColor: '#c1440e', stopOpacity: 1 }} />
                      </linearGradient>
                    </defs>
                    <path d="M 20 20 L 180 20 L 130 400 L 70 400 Z" fill="url(#funnelGradient)" />
                  </svg>
                </div>

                {/* Etapas - Lado Direito */}
                <div className="flex-1 h-full flex flex-col justify-around py-8 relative">
                  {/* Linha pontilhada vertical */}
                  <svg className="absolute left-6 top-0 h-full w-1" style={{ zIndex: 0 }}>
                    <line x1="0" y1="10%" x2="0" y2="90%" stroke="#ff6b35" strokeWidth="2" strokeDasharray="4,4" opacity="0.5" />
                  </svg>

                  {dadosFunil.map((etapa, idx) => (
                    <div key={idx} className="relative flex items-center gap-4 z-10">
                      {/* Ícone Circular */}
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#ff6b35] to-[#c1440e] flex items-center justify-center flex-shrink-0 border-2 border-slate-800">
                        <span className="text-white text-xl">{etapa.icone}</span>
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1">
                        <p className="text-white font-bold text-2xl">{etapa.value.toLocaleString('pt-BR')}</p>
                        <p className="text-slate-400 text-sm">{etapa.name}</p>
                      </div>

                      {/* Taxa de Conversão */}
                      {idx < dadosFunil.length - 1 && (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-[#ff6b35]"></div>
                          <span className="text-[#ff6b35] font-bold text-lg min-w-[80px] text-right">
                            {dadosFunil[idx + 1].taxa}
                          </span>
                        </div>
                      )}
                      
                      {/* Taxa Final na última etapa */}
                      {idx === dadosFunil.length - 1 && (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                          <span className="text-emerald-400 font-bold text-lg min-w-[80px] text-right">
                            {taxaFinal}%
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI vs Meta por Mês */}
          <Card className="bg-gradient-to-br from-[#0a0e1a] to-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#ff6b35]"></div>
                KPI vs Meta por Mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Seletor de KPI */}
                <div className="grid grid-cols-6 gap-2">
                  {Object.entries(kpis).map(([key, kpi]) => (
                    <button
                      key={key}
                      onClick={() => setKpiSelecionado(key)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        kpiSelecionado === key
                          ? 'border-[#ff6b35] bg-[#ff6b35]/10 text-white'
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600 text-slate-300'
                      }`}
                    >
                      <p className="font-bold text-sm">{kpi.nome}</p>
                    </button>
                  ))}
                </div>

                {/* Cards de Métricas */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <p className="text-slate-400 text-xs mb-1">Realizado</p>
                    <p className="text-white font-bold text-3xl">{kpiAtual.realizado}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <p className="text-slate-400 text-xs mb-1">Necessário</p>
                    <p className="text-white font-bold text-3xl">{kpiAtual.necessario}</p>
                    <p className={`text-xs font-semibold mt-1 ${kpiAtual.usandoMetaConfigurada ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {kpiAtual.usandoMetaConfigurada ? '✓ Meta configurada' : '~ Meta padrão'}
                    </p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <p className="text-slate-400 text-xs mb-1">GAP Meta</p>
                    <p className={`font-bold text-3xl ${gapKPI >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {gapKPI > 0 ? '+' : ''}{gapKPI}
                    </p>
                    <p className="text-slate-500 text-xs mt-1">{percentualKPI}% da meta</p>
                  </div>
                </div>

                {/* Gráfico */}
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={(() => {
                      let acumulado = 0;
                      return atividadesPorDia.map((dia, idx) => {
                        const diaStr = dia.dia;
                        const atividadesDoDia = atividadesFiltradas.filter(a => format(new Date(a.created_date), "dd/MM") === diaStr);
                        const leadsDoDia = leadsFiltrados.filter(l => format(new Date(l.created_date), "dd/MM") === diaStr);
                        let realizadoDia = 0;
                        switch (kpiSelecionado) {
                          case 'leads': realizadoDia = leadsDoDia.length; break;
                          case 'mql': realizadoDia = leadsDoDia.filter(l => l.status !== "desqualificado" && l.status !== "sem_interesse").length; break;
                          case 'conexoes': realizadoDia = atividadesDoDia.filter(a => a.resultado === "atendeu" || a.resultado === "respondeu").length; break;
                          case 'rm': realizadoDia = leadsDoDia.filter(l => l.status === "reuniao_agendada" || l.status === "reuniao_realizada" || l.status === "qualificado").length; break;
                          case 'rr': realizadoDia = leadsDoDia.filter(l => l.status === "reuniao_realizada" || l.status === "qualificado").length; break;
                          case 'vendas': realizadoDia = leadsDoDia.filter(l => l.status === "qualificado").length; break;
                          default: realizadoDia = 0;
                        }
                        acumulado += realizadoDia;
                        return {
                          dia: diaStr,
                          realizado: acumulado,
                          meta: Math.floor(kpiAtual.necessario * (idx + 1) / parseInt(periodo))
                        };
                      });
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="dia" stroke="#64748b" fontSize={10} />
                      <YAxis stroke="#64748b" fontSize={10} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "#0f172a", 
                          border: "1px solid #334155", 
                          borderRadius: "8px" 
                        }} 
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="realizado" 
                        stroke="#ff6b35" 
                        strokeWidth={3}
                        name="Realizado"
                        dot={{ fill: '#ff6b35', r: 3 }}
                        fill="url(#colorRealizado)"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="meta" 
                        stroke="#10b981" 
                        strokeWidth={3}
                        name="Necessário"
                        dot={{ fill: '#10b981', r: 3 }}
                        strokeDasharray="5 5"
                      />
                      <defs>
                        <linearGradient id="colorRealizado" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ff6b35" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#ff6b35" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Rankings de Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ranking de Closers */}
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Target className="w-5 h-5 text-[#ff6b35]" />
                Ranking de Closer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dadosPorVendedor.slice(0, 5).map((v, idx) => (
                  <div key={v.email} className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-800/40 border border-slate-800 hover:border-[#ff6b35]/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#ff6b35] to-[#ff8c42] flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-xs">{idx + 1}</span>
                      </div>
                      <span className="text-white font-medium text-sm">{v.nome}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-[#ff6b35] font-bold">R$ {(v.reunioes * ticketMedio).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                      <p className="text-slate-500 text-xs">{v.reunioes} reuniões</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Ranking de SDR */}
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                Ranking de SDR / Captador
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...dadosPorVendedor]
                  .sort((a, b) => {
                    const aVal = a.conversoes > 0 ? a.conversoes : a.leads;
                    const bVal = b.conversoes > 0 ? b.conversoes : b.leads;
                    return bVal - aVal;
                  })
                  .slice(0, 5)
                  .map((v, idx) => (
                  <div key={v.email} className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-800/40 border border-slate-800 hover:border-emerald-500/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-green-400 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-xs">{idx + 1}</span>
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">{v.nome}</p>
                        <p className="text-slate-500 text-xs">{v.leads} leads</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {v.atendimentos > 0 ? (
                        <>
                          <p className="text-emerald-400 font-bold text-sm">{v.conversoes} conversões</p>
                          <p className="text-slate-400 text-xs">{v.atendimentos} atend. · {v.taxaConversaoReal}%</p>
                        </>
                      ) : (
                        <>
                          <p className="text-emerald-400 font-bold text-sm">{v.leads} leads</p>
                          <p className="text-slate-500 text-xs">{v.conversao}% conv.</p>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabelas de Valor Vendido */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Valor por Origem */}
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-sm">Valor Vendido por Origem</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                 {(() => {
                   const origemMap = { "Tráfego Pago": "trafego_pago", "Indicação": "indicacao", "Orgânico": "organico", "Evento": "evento", "Lista Fria": "lista_fria" };
                   return dadosPorOrigem.slice(0, 6).map((origem, idx) => {
                     const origemKey = origemMap[origem.name];
                     const leadsOrigem = leadsFiltrados.filter(l => origemKey ? l.origem === origemKey : (l.origem === "outro" || !l.origem));
                     const valor = leadsOrigem.reduce((sum, l) => sum + (faturamentoPorLead[l.id] || l.valor_potencial || ticketMedio), 0);
                     return (
                       <div key={idx} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-800/80">
                         <span className="text-slate-300 text-sm">{origem.name}</span>
                         <span className="text-white font-semibold text-sm">
                           R$ {valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                         </span>
                       </div>
                     );
                   });
                 })()}
              </div>
            </CardContent>
          </Card>

          {/* Valor por Produto */}
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-sm">Valor Vendido por Produto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(() => {
                  const porProduto = leadsFiltrados
                    .filter(l => l.produto_interesse_nome)
                    .reduce((acc, lead) => {
                      const produto = lead.produto_interesse_nome;
                      if (!acc[produto]) acc[produto] = 0;
                      acc[produto] += faturamentoPorLead[lead.id] || lead.valor_potencial || ticketMedio;
                      return acc;
                    }, {});
                  const entries = Object.entries(porProduto).sort((a, b) => b[1] - a[1]).slice(0, 6);
                  if (entries.length === 0) return <p className="text-slate-500 text-sm">Sem dados</p>;
                  return entries.map(([produto, valor], idx) => (
                    <div key={idx} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-800/80">
                      <span className="text-slate-300 text-sm truncate">{produto}</span>
                      <span className="text-white font-semibold text-sm">
                        R$ {valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Valor por Empresa Vendedora */}
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-sm">Valor Vendido por Empresa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {empresasVendedoras.length > 0 ? (
                  empresasVendedoras
                    .map(empresa => {
                      const leadsEmpresa = leadsFiltrados.filter(l => l.empresa_vendedora_id === empresa.id);
                      const valorTotal = leadsEmpresa.reduce((sum, l) => sum + (faturamentoPorLead[l.id] || l.valor_potencial || ticketMedio), 0);
                      return { empresa, valor: valorTotal };
                    })
                    .filter(item => item.valor > 0)
                    .sort((a, b) => b.valor - a.valor)
                    .map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: item.empresa.cor || '#ff6b35' }}>
                          <span className="text-white font-bold text-xs">{item.empresa.nome.substring(0, 2).toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-sm truncate">{item.empresa.nome}</p>
                          <p className="text-slate-400 text-xs">
                            {leadsFiltrados.filter(l => l.empresa_vendedora_id === item.empresa.id).length} leads
                          </p>
                        </div>
                        <span className="text-white font-bold text-base">
                          R$ {item.valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    ))
                ) : (
                  <div className="text-center py-4">
                    <p className="text-slate-500 text-sm mb-2">Nenhuma empresa cadastrada</p>
                    <p className="text-slate-600 text-xs">Cadastre suas empresas vendedoras</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
              </div>
              </div>
              );
              }