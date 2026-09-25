import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { buscarEmpresaPorId } from "@/lib/services/empresaService";
import { listarVinculos, listarEquipes, vinculosParaUsuarios } from "@/lib/services/equipeService";
import { listarTarefas } from "@/lib/services/tarefaService";
import { listarAtividades } from "@/lib/services/atividadeService";
import { listarLeads } from "@/lib/services/leadService";
import { createPageUrl } from "../utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, Calendar, TrendingUp, TrendingDown, Filter, Phone, Flame } from "lucide-react";
import { isBefore, startOfDay } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import FunisView from "@/components/funis/FunisView";
import KPIHoje from "@/components/dashboard/KPIHoje";
import DashboardCloser from "@/components/crm/DashboardCloser";

export default function Dashboard() {
  const navigate = useNavigate();
  const [visualizacao, setVisualizacao] = React.useState("sdr");
  const [filtroVendedor, setFiltroVendedor] = React.useState("todos");
  const [filtroRole, setFiltroRole] = React.useState("todos");
  const [filtroEquipe, setFiltroEquipe] = React.useState("todos");

  const { data: user, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.auth.me(),
  });

  const { empresaId } = useEmpresaAtual();

  const { data: empresaAtual } = useQuery({
    queryKey: ["empresa-atual", empresaId],
    queryFn: () => buscarEmpresaPorId(empresaId),
    enabled: !!empresaId,
  });

  const { data: vinculos = [] } = useQuery({
    queryKey: ["vinculos-dashboard", empresaId],
    queryFn: () => listarVinculos(empresaId),
    enabled: !!empresaId,
  });
  const usuarios = useMemo(() => {
    const seen = new Set();
    return vinculosParaUsuarios(vinculos)
      .map(u => ({ ...u, role: u.papel }))
      .filter(u => {
        if (seen.has(u.email)) return false;
        seen.add(u.email);
        return true;
      });
  }, [vinculos]);

  const { data: equipes = [] } = useQuery({
    queryKey: ["equipes-dashboard", empresaId],
    queryFn: () => listarEquipes(empresaId),
    enabled: !!empresaId,
  });

  const { data: userProfiles = [] } = useQuery({
    queryKey: ["user-profiles-dashboard", empresaId],
    queryFn: () => api.entities.UserProfile.filter({ empresaId }),
    enabled: !!empresaId,
    staleTime: 5 * 60_000,
  });
  const perfilPorEmail = useMemo(() => {
    const mapa = {};
    userProfiles.forEach(p => { if (p.user_email) mapa[p.user_email.toLowerCase()] = p; });
    return mapa;
  }, [userProfiles]);

  const { data: todasTarefas = [], isError: erroTarefas } = useQuery({
    queryKey: ["tarefas-dashboard", empresaId],
    queryFn: () => listarTarefas(empresaId),
    enabled: !!empresaId,
    refetchInterval: 30000,
    retry: 2,
  });

  const { data: todasAtividades = [], isError: erroAtividades } = useQuery({
    queryKey: ["atividades-dashboard", empresaId],
    queryFn: () => listarAtividades(empresaId, { limit: 2000 }),
    enabled: !!empresaId,
    refetchInterval: 30000,
    retry: 2,
  });

  const { data: todosLeads = [], isError: erroLeads } = useQuery({
    queryKey: ["leads-dashboard", empresaId],
    queryFn: () => listarLeads(empresaId),
    enabled: !!empresaId,
    refetchInterval: 30000,
    retry: 2,
  });

  // Aplicar filtros
  const tarefas = React.useMemo(() => {
    let filtered = todasTarefas;

    if (filtroVendedor !== "todos") {
      filtered = filtered.filter(t => t.sdr_email === filtroVendedor);
    }

    if (filtroRole !== "todos") {
      const usuariosRole = usuarios.filter(u => u.role === filtroRole).map(u => u.email);
      filtered = filtered.filter(t => usuariosRole.includes(t.sdr_email));
    }

    if (filtroEquipe !== "todos") {
      const equipe = equipes.find(eq => eq.nome === filtroEquipe);
      if (equipe?.membros) {
        filtered = filtered.filter(t => equipe.membros.includes(t.sdr_email));
      }
    }

    return filtered;
  }, [todasTarefas, filtroVendedor, filtroRole, filtroEquipe, usuarios, equipes]);

  // Filtrar atividades pelos mesmos filtros de vendedor/role/equipe
  const atividades = React.useMemo(() => {
    let filtered = todasAtividades;
    if (filtroVendedor !== "todos") {
      filtered = filtered.filter(a => a.sdr_email === filtroVendedor);
    }
    if (filtroRole !== "todos") {
      const usuariosRole = usuarios.filter(u => u.role === filtroRole).map(u => u.email);
      filtered = filtered.filter(a => usuariosRole.includes(a.sdr_email));
    }
    if (filtroEquipe !== "todos") {
      const equipe = equipes.find(eq => eq.nome === filtroEquipe);
      if (equipe?.membros) {
        filtered = filtered.filter(a => equipe.membros.includes(a.sdr_email));
      }
    }
    return filtered;
  }, [todasAtividades, filtroVendedor, filtroRole, filtroEquipe, usuarios, equipes]);

  const leads = React.useMemo(() => {
    // Apenas leads com cadência iniciada (status em_cadencia ou cadencia_id preenchido)
    let filtered = todosLeads.filter(l => l.status === "em_cadencia" || !!l.cadencia_id);

    if (filtroVendedor !== "todos") {
      filtered = filtered.filter(l => l.sdr_responsavel === filtroVendedor || l.closer_responsavel === filtroVendedor);
    }

    if (filtroRole !== "todos") {
      const usuariosRole = usuarios.filter(u => u.role === filtroRole).map(u => u.email);
      filtered = filtered.filter(l => 
        usuariosRole.includes(l.sdr_responsavel) || usuariosRole.includes(l.closer_responsavel)
      );
    }

    if (filtroEquipe !== "todos") {
      const equipe = equipes.find(eq => eq.nome === filtroEquipe);
      if (equipe?.membros) {
        filtered = filtered.filter(l => 
          equipe.membros.includes(l.sdr_responsavel) || equipe.membros.includes(l.closer_responsavel)
        );
      }
    }

    return filtered;
  }, [todosLeads, filtroVendedor, filtroRole, filtroEquipe, usuarios, equipes]);

  // Calcular métricas de produtividade
  const produtividade = useMemo(() => {
    const hoje = startOfDay(new Date());
    const totalTarefas = tarefas.length;
    const tarefasConcluidas = tarefas.filter(t => t.status === "concluida").length;
    const tarefasAtrasadas = tarefas.filter(t => 
      t.status === "pendente" && isBefore(new Date(t.data_prevista), hoje)
    ).length;
    const tarefasPendentes = tarefas.filter(t => t.status === "pendente").length;
    
    const percentualProdutividade = totalTarefas > 0 
      ? Math.round((tarefasConcluidas / totalTarefas) * 100) 
      : 0;

    return {
      totalTarefas,
      tarefasConcluidas,
      tarefasAtrasadas,
      tarefasPendentes,
      percentualProdutividade,
    };
  }, [tarefas]);

  // Calcular métricas de eficiência (reuniões) — mantido para outros dashboards
  const eficiencia = useMemo(() => {
    const reunioesAgendadas = tarefas.filter(t => 
      t.tipo === "reuniao" && t.status !== "cancelada"
    ).length;

    const reunioesRealizadas = tarefas.filter(t => 
      t.tipo === "reuniao" && t.status === "concluida"
    ).length;

    const percentualEficiencia = reunioesAgendadas > 0 
      ? Math.round((reunioesRealizadas / reunioesAgendadas) * 100) 
      : 0;

    return {
      reunioesAgendadas,
      reunioesRealizadas,
      percentualEficiencia,
    };
  }, [tarefas]);

  // Eficiência CORRETA do SDR: reuniões agendadas / total de contatos realizados
  const eficienciaSDR = useMemo(() => {
    // Contatos realizados = atividades de ligação + whatsapp + email + instagram
    const tiposContato = ["ligacao", "whatsapp", "email", "instagram"];
    const totalContatos = atividades.filter(a => tiposContato.includes(a.tipo)).length;

    // Reuniões agendadas = leads com status reuniao_agendada gerados por atividades do SDR
    // Simplificado: tarefas do tipo "reuniao" criadas (status pendente ou concluída)
    const reunioesAgendadas = tarefas.filter(t => t.tipo === "reuniao").length;

    const percentualEficienciaSDR = totalContatos > 0
      ? Math.round((reunioesAgendadas / totalContatos) * 100)
      : 0;

    return {
      totalContatos,
      reunioesAgendadas,
      percentualEficienciaSDR,
    };
  }, [atividades, tarefas]);

  // Métricas específicas para Closer
  const metricasCloser = useMemo(() => {
    const reunioesAgendadas = tarefas.filter(t => 
      t.tipo === "reuniao" && t.status !== "cancelada"
    ).length;

    const reunioesConcluidas = tarefas.filter(t => 
      t.tipo === "reuniao" && t.status === "concluida"
    ).length;

    const negociacoesAbertas = leads.filter(l => 
      l.status === "reuniao_realizada" || l.status === "qualificado"
    ).length;

    const vendas = tarefas.filter(t => 
      t.tipo === "recebimento" && 
      t.status === "concluida" && 
      t.resultado_venda === "venda_realizada"
    ).length;

    // Produtividade: reuniões + tarefas
    const tarefasCloser = tarefas.filter(t => 
      ["reuniao", "realizar_reuniao", "enviar_contrato", "recebimento", "case_sucesso"].includes(t.tipo)
    );
    const tarefasConcluidasCloser = tarefasCloser.filter(t => t.status === "concluida").length;
    const percentualProdutividadeCloser = tarefasCloser.length > 0
      ? Math.round((tarefasConcluidasCloser / tarefasCloser.length) * 100)
      : 0;

    // Eficiência: vendas por reunião realizada
    const percentualEficienciaCloser = reunioesConcluidas > 0
      ? Math.round((vendas / reunioesConcluidas) * 100)
      : 0;

    return {
      reunioesAgendadas,
      reunioesConcluidas,
      negociacoesAbertas,
      vendas,
      percentualProdutividadeCloser,
      percentualEficienciaCloser,
      totalTarefasCloser: tarefasCloser.length,
      tarefasConcluidasCloser,
    };
  }, [tarefas, leads]);

  // Métricas específicas para Vendedor (SDR + Closer)
  const metricasVendedor = useMemo(() => {
    // Combina todas as tarefas (SDR + Closer)
    const todasTarefas = tarefas.length;
    const tarefasConcluidas = tarefas.filter(t => t.status === "concluida").length;
    const tarefasAtrasadas = tarefas.filter(t => t.status === "atrasada").length;

    // Reuniões
    const reunioesAgendadas = tarefas.filter(t => 
      t.tipo === "reuniao" && t.status !== "cancelada"
    ).length;

    const reunioesConcluidas = tarefas.filter(t => 
      t.tipo === "reuniao" && t.status === "concluida"
    ).length;

    // Vendas
    const vendas = tarefas.filter(t => 
      t.tipo === "recebimento" && 
      t.status === "concluida" && 
      t.resultado_venda === "venda_realizada"
    ).length;

    // Produtividade geral (todas as tarefas)
    const percentualProdutividadeVendedor = todasTarefas > 0
      ? Math.round((tarefasConcluidas / todasTarefas) * 100)
      : 0;

    // Eficiência combinada: comparecimento + conversão
    // 50% peso para comparecimento, 50% peso para conversão
    const taxaComparecimento = reunioesAgendadas > 0
      ? (reunioesConcluidas / reunioesAgendadas) * 100
      : 0;

    const taxaConversao = reunioesConcluidas > 0
      ? (vendas / reunioesConcluidas) * 100
      : 0;

    const percentualEficienciaVendedor = Math.round((taxaComparecimento + taxaConversao) / 2);

    return {
      leads: leads.length,
      tarefasPendentes: tarefas.filter(t => t.status === "pendente").length,
      reunioesAgendadas,
      reunioesConcluidas,
      vendas,
      todasTarefas,
      tarefasConcluidas,
      tarefasAtrasadas,
      percentualProdutividadeVendedor,
      percentualEficienciaVendedor,
      taxaComparecimento: Math.round(taxaComparecimento),
      taxaConversao: Math.round(taxaConversao),
    };
  }, [tarefas, leads]);

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      navigate(createPageUrl("Acesso"));
      return;
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] p-6">
      <div className="max-w-7xl mx-auto">
        {(erroTarefas || erroAtividades || erroLeads) && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-2">
            <span>⚠️</span>
            <span>Alguns dados não puderam ser carregados. Recarregue a página se o problema persistir.</span>
          </div>
        )}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1 h-6 bg-gradient-to-b from-[#ff6b35] to-[#ff8c42] rounded-full" />
                <h1 className="text-2xl font-bold text-white">
                  Dashboard {visualizacao === "sdr" ? "SDR" : visualizacao === "closer" ? "Closer" : visualizacao === "vendedor" ? "Vendedor" : visualizacao === "telemarketing" ? "Telemarketing" : visualizacao === "bdr" ? "BDR" : ""}
                </h1>
              </div>
              <p className="text-slate-500 text-sm ml-3">
                {empresaAtual?.nome || "Carregando..."}
              </p>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              <Filter className="w-5 h-5 text-slate-400" />
              <Select value={visualizacao} onValueChange={setVisualizacao}>
                <SelectTrigger className="w-48 bg-slate-900 border-slate-800 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  <SelectItem value="sdr">Dashboard SDR</SelectItem>
                  <SelectItem value="closer">Dashboard Closer</SelectItem>
                  <SelectItem value="bdr">Dashboard BDR</SelectItem>
                  <SelectItem value="vendedor">Dashboard Vendedor</SelectItem>
                  <SelectItem value="telemarketing">Dashboard Telemarketing</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filtroVendedor} onValueChange={setFiltroVendedor}>
                <SelectTrigger className="w-48 bg-slate-900 border-slate-800 text-white">
                  <SelectValue placeholder="Filtrar vendedor" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  <SelectItem value="todos">Todos Vendedores</SelectItem>
                  {usuarios.filter(u => u.role !== "admin").map(user => (
                    <SelectItem key={user.id} value={user.email}>
                      {perfilPorEmail[user.email?.toLowerCase()]?.user_name || user.full_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filtroRole} onValueChange={setFiltroRole}>
                <SelectTrigger className="w-40 bg-slate-900 border-slate-800 text-white">
                  <SelectValue placeholder="Função" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  <SelectItem value="todos">Todas Funções</SelectItem>
                  <SelectItem value="sdr">SDR</SelectItem>
                  <SelectItem value="closer">Closer</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filtroEquipe} onValueChange={setFiltroEquipe}>
                <SelectTrigger className="w-40 bg-slate-900 border-slate-800 text-white">
                  <SelectValue placeholder="Equipe" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  <SelectItem value="todos">Todas Equipes</SelectItem>
                  {equipes.map(equipe => (
                    <SelectItem key={equipe.id} value={equipe.nome}>
                      {equipe.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* ── Abas: Métricas | 3 Funis ── */}
        <Tabs defaultValue="metricas" className="w-full">
          <TabsList className="bg-slate-900/80 border border-slate-800/60 rounded-xl mb-6 h-10">
            <TabsTrigger value="metricas" className="text-sm data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400 rounded-lg px-5">
              📊 Métricas
            </TabsTrigger>
            <TabsTrigger value="funis" className="text-sm data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400 rounded-lg px-5">
              🔥 Pipeline
            </TabsTrigger>
          </TabsList>

          <TabsContent value="funis">
            <FunisView leads={leads} usuarios={usuarios} />
          </TabsContent>

          <TabsContent value="metricas">

        {/* KPI do SDR hoje */}
        {(visualizacao === "sdr" || visualizacao === "bdr" || visualizacao === "telemarketing") && user?.email && (
          <KPIHoje userEmail={user.email} />
        )}

        {/* Dashboard Closer dedicado */}
        {visualizacao === "closer" && (
          <DashboardCloser userEmail={user?.email} filtroVendedor={filtroVendedor} />
        )}

        {/* Cards principais */}
        {visualizacao === "closer" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { value: metricasCloser.reunioesAgendadas, label: "Reuniões Agendadas", color: "blue" },
              { value: metricasCloser.reunioesConcluidas, label: "Reuniões Concluídas", color: "emerald" },
              { value: metricasCloser.negociacoesAbertas, label: "Negociações em Aberto", color: "amber" },
              { value: metricasCloser.vendas, label: "Vendas Realizadas", color: "orange" },
            ].map((card, i) => (
              <div key={i} className="relative overflow-hidden rounded-2xl bg-slate-900/80 border border-slate-800/60 p-5 backdrop-blur-sm hover:border-slate-700 transition-all duration-300">
                <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-10 ${card.color === "blue" ? "bg-blue-400" : card.color === "emerald" ? "bg-emerald-400" : card.color === "amber" ? "bg-amber-400" : "bg-orange-400"}`} />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">{card.label}</p>
                <p className="text-4xl font-bold text-white">{card.value}</p>
              </div>
            ))}
          </div>
        ) : visualizacao === "vendedor" || visualizacao === "telemarketing" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { value: metricasVendedor.leads, label: "Leads Totais", color: "blue" },
              { value: metricasVendedor.tarefasPendentes, label: "Tarefas Pendentes", color: "amber" },
              { value: metricasVendedor.reunioesAgendadas, label: "Reuniões Agendadas", color: "purple" },
              { value: metricasVendedor.vendas, label: "Vendas Realizadas", color: "emerald" },
            ].map((card, i) => (
              <div key={i} className="relative overflow-hidden rounded-2xl bg-slate-900/80 border border-slate-800/60 p-5 backdrop-blur-sm hover:border-slate-700 transition-all duration-300">
                <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-10 ${card.color === "blue" ? "bg-blue-400" : card.color === "amber" ? "bg-amber-400" : card.color === "purple" ? "bg-purple-400" : "bg-emerald-400"}`} />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">{card.label}</p>
                <p className="text-4xl font-bold text-white">{card.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { value: leads.length, label: "Leads", color: "blue" },
              { value: produtividade.tarefasPendentes, label: "Tarefas Pendentes", color: "amber" },
              { value: eficiencia.reunioesAgendadas, label: "Reuniões Agendadas", color: "purple" },
              { value: `${eficiencia.percentualEficiencia}%`, label: "Taxa de Comparecimento", color: "emerald" },
            ].map((card, i) => (
              <div key={i} className="relative overflow-hidden rounded-2xl bg-slate-900/80 border border-slate-800/60 p-5 backdrop-blur-sm hover:border-slate-700 transition-all duration-300">
                <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-10 ${card.color === "blue" ? "bg-blue-400" : card.color === "amber" ? "bg-amber-400" : card.color === "purple" ? "bg-purple-400" : "bg-emerald-400"}`} />
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">{card.label}</p>
                <p className="text-4xl font-bold text-white">{card.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Painéis de Produtividade e Eficiência */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          {/* Painel de Produtividade */}
          <Card className="bg-slate-900/80 border-slate-800/60 rounded-2xl backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                {(visualizacao === "closer" ? metricasCloser.percentualProdutividadeCloser : visualizacao === "vendedor" || visualizacao === "telemarketing" ? metricasVendedor.percentualProdutividadeVendedor : produtividade.percentualProdutividade) >= 70 ? (
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-rose-400" />
                )}
                Produtividade
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-400 text-sm">Taxa de Produtividade</span>
                  <span className={`text-2xl font-bold ${
                    (visualizacao === "closer" ? metricasCloser.percentualProdutividadeCloser : visualizacao === "vendedor" || visualizacao === "telemarketing" ? metricasVendedor.percentualProdutividadeVendedor : produtividade.percentualProdutividade) >= 70 ? "text-emerald-400" : "text-rose-400"
                  }`}>
                    {visualizacao === "closer" ? metricasCloser.percentualProdutividadeCloser : visualizacao === "vendedor" || visualizacao === "telemarketing" ? metricasVendedor.percentualProdutividadeVendedor : produtividade.percentualProdutividade}%
                  </span>
                </div>
                <Progress 
                  value={visualizacao === "closer" ? metricasCloser.percentualProdutividadeCloser : visualizacao === "vendedor" || visualizacao === "telemarketing" ? metricasVendedor.percentualProdutividadeVendedor : produtividade.percentualProdutividade} 
                  className="h-2 bg-slate-800"
                />
              </div>

              {visualizacao === "closer" ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs text-slate-400">Concluídas</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {metricasCloser.tarefasConcluidasCloser}
                    </div>
                    <div className="text-xs text-slate-500">
                      de {metricasCloser.totalTarefasCloser} tarefas
                    </div>
                  </div>

                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-slate-400">Reuniões</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {metricasCloser.reunioesConcluidas}
                    </div>
                    <div className="text-xs text-slate-500">
                      de {metricasCloser.reunioesAgendadas} agendadas
                    </div>
                  </div>
                </div>
              ) : visualizacao === "vendedor" || visualizacao === "telemarketing" ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs text-slate-400">Concluídas</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {metricasVendedor.tarefasConcluidas}
                    </div>
                    <div className="text-xs text-slate-500">
                      de {metricasVendedor.todasTarefas} tarefas
                    </div>
                  </div>

                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <XCircle className="w-4 h-4 text-rose-400" />
                      <span className="text-xs text-slate-400">Atrasadas</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {metricasVendedor.tarefasAtrasadas}
                    </div>
                    <div className="text-xs text-slate-500">
                      tarefas em atraso
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs text-slate-400">Concluídas</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {produtividade.tarefasConcluidas}
                    </div>
                    <div className="text-xs text-slate-500">
                      de {produtividade.totalTarefas} tarefas
                    </div>
                  </div>

                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <XCircle className="w-4 h-4 text-rose-400" />
                      <span className="text-xs text-slate-400">Atrasadas</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {produtividade.tarefasAtrasadas}
                    </div>
                    <div className="text-xs text-slate-500">
                      tarefas em atraso
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-800">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Total de Tarefas</span>
                  <span className="text-white font-semibold">
                    {visualizacao === "closer" ? metricasCloser.totalTarefasCloser : visualizacao === "vendedor" || visualizacao === "telemarketing" ? metricasVendedor.todasTarefas : produtividade.totalTarefas}
                  </span>
                </div>
              </div>
              </CardContent>
              </Card>

          {/* Painel de Eficiência */}
          <Card className="bg-slate-900/80 border-slate-800/60 rounded-2xl backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                {(visualizacao === "closer" ? metricasCloser.percentualEficienciaCloser : visualizacao === "vendedor" || visualizacao === "telemarketing" ? metricasVendedor.percentualEficienciaVendedor : eficienciaSDR.percentualEficienciaSDR) >= 70 ? (
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-amber-400" />
                )}
                Eficiência {visualizacao === "closer" ? "(Conversão)" : visualizacao === "vendedor" || visualizacao === "telemarketing" ? "(Geral)" : "(Agendamento)"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-400 text-sm">
                    {visualizacao === "closer" ? "Taxa de Conversão" : visualizacao === "vendedor" || visualizacao === "telemarketing" ? "Eficiência Geral" : "Taxa de Agendamento"}
                  </span>
                  <span className={`text-2xl font-bold ${
                    (visualizacao === "closer" ? metricasCloser.percentualEficienciaCloser : visualizacao === "vendedor" || visualizacao === "telemarketing" ? metricasVendedor.percentualEficienciaVendedor : eficienciaSDR.percentualEficienciaSDR) >= 70 ? "text-blue-400" : "text-amber-400"
                  }`}>
                    {visualizacao === "closer" ? metricasCloser.percentualEficienciaCloser : visualizacao === "vendedor" || visualizacao === "telemarketing" ? metricasVendedor.percentualEficienciaVendedor : eficienciaSDR.percentualEficienciaSDR}%
                  </span>
                </div>
                <Progress 
                  value={visualizacao === "closer" ? metricasCloser.percentualEficienciaCloser : visualizacao === "vendedor" || visualizacao === "telemarketing" ? metricasVendedor.percentualEficienciaVendedor : eficienciaSDR.percentualEficienciaSDR} 
                  className="h-2 bg-slate-800"
                />
              </div>

              {visualizacao === "closer" ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-slate-400">Reuniões</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {metricasCloser.reunioesConcluidas}
                    </div>
                    <div className="text-xs text-slate-500">
                      reuniões realizadas
                    </div>
                  </div>

                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs text-slate-400">Vendas</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {metricasCloser.vendas}
                    </div>
                    <div className="text-xs text-slate-500">
                      pagamentos efetivados
                    </div>
                  </div>
                </div>
              ) : visualizacao === "vendedor" || visualizacao === "telemarketing" ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-slate-400">Comparecimento</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {metricasVendedor.taxaComparecimento}%
                    </div>
                    <div className="text-xs text-slate-500">
                      {metricasVendedor.reunioesConcluidas} de {metricasVendedor.reunioesAgendadas}
                    </div>
                  </div>

                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs text-slate-400">Conversão</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {metricasVendedor.taxaConversao}%
                    </div>
                    <div className="text-xs text-slate-500">
                      {metricasVendedor.vendas} vendas realizadas
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Phone className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-slate-400">Contatos Feitos</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {eficienciaSDR.totalContatos}
                    </div>
                    <div className="text-xs text-slate-500">
                      ligações + wpp + email
                    </div>
                  </div>

                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs text-slate-400">Reuniões Geradas</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {eficienciaSDR.reunioesAgendadas}
                    </div>
                    <div className="text-xs text-slate-500">
                      reuniões agendadas
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-800">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">
                    {visualizacao === "closer" ? "Negociações Abertas" : visualizacao === "vendedor" || visualizacao === "telemarketing" ? "Reuniões + Vendas" : "Conversão por Contato"}
                  </span>
                  <span className={`font-semibold ${visualizacao === "closer" || visualizacao === "vendedor" || visualizacao === "telemarketing" ? "text-white" : "text-blue-400"}`}>
                    {visualizacao === "closer" 
                      ? metricasCloser.negociacoesAbertas
                      : visualizacao === "vendedor" || visualizacao === "telemarketing"
                        ? `${metricasVendedor.reunioesConcluidas}/${metricasVendedor.vendas}`
                        : `${eficienciaSDR.reunioesAgendadas} reunião(ões) em ${eficienciaSDR.totalContatos} contato(s)`
                    }
                  </span>
                </div>
              </div>
              </CardContent>
              </Card>
              </div>

          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}