import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { listarProximosContatos } from "@/lib/services/tarefaService";
import { criarAtividade } from "@/lib/services/atividadeService";
import { carregarMapaNomes } from "@/lib/services/equipeService";
import {
  Clock, Phone, MessageCircle, Mail, Calendar, X, Search,
  AlertTriangle, Eye, Play,
} from "lucide-react";
import ModalReagendarContato from "@/components/crm/ModalReagendarContato";
import ModalGestaoLead from "@/components/crm/ModalGestaoLead";
import {
  format, isBefore, isToday, isTomorrow,
  addDays, startOfDay, differenceInDays, differenceInHours, differenceInMinutes,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Configuração de canais ─────────────────────────────────
const tipoConfig = {
  ligacao:   { icon: Phone,         label: "Ligação",   color: "text-sky-400",     bg: "bg-sky-500/10",     border: "border-sky-500/30",    bar: "bg-sky-500"     },
  whatsapp:  { icon: MessageCircle, label: "WhatsApp",  color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", bar: "bg-emerald-500" },
  email:     { icon: Mail,          label: "Email",     color: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/30",  bar: "bg-violet-500"  },
};

// ── Helpers ────────────────────────────────────────────────
function getTempoRestante(dataPrevista) {
  const agora = new Date();
  const data = new Date(dataPrevista);
  if (isBefore(data, agora))  return { label: "Atrasado", cls: "text-rose-400 bg-rose-500/10 border-rose-500/30" };
  if (isToday(data)) {
    const horas = differenceInHours(data, agora);
    if (horas < 1) {
      const mins = differenceInMinutes(data, agora);
      return { label: `Em ${mins}min`, cls: "text-amber-400 bg-amber-500/10 border-amber-500/30" };
    }
    return { label: "Hoje", cls: "text-amber-400 bg-amber-500/10 border-amber-500/30" };
  }
  if (isTomorrow(data)) return { label: "Amanhã", cls: "text-blue-400 bg-blue-500/10 border-blue-500/30" };
  const dias = differenceInDays(data, startOfDay(agora));
  return { label: `Em ${dias} dias`, cls: "text-slate-400 bg-slate-500/10 border-slate-500/30" };
}

// Ordenação inteligente: Atrasados → Hoje → Amanhã → Próximos
function ordenarTarefas(tarefas) {
  return [...tarefas].sort((a, b) => {
    const da = new Date(a.data_prevista);
    const db = new Date(b.data_prevista);
    const hoje = startOfDay(new Date());
    const rank = (d) => {
      if (isBefore(d, hoje)) return 0;          // atrasado
      if (isToday(d))        return 1;          // hoje
      if (isTomorrow(d))     return 2;          // amanhã
      return 3;                                  // próximos
    };
    const ra = rank(da), rb = rank(db);
    if (ra !== rb) return ra - rb;
    return da - db;
  });
}

function agruparPorDia(tarefas) {
  const grupos = [];
  const mapa = new Map();
  for (const t of tarefas) {
    const data = new Date(t.data_prevista);
    const chave = format(data, "yyyy-MM-dd");
    if (!mapa.has(chave)) {
      let label;
      if (isBefore(data, startOfDay(new Date()))) label = "⚠️ Atrasados";
      else if (isToday(data))   label = "Hoje";
      else if (isTomorrow(data)) label = "Amanhã";
      else label = format(data, "EEEE, dd 'de' MMMM", { locale: ptBR });
      const entry = { chave, label, tarefas: [] };
      mapa.set(chave, entry);
      grupos.push(entry);
    }
    mapa.get(chave).tarefas.push(t);
  }
  return grupos;
}

const FILTROS_RAPIDOS = [
  { value: "todos",    label: "Todos"       },
  { value: "vencidos", label: "Atrasados"   },
  { value: "hoje",     label: "Hoje"        },
  { value: "amanha",   label: "Amanhã"      },
  { value: "semana",   label: "Esta semana" },
];

// ── Componente principal ───────────────────────────────────
export default function ProximosContatosCard() {
  const [tarefaReagendando, setTarefaReagendando]   = useState(null);
  const [leadHistorico, setLeadHistorico]           = useState(null);
  const [busca, setBusca]                           = useState("");
  const [filtroRapido, setFiltroRapido]             = useState("todos");
  const [filtroTipo, setFiltroTipo]                 = useState("todos");
  const [filtroSdr, setFiltroSdr]                   = useState(null);
  const [capturandoId, setCapturandoId]             = useState(null);

  const { empresaId } = useEmpresaAtual();
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60_000,
  });

  const { data: mapaNomes = new Map() } = useQuery({
    queryKey: ["mapaNomes", empresaId],
    queryFn: () => carregarMapaNomes(empresaId),
    enabled: !!empresaId,
    staleTime: 120_000,
  });

  const { data: tarefas = [], isLoading } = useQuery({
    queryKey: ["proximos-contatos", empresaId],
    queryFn: () => listarProximosContatos(empresaId),
    enabled: !!empresaId,
  });

  const filtroSdrEfetivo = filtroSdr ?? (user?.email || "todos");

  const resolverNome = (email) => {
    if (!email) return "—";
    return mapaNomes.get(email.toLowerCase()) || email.split("@")[0];
  };

  const sdrsUnicos = useMemo(() => {
    const set = new Set(tarefas.map(t => t.sdr_email).filter(Boolean));
    if (user?.email) set.add(user.email);
    return [...set].sort();
  }, [tarefas, user?.email]);

  const tarefasFiltradas = useMemo(() => {
    const hoje = startOfDay(new Date());
    const filtradas = tarefas.filter(t => {
      const data = new Date(t.data_prevista);
      if (busca && !t.lead_nome?.toLowerCase().includes(busca.toLowerCase())) return false;
      if (filtroSdrEfetivo !== "todos" && t.sdr_email !== filtroSdrEfetivo) return false;
      if (filtroTipo !== "todos" && t.tipo !== filtroTipo) return false;
      if (filtroRapido === "vencidos" && !isBefore(data, hoje)) return false;
      if (filtroRapido === "hoje"     && !isToday(data))        return false;
      if (filtroRapido === "amanha"   && !isTomorrow(data))     return false;
      if (filtroRapido === "semana"   && (isBefore(data, hoje) || isBefore(addDays(hoje, 7), data))) return false;
      return true;
    });
    return ordenarTarefas(filtradas);
  }, [tarefas, busca, filtroSdrEfetivo, filtroTipo, filtroRapido]);

  const grupos = useMemo(() => agruparPorDia(tarefasFiltradas), [tarefasFiltradas]);
  const vencidos = tarefas.filter(t => isBefore(new Date(t.data_prevista), startOfDay(new Date())));

  // ── Mutation: Capturar Atendimento ─────────────────────
  const capturarMutation = useMutation({
    mutationFn: async (tarefa) => {
      const tipoTarefa = ["ligacao", "whatsapp", "email"].includes(tarefa.tipo) ? tarefa.tipo : "ligacao";
      const hoje = new Date().toISOString().split("T")[0];
      const periodo = new Date().getHours() < 12 ? "manha" : "tarde";

      // 1. Criar tarefa operacional
      await api.entities.Tarefa.create({
        empresaId,
        lead_id:       tarefa.lead_id,
        lead_nome:     tarefa.lead_nome,
        lead_telefone: tarefa.lead_telefone,
        lead_empresa:  tarefa.lead_empresa,
        sdr_email:     tarefa.sdr_email,
        tipo:          tipoTarefa,
        data_prevista: hoje,
        periodo,
        status:        "pendente",
        origem:        "proximo_contato",
      });

      // 2. Remover o registro de próximo contato (atualiza status para encerrado)
      await api.entities.Tarefa.update(tarefa.id, {
        status: "encerrada_automaticamente",
        motivo_encerramento: "followup_agendado",
      });

      // 3. Registrar na timeline do lead
      const usuarioNome = user?.full_name || user?.email || "Usuário";
      const canalLabel  = tipoConfig[tipoTarefa]?.label || tipoTarefa;
      const dataAgendada = tarefa.data_prevista
        ? format(new Date(tarefa.data_prevista), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
        : "—";

      await criarAtividade({
        empresaId,
        lead_id:    tarefa.lead_id,
        lead_nome:  tarefa.lead_nome,
        sdr_email:  user?.email,
        tipo:       "anotacao",
        resultado:  "execucao_agendamento",
        observacao: `▶️ Próximo contato iniciado.\n\nO atendimento agendado foi capturado e transformado em tarefa operacional.\n\nResponsável: ${usuarioNome}\nCanal: ${canalLabel}\nAgendamento original: ${dataAgendada}`,
      });

      return tarefa;
    },
    onSuccess: (tarefa) => {
      queryClient.invalidateQueries({ queryKey: ["proximos-contatos"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["atividades"] });
      const canalLabel = tipoConfig[tarefa.tipo]?.label || "tarefa";
      toast.success(`Atendimento capturado! ${canalLabel} adicionada às suas tarefas.`);
      setCapturandoId(null);
    },
    onError: (e) => {
      toast.error(e.message || "Erro ao capturar atendimento");
      setCapturandoId(null);
    },
  });

  const handleCapturar = (tarefa) => {
    setCapturandoId(tarefa.id);
    capturarMutation.mutate(tarefa);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/60 rounded-2xl border border-slate-700/60 overflow-hidden">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-700/50 space-y-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span className="text-sm font-bold text-white">Próximos Contatos Agendados</span>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/25 text-blue-300 font-semibold">
            {tarefas.length}
          </span>
          {vencidos.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />{vencidos.length}
            </span>
          )}
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            placeholder="Buscar cliente..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-800/80 border border-slate-700/60 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/40"
          />
          {busca && (
            <button onClick={() => setBusca("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Filtros rápidos */}
        <div className="flex items-center gap-1 flex-wrap">
          {FILTROS_RAPIDOS.map(f => (
            <button
              key={f.value}
              onClick={() => setFiltroRapido(f.value)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all",
                filtroRapido === f.value
                  ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                  : "bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-white"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Filtros canal + SDR */}
        <div className="flex items-center gap-2">
          {[
            { value: "todos",    label: "Todos" },
            { value: "ligacao",  label: "📞"   },
            { value: "whatsapp", label: "💬"   },
            { value: "email",    label: "✉️"   },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFiltroTipo(value)}
              className={cn(
                "px-2 py-1 rounded-lg text-[11px] font-medium border transition-all",
                filtroTipo === value
                  ? "bg-slate-600 border-slate-500 text-white"
                  : "bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-white"
              )}
            >
              {label}
            </button>
          ))}
          <select
            value={filtroSdrEfetivo}
            onChange={e => setFiltroSdr(e.target.value)}
            className="ml-auto px-2 py-1 rounded-lg text-[11px] bg-slate-800/80 border border-slate-700/60 text-slate-300 focus:outline-none max-w-[130px]"
          >
            <option value="todos">Todos</option>
            {sdrsUnicos.map(email => (
              <option key={email} value={email}>
                {email === user?.email ? "👤 Eu" : resolverNome(email)}
              </option>
            ))}
          </select>
        </div>

        <p className="text-[11px] text-slate-500">
          {tarefasFiltradas.length} contato{tarefasFiltradas.length !== 1 ? "s" : ""} encontrado{tarefasFiltradas.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* ── Lista ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : grupos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <Calendar className="w-8 h-8 text-slate-700" />
            <p className="text-slate-500 text-sm text-center">
              {tarefas.length === 0 ? "Nenhum contato agendado" : "Nenhum resultado com os filtros selecionados"}
            </p>
          </div>
        ) : (
          grupos.map(grupo => (
            <div key={grupo.chave}>
              {/* Label do grupo */}
              <div className="flex items-center gap-2 mb-2">
                <span className={cn(
                  "text-xs font-bold uppercase tracking-wider",
                  grupo.label.startsWith("⚠️") ? "text-rose-400"
                    : grupo.label === "Hoje" ? "text-amber-400"
                    : "text-slate-400"
                )}>
                  {grupo.label}
                </span>
                <div className="flex-1 h-px bg-slate-700/60" />
                <span className="text-[10px] text-slate-600">{grupo.tarefas.length}</span>
              </div>

              {/* Cards */}
              <div className="space-y-2">
                {grupo.tarefas.map(tarefa => (
                  <ContatoCard
                    key={tarefa.id}
                    tarefa={tarefa}
                    resolverNome={resolverNome}
                    capturandoId={capturandoId}
                    onCapturar={handleCapturar}
                    onReagendar={setTarefaReagendando}
                    onHistorico={setLeadHistorico}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────── */}
      {tarefaReagendando && (
        <ModalReagendarContato
          tarefa={tarefaReagendando}
          onClose={() => setTarefaReagendando(null)}
          onSuccess={() => setTarefaReagendando(null)}
        />
      )}
      {leadHistorico && (
        <ModalGestaoLead
          lead={{ id: leadHistorico.lead_id, nome: leadHistorico.lead_nome }}
          onClose={() => setLeadHistorico(null)}
        />
      )}
    </div>
  );
}

// ── Card individual ────────────────────────────────────────
function ContatoCard({ tarefa, resolverNome, capturandoId, onCapturar, onReagendar, onHistorico }) {
  const cfg   = tipoConfig[tarefa.tipo] || tipoConfig.ligacao;
  const Icon  = cfg.icon;
  const tempo = getTempoRestante(tarefa.data_prevista);
  const isAtrasado  = isBefore(new Date(tarefa.data_prevista), startOfDay(new Date()));
  const isCapturando = capturandoId === tarefa.id;

  const dataFormatada = tarefa.data_prevista
    ? (() => {
        try {
          const d = new Date(tarefa.data_prevista);
          return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
        } catch { return tarefa.data_prevista; }
      })()
    : "—";

  return (
    <div
      className={cn(
        "relative rounded-xl border overflow-hidden transition-all",
        isAtrasado
          ? "bg-rose-500/5 border-rose-500/20"
          : "bg-slate-800/40 border-slate-700/50 hover:border-slate-600/60"
      )}
    >
      {/* Barra lateral colorida por canal */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-xl", cfg.bar)} />

      <div className="pl-4 pr-3 pt-3 pb-3 space-y-3">
        {/* Linha 1: Nome + badge tempo */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white truncate leading-tight">{tarefa.lead_nome || "Lead"}</p>
            {tarefa.lead_telefone && (
              <p className="text-xs text-slate-400 mt-0.5">{tarefa.lead_telefone}</p>
            )}
          </div>
          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 whitespace-nowrap", tempo.cls)}>
            {tempo.label}
          </span>
        </div>

        {/* Linha 2: Canal · Responsável · Data */}
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500">
          <span className={cn("inline-flex items-center gap-1 font-semibold", cfg.color)}>
            <Icon className="w-3 h-3" />
            {cfg.label}
          </span>
          <span className="text-slate-700">·</span>
          <span className="text-slate-400 truncate max-w-[90px]">{resolverNome(tarefa.sdr_email)}</span>
          <span className="text-slate-700">·</span>
          <span className="text-slate-400">{dataFormatada}</span>
        </div>

        {/* Separador */}
        <div className="h-px bg-slate-700/50" />

        {/* Ações */}
        <div className="space-y-2">
          {/* Botão principal */}
          <button
            onClick={() => onCapturar(tarefa)}
            disabled={isCapturando}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all",
              "bg-blue-600 hover:bg-blue-500 text-white",
              "disabled:opacity-60 disabled:cursor-not-allowed"
            )}
          >
            {isCapturando ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Capturando...
              </>
            ) : (
              <>
                <Icon className="w-3.5 h-3.5" />
                Capturar Atendimento
              </>
            )}
          </button>

          {/* Ações secundárias */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onReagendar(tarefa)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all",
                "border-slate-700/60 text-slate-400 hover:text-blue-400 hover:border-blue-500/40 hover:bg-blue-500/5"
              )}
            >
              <Calendar className="w-3 h-3" />
              Reagendar
            </button>
            <button
              onClick={() => onHistorico(tarefa)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all",
                "border-slate-700/60 text-slate-400 hover:text-slate-200 hover:border-slate-600 hover:bg-slate-700/20"
              )}
            >
              <Eye className="w-3 h-3" />
              Histórico
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}