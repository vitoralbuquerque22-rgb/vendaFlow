import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listarLeads } from "@/lib/services/leadService";
import { listarTarefas } from "@/lib/services/tarefaService";
import { listarCadencias } from "@/lib/services/cadenciaService";
import { listarVinculos, vinculosParaUsuarios, carregarMapaNomes } from "@/lib/services/equipeService";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { usePermissions } from "@/components/hooks/usePermissions";
import { format, isBefore, isToday, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Search, ChevronDown, ChevronUp, AlertTriangle, Clock, CheckCircle2, User, ExternalLink } from "lucide-react";
import ModalGestaoLead from "@/components/crm/ModalGestaoLead";
import { api } from "@/api/client";
import { toast } from "sonner";

const STATUS_LEAD = {
  em_cadencia:       { label: "Em cadência",      cor: "text-violet-300",  bg: "bg-violet-500/10 border-violet-500/20" },
  em_contato:        { label: "Em contato",       cor: "text-sky-300",     bg: "bg-sky-500/10 border-sky-500/20" },
  reuniao_agendada:  { label: "Reunião agendada", cor: "text-stone-300",   bg: "bg-stone-500/10 border-stone-500/20" },
  reuniao_realizada: { label: "Reunião realizada",cor: "text-orange-300",  bg: "bg-orange-500/10 border-orange-500/20" },
  proposta_enviada:  { label: "Proposta enviada", cor: "text-amber-300",   bg: "bg-amber-500/10 border-amber-500/20" },
  em_negociacao:     { label: "Em negociação",    cor: "text-yellow-300",  bg: "bg-yellow-500/10 border-yellow-500/20" },
  novo:              { label: "Novo",             cor: "text-slate-300",   bg: "bg-slate-700/40 border-slate-700/40" },
  qualificado:       { label: "Qualificado",      cor: "text-violet-300",  bg: "bg-violet-500/10 border-violet-500/20" },
  respondeu:         { label: "Respondeu",        cor: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-500/20" },
};

function badgeStatus(status) {
  const s = STATUS_LEAD[status];
  if (!s) return null;
  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium", s.cor, s.bg)}>
      {s.label}
    </span>
  );
}

function badgeTarefa(tarefa) {
  if (!tarefa) return <span className="text-[10px] text-slate-600">Sem tarefa</span>;
  const atrasada = isBefore(new Date(tarefa.data_prevista + "T12:00:00"), startOfDay(new Date())) && tarefa.status === "pendente";
  if (atrasada) return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 font-medium">
      <AlertTriangle className="w-2.5 h-2.5" /> Atrasada {format(new Date(tarefa.data_prevista + "T12:00:00"), "dd/MM", { locale: ptBR })}
    </span>
  );
  if (isToday(new Date(tarefa.data_prevista + "T12:00:00"))) return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300 font-medium">
      <Clock className="w-2.5 h-2.5" /> Hoje
    </span>
  );
  return (
    <span className="text-[10px] text-slate-500">
      {format(new Date(tarefa.data_prevista + "T12:00:00"), "dd/MM", { locale: ptBR })}
    </span>
  );
}

export default function PainelLeadsEmCadencia({ onAbrirLead }) {
  const { empresaId } = useEmpresaAtual();
  const { isAdmin, rawRole, user } = usePermissions();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [cadenciaFiltro, setCadenciaFiltro] = useState("todas");
  const [responsavelFiltro, setResponsavelFiltro] = useState("todos");
  const [expandido, setExpandido] = useState({});
  const [leadSelecionado, setLeadSelecionado] = useState(null);
  const podeRemover = isAdmin || rawRole === "admin" || rawRole === "gestor";

  const { data: leads = [] } = useQuery({
    queryKey: ["leads", "cadencia-ativa", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      // Busca direto por leads em cadência, sem carregar toda a base
      return api.entities.Lead.filter({ empresaId, cadencia_id: { $exists: true, $ne: null } }, "-updated_date", 500);
    },
    enabled: !!empresaId,
    refetchInterval: 60_000,
  });

  const { data: tarefas = [] } = useQuery({
    queryKey: ["tarefas", "supervisor", empresaId],
    queryFn: () => listarTarefas(empresaId, {}),
    enabled: !!empresaId,
    refetchInterval: 90_000,
  });

  const { data: cadencias = [] } = useQuery({
    queryKey: ["cadencias", empresaId],
    queryFn: () => listarCadencias(empresaId),
    enabled: !!empresaId,
  });

  const { data: vinculos = [] } = useQuery({
    queryKey: ["vinculos", empresaId],
    queryFn: () => listarVinculos(empresaId),
    enabled: !!empresaId,
  });

  const { data: mapaNomes = new Map() } = useQuery({
    queryKey: ["mapaNomes", empresaId],
    queryFn: () => carregarMapaNomes(empresaId),
    enabled: !!empresaId,
    staleTime: 120000,
  });

  const usuariosPorEmail = useMemo(() => {
    const usuarios = vinculosParaUsuarios(vinculos, mapaNomes);
    return Object.fromEntries(usuarios.map(u => [u.email, u.full_name]));
  }, [vinculos, mapaNomes]);

  const nomeAgente = (email) => {
    if (!email) return "Sem responsável";
    return usuariosPorEmail[email] || mapaNomes.get(email.toLowerCase()) || email.split("@")[0];
  };

  const leadsEmCadencia = useMemo(() => {
    const statusExcluidos = ["desqualificado", "sem_interesse", "fechado"];
    return leads.filter(l => l.cadencia_id && !statusExcluidos.includes(l.status));
  }, [leads]);

  const proximaTarefaPorLead = useMemo(() => {
    const idx = {};
    tarefas
      .filter(t => t.status === "pendente")
      .sort((a, b) => new Date(a.data_prevista) - new Date(b.data_prevista))
      .forEach(t => { if (!idx[t.lead_id]) idx[t.lead_id] = t; });
    return idx;
  }, [tarefas]);

  const tarefasPorLead = useMemo(() => {
    const idx = {};
    tarefas.filter(t => t.status === "pendente").forEach(t => {
      if (!idx[t.lead_id]) idx[t.lead_id] = [];
      idx[t.lead_id].push(t);
    });
    return idx;
  }, [tarefas]);

  const responsaveis = useMemo(() => {
    const set = new Set();
    leadsEmCadencia.forEach(l => { if (l.sdr_responsavel) set.add(l.sdr_responsavel); });
    return Array.from(set).sort();
  }, [leadsEmCadencia]);

  const leadsFiltrados = useMemo(() => {
    return leadsEmCadencia.filter(l => {
      const termo = busca.toLowerCase();
      const termoDigitos = termo.replace(/\D/g, "");
      const buscaOk = !busca || l.nome?.toLowerCase().includes(termo) || l.empresa?.toLowerCase().includes(termo) || l.sdr_responsavel?.toLowerCase().includes(termo) || (!!termoDigitos && l.telefone?.replace(/\D/g, "").includes(termoDigitos));
      const cadOk = cadenciaFiltro === "todas" || l.cadencia_id === cadenciaFiltro;
      const respOk = responsavelFiltro === "todos" || l.sdr_responsavel === responsavelFiltro;
      return buscaOk && cadOk && respOk;
    });
  }, [leadsEmCadencia, busca, cadenciaFiltro, responsavelFiltro]);

  const comAtrasada = leadsFiltrados.filter(l => {
    const t = proximaTarefaPorLead[l.id];
    return t && isBefore(new Date(t.data_prevista + "T12:00:00"), startOfDay(new Date()));
  });

  const porCadencia = useMemo(() => {
    const grupos = {};
    leadsFiltrados.forEach(l => {
      const cid = l.cadencia_id || "__sem__";
      if (!grupos[cid]) grupos[cid] = [];
      grupos[cid].push(l);
    });
    return grupos;
  }, [leadsFiltrados]);

  const nomeCadencia = (id) => cadencias.find(c => c.id === id)?.nome || "Sem cadência";

  const toggleExpandido = (id) => setExpandido(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="flex flex-col h-full bg-slate-900/50 border border-slate-800/60 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800/60 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-bold text-white">Leads em Cadência</h2>
          <div className="flex items-center gap-2">
            {comAtrasada.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 font-semibold">
                {comAtrasada.length} atrasados
              </span>
            )}
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 font-semibold">
              {leadsFiltrados.length} leads
            </span>
          </div>
        </div>
        <p className="text-[11px] text-slate-500">Leads com cadência ativa e responsável</p>
      </div>

      {/* Filtros */}
      <div className="px-3 py-2 border-b border-slate-800/40 space-y-2 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar lead, empresa, telefone..."
            className="w-full pl-7 pr-3 py-1.5 bg-slate-800/60 border border-slate-700/60 text-white text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500/50 placeholder:text-slate-600"
          />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <select
            value={cadenciaFiltro}
            onChange={e => setCadenciaFiltro(e.target.value)}
            className="w-full bg-slate-800/60 border border-slate-700/60 text-slate-300 text-[11px] rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
          >
            <option value="todas">Todas cadências</option>
            {cadencias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <select
            value={responsavelFiltro}
            onChange={e => setResponsavelFiltro(e.target.value)}
            className="w-full bg-slate-800/60 border border-slate-700/60 text-slate-300 text-[11px] rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
          >
            <option value="todos">Todos SDRs</option>
            {responsaveis.map(r => <option key={r} value={r}>{nomeAgente(r)}</option>)}
          </select>
        </div>
      </div>

      {/* Lista agrupada por cadência */}
      <div className="flex-1 overflow-y-auto">
        {leadsFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <CheckCircle2 className="w-8 h-8 text-slate-700 mb-2" />
            <p className="text-slate-500 text-xs">Nenhum lead em cadência ativa</p>
          </div>
        ) : (
          Object.entries(porCadencia).map(([cadId, leadsGrupo]) => {
            const nome = nomeCadencia(cadId);
            const aberto = expandido[cadId] !== false;
            const atrasadosGrupo = leadsGrupo.filter(l => {
              const t = proximaTarefaPorLead[l.id];
              return t && isBefore(new Date(t.data_prevista + "T12:00:00"), startOfDay(new Date()));
            });

            return (
              <div key={cadId} className="border-b border-slate-800/40 last:border-0">
                <button
                  onClick={() => toggleExpandido(cadId)}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/3 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] font-semibold text-violet-300 truncate">{nome}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-400 flex-shrink-0">
                      {leadsGrupo.length}
                    </span>
                    {atrasadosGrupo.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 flex-shrink-0">
                        ⚠ {atrasadosGrupo.length}
                      </span>
                    )}
                  </div>
                  {aberto
                    ? <ChevronUp className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                    : <ChevronDown className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />}
                </button>

                {aberto && (
                  <div className="px-2 pb-2 space-y-1.5">
                    {leadsGrupo.map(lead => {
                      const proxTarefa = proximaTarefaPorLead[lead.id];
                      const qtdTarefas = tarefasPorLead[lead.id]?.length || 0;
                      const atrasada = proxTarefa && isBefore(new Date(proxTarefa.data_prevista + "T12:00:00"), startOfDay(new Date()));

                      return (
                        <div
                          key={lead.id}
                          onClick={() => onAbrirLead ? onAbrirLead(lead) : setLeadSelecionado(lead)}
                          className={cn(
                            "rounded-xl border px-3 py-2.5 space-y-1.5 transition-colors cursor-pointer hover:border-slate-500/60",
                            atrasada
                              ? "bg-rose-500/5 border-rose-500/20"
                              : "bg-slate-800/30 border-slate-700/40"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white truncate">{lead.nome || "—"}</p>
                              {lead.empresa && <p className="text-[10px] text-slate-500 truncate">{lead.empresa}</p>}
                            </div>
                            {badgeStatus(lead.status)}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <User className="w-3 h-3 text-slate-600 flex-shrink-0" />
                            <span className="text-[10px] text-slate-400 truncate">
                              {nomeAgente(lead.sdr_responsavel)}
                            </span>
                            {lead.closer_responsavel && (
                              <span className="text-[10px] text-slate-500 truncate">
                                · closer: {nomeAgente(lead.closer_responsavel)}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-600">Próxima:</span>
                              {proxTarefa ? (
                                <span className="text-[10px] text-slate-400 capitalize">
                                  {proxTarefa.tipo?.replace(/_/g, " ")}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-600">—</span>
                              )}
                            </div>
                            {badgeTarefa(proxTarefa)}
                          </div>

                          <div className="flex items-center justify-between pt-0.5">
                            <span className="text-[10px] text-slate-600">
                              {qtdTarefas} tarefa{qtdTarefas !== 1 ? "s" : ""} pendente{qtdTarefas !== 1 ? "s" : ""}
                            </span>
                            {lead.updated_date && (
                              <span className="text-[10px] text-slate-600">
                                Atualizado {format(new Date(lead.updated_date), "dd/MM", { locale: ptBR })}
                              </span>
                            )}
                          </div>

                          {podeRemover && (
                            <div className="pt-1 border-t border-slate-700/40" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  if (onAbrirLead) onAbrirLead(lead, 'transferir');
                                  else setLeadSelecionado(lead);
                                }}
                                className="w-full flex items-center justify-center gap-1.5 text-[10px] py-1 rounded-lg bg-slate-700/40 border border-slate-600/30 text-slate-400 hover:bg-sky-500/10 hover:border-sky-500/30 hover:text-sky-300 transition-colors"
                              >
                                <ExternalLink className="w-2.5 h-2.5" /> Gerenciar Lead
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {!onAbrirLead && leadSelecionado && (
        <ModalGestaoLead lead={leadSelecionado} onClose={() => setLeadSelecionado(null)} />
      )}
    </div>
  );
}