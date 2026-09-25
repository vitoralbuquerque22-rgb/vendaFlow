import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { listarLeads, buscarLeadPorId, atualizarLead } from "@/lib/services/leadService";
import {
  listarTarefas, criarTarefa, atualizarTarefa,
  buscarTarefasPendentesDoLead, encerrarTarefasAutomaticamente, criarTarefasDaCadencia,
} from "@/lib/services/tarefaService";
import { listarAtividades, criarAtividade } from "@/lib/services/atividadeService";
import { listarVinculos, vinculosParaUsuarios } from "@/lib/services/equipeService";
import { buscarCadenciaPorId, listarCadencias } from "@/lib/services/cadenciaService";
import { listarScripts } from "@/lib/services/scriptService";
import { buscarProdutoPorId } from "@/lib/services/produtoService";
import { notificarGestores } from "@/lib/services/alertaService";
import { criarEventoComMeet, isConnected as isGCalConnected } from "@/lib/services/googleCalendarService";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { usePermissions } from "@/components/hooks/usePermissions";
import { useTelefonia } from "@/contexts/TelefoniaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Phone, MessageCircle, Mail, Search, Clock, Sun, Sunset, CheckCircle2, AlertCircle, RefreshCw, ChevronDown, ChevronUp, User, Shield, Target } from "lucide-react";
import ButtonAtualizar from "@/components/ui/ButtonAtualizar";
import { format as formatDate } from "date-fns";
import TaskCard from "@/components/crm/TaskCard";
import ExecutarAtividadeModal from "@/components/crm/ExecutarAtividadeModal/index";
import PainelSupervisor from "@/components/crm/PainelSupervisor";
import PipelineCloser from "@/components/crm/PipelineCloser";

import { format, isToday, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import IniciarCadenciaModal from "@/components/crm/IniciarCadenciaModal";
import PainelLeadsEmCadencia from "@/components/crm/PainelLeadsEmCadencia";
import ModalGestaoLead from "@/components/crm/ModalGestaoLead";
import { cn } from "@/lib/utils";

const parseLocal = (str) => {
  if (!str) return new Date();
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
};

function formatarTelefoneAcomp(tel) {
  if (!tel) return '';
  const digits = String(tel).replace(/\D/g, '');
  if (digits.length === 11) return `(${digits.slice(0,2)}) ${digits[2]} ${digits.slice(3,7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  return tel;
}

function PainelLeadsAcompanhamento({ empresaId }) {
  const { data: todosLeads = [] } = useQuery({
    queryKey: ["leads-acompanhamento", empresaId],
    queryFn: () => listarLeads(empresaId),
    enabled: !!empresaId,
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["colaboradores-acompanhamento", empresaId],
    queryFn: async () => {
      const result = await base44.functions.invoke('buscarColaboradoresEmpresa', { empresaId });
      return result?.data?.colaboradores || [];
    },
    enabled: !!empresaId,
  });

  const leadsCloser = todosLeads.filter(l =>
    ["reuniao_agendada", "reuniao_realizada"].includes(l.status)
  );

  return (
    <div className="space-y-4 mt-4">
      {/* Pipeline do Closer */}
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-violet-400">🤝</span>
          <h3 className="text-sm font-bold text-violet-300">Pipeline do Closer</h3>
          <span className="text-xs bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full border border-violet-500/30">
            {leadsCloser.length}
          </span>
        </div>
        <p className="text-xs text-slate-500 mb-3">Leads com reunião agendada ou realizada</p>
        {leadsCloser.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-3">Nenhum lead no pipeline do closer</p>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {leadsCloser.map(lead => (
              <div key={lead.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-700/40">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{lead.nome}</p>
                  <p className="text-xs text-slate-500">
                    {formatarTelefoneAcomp(lead.telefone)} · Closer: {colaboradores.find(c => c.email === lead.closer_responsavel)?.nome || lead.closer_responsavel?.split("@")[0] || '—'}
                    {lead.data_reuniao ? ` · ${lead.status === 'reuniao_agendada' ? 'Reunião' : 'Realizada'}: ${new Date(lead.data_reuniao).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})} às ${new Date(lead.data_reuniao).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}` : ''}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded border ${
                  lead.status === 'reuniao_agendada'
                    ? 'text-stone-300 bg-stone-500/10 border-stone-500/20'
                    : 'text-orange-300 bg-orange-500/10 border-orange-500/20'
                }`}>
                  {lead.status === 'reuniao_agendada' ? 'Agendada' : 'Realizada'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ModoToggle({ modoAtivo, onToggle }) {
  const isSupervisor = modoAtivo === "supervisor";
  return (
    <button
      onClick={() => onToggle(isSupervisor ? "closer" : "supervisor")}
      className="relative flex items-center rounded-full p-1 border border-white/10 overflow-hidden"
      style={{
        width: 210,
        height: 40,
        background: isSupervisor
          ? "linear-gradient(90deg, rgba(139,92,246,0.18), rgba(124,58,237,0.12))"
          : "linear-gradient(90deg, rgba(245,158,11,0.18), rgba(249,115,22,0.12))",
        transition: "background 0.4s ease",
      }}
    >
      <motion.div
        className="absolute top-1 bottom-1 rounded-full shadow-lg"
        animate={{ left: isSupervisor ? 4 : 105 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        style={{
          width: 101,
          background: isSupervisor
            ? "linear-gradient(135deg, #8b5cf6, #7c3aed)"
            : "linear-gradient(135deg, #f59e0b, #f97316)",
        }}
      />
      <div className="relative z-10 flex items-center justify-center gap-1.5" style={{ width: 101 }}>
        <Shield className="w-3.5 h-3.5" style={{ color: isSupervisor ? "#fff" : "#94a3b8" }} />
        <span className="text-xs font-semibold" style={{ color: isSupervisor ? "#fff" : "#94a3b8" }}>Supervisor</span>
      </div>
      <div className="relative z-10 flex items-center justify-center gap-1.5" style={{ width: 101 }}>
        <Target className="w-3.5 h-3.5" style={{ color: !isSupervisor ? "#fff" : "#94a3b8" }} />
        <span className="text-xs font-semibold" style={{ color: !isSupervisor ? "#fff" : "#94a3b8" }}>Closer</span>
      </div>
    </button>
  );
}

export default function Tarefas() {
  const [periodo, setPeriodo] = useState("manha");
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [vendedorFiltro, setVendedorFiltro] = useState("todos");
  const [proximoContatoFiltro, setProximoContatoFiltro] = useState("abertos");
  const [expandedCardId, setExpandedCardId] = useState(null);

  const [tarefaSelecionada, setTarefaSelecionada] = useState(null);
  const [scriptUsado, setScriptUsado] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalMinimizado, setModalMinimizado] = useState(false);
  const [modalCadenciaAberto, setModalCadenciaAberto] = useState(false);
  const [tarefaParaCadencia, setTarefaParaCadencia] = useState(null);
  const [tarefaConcluidaModal, setTarefaConcluidaModal] = useState(null);
  const [totalBusca, setTotalBusca] = useState("");
  const [totalDataFiltro, setTotalDataFiltro] = useState("");
  const [totalPagina, setTotalPagina] = useState(1);
  const TOTAL_POR_PAGINA = 10;
  const [secaoColapsada, setSecaoColapsada] = useState({});

  const queryClient = useQueryClient();
  const { empresaId } = useEmpresaAtual();

  const telefonia = useTelefonia();

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const { effectiveRole, isAdmin, isGestor, userProfile, nivel } = usePermissions();
  const isGestorOrAdmin = nivel >= 4;
  const isCloser = effectiveRole === "closer" || effectiveRole === "cs";

  // ── Modo Supervisor / Closer ──────────────────────────────────
  const [modoAtivo, setModoAtivo] = useState("supervisor");
  const modoHidratado = useRef(false);

  useEffect(() => {
    if (userProfile && !modoHidratado.current) {
      setModoAtivo(userProfile.modo_ativo || "supervisor");
      modoHidratado.current = true;
    }
  }, [userProfile]);

  const handleTrocarModo = async (novoModo) => {
    if (novoModo === modoAtivo) return;
    setModoAtivo(novoModo);
    if (novoModo === "closer") {
      toast.success("Modo Closer ativado — você agora recebe leads");
    } else {
      toast.success("Modo Supervisor ativado — painel da equipe");
    }
    if (userProfile?.id) {
      try {
        await base44.entities.UserProfile.update(userProfile.id, { modo_ativo: novoModo });
      } catch (e) {
        console.warn("[Tarefas] Falha ao salvar modo_ativo:", e.message);
      }
    }
  };

  const gestorComoCloser = isGestorOrAdmin && modoAtivo === "closer";
  const operaComoSDR = !isGestorOrAdmin || gestorComoCloser;

  const { data: tarefas = [], isLoading } = useQuery({
    queryKey: ["tarefas", effectiveRole, user?.email, empresaId, gestorComoCloser],
    queryFn: () => listarTarefas(empresaId, { apenasDoSDR: !isGestorOrAdmin || gestorComoCloser, sdrEmail: user?.email }),
    enabled: !!user?.email && !!empresaId,
  });

  const { data: scripts = [] } = useQuery({
    queryKey: ["scripts", empresaId],
    queryFn: () => listarScripts(empresaId),
    enabled: !!empresaId,
  });

  const { data: atividades = [] } = useQuery({
    queryKey: ["atividades", empresaId],
    queryFn: () => listarAtividades(empresaId),
    enabled: !!empresaId,
  });

  const { data: vinculos = [] } = useQuery({
    queryKey: ["vinculos", empresaId],
    queryFn: () => listarVinculos(empresaId),
    enabled: !!empresaId && isGestorOrAdmin,
  });

  const { data: userProfilesTabela = [] } = useQuery({
    queryKey: ["user-profiles-tarefas", empresaId],
    queryFn: () => base44.entities.UserProfile.filter({ empresaId }),
    enabled: !!empresaId,
    staleTime: 5 * 60_000,
  });
  const perfilPorEmailTabela = useMemo(() => {
    const mapa = {};
    userProfilesTabela.forEach(p => { if (p.user_email) mapa[p.user_email.toLowerCase()] = p; });
    return mapa;
  }, [userProfilesTabela]);

  const usuarios = vinculosParaUsuarios(vinculos).map(u => ({
    ...u,
    full_name: perfilPorEmailTabela[u.email?.toLowerCase()]?.user_name || u.full_name,
  }));

  const { data: leadsSDR = [] } = useQuery({
    queryKey: ["leadsSDR", empresaId, user?.email],
    queryFn: () => listarLeads(empresaId, { sdr_email: user?.email }),
    enabled: !!empresaId && !!user?.email && (!isGestorOrAdmin || gestorComoCloser),
  });

  const { data: cadencias = [] } = useQuery({
    queryKey: ["cadencias", empresaId],
    queryFn: () => listarCadencias(empresaId, { apenasAtivas: false }),
    enabled: !!empresaId,
  });

  const { data: leadAtivo } = useQuery({
    queryKey: ["leadAtivo", telefonia.callSession?.lead_id],
    queryFn: () => buscarLeadPorId(telefonia.callSession?.lead_id),
    enabled: !!telefonia.callSession?.lead_id && telefonia.modalAtendimentoAberto,
  });

  const criarAtividadeMutation = useMutation({
    mutationFn: (data) => criarAtividade(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["atividades"] });
    },
  });

  const atualizarTarefaMutation = useMutation({
    mutationFn: ({ id, data }) => atualizarTarefa(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      toast.success("Tarefa concluída!");
    },
  });

  const atualizarLeadMutation = useMutation({
    mutationFn: ({ id, data }) => atualizarLead(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  // Tarefa é um próximo contato agendado futuro → fica na aba separada, nunca na fila operacional
  const isProximoContatoFuturo = (t) =>
    t.origem === "proximo_contato" &&
    t.status === "pendente" &&
    !isToday(parseLocal(t.data_prevista)) &&
    !isBefore(parseLocal(t.data_prevista), startOfDay(new Date()));

  const isProximoContato = (t) => t.motivo_encerramento === 'conversao' && t.status === 'pendente';

  const minhasTarefas = tarefas.filter((t) => {
    const periodoOk = t.periodo === periodo;
    const vendedorOk = !isGestorOrAdmin || vendedorFiltro === "todos" || t.sdr_email === vendedorFiltro;

    if (statusFiltro === "concluidas") {
      const concluidaHoje = t.status === "concluida" && isToday(new Date(t.updated_date || t.created_date));
      return concluidaHoje && periodoOk && vendedorOk;
    }

    if (statusFiltro === "concluidas_total") {
      return (t.status === "concluida" || t.status === "encerrada_automaticamente") && vendedorOk;
    }

    if (statusFiltro === "proximo_contato") {
      const isAberto = t.status === "pendente";
      const isFechado = t.status === "concluida";
      const filtroOk = proximoContatoFiltro === "abertos" ? isAberto : proximoContatoFiltro === "fechados" ? isFechado : true;
      return isProximoContato(t) && vendedorOk && filtroOk;
    }

    // Tarefas de próximo contato futuro vão para o painel dedicado — nunca aqui
    if (isProximoContatoFuturo(t)) return false;

    const pendente = t.status === "pendente";
    const hojeOuAtrasada = isToday(parseLocal(t.data_prevista)) || isBefore(parseLocal(t.data_prevista), startOfDay(new Date()));

    const dataAtual = startOfDay(new Date());
    const dataTarefa = parseLocal(t.data_prevista);
    const estaAtrasada = isBefore(dataTarefa, dataAtual) && t.status === "pendente" && !isProximoContato(t);

    const statusOk = statusFiltro === "todos" ||
                     (statusFiltro === "atrasado" && estaAtrasada) ||
                     (statusFiltro === "em_dia" && (!estaAtrasada || isProximoContato(t)));

    // Para tarefas pendentes ativas: ignora filtro de período para nunca esconder trabalho
    return pendente && hojeOuAtrasada && statusOk && vendedorOk;
  });

  const tarefasAtrasadas = minhasTarefas.filter((t) =>
    isBefore(parseLocal(t.data_prevista), startOfDay(new Date())) && t.status === "pendente"
  );
  const tarefasHoje = minhasTarefas.filter((t) => isToday(parseLocal(t.data_prevista)));

  const handleExecutar = (tarefa, script) => {
    setTarefaSelecionada(tarefa);
    setScriptUsado(script);
    setModalAberto(true);
  };

  const handleSalvarAtividade = async (dados) => {
    const produtoNome = dados.produto_id
      ? ((await buscarProdutoPorId(empresaId, dados.produto_id))?.nome || "")
      : "";

    await criarAtividadeMutation.mutateAsync({
      empresaId,
      lead_id: tarefaSelecionada.lead_id,
      lead_nome: tarefaSelecionada.lead_nome,
      sdr_email: user?.email,
      tipo: tarefaSelecionada.tipo,
      resultado: dados.resultado,
      observacao: dados.observacao,
      duracao_segundos: dados.duracao_segundos,
      script_usado: dados.script_usado,
      dia_cadencia: tarefaSelecionada.dia_cadencia,
      periodo: tarefaSelecionada.periodo,
      campanha: tarefaSelecionada.campanha,
      equipe: tarefaSelecionada.equipe,
      produto_id: dados.produto_id || tarefaSelecionada.produto_id || "",
      produto_nome: produtoNome || tarefaSelecionada.produto_nome || "",
    });

    await atualizarTarefaMutation.mutateAsync({
      id: tarefaSelecionada.id,
      data: { status: "concluida" },
    });

    const PROGRESSAO_STATUS = ['novo', 'em_contato', 'em_negociacao', 'reuniao_agendada', 'proposta_enviada', 'fechado'];
    const mapaResultadoStatus = {
      'atendeu':          'em_contato',
      'respondeu':        'em_contato',
      'interesse':        'em_negociacao',
      'proposta':         'em_negociacao',
      'proposta_enviada': 'proposta_enviada',
    };
    const novoStatus = mapaResultadoStatus[dados.resultado];
    if (novoStatus && tarefaSelecionada.lead_id) {
      try {
        const leadAtual = await buscarLeadPorId(tarefaSelecionada.lead_id);
        const idxAtual = PROGRESSAO_STATUS.indexOf(leadAtual?.status || 'novo');
        const idxNovo  = PROGRESSAO_STATUS.indexOf(novoStatus);
        if (idxNovo > idxAtual) {
          await atualizarLeadMutation.mutateAsync({ id: tarefaSelecionada.lead_id, data: { status: novoStatus } });
        }
      } catch (e) { console.warn('[Tarefas] update lead status:', e.message); }
    }

    try {
      await notificarGestores(empresaId, vinculos, {
        titulo: `Tarefa concluída — ${user?.full_name || user?.email}`,
        mensagem: `Lead: ${tarefaSelecionada.lead_nome || 'Não identificado'} · Resultado: ${dados.resultado}${dados.observacao ? ` · Obs: ${dados.observacao.substring(0, 80)}` : ''}`,
        usuarioReferencia: user?.email,
      });
    } catch (e) { console.warn('[Tarefas] notificação gestor:', e.message); }

    if (dados.perfil_data) {
      const camposPerfil = {};
      const campos = ['cidade', 'estado', 'qtd_tecnicos', 'qtd_vendedores', 'qtd_administrativo',
        'contratou_consultoria', 'tempo_seguindo', 'qtd_unidades', 'tipo_rede',
        'tem_socios', 'nome_socio', 'telefone_socio', 'ja_cliente', 'produtos_comprados'];
      campos.forEach(campo => {
        const val = dados.perfil_data[campo];
        if (val !== null && val !== undefined && val !== "") camposPerfil[campo] = val;
      });
      if (Object.keys(camposPerfil).length > 0) {
        await atualizarLeadMutation.mutateAsync({ id: tarefaSelecionada.lead_id, data: camposPerfil });
      }
    }

    if (dados.status_lead === 'sem_interesse' || dados.status_lead === 'desqualificado') {
      await atualizarLeadMutation.mutateAsync({
        id: tarefaSelecionada.lead_id,
        data: {
          status: dados.status_lead,
          observacoes: dados.motivo_desqualificacao || dados.observacao,
        },
      });

      const tarefasFrescasDeseq = await buscarTarefasPendentesDoLead(empresaId, tarefaSelecionada.lead_id);
      const tarefasFuturas = tarefasFrescasDeseq.filter(t => t.id !== tarefaSelecionada.id);
      await encerrarTarefasAutomaticamente(
        tarefasFuturas,
        dados.status_lead === 'sem_interesse' ? 'sem_interesse' : 'desqualificacao'
      );

      toast.success(`Lead desqualificado e ${tarefasFuturas.length} tarefa(s) futura(s) encerrada(s) automaticamente`);
      return;
    }

    if (dados.agendar_reuniao) {
      if (!dados.data_reuniao || !dados.closer_email) {
        toast.error("Preencha a data e selecione um closer para agendar a reunião.");
        return;
      }
    }

    if (dados.agendar_reuniao && dados.data_reuniao && dados.closer_email) {
      // Usar link Meet já criado no wizard, ou tentar criar automaticamente
      let meetLink = dados.meet_link || "";
      let calendarEventId = dados.calendar_event_id || "";

      if (!meetLink && isGCalConnected()) {
        try {
          const leadNome = tarefaSelecionada.lead_nome || "Lead";
          const resultado = await criarEventoComMeet({
            titulo: `Reunião VendaFLOW — ${leadNome}`,
            descricao: `Reunião agendada pelo VendaFLOW\nLead: ${leadNome}\nResponsável: ${dados.closer_email}`,
            dataHoraInicio: dados.data_reuniao,
            participantes: [
              { email: dados.closer_email },
              ...(user?.email ? [{ email: user.email }] : []),
            ],
          });
          meetLink = resultado.meetLink || resultado.hangoutLink || "";
          calendarEventId = resultado.eventId || "";
        } catch (e) {
          console.warn("[Tarefas] Falha ao criar evento Google Calendar:", e.message);
        }
      }

      const leadInfo = await buscarLeadPorId(tarefaSelecionada.lead_id);
      const cadenciaSDR = leadInfo?.cadencia_id
        ? await buscarCadenciaPorId(leadInfo.cadencia_id)
        : null;

      // ── 1. Encerrar TODAS as tarefas pendentes do lead ANTES de qualquer update ou criação
      // Isso evita que tarefas da cadência SDR sobrevivam à transição para reunião agendada
      const tarefasAntesReuniao = await buscarTarefasPendentesDoLead(empresaId, tarefaSelecionada.lead_id);
      await encerrarTarefasAutomaticamente(tarefasAntesReuniao, "reuniao_agendada");

      // ── 2. Atualizar o lead para reuniao_agendada
      await atualizarLeadMutation.mutateAsync({
        id: tarefaSelecionada.lead_id,
        data: {
          status: "reuniao_agendada",
          data_reuniao: dados.data_reuniao,
          closer_responsavel: dados.closer_email,
        },
      });

      let observacaoExtra = "";
      const cadenciaCloserId = dados.cadencia_closer_id || cadenciaSDR?.cadencia_closer_id || null;
      if (cadenciaCloserId) {
        const cadenciaCloser = await buscarCadenciaPorId(cadenciaCloserId);
        if (cadenciaCloser) {
          await atualizarLeadMutation.mutateAsync({
            id: tarefaSelecionada.lead_id,
            data: {
              cadencia_id: cadenciaCloser.id,
              dia_cadencia: 1,
              data_inicio_cadencia: dados.data_reuniao.split('T')[0],
            },
          });

          await criarTarefasDaCadencia(
            empresaId,
            tarefaSelecionada,
            dados.closer_email,
            cadenciaCloser,
            new Date(dados.data_reuniao.split('T')[0]),
            { produto_id: dados.produto_id, produto_nome: produtoNome }
          );

          observacaoExtra = `\n\n🤖 Cadência de Closer "${cadenciaCloser.nome}" iniciada automaticamente`;
        }
      }

      const dataReuniao = new Date(dados.data_reuniao);
      const periodoReuniao = dataReuniao.getHours() < 13 ? "manha" : "tarde";

      await criarTarefa({
        empresaId,
        lead_id: tarefaSelecionada.lead_id,
        lead_nome: tarefaSelecionada.lead_nome,
        lead_telefone: tarefaSelecionada.lead_telefone,
        lead_empresa: tarefaSelecionada.lead_empresa,
        sdr_email: dados.closer_email,
        tipo: "reuniao",
        data_prevista: dados.data_reuniao.split('T')[0],
        periodo: periodoReuniao,
        status: "pendente",
        campanha: tarefaSelecionada.campanha,
        equipe: tarefaSelecionada.equipe,
        produto_id: dados.produto_id || tarefaSelecionada.produto_id || "",
        produto_nome: produtoNome || tarefaSelecionada.produto_nome || "",
        google_calendar_event_id: calendarEventId || undefined,
        observacao: `Reunião agendada por ${user?.full_name || user?.email}

        📅 Horário: ${formatDate(dataReuniao, "dd/MM/yyyy 'às' HH:mm")}
        🔗 Link: ${meetLink || "(link não gerado)"}
        ${observacaoExtra || '\n⚠️ Atenção: Nenhuma cadência de Closer foi vinculada. Aceite esta tarefa e escolha uma cadência para iniciar.'}

        📋 Dados do Lead:
- Nome: ${leadInfo?.nome || tarefaSelecionada.lead_nome}
- Telefone: ${leadInfo?.telefone || tarefaSelecionada.lead_telefone}
- E-mail: ${leadInfo?.email || 'Não informado'}
- Empresa: ${leadInfo?.empresa || tarefaSelecionada.lead_empresa || 'Não informado'}
- Origem: ${leadInfo?.origem || 'Não informado'}
- Produto de Interesse: ${produtoNome || 'Não informado'}

💬 Observações do SDR:
${dados.observacao || 'Nenhuma observação adicional'}

📝 Respostas do Formulário:
${leadInfo?.respostas_formulario || 'Não disponível'}`,
      });

      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["proximos-contatos"] });
      const msgCadencia = cadenciaCloserId ? "Cadência de Closer iniciada." : "Sem novas tarefas até selecionar uma cadência.";
      toast.success(`Reunião agendada! ${meetLink ? "Link Meet gerado ✓" : "Sem link Meet."} ${tarefasAntesReuniao.length} tarefa(s) encerrada(s). ${msgCadencia}`);
      return;
    }

    if (dados.agendar_proximo_contato && dados.data_proximo_contato) {
      const dataProximoContato = new Date(dados.data_proximo_contato);

      const tarefasFrescasProximo = await buscarTarefasPendentesDoLead(empresaId, tarefaSelecionada.lead_id);
      await encerrarTarefasAutomaticamente(tarefasFrescasProximo, "followup_agendado");

      const periodoHora = dataProximoContato.getHours() < 13 ? "manha" : "tarde";
       await criarTarefa({
         empresaId,
         lead_id: tarefaSelecionada.lead_id,
         lead_nome: tarefaSelecionada.lead_nome,
         lead_telefone: tarefaSelecionada.lead_telefone,
         lead_empresa: tarefaSelecionada.lead_empresa,
         sdr_email: user?.email,
         tipo: dados.tipo_proximo_contato,
         data_prevista: dados.data_proximo_contato.split('T')[0],
         periodo: periodoHora,
         status: "pendente",
         dia_cadencia: tarefaSelecionada.dia_cadencia,
         cadencia_id: tarefaSelecionada.cadencia_id,
         campanha: tarefaSelecionada.campanha,
         equipe: tarefaSelecionada.equipe,
         produto_id: dados.produto_id || tarefaSelecionada.produto_id || "",
         produto_nome: produtoNome || tarefaSelecionada.produto_nome || "",
         origem: "proximo_contato",
       });

      // Registrar no histórico do lead
      const dataFormatada = dataProximoContato.toLocaleDateString('pt-BR');
      const horaFormatada = dataProximoContato.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      await criarAtividadeMutation.mutateAsync({
        empresaId,
        lead_id: tarefaSelecionada.lead_id,
        lead_nome: tarefaSelecionada.lead_nome,
        sdr_email: user?.email,
        tipo: 'anotacao',
        resultado: 'agendamento',
        observacao: `📅 Próximo contato agendado: ${dados.tipo_proximo_contato || 'contato'} em ${dataFormatada} às ${horaFormatada} — ${periodoHora} · Responsável: ${user?.full_name || user?.email}`,
      });

      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["proximos-contatos"] });
      toast.success(`Próximo contato agendado! ${tarefasFrescasProximo.length} tarefa(s) encerrada(s)`);
      return;
    }

    if (dados.resultado === 'nao_atendeu' || dados.resultado === 'nao_respondeu' || dados.resultado === 'caixa_postal') {
      const atividadesDoLead = atividades
        .filter(a => a.lead_id === tarefaSelecionada.lead_id)
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

      const seteDiasAtras = new Date();
      seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

      const houveResposta = atividadesDoLead.some(a => {
        const dataAtividade = new Date(a.created_date);
        return dataAtividade >= seteDiasAtras &&
               (a.resultado === 'atendeu' || a.resultado === 'respondeu');
      });

      let tentativasSemResposta = 1;
      for (const ativ of atividadesDoLead) {
        if (ativ.resultado === 'atendeu' || ativ.resultado === 'respondeu') {
          break;
        }
        if (ativ.tipo === 'ligacao' || ativ.tipo === 'whatsapp') {
          tentativasSemResposta++;
        }
      }

      if (!houveResposta && tentativasSemResposta >= 7) {
        await atualizarLeadMutation.mutateAsync({
          id: tarefaSelecionada.lead_id,
          data: {
            status: 'desqualificado',
            observacoes: `Desqualificado automaticamente: ${tentativasSemResposta} tentativas de contato sem resposta em 7 dias`,
          },
        });
        toast.warning("Lead desqualificado automaticamente por falta de resposta");
      }
    }
  };

  const handleIniciarCadencia = (tarefa) => {
    setTarefaParaCadencia(tarefa);
    setModalCadenciaAberto(true);
  };

  const handleSalvarCadencia = async (cadenciaId) => {
    const cadencia = await buscarCadenciaPorId(cadenciaId);
    if (!cadencia) return;

    await atualizarLeadMutation.mutateAsync({
      id: tarefaParaCadencia.lead_id,
      data: {
        cadencia_id: cadencia.id,
        dia_cadencia: 1,
        data_inicio_cadencia: new Date().toISOString().split("T")[0],
        sdr_responsavel: tarefaParaCadencia.sdr_email || user?.email,
      },
    });

    await criarTarefasDaCadencia(empresaId, tarefaParaCadencia, user?.email, cadencia);

    await atualizarTarefaMutation.mutateAsync({
      id: tarefaParaCadencia.id,
      data: { status: "concluida" },
    });

    queryClient.invalidateQueries({ queryKey: ["tarefas"] });
    toast.success(`Cadência "${cadencia.nome}" iniciada com sucesso!`);
  };

  // ── Fase 2: Fila priorizada do SDR ────────────────────────────
  const { leadMap, atividadesPorLead, filaPriorizada } = useMemo(() => {
    const leadMap = Object.fromEntries(leadsSDR.map(l => [l.id, l]));

    const atividadesPorLead = {};
    atividades.forEach(a => {
      if (!atividadesPorLead[a.lead_id]) atividadesPorLead[a.lead_id] = [];
      atividadesPorLead[a.lead_id].push(a);
    });

    const agora = new Date();
    const duasHoras = 2 * 60 * 60 * 1000;

    const classificar = (t) => {
      const lead = leadMap[t.lead_id];
      const atvsLead = (atividadesPorLead[t.lead_id] || [])
        .slice().sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      const ultimaAtv = atvsLead[0];

      if (lead?.fonte_externa && atvsLead.length === 0) {
        const ref = new Date(lead.data_atribuicao || lead.created_date);
        if (agora - ref < duasHoras) return 'urgente';
      }
      if (ultimaAtv && ['nao_atendeu', 'ocupado', 'caixa_postal'].includes(ultimaAtv.resultado)) {
        if (new Date(t.data_prevista) <= agora) return 'retentativa';
      }
      if (isProximoContato(t) && isToday(parseLocal(t.data_prevista))) return 'retorno';
      return 'prospeccao';
    };

    const urgente = [], retentativa = [], retorno = [], prospeccao = [];
    minhasTarefas.filter(t => t.status === 'pendente').forEach(t => {
      const cat = classificar(t);
      if (cat === 'urgente') urgente.push(t);
      else if (cat === 'retentativa') retentativa.push(t);
      else if (cat === 'retorno') retorno.push(t);
      else prospeccao.push(t);
    });

    return { leadMap, atividadesPorLead, filaPriorizada: { urgente, retentativa, retorno, prospeccao } };
  }, [leadsSDR, atividades, minhasTarefas]);

  // ── Painel do Supervisor/Gestor (Fase 2.5) ──────────────────
  const [leadGestaoAberto, setLeadGestaoAberto] = useState(null);

  if (isGestorOrAdmin && modoAtivo === "supervisor") {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="modo-supervisor"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="p-6 space-y-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <div className="w-1 h-6 bg-gradient-to-b from-violet-400 to-sky-500 rounded-full" />
                <h1 className="text-2xl font-bold text-white">Painel da Equipe</h1>
              </div>
              <p className="text-slate-500 text-sm ml-3">
                {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </p>
            </div>
            <ModoToggle modoAtivo={modoAtivo} onToggle={handleTrocarModo} />
          </div>
          <div className="flex gap-5 items-start">
            <div className="w-72 flex-shrink-0 sticky top-6" style={{ height: "calc(100vh - 140px)" }}>
              <PainelLeadsEmCadencia onAbrirLead={setLeadGestaoAberto} />
            </div>
            <div className="flex-1 min-w-0">
              <PainelSupervisor user={user} />
              <PainelLeadsAcompanhamento empresaId={empresaId} />
            </div>
          </div>
          {leadGestaoAberto && (
            <ModalGestaoLead lead={leadGestaoAberto} onClose={() => setLeadGestaoAberto(null)} />
          )}
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence mode="wait">
    <motion.div
      key={gestorComoCloser ? "modo-closer" : "modo-sdr"}
      initial={{ opacity: 0, x: gestorComoCloser ? 20 : 0 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="p-6 space-y-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className={cn("w-1 h-6 rounded-full", gestorComoCloser ? "bg-gradient-to-b from-amber-400 to-orange-500" : "bg-gradient-to-b from-sky-400 to-violet-500")} />
            <h1 className="text-2xl font-bold text-white">
              {gestorComoCloser ? "Minhas Tarefas (Modo Closer)" : "Minhas Tarefas"}
            </h1>
          </div>
          <p className="text-slate-500 text-sm ml-3">
            {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        {isGestorOrAdmin && <ModoToggle modoAtivo={modoAtivo} onToggle={handleTrocarModo} />}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/80 border border-slate-800/60">
          {[
            { value: "manha", icon: Sun, label: "Manhã",  activeClass: "bg-gradient-to-r from-sky-500 to-sky-400 shadow-lg shadow-sky-500/25 text-white" },
            { value: "tarde", icon: Sunset, label: "Tarde", activeClass: "bg-gradient-to-r from-orange-500 to-amber-400 shadow-lg shadow-orange-500/25 text-white" },
          ].map(({ value, icon: Icon, label, activeClass }) => (
            <button
              key={value}
              onClick={() => setPeriodo(value)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
                periodo === value ? activeClass : "text-slate-500 hover:text-slate-300"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {[
            { value: "todos",     label: "Todos" },
            { value: "atrasado",  label: `⚠️ Atrasadas (${tarefasAtrasadas.length})`, activeClass: "bg-gradient-to-r from-rose-500 to-rose-400 text-white shadow shadow-rose-500/25" },
            { value: "em_dia",    label: "✅ Em dia", activeClass: "bg-gradient-to-r from-emerald-500 to-emerald-400 text-white shadow shadow-emerald-500/25" },
            { value: "concluidas", label: "☑️ Concluídas Hoje", activeClass: "bg-gradient-to-r from-sky-500 to-sky-400 text-white shadow shadow-sky-500/25" },
            { value: "concluidas_total", label: "📋 Concluídas Totais", activeClass: "bg-gradient-to-r from-violet-500 to-violet-400 text-white shadow shadow-violet-500/25" },
            { value: "proximo_contato", label: "📅 Próx. Contato", activeClass: "bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow shadow-orange-500/25" },
          ].map(({ value, label, activeClass }) => (
            <button
              key={value}
              onClick={() => setStatusFiltro(value)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200",
                statusFiltro === value
                  ? (activeClass || "bg-slate-700 text-white shadow shadow-slate-500/20") + " border-transparent"
                  : "border-slate-700/60 bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:border-slate-600"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {isGestorOrAdmin && (
          <Select value={vendedorFiltro} onValueChange={setVendedorFiltro}>
            <SelectTrigger className="w-48 h-8 text-xs bg-slate-800/80 border-slate-700/60 text-slate-300">
              <SelectValue placeholder="Todos os vendedores" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="todos">Todos os vendedores</SelectItem>
              {usuarios.map(u => (
                <SelectItem key={u.id} value={u.email}>{u.full_name || u.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <ButtonAtualizar
          onClick={() => Promise.all([
            queryClient.refetchQueries({ queryKey: ["tarefas"] }),
            queryClient.refetchQueries({ queryKey: ["cadencias"] }),
          ])}
        />
      </div>

      {tarefasAtrasadas.length > 0 && (
        <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
          <div className="w-7 h-7 rounded-lg bg-rose-500/20 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-400" />
          </div>
          <span className="text-rose-300 text-sm">
            Você tem <strong>{tarefasAtrasadas.length}</strong> tarefa(s) atrasada(s)
          </span>
        </div>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-3" />
            <p className="text-slate-400">Carregando tarefas...</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-slate-900/40 border border-slate-800/60 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  {statusFiltro === "concluidas" ? "Concluídas Hoje" : statusFiltro === "concluidas_total" ? "Concluídas Totais" : statusFiltro === "proximo_contato" ? "Próximo Contato" : "Minhas Tarefas"}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60">
                  {minhasTarefas.length}
                </span>
              </div>
              {statusFiltro === "proximo_contato" && (
                <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-800/60 border border-slate-700/60">
                  {["abertos", "fechados"].map(tipo => (
                    <button
                      key={tipo}
                      onClick={() => setProximoContatoFiltro(tipo)}
                      className={cn(
                        "px-2 py-1 rounded text-xs font-medium transition-all",
                        proximoContatoFiltro === tipo
                          ? "bg-orange-500/30 border border-orange-500/40 text-orange-300"
                          : "text-slate-400 hover:text-slate-200"
                      )}
                    >
                      {tipo === "abertos" ? "Abertos" : "Fechados"}
                    </button>
                  ))}
                </div>
              )}
              {statusFiltro !== "concluidas" && statusFiltro !== "concluidas_total" && statusFiltro !== "proximo_contato" && tarefasAtrasadas.length > 0 && (
                <span className="text-xs text-rose-400 font-medium">
                  {tarefasAtrasadas.length} atrasada{tarefasAtrasadas.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="p-3 space-y-2">

              {statusFiltro === "concluidas_total" && (() => {
                const tipoIcons = { ligacao: "📞", whatsapp: "💬", email: "✉️", reuniao: "📅", instagram: "📸" };

                const filtradas = minhasTarefas
                  .sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date))
                  .filter(t => {
                    const buscaOk = !totalBusca || (t.lead_nome || "").toLowerCase().includes(totalBusca.toLowerCase());
                    const dataOk = !totalDataFiltro || (t.updated_date || "").startsWith(totalDataFiltro);
                    return buscaOk && dataOk;
                  });

                const totalPaginas = Math.max(1, Math.ceil(filtradas.length / TOTAL_POR_PAGINA));
                const paginaAtual = Math.min(totalPagina, totalPaginas);
                const itensPagina = filtradas.slice((paginaAtual - 1) * TOTAL_POR_PAGINA, paginaAtual * TOTAL_POR_PAGINA);

                const gerarPaginas = () => {
                  if (totalPaginas <= 7) return Array.from({ length: totalPaginas }, (_, i) => i + 1);
                  const pages = new Set([1, totalPaginas, paginaAtual]);
                  for (let i = paginaAtual - 1; i <= paginaAtual + 1; i++) if (i > 0 && i <= totalPaginas) pages.add(i);
                  return [...pages].sort((a, b) => a - b);
                };
                const paginasVisiveis = gerarPaginas();

                return (
                  <div>
                    <div className="flex gap-2 mb-3">
                      <div className="flex-1 relative">
                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Buscar por nome..."
                          value={totalBusca}
                          onChange={e => { setTotalBusca(e.target.value); setTotalPagina(1); }}
                          className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-800/80 border border-slate-700/60 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
                        />
                      </div>
                      <input
                        type="date"
                        value={totalDataFiltro}
                        onChange={e => { setTotalDataFiltro(e.target.value); setTotalPagina(1); }}
                        className="px-2 py-1.5 text-xs bg-slate-800/80 border border-slate-700/60 rounded-lg text-slate-300 focus:outline-none focus:border-violet-500/50"
                      />
                      {(totalBusca || totalDataFiltro) && (
                        <button
                          onClick={() => { setTotalBusca(""); setTotalDataFiltro(""); setTotalPagina(1); }}
                          className="px-2 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800/80 border border-slate-700/60 rounded-lg transition-colors"
                        >✕</button>
                      )}
                    </div>

                    <div className="divide-y divide-slate-800/60">
                      {itensPagina.length === 0 ? (
                        <p className="text-slate-500 text-sm text-center py-8">Nenhuma tarefa encontrada.</p>
                      ) : itensPagina.map((tarefa) => (
                        <button
                          key={tarefa.id}
                          onClick={() => setTarefaConcluidaModal(tarefa)}
                          className="w-full flex items-center gap-3 px-3 py-3 hover:bg-slate-800/50 rounded-lg transition-colors text-left"
                        >
                          <span className="text-lg">{tipoIcons[tarefa.tipo] || "✅"}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{tarefa.lead_nome || "—"}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{tarefa.lead_empresa || tarefa.lead_telefone || ""}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs text-slate-400">
                              {tarefa.updated_date ? format(new Date(tarefa.updated_date), "dd/MM/yy", { locale: ptBR }) : "—"}
                            </p>
                            <p className="text-xs text-slate-600 capitalize">{tarefa.tipo}</p>
                          </div>
                        </button>
                      ))}
                    </div>

                    {totalPaginas > 1 && (
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-800/60">
                        <span className="text-xs text-slate-500">
                          {(paginaAtual - 1) * TOTAL_POR_PAGINA + 1}–{Math.min(paginaAtual * TOTAL_POR_PAGINA, filtradas.length)} de {filtradas.length}
                        </span>
                        <div className="flex items-center gap-1 justify-start">
                          <button
                            disabled={paginaAtual === 1}
                            onClick={() => setTotalPagina(p => p - 1)}
                            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs"
                          >‹</button>
                          {paginasVisiveis.map((p, i) => {
                            const prev = paginasVisiveis[i - 1];
                            return (
                              <React.Fragment key={p}>
                                {prev && p - prev > 1 && <span className="text-slate-600 text-xs px-0.5">…</span>}
                                <button
                                  onClick={() => setTotalPagina(p)}
                                  className={cn(
                                    "w-7 h-7 flex items-center justify-center rounded-md text-xs font-medium transition-colors",
                                    p === paginaAtual
                                      ? "bg-violet-600 text-white"
                                      : "text-slate-400 hover:text-white hover:bg-slate-700"
                                  )}
                                >{p}</button>
                              </React.Fragment>
                            );
                          })}
                          <button
                            disabled={paginaAtual === totalPaginas}
                            onClick={() => setTotalPagina(p => p + 1)}
                            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs"
                          >›</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Fila Priorizada SDR (Fase 2) ────────────────── */}
              {statusFiltro !== "concluidas_total" && operaComoSDR && statusFiltro === "todos" ? (() => {
                const secoes = [
                  {
                    key: 'urgente',
                    label: '🔴 URGENTE',
                    sublabel: 'Leads externos sem contato — responda agora',
                    bordaClass: 'border-rose-500/30 bg-rose-500/5',
                    headerClass: 'text-rose-300',
                    badgeClass: 'bg-rose-500/20 border-rose-500/40 text-rose-300',
                    items: filaPriorizada.urgente,
                  },
                  {
                    key: 'retentativa',
                    label: '🟠 RETENTATIVAS',
                    sublabel: 'Não atendeu — tente novamente',
                    bordaClass: 'border-orange-500/30 bg-orange-500/5',
                    headerClass: 'text-orange-300',
                    badgeClass: 'bg-orange-500/20 border-orange-500/40 text-orange-300',
                    items: filaPriorizada.retentativa,
                  },
                  {
                    key: 'retorno',
                    label: '🟡 RETORNOS',
                    sublabel: 'Próximo contato agendado para hoje',
                    bordaClass: 'border-amber-500/30 bg-amber-500/5',
                    headerClass: 'text-amber-300',
                    badgeClass: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
                    items: filaPriorizada.retorno,
                  },
                  {
                    key: 'prospeccao',
                    label: '🟢 PROSPECÇÃO',
                    sublabel: 'Fila do dia — cadência ativa',
                    bordaClass: 'border-emerald-500/30 bg-emerald-500/5',
                    headerClass: 'text-emerald-300',
                    badgeClass: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
                    items: filaPriorizada.prospeccao,
                  },
                ];

                const totalFila = secoes.reduce((s, sec) => s + sec.items.length, 0);
                if (totalFila === 0) return (
                  <div className="py-12 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-1">Nenhuma tarefa pendente!</h3>
                    <p className="text-slate-500 text-xs">Todas as tarefas do período foram concluídas.</p>
                  </div>
                );

                return (
                  <div className="space-y-4">
                    {secoes.map(sec => {
                      if (sec.items.length === 0) return null;
                      const colapsado = secaoColapsada[sec.key];
                      return (
                        <div key={sec.key} className={cn("rounded-xl border overflow-hidden", sec.bordaClass)}>
                          <button
                            onClick={() => setSecaoColapsada(prev => ({ ...prev, [sec.key]: !prev[sec.key] }))}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className={cn("text-sm font-bold", sec.headerClass)}>{sec.label}</span>
                              <span className={cn("text-xs px-2 py-0.5 rounded-full border font-semibold", sec.badgeClass)}>
                                {sec.items.length}
                              </span>
                              <span className="text-xs text-slate-500 hidden sm:inline">{sec.sublabel}</span>
                            </div>
                            {colapsado
                              ? <ChevronDown className="w-4 h-4 text-slate-500" />
                              : <ChevronUp className="w-4 h-4 text-slate-500" />
                            }
                          </button>
                          {!colapsado && (
                            <div className="px-3 pb-3 space-y-2">
                              {(() => {
                                // Agrupa tarefas por lead_id
                                const grupos = {};
                                sec.items.forEach(tarefa => {
                                  const chave = tarefa.lead_id || tarefa.lead_nome || 'sem_identificacao';
                                  if (!grupos[chave]) {
                                    grupos[chave] = { leadId: tarefa.lead_id, leadNome: tarefa.lead_nome, leadEmpresa: tarefa.lead_empresa, cadenciaId: tarefa.cadencia_id, tarefas: [] };
                                  }
                                  grupos[chave].tarefas.push(tarefa);
                                });
                                const gruposArray = Object.values(grupos);
                                const temGruposMultiplos = gruposArray.some(g => g.tarefas.length > 1);

                                return gruposArray.map(grupo => {
                                  if (!temGruposMultiplos) {
                                    // Renderiza flat se todos têm 1 tarefa
                                    return grupo.tarefas.map(tarefa => {
                                      const estaAtrasada = isBefore(parseLocal(tarefa.data_prevista), startOfDay(new Date())) && tarefa.status === "pendente";
                                      const ehConcluida = tarefa.status === "concluida";
                                      if (sec.key === 'retorno') {
                                        return (
                                          <button
                                            key={tarefa.id}
                                            onClick={() => setTarefaConcluidaModal(tarefa)}
                                            className="w-full text-left rounded-xl bg-gradient-to-r from-orange-500/15 to-amber-500/10 border border-orange-500/25 p-4 hover:border-orange-500/40 hover:shadow-lg hover:shadow-orange-500/10 transition-all"
                                          >
                                            <div className="flex items-start justify-between gap-4">
                                              <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                  <span className="inline-block px-2 py-1 rounded-lg bg-orange-500/30 border border-orange-500/40 text-xs font-semibold text-orange-300">
                                                    📅 Próximo Contato
                                                  </span>
                                                </div>
                                                <h3 className="text-sm font-semibold text-white mb-1">{tarefa.lead_nome || "—"}</h3>
                                                <p className="text-xs text-slate-400 mb-2">{tarefa.lead_empresa || tarefa.lead_telefone || ""}</p>
                                                <p className="text-xs text-orange-300 font-medium">
                                                  Agendado para: {format(new Date(tarefa.data_prevista), "dd/MM/yyyy", { locale: ptBR })}
                                                </p>
                                              </div>
                                              <div className="text-right flex-shrink-0">
                                                <p className="text-xs text-slate-500 capitalize bg-slate-800/50 px-2 py-1 rounded">{tarefa.tipo}</p>
                                              </div>
                                            </div>
                                          </button>
                                        );
                                      }
                                      return (
                                        <div key={tarefa.id}
                                          onClick={ehConcluida ? () => setTarefaConcluidaModal(tarefa) : undefined}
                                          style={ehConcluida ? { cursor: 'pointer', opacity: 0.8 } : undefined}
                                        >
                                          <TaskCard
                                            tarefa={tarefa}
                                            scripts={scripts}
                                            atividades={atividades}
                                            user={user}
                                            userProfile={userProfile}
                                            onExecutar={handleExecutar}
                                            atrasada={estaAtrasada}
                                            onIniciarCadencia={handleIniciarCadencia}
                                            telefonia={telefonia}
                                            expandedId={expandedCardId}
                                            onExpandChange={setExpandedCardId}
                                          />
                                        </div>
                                      );
                                    });
                                  }

                                  // Com múltiplos grupos, renderiza com blocos visuais
                                  const temAtrasada = grupo.tarefas.some(t => isBefore(parseLocal(t.data_prevista), startOfDay(new Date())) && t.status === "pendente");
                                  const cadenciaNome = grupo.cadenciaId && cadencias ? cadencias.find(c => c.id === grupo.cadenciaId)?.nome : null;

                                  return (
                                    <div key={grupo.leadId || grupo.leadNome} className={cn("rounded-xl border overflow-hidden", temAtrasada ? "border-rose-500/30 bg-rose-500/5" : "border-slate-700/40 bg-slate-800/30")}>
                                      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700/30">
                                        <User className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="text-sm font-semibold text-white">{grupo.leadNome}</span>
                                        {grupo.leadEmpresa && <span className="text-xs text-slate-500">· {grupo.leadEmpresa}</span>}
                                        {cadenciaNome && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/25 text-violet-300 ml-auto">{cadenciaNome}</span>}
                                        {temAtrasada && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300">ATRASADA</span>}
                                      </div>
                                      <div className="p-2 space-y-2">
                                        {grupo.tarefas.map(tarefa => {
                                          const estaAtrasada = isBefore(parseLocal(tarefa.data_prevista), startOfDay(new Date())) && tarefa.status === "pendente";
                                          const ehConcluida = tarefa.status === "concluida";
                                          if (sec.key === 'retorno') {
                                            return (
                                              <button
                                                key={tarefa.id}
                                                onClick={() => setTarefaConcluidaModal(tarefa)}
                                                className="w-full text-left rounded-xl bg-gradient-to-r from-orange-500/15 to-amber-500/10 border border-orange-500/25 p-4 hover:border-orange-500/40 hover:shadow-lg hover:shadow-orange-500/10 transition-all"
                                              >
                                                <div className="flex items-start justify-between gap-4">
                                                  <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                      <span className="inline-block px-2 py-1 rounded-lg bg-orange-500/30 border border-orange-500/40 text-xs font-semibold text-orange-300">
                                                        📅 Próximo Contato
                                                      </span>
                                                    </div>
                                                    <p className="text-xs text-orange-300 font-medium">
                                                      Agendado para: {format(new Date(tarefa.data_prevista), "dd/MM/yyyy", { locale: ptBR })}
                                                    </p>
                                                  </div>
                                                  <div className="text-right flex-shrink-0">
                                                    <p className="text-xs text-slate-500 capitalize bg-slate-800/50 px-2 py-1 rounded">{tarefa.tipo}</p>
                                                  </div>
                                                </div>
                                              </button>
                                            );
                                          }
                                          return (
                                            <div key={tarefa.id}
                                              onClick={ehConcluida ? () => setTarefaConcluidaModal(tarefa) : undefined}
                                              style={ehConcluida ? { cursor: 'pointer', opacity: 0.8 } : undefined}
                                            >
                                              <TaskCard
                                                tarefa={tarefa}
                                                scripts={scripts}
                                                atividades={atividades}
                                                user={user}
                                                userProfile={userProfile}
                                                onExecutar={handleExecutar}
                                                atrasada={estaAtrasada}
                                                onIniciarCadencia={handleIniciarCadencia}
                                                telefonia={telefonia}
                                                expandedId={expandedCardId}
                                                onExpandChange={setExpandedCardId}
                                              />
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })() : (
              <AnimatePresence>
                {statusFiltro !== "concluidas_total" && minhasTarefas
                  .sort((a, b) => {
                    const dataAtual = startOfDay(new Date());
                    const atrasadaA = isBefore(parseLocal(a.data_prevista), dataAtual) && a.status === "pendente" && !isProximoContato(a);
                    const atrasadaB = isBefore(parseLocal(b.data_prevista), dataAtual) && b.status === "pendente" && !isProximoContato(b);
                    const proximoA = isProximoContato(a);
                    const proximoB = isProximoContato(b);
                    if (proximoA && !proximoB) return -1;
                    if (!proximoA && proximoB) return 1;
                    const finalizadaA = a.status === "encerrada_automaticamente";
                    const finalizadaB = b.status === "encerrada_automaticamente";
                    if (finalizadaA && !finalizadaB) return 1;
                    if (!finalizadaA && finalizadaB) return -1;
                    if (atrasadaA && !atrasadaB) return -1;
                    if (!atrasadaA && atrasadaB) return 1;
                    if (atrasadaA && atrasadaB) return parseLocal(a.data_prevista) - parseLocal(b.data_prevista);
                    return 0;
                  })
                  .map((tarefa) => {
                    const proximoContato = isProximoContato(tarefa);
                    const estaAtrasada = isBefore(parseLocal(tarefa.data_prevista), startOfDay(new Date()))
                      && tarefa.status === "pendente"
                      && !proximoContato;
                    const ehConcluida = tarefa.status === "concluida";

                    if (proximoContato) {
                      return (
                        <button
                          key={tarefa.id}
                          onClick={() => setTarefaConcluidaModal(tarefa)}
                          className="w-full text-left rounded-xl bg-gradient-to-r from-orange-500/15 to-amber-500/10 border border-orange-500/25 p-4 hover:border-orange-500/40 hover:shadow-lg hover:shadow-orange-500/10 transition-all"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="inline-block px-2 py-1 rounded-lg bg-orange-500/30 border border-orange-500/40 text-xs font-semibold text-orange-300">
                                  📅 Próximo Contato
                                </span>
                              </div>
                              <h3 className="text-sm font-semibold text-white mb-1">{tarefa.lead_nome || "—"}</h3>
                              <p className="text-xs text-slate-400 mb-2">{tarefa.lead_empresa || tarefa.lead_telefone || ""}</p>
                              <p className="text-xs text-orange-300 font-medium">
                                Agendado para: {format(new Date(tarefa.data_prevista), "dd/MM/yyyy", { locale: ptBR })}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs text-slate-500 capitalize bg-slate-800/50 px-2 py-1 rounded">{tarefa.tipo}</p>
                            </div>
                          </div>
                        </button>
                      );
                    }

                    return (
                      <div key={tarefa.id}
                        onClick={ehConcluida ? () => setTarefaConcluidaModal(tarefa) : undefined}
                        style={ehConcluida ? { cursor: 'pointer', opacity: 0.8 } : undefined}
                      >
                        <TaskCard
                           tarefa={tarefa}
                           scripts={scripts}
                           atividades={atividades}
                           user={user}
                           userProfile={userProfile}
                           onExecutar={handleExecutar}
                           atrasada={estaAtrasada}
                           onIniciarCadencia={handleIniciarCadencia}
                           telefonia={telefonia}
                           expandedId={expandedCardId}
                           onExpandChange={setExpandedCardId}
                         />
                      </div>
                    );
                  })}
              </AnimatePresence>
              )}

              {tarefaConcluidaModal && (
                <div
                  style={{
                    position: 'fixed', inset: 0, zIndex: 100,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
                  }}
                  onClick={() => setTarefaConcluidaModal(null)}
                >
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{
                      background: 'linear-gradient(135deg, #0a0e1a, #0c1628)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 20, padding: 28, width: '100%', maxWidth: 480,
                      boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CheckCircle2 style={{ width: 16, height: 16, color: '#10b981' }} />
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Tarefa Concluída</span>
                      </div>
                      <button onClick={() => setTarefaConcluidaModal(null)} style={{ color: '#64748b', fontSize: 18, lineHeight: 1, cursor: 'pointer', background: 'none', border: 'none' }}>✕</button>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
                      <p style={{ fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lead</p>
                      <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{tarefaConcluidaModal.lead_nome || 'Não identificado'}</p>
                      {tarefaConcluidaModal.lead_telefone && <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>{tarefaConcluidaModal.lead_telefone}</p>}
                      {tarefaConcluidaModal.lead_empresa && <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{tarefaConcluidaModal.lead_empresa}</p>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                      <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 14px' }}>
                        <p style={{ fontSize: 11, color: '#64748b', marginBottom: 3 }}>Tipo</p>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', textTransform: 'capitalize' }}>{tarefaConcluidaModal.tipo || '—'}</p>
                      </div>
                      <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 14px' }}>
                        <p style={{ fontSize: 11, color: '#64748b', marginBottom: 3 }}>Data prevista</p>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
                          {tarefaConcluidaModal.data_prevista ? format(new Date(tarefaConcluidaModal.data_prevista), "dd/MM/yyyy", { locale: ptBR }) : '—'}
                        </p>
                      </div>
                    </div>

                    {(() => {
                     const atividadeVinculada = atividades
                       .filter(a => a.lead_id === tarefaConcluidaModal.lead_id)
                       .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {atividadeVinculada?.resultado && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
                              <span style={{ fontSize: 13, color: '#64748b' }}>Resultado</span>
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#10b981', textTransform: 'capitalize' }}>{atividadeVinculada.resultado.replace(/_/g, ' ')}</span>
                            </div>
                          )}
                          {atividadeVinculada?.duracao_segundos > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
                              <span style={{ fontSize: 13, color: '#64748b' }}>Duração</span>
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                                {Math.floor(atividadeVinculada.duracao_segundos / 60)}:{String(atividadeVinculada.duracao_segundos % 60).padStart(2, '0')}
                              </span>
                            </div>
                          )}
                          {atividadeVinculada?.observacao && (
                            <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
                              <p style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Observação</p>
                              <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6 }}>{atividadeVinculada.observacao}</p>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
                            <span style={{ fontSize: 13, color: '#64748b' }}>Concluída em</span>
                            <span style={{ fontSize: 13, color: '#94a3b8' }}>
                              {atividadeVinculada?.created_date
                                ? format(new Date(atividadeVinculada.created_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                                : format(new Date(), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          </div>
                          {!atividadeVinculada && (
                            <p style={{ fontSize: 13, color: '#475569', textAlign: 'center', padding: '12px 0' }}>Atividade não encontrada para esta tarefa.</p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {minhasTarefas.length === 0 && !(operaComoSDR && statusFiltro === "todos") && (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  </div>
                  {statusFiltro === "concluidas" ? (
                    <>
                      <h3 className="text-sm font-semibold text-white mb-1">Nenhuma tarefa concluída hoje</h3>
                      <p className="text-slate-500 text-xs">As tarefas concluídas neste período aparecerão aqui.</p>
                    </>
                  ) : statusFiltro === "concluidas_total" ? (
                    <>
                      <h3 className="text-sm font-semibold text-white mb-1">Nenhuma tarefa concluída</h3>
                      <p className="text-slate-500 text-xs">Tarefas concluídas aparecerão aqui.</p>
                    </>
                  ) : statusFiltro === "proximo_contato" ? (
                    <>
                      <h3 className="text-sm font-semibold text-white mb-1">Nenhum próximo contato agendado</h3>
                      <p className="text-slate-500 text-xs">Tarefas de próximo contato agendadas aparecerão aqui.</p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-sm font-semibold text-white mb-1">Nenhuma tarefa pendente!</h3>
                      <p className="text-slate-500 text-xs">Todas as tarefas do período foram concluídas.</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {modalAberto && (
        <div style={{ display: modalMinimizado ? 'none' : 'contents' }}>
          <ExecutarAtividadeModal
            open={modalAberto}
            minimizado={modalMinimizado}
            onClose={() => {
              setModalAberto(false);
              setModalMinimizado(false);
              setTarefaSelecionada(null);
              setScriptUsado(null);
            }}
            onMinimizar={() => setModalMinimizado(true)}
            tarefa={tarefaSelecionada}
            scriptUsado={scriptUsado}
            currentUser={user}
            onSave={(dados) => {
              setModalMinimizado(false);
              handleSalvarAtividade(dados);
            }}
          />
        </div>
      )}
      {modalAberto && modalMinimizado && (
        <div
          onClick={() => setModalMinimizado(false)}
          style={{
            position: 'fixed', bottom: '24px', left: '50%',
            transform: 'translateX(-50%)', zIndex: 60, cursor: 'pointer',
            background: 'linear-gradient(135deg, #0f172a, #0c1628)',
            border: '1px solid rgba(56,189,248,0.35)', borderRadius: 999,
            padding: '10px 20px', display: 'flex', alignItems: 'center',
            gap: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(20px)', minWidth: 280,
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 10px #38bdf8' }} />
          <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
            {tarefaSelecionada?.lead_nome || tarefaSelecionada?.titulo || 'Registrando tarefa'}
          </p>
          <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>Clique para restaurar</span>
        </div>
      )}

      {(isCloser || gestorComoCloser) && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-6 bg-gradient-to-b from-amber-400 to-orange-500 rounded-full" />
            <h2 className="text-xl font-bold text-white">Pipeline do Closer</h2>
          </div>
          <PipelineCloser user={user} />
        </div>
      )}

      <IniciarCadenciaModal
        open={modalCadenciaAberto}
        onClose={() => {
          setModalCadenciaAberto(false);
          setTarefaParaCadencia(null);
        }}
        tarefa={tarefaParaCadencia}
        onIniciar={handleSalvarCadencia}
      />
    </motion.div>
    </AnimatePresence>
  );
}