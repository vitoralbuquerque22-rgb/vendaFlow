import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMonitoramentoRealTime } from '@/hooks/useMonitoramentoRealTime';
import { api } from '@/api/client';
import { listarLeads, atualizarLead } from "@/lib/services/leadService";
import { listarTarefas, atualizarTarefa, criarTarefa } from "@/lib/services/tarefaService";
import { listarAtividades } from "@/lib/services/atividadeService";
import { listarVinculos, vinculosParaUsuarios } from "@/lib/services/equipeService";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format, isToday, isBefore, startOfDay, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Clock, CheckCircle2, Users, Phone, BarChart2, RefreshCw, AlertCircle, Calendar, UserCheck, ArrowRightLeft, X, PhoneCall } from "lucide-react";
import { cn } from "@/lib/utils";
import ButtonAtualizar from "@/components/ui/ButtonAtualizar";
import { toast } from "sonner";

const ROLES_OPERACIONAIS = ["sdr", "closer", "cs", "social_seller", "gestor", "admin", "gerente_filial", "supervisor"];

const STATUS_3CPLUS = {
  idle:       { label: "Ocioso",          classes: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400", pulse: false },
  in_call:    { label: "Em ligação",      classes: "bg-sky-500/10 border-sky-500/20 text-sky-400",             pulse: true },
  answered:   { label: "Em ligação",      classes: "bg-sky-500/10 border-sky-500/20 text-sky-400",             pulse: true },
  acw:        { label: "Pós-atendimento", classes: "bg-amber-500/10 border-amber-500/20 text-amber-400",       pulse: false },
  work_break: { label: "Intervalo",       classes: "bg-violet-500/10 border-violet-500/20 text-violet-400",    pulse: false },
  offline:    { label: "Offline",         classes: "bg-slate-700/40 border-slate-700/40 text-slate-500",       pulse: false },
};
function statusConfig3cplus(status) {
  return STATUS_3CPLUS[status] || STATUS_3CPLUS.offline;
}
const HORARIO_COMERCIAL = { inicio: 8, fim: 18 };

function dentroHorarioComercial() {
  const h = new Date().getHours();
  return h >= HORARIO_COMERCIAL.inicio && h < HORARIO_COMERCIAL.fim;
}

export default function PainelSupervisor({ user }) {
  const [vendedorFiltro, setVendedorFiltro] = useState("todos");
  const [membroDetalhe, setMembroDetalhe] = useState(null);
  const [tickCount, setTickCount] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTickCount(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  const { empresaId } = useEmpresaAtual();
  const queryClient = useQueryClient();

  // Token gestor para socket de monitoramento
  const { data: integracoesTel } = useQuery({
    queryKey: ['integracoes-telefonia-supervisor', empresaId],
    queryFn: () => api.entities.Integracao.filter({ empresaId, tipo: 'telefonia', ativa: true }),
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
  });
  // O token vem mascarado do servidor: só indica que o monitoramento está configurado
  const monitoramentoConfigurado = !!integracoesTel?.[0]?.configuracao?.token_gestor;

  const { agentes: agentesAoVivo } = useMonitoramentoRealTime({
    empresaId,
    habilitado: monitoramentoConfigurado,
  });

  // Mapear email do agente 3C → status ao vivo
  const statusTelefoniaPorEmail = useMemo(() => {
    const mapa = {};
    agentesAoVivo.forEach(a => {
      if (a.email) mapa[a.email.toLowerCase()] = a;
    });
    return mapa;
  }, [agentesAoVivo]);

  const { data: vinculos = [], isLoading: loadingVinculos } = useQuery({
    queryKey: ["vinculos", empresaId],
    queryFn: () => listarVinculos(empresaId),
    enabled: !!empresaId,
    refetchInterval: 30_000,
  });

  const { data: tarefas = [], isLoading: loadingTarefas } = useQuery({
    queryKey: ["tarefas", "supervisor", empresaId],
    queryFn: () => listarTarefas(empresaId, {}),
    enabled: !!empresaId,
    refetchInterval: 30_000,
  });

  const { data: atividades = [] } = useQuery({
    queryKey: ["atividades", empresaId],
    queryFn: () => listarAtividades(empresaId),
    enabled: !!empresaId,
    refetchInterval: 30_000,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads", "supervisor", empresaId],
    queryFn: () => listarLeads(empresaId),
    enabled: !!empresaId,
  });

  const { data: userProfiles = [] } = useQuery({
    queryKey: ["user-profiles", "supervisor", empresaId],
    queryFn: () => api.entities.UserProfile.filter({ empresaId }),
    enabled: !!empresaId,
    refetchInterval: 15_000,
  });

  const perfilPorEmail = useMemo(() => {
    const mapa = {};
    userProfiles.forEach(p => {
      if (p.user_email) mapa[p.user_email.toLowerCase()] = p;
    });
    return mapa;
  }, [userProfiles]);

  const modoAtivoPorEmail = useMemo(() => {
    const mapa = {};
    userProfiles.forEach(p => {
      if (p.user_email) mapa[p.user_email.toLowerCase()] = p.modo_ativo;
    });
    return mapa;
  }, [userProfiles]);

  const atualizarLeadMutation = useMutation({
    mutationFn: ({ id, data }) => atualizarLead(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      toast.success("Lead reatribuído com sucesso!");
    },
  });

  const isLoading = loadingVinculos || loadingTarefas;

  const membros = useMemo(() => {
    const seen = new Set();
    return vinculos
      .filter(v => ROLES_OPERACIONAIS.includes(v.papel))
      .filter(v => {
        if (seen.has(v.userEmail)) return false;
        seen.add(v.userEmail);
        return true;
      });
  }, [vinculos]);

  const membrosFiltrados = useMemo(() =>
    vendedorFiltro === "todos" ? membros : membros.filter(v => v.userEmail === vendedorFiltro),
    [membros, vendedorFiltro]
  );

  const atividadesPorSDR = useMemo(() => {
    const idx = {};
    atividades.forEach(a => {
      const email = a.sdr_email;
      if (!email) return;
      if (!idx[email]) idx[email] = [];
      idx[email].push(a);
    });
    return idx;
  }, [atividades]);

  const tarefasPorSDR = useMemo(() => {
    const idx = {};
    tarefas.forEach(t => {
      const email = t.sdr_email;
      if (!email) return;
      if (!idx[email]) idx[email] = [];
      idx[email].push(t);
    });
    return idx;
  }, [tarefas]);

  const dadosMembros = useMemo(() => {
    const agora = new Date();
    const hoje = startOfDay(agora);

    return membrosFiltrados.map(v => {
      const email = v.userEmail;
      const atvsSDR = (atividadesPorSDR[email] || [])
        .slice().sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      const ultimaAtv = atvsSDR[0];
      const ultimaAtvMs = ultimaAtv ? agora - new Date(ultimaAtv.created_date) : null;
      const semAtvidade1h = dentroHorarioComercial() && (!ultimaAtv || ultimaAtvMs > 60 * 60 * 1000);

      const tarefasSDR = tarefasPorSDR[email] || [];
      // "Pendentes hoje" e "Atrasadas" são números DISTINTOS (não somados)
      const pendentes = tarefasSDR.filter(t =>
        t.status === "pendente" && isToday(new Date(t.data_prevista + "T12:00:00"))
      );
      const atrasadas = tarefasSDR.filter(t =>
        t.status === "pendente" && isBefore(new Date(t.data_prevista + "T12:00:00"), hoje)
      );
      const concluidasHoje = tarefasSDR.filter(t => t.status === "concluida" && isToday(new Date(t.updated_date || t.created_date)));
      const ligacoesHoje = atvsSDR.filter(a => isToday(new Date(a.created_date)) && a.tipo === "ligacao");

      return {
        email,
        nome: perfilPorEmail[email?.toLowerCase()]?.user_name || v.userName?.trim() || email.split("@")[0],
        papel: v.papel,
        atuandoComoCloser: modoAtivoPorEmail[email?.toLowerCase()] === "closer",
        status3cplus: perfilPorEmail[email?.toLowerCase()]?.status_3cplus || null,
        ultimaAtualizacaoStatus: perfilPorEmail[email?.toLowerCase()]?.ultima_atualizacao_status || null,
        semAtvidade1h,
        ultimaAtv,
        ultimaAtvMs,
        pendentes: pendentes.length,
        atrasadas: atrasadas.length,
        concluidasHoje: concluidasHoje.length,
        ligacoesHoje: ligacoesHoje.length,
        atividadesHoje: atvsSDR.filter(a => isToday(new Date(a.created_date))).length,
        statusTelefonia: (() => {
          const st = statusTelefoniaPorEmail[email?.toLowerCase()];
          if (!st) return null;
          return {
            ...st,
            duracao_ao_vivo: st.em_ligacao || st.em_pausa ? (st.duracao || 0) + tickCount : st.duracao || 0,
          };
        })(),
      };
    });
  }, [membrosFiltrados, atividadesPorSDR, tarefasPorSDR, statusTelefoniaPorEmail, tickCount, modoAtivoPorEmail, perfilPorEmail]);

  const leadsAlerta = useMemo(() => {
    const agora = new Date();
    const duasHoras = 2 * 60 * 60 * 1000;
    const atividadesPorLead = {};
    atividades.forEach(a => {
      if (!atividadesPorLead[a.lead_id]) atividadesPorLead[a.lead_id] = [];
      atividadesPorLead[a.lead_id].push(a);
    });

    return leads
      .filter(l => l.sdr_responsavel || l.sdr_email)
      .reduce((acc, lead) => {
        const atvsLead = atividadesPorLead[lead.id] || [];
        const semContato = lead.fonte_externa && atvsLead.length === 0;
        const criado = new Date(lead.data_atribuicao || lead.created_date);
        const urgente = semContato && (agora - criado) > duasHoras;

        const tarefasLead = tarefas.filter(t => t.lead_id === lead.id && t.status === "pendente");
        const retornoVencido = tarefasLead.some(t =>
          t.motivo_encerramento === "conversao" && isBefore(new Date(t.data_prevista), startOfDay(agora))
        );

        const redistribuicoes = lead.redistribuicoes_count || 0;

        if (urgente) acc.push({ lead, motivo: "sem_contato", label: "Sem contato", cor: "rose" });
        else if (retornoVencido) acc.push({ lead, motivo: "retorno_vencido", label: "Retorno vencido", cor: "orange" });
        else if (redistribuicoes >= 3) acc.push({ lead, motivo: "multiplas_redistribuicoes", label: `Redistribuído ${redistribuicoes}x`, cor: "amber" });
        return acc;
      }, [])
      .slice(0, 20);
  }, [leads, atividades, tarefas]);

  const agendaTime = useMemo(() => {
    const agora = new Date();
    const amanha = new Date(agora);
    amanha.setDate(amanha.getDate() + 1);
    const fimAmanha = new Date(amanha);
    fimAmanha.setHours(23, 59, 59);

    return tarefas
      .filter(t => {
        const data = new Date(t.data_prevista);
        return t.status === "pendente" &&
          (t.tipo === "reuniao" || t.motivo_encerramento === "conversao") &&
          data >= startOfDay(agora) && data <= fimAmanha;
      })
      .sort((a, b) => new Date(a.data_prevista) - new Date(b.data_prevista))
      .slice(0, 15);
  }, [tarefas]);

  const indicadores = useMemo(() => {
    const atvsHoje = atividades.filter(a => isToday(new Date(a.created_date)));
    const ligacoes = atvsHoje.filter(a => a.tipo === "ligacao").length;
    const leadsAbordados = new Set(atvsHoje.map(a => a.lead_id)).size;
    const reunioes = atvsHoje.filter(a => a.resultado === "reuniao_agendada" || a.resultado === "interesse").length;
    const desqualificados = atvsHoje.filter(a => a.resultado === "desqualificado" || a.resultado === "sem_interesse").length;
    const RESULTADOS_CONTATO = ["atendeu", "respondeu", "conversao", "reuniao_agendada", "interesse", "callback", "follow_up"];
    const atendeu = atvsHoje.filter(a => RESULTADOS_CONTATO.includes(a.resultado)).length;
    const taxa = ligacoes > 0 ? Math.round((atendeu / ligacoes) * 100) : 0;
    return { ligacoes, leadsAbordados, reunioes, desqualificados, taxa };
  }, [atividades]);

  const membrosParaReatribuicao = useMemo(() =>
    membros.filter(v => ["sdr", "closer", "cs", "social_seller", "supervisor"].includes(v.papel)),
    [membros]
  );

  const handleReatribuir = async (lead, novoEmail) => {
    const membro = membros.find(v => v.userEmail === novoEmail);
    atualizarLeadMutation.mutate({
      id: lead.id,
      data: {
        sdr_responsavel: novoEmail,
        sdr_email: novoEmail,
        data_atribuicao: new Date().toISOString(),
      },
    });

    try {
      await criarTarefa({
        empresaId,
        lead_id: lead.id,
        lead_nome: lead.nome || "Lead",
        lead_telefone: lead.telefone || "",
        lead_empresa: lead.empresa || "",
        sdr_email: novoEmail,
        tipo: "ligacao",
        data_prevista: new Date().toISOString().split("T")[0],
        periodo: new Date().getHours() < 13 ? "manha" : "tarde",
        status: "pendente",
        observacao: `Lead reatribuído pelo supervisor. Responsável anterior: ${lead.sdr_responsavel || "nenhum"}`,
      });
      toast.success(`Lead reatribuído para ${perfilPorEmail[novoEmail?.toLowerCase()]?.user_name || membro?.userName?.trim() || novoEmail.split("@")[0]}. Tarefa de contato criada.`);
    } catch (e) {
      console.error("[handleReatribuir] erro ao criar tarefa:", e);
      toast.success(`Lead reatribuído, mas houve erro ao criar tarefa automática.`);
    }

    queryClient.invalidateQueries({ queryKey: ["tarefas"] });
  };

  if (isLoading) {
    return (
      <div className="text-center py-16">
        <RefreshCw className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-3" />
        <p className="text-slate-400">Carregando painel...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={vendedorFiltro} onValueChange={setVendedorFiltro}>
          <SelectTrigger className="w-52 h-8 text-xs bg-slate-800/80 border-slate-700/60 text-slate-300">
            <SelectValue placeholder="Toda a equipe" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="todos">Toda a equipe</SelectItem>
            {membros.map(v => (
              <SelectItem key={v.userEmail} value={v.userEmail}>
                {perfilPorEmail[v.userEmail?.toLowerCase()]?.user_name || v.userName?.trim() || v.userEmail.split("@")[0]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ButtonAtualizar onClick={() => {
          queryClient.refetchQueries({ queryKey: ["tarefas", "supervisor"] });
          queryClient.refetchQueries({ queryKey: ["atividades"] });
          queryClient.refetchQueries({ queryKey: ["leads", "supervisor"] });
        }} />
        <span className="text-xs text-slate-500 ml-auto">
          Atualizado às {format(new Date(), "HH:mm", { locale: ptBR })} · atualiza a cada 1 min
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Ligações",          value: indicadores.ligacoes,       icon: Phone,       cor: "sky" },
          { label: "Leads abordados",   value: indicadores.leadsAbordados,  icon: Users,       cor: "violet" },
          { label: "Reuniões agend.",   value: indicadores.reunioes,        icon: Calendar,    cor: "emerald" },
          { label: "Desqualificados",   value: indicadores.desqualificados, icon: AlertCircle, cor: "rose" },
          { label: "Taxa de contato",   value: `${indicadores.taxa}%`,      icon: BarChart2,   cor: "amber" },
        ].map(({ label, value, icon: Icon, cor }) => (
          <div key={label} className={cn(
            "rounded-xl border p-3 flex flex-col gap-1",
            cor === "sky"     && "border-sky-500/20 bg-sky-500/5",
            cor === "violet"  && "border-violet-500/20 bg-violet-500/5",
            cor === "emerald" && "border-emerald-500/20 bg-emerald-500/5",
            cor === "rose"    && "border-rose-500/20 bg-rose-500/5",
            cor === "amber"   && "border-amber-500/20 bg-amber-500/5",
          )}>
            <div className="flex items-center gap-2">
              <Icon className={cn("w-4 h-4",
                cor === "sky"     && "text-sky-400",
                cor === "violet"  && "text-violet-400",
                cor === "emerald" && "text-emerald-400",
                cor === "rose"    && "text-rose-400",
                cor === "amber"   && "text-amber-400",
              )} />
              <span className="text-xs text-slate-500">{label}</span>
            </div>
            <span className={cn("text-2xl font-bold",
              cor === "sky"     && "text-sky-300",
              cor === "violet"  && "text-violet-300",
              cor === "emerald" && "text-emerald-300",
              cor === "rose"    && "text-rose-300",
              cor === "amber"   && "text-amber-300",
            )}>{value}</span>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-white">Status da Equipe</h2>
          <span className="text-xs text-slate-500">({dadosMembros.length} membros)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...dadosMembros].sort((a, b) => {
            const ordem = (m) => {
              if (m.semAtvidade1h) return 0;
              if (m.statusTelefonia?.em_pausa && m.statusTelefonia?.duracao_ao_vivo > 900) return 1;
              if (m.statusTelefonia?.em_pausa) return 2;
              if (m.statusTelefonia?.em_ligacao) return 3;
              if (m.statusTelefonia?.disponivel) return 4;
              if (m.statusTelefonia?.status === 0) return 6;
              if (!m.statusTelefonia) return 5;
              return 5;
            };
            return ordem(a) - ordem(b);
          }).map(m => (
            <div key={m.email}
              className={cn(
                "rounded-xl border p-4 space-y-2 transition-all",
                m.semAtvidade1h
                  ? "border-orange-500/30 bg-orange-500/5"
                  : m.statusTelefonia?.em_pausa && m.statusTelefonia?.duracao_ao_vivo > 900
                  ? "border-amber-500/30 bg-amber-500/5"
                  : m.statusTelefonia?.em_ligacao
                  ? "border-sky-500/20 bg-sky-500/5"
                  : "border-slate-800/60 bg-slate-900/40"
              )}
              onClick={() => m.statusTelefonia?.em_ligacao ? setMembroDetalhe(m) : null}
              style={{ cursor: m.statusTelefonia?.em_ligacao ? 'pointer' : 'default' }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0",
                    m.statusTelefonia?.em_ligacao ? "bg-sky-400 animate-pulse" :
                    m.statusTelefonia?.disponivel ? "bg-emerald-400" :
                    m.statusTelefonia?.em_pausa ? "bg-orange-400" :
                    m.semAtvidade1h ? "bg-orange-400" : "bg-emerald-400"
                  )} />
                  <span className="text-sm font-semibold text-white truncate">{m.nome}</span>
                  {m.atuandoComoCloser && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/30 flex-shrink-0">
                      Closer
                    </span>
                  )}
                  {(() => {
                    const cfg = statusConfig3cplus(m.status3cplus);
                    return (
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 flex-shrink-0", cfg.classes)}>
                        <span className={cn("w-1.5 h-1.5 rounded-full bg-current", cfg.pulse && "animate-pulse")} />
                        {cfg.label}
                      </span>
                    );
                  })()}
                </div>
                <span className="text-xs text-slate-500 capitalize flex-shrink-0">{m.papel}</span>
              </div>

              {m.ultimaAtualizacaoStatus && (
                <p className="text-[10px] text-slate-500 -mt-1">
                  Status {formatDistanceToNow(new Date(m.ultimaAtualizacaoStatus), { locale: ptBR, addSuffix: true })}
                </p>
              )}

              {m.statusTelefonia && (
                <div className={cn(
                  "flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border w-fit",
                  m.statusTelefonia.em_ligacao && "bg-sky-500/10 border-sky-500/20 text-sky-400",
                  m.statusTelefonia.disponivel && "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
                  m.statusTelefonia.em_pausa && "bg-orange-500/10 border-orange-500/20 text-orange-400",
                  !m.statusTelefonia.em_ligacao && !m.statusTelefonia.disponivel && !m.statusTelefonia.em_pausa && "bg-slate-700/40 border-slate-700/40 text-slate-500",
                )}>
                  <span>{m.statusTelefonia.status_icone}</span>
                  <span>{m.statusTelefonia.status_label}</span>
                  {m.statusTelefonia.duracao_ao_vivo > 0 && (
                    <span className="font-mono text-[10px] opacity-70">
                      {Math.floor(m.statusTelefonia.duracao_ao_vivo / 60)}:{String(m.statusTelefonia.duracao_ao_vivo % 60).padStart(2, '0')}
                    </span>
                  )}
                </div>
              )}
              {m.statusTelefonia?.campanha_nome && (
                <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                  🎯 {m.statusTelefonia.campanha_nome}
                </p>
              )}

              <div className="grid grid-cols-3 gap-1 text-center">
                <div className="rounded-lg bg-slate-800/60 py-1.5">
                  <p className="text-xs text-slate-500">Pendentes</p>
                  <p className="text-sm font-bold text-white">{m.pendentes}</p>
                </div>
                <div className={cn("rounded-lg py-1.5", m.atrasadas > 0 ? "bg-rose-500/20" : "bg-slate-800/60")}>
                  <p className="text-xs text-slate-500">Atrasadas</p>
                  <p className={cn("text-sm font-bold", m.atrasadas > 0 ? "text-rose-300" : "text-white")}>{m.atrasadas}</p>
                </div>
                <div className="rounded-lg bg-emerald-500/10 py-1.5">
                  <p className="text-xs text-slate-500">Concluídas</p>
                  <p className="text-sm font-bold text-emerald-300">{m.concluidasHoje}</p>
                </div>
              </div>

              {/* Progresso ligações do dia */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">Ligações hoje</span>
                  <span className="text-slate-400 font-medium">{m.ligacoesHoje} / 50</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      m.ligacoesHoje >= 50 ? "bg-emerald-400" :
                      m.ligacoesHoje >= 25 ? "bg-sky-400" :
                      m.ligacoesHoje >= 10 ? "bg-amber-400" : "bg-rose-400"
                    )}
                    style={{ width: `${Math.min(100, (m.ligacoesHoje / 50) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  {m.ultimaAtv
                    ? `Última ativ. ${formatDistanceToNow(new Date(m.ultimaAtv.created_date), { locale: ptBR, addSuffix: true })}`
                    : "Sem atividade hoje"
                  }
                </span>
                <span className="text-slate-400">{m.ligacoesHoje} lig.</span>
              </div>

              {m.semAtvidade1h && (
                <div className="flex items-center gap-1.5 text-xs text-orange-300 bg-orange-500/10 rounded-lg px-2 py-1">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  Inativo há mais de 1h
                </div>
              )}
              {m.statusTelefonia?.em_pausa && m.statusTelefonia?.duracao_ao_vivo > 900 && (
                <div className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-500/10 rounded-lg px-2 py-1">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  Em pausa há {Math.floor(m.statusTelefonia.duracao_ao_vivo / 60)} min
                </div>
              )}
            </div>
          ))}

          {dadosMembros.length === 0 && (
            <div className="col-span-full text-center py-8 text-slate-500 text-sm">
              Nenhum membro encontrado.
            </div>
          )}
        </div>
      </div>

      {leadsAlerta.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <h2 className="text-sm font-semibold text-white">Leads em Alerta</h2>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
              {leadsAlerta.length}
            </span>
          </div>

          <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 divide-y divide-slate-800/60">
            {leadsAlerta.map(({ lead, motivo, label, cor }) => (
              <div key={lead.id} className="flex items-center gap-3 px-4 py-3">
                <div className={cn(
                  "text-xs font-semibold px-2 py-0.5 rounded-full border flex-shrink-0",
                  cor === "rose"   && "bg-rose-500/20 border-rose-500/40 text-rose-300",
                  cor === "orange" && "bg-orange-500/20 border-orange-500/40 text-orange-300",
                  cor === "amber"  && "bg-amber-500/20 border-amber-500/40 text-amber-300",
                )}>
                  {label}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{lead.nome || "—"}</p>
                  <p className="text-xs text-slate-500">
                    {lead.sdr_responsavel || lead.sdr_email || "Sem dono"}
                    {lead.empresa ? ` · ${lead.empresa}` : ""}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <Select onValueChange={(novoEmail) => handleReatribuir(lead, novoEmail)}>
                    <SelectTrigger className="h-7 text-xs bg-slate-800/80 border-slate-700/60 text-slate-300 w-36 gap-1">
                      <ArrowRightLeft className="w-3 h-3 text-slate-400" />
                      <SelectValue placeholder="Reatribuir" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {membrosParaReatribuicao.map(v => (
                        <SelectItem key={v.userEmail} value={v.userEmail}>
                          {perfilPorEmail[v.userEmail?.toLowerCase()]?.user_name || v.userName?.trim() || v.userEmail.split("@")[0]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {agendaTime.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-white">Agenda do Time</h2>
            <span className="text-xs text-slate-500">Hoje e amanhã</span>
          </div>

          <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 divide-y divide-slate-800/60">
            {agendaTime.map(t => {
              const isReuniao = t.tipo === "reuniao";
              const data = new Date(t.data_prevista);
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-lg flex-shrink-0">{isReuniao ? "📅" : "🔔"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{t.lead_nome || "—"}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {perfilPorEmail[t.sdr_email?.toLowerCase()]?.user_name || t.sdr_email?.split("@")[0] || "—"} · {t.lead_empresa || ""}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={cn(
                      "text-xs font-medium",
                      isToday(data) ? "text-sky-300" : "text-slate-400"
                    )}>
                      {isToday(data) ? "Hoje" : "Amanhã"}
                    </p>
                    <p className="text-xs text-slate-500 capitalize">{t.tipo}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {membroDetalhe && membroDetalhe.statusTelefonia?.em_ligacao && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMembroDetalhe(null)} />
          <div className="relative z-10 w-full max-w-xs p-5 rounded-2xl bg-zinc-950 border border-sky-500/20 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-violet-500 flex items-center justify-center text-sm font-bold text-white">
                  {(membroDetalhe.nome || '?')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{membroDetalhe.nome}</p>
                  <p className="text-[10px] text-slate-500">{membroDetalhe.statusTelefonia?.campanha_nome || 'Sem campanha'}</p>
                </div>
              </div>
              <button onClick={() => setMembroDetalhe(null)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-500/10 border border-sky-500/20">
              <PhoneCall className="w-4 h-4 text-sky-400 animate-pulse" />
              <span className="text-xs text-sky-300">Em ligação</span>
              <span className="text-xs font-mono text-sky-400 ml-auto">
                {Math.floor((membroDetalhe.statusTelefonia?.duracao_ao_vivo || 0) / 60)}:{String((membroDetalhe.statusTelefonia?.duracao_ao_vivo || 0) % 60).padStart(2, '0')}
              </span>
            </div>
            <div className="text-xs text-slate-500 space-y-1">
              <p>📊 {membroDetalhe.ligacoesHoje} ligações hoje</p>
              <p>✅ {membroDetalhe.concluidasHoje} tarefas concluídas</p>
              <p>⏳ {membroDetalhe.pendentes} pendentes · {membroDetalhe.atrasadas} atrasadas</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}