import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { atualizarTarefa } from "@/lib/services/tarefaService";
import { criarAtividade } from "@/lib/services/atividadeService";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { format, isBefore, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, AlertTriangle, ArrowDown, Check, Phone, MessageCircle, Mail } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const tipoConfig = {
  ligacao:  { icon: Phone,         label: "Ligação",  color: "text-sky-400",     bg: "bg-sky-500/10"     },
  whatsapp: { icon: MessageCircle, label: "WhatsApp", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  email:    { icon: Mail,          label: "Email",    color: "text-violet-400",  bg: "bg-violet-500/10"  },
};

const SUGESTOES = [
  "Cliente pediu outro horário",
  "Em reunião",
  "Não atendeu",
  "Pediu retorno",
  "Aguardando orçamento",
  "Aguardando sócio",
  "Viagem",
];

function formatarData(str) {
  if (!str) return "—";
  try { return format(new Date(str), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); } catch { return str; }
}

function labelTempo(d) {
  if (isToday(d))   return "Hoje";
  if (isTomorrow(d)) return "Amanhã";
  return format(d, "dd/MM/yyyy", { locale: ptBR });
}

export default function ModalReagendarContato({ tarefa, onClose, onSuccess }) {
  const { empresaId } = useEmpresaAtual();
  const { data: user } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me(), staleTime: 5 * 60_000 });
  const queryClient = useQueryClient();

  const dataAtualStr = tarefa?.data_prevista?.split("T")[0] || tarefa?.data_prevista || "";
  const horaAtualStr = tarefa?.data_prevista?.includes("T")
    ? tarefa.data_prevista.split("T")[1]?.slice(0, 5)
    : "09:00";

  const [novaData, setNovaData]     = useState(dataAtualStr);
  const [novoHorario, setNovoHorario] = useState("09:00");
  const [motivo, setMotivo]         = useState("");
  const [erro, setErro]             = useState("");

  const hoje = new Date().toISOString().split("T")[0];

  // Preview do novo agendamento
  const novoDatetimePreview = novaData
    ? (() => { try { return format(new Date(`${novaData}T${novoHorario}:00`), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); } catch { return "—"; } })()
    : "—";

  const novoDatetime = novaData ? new Date(`${novaData}T${novoHorario}:00`) : null;
  const isExpirado   = novoDatetime && isBefore(novoDatetime, new Date());
  const isValido     = novoDatetime && !isExpirado && motivo.trim().length > 0;

  const dataAtualDisplay = (() => {
    if (!tarefa?.data_prevista) return { dia: "—", hora: "—", badge: "" };
    const d = new Date(tarefa.data_prevista);
    return {
      dia:   format(d, "dd/MM", { locale: ptBR }),
      hora:  tarefa?.data_prevista?.includes("T") ? horaAtualStr : "—",
      badge: isToday(d) ? "Hoje" : isTomorrow(d) ? "Amanhã" : format(d, "EEE", { locale: ptBR }),
    };
  })();

  const novoDisplay = novaData
    ? (() => {
        const d = new Date(`${novaData}T${novoHorario}:00`);
        return { dia: format(d, "dd/MM", { locale: ptBR }), hora: novoHorario, badge: labelTempo(d) };
      })()
    : null;

  const canalCfg = tipoConfig[tarefa?.tipo] || tipoConfig.ligacao;
  const CanalIcon = canalCfg.icon;

  const salvarMutation = useMutation({
    mutationFn: async () => {
      if (!novaData)           throw new Error("Selecione uma nova data");
      if (!novoHorario)        throw new Error("Selecione um horário");
      if (!motivo.trim())      throw new Error("Informe o motivo do reagendamento");
      if (isExpirado)          throw new Error("A nova data/hora não pode ser no passado");

      const dataAntigaFormatada = formatarData(tarefa.data_prevista);
      const novaDataFormatada   = novoDatetimePreview;
      const usuarioNome         = user?.full_name || user?.email || "Usuário";
      const agora               = new Date();

      await atualizarTarefa(tarefa.id, { data_prevista: novaData });

      await criarAtividade({
        empresaId,
        lead_id:    tarefa.lead_id,
        lead_nome:  tarefa.lead_nome,
        sdr_email:  user?.email,
        tipo:       "anotacao",
        resultado:  "reagendamento",
        observacao: `📅 Próximo contato reagendado.\n\nData anterior: ${dataAntigaFormatada}\nNova data: ${novaDataFormatada}\n\nMotivo: ${motivo.trim()}\n\nAlterado por: ${usuarioNome} em ${format(agora, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      });

      return { novaData, novoHorario };
    },
    onSuccess: ({ novaData, novoHorario }) => {
      queryClient.invalidateQueries({ queryKey: ["proximos-contatos"] });
      queryClient.invalidateQueries({ queryKey: ["atividades"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      const d = new Date(`${novaData}T${novoHorario}:00`);
      const dataFormatada = format(d, "dd/MM 'às' HH:mm", { locale: ptBR });
      toast.success(`Próximo contato reagendado. Nova data: ${dataFormatada}`);
      onSuccess?.(novaData);
      onClose();
    },
    onError: (e) => setErro(e.message),
  });

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(10px)" }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-white/8 shadow-2xl overflow-hidden"
        style={{ background: "linear-gradient(145deg, #0a0e1a, #0c1628)" }}
      >
        {/* ── Header ──────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/6">
          <div className={cn("w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0", canalCfg.bg, "border-white/10")}>
            <CanalIcon className={cn("w-4 h-4", canalCfg.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{tarefa?.lead_nome}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {tarefa?.lead_telefone && <span className="text-xs text-slate-500">{tarefa.lead_telefone}</span>}
              <span className={cn("text-[10px] font-semibold", canalCfg.color)}>• {canalCfg.label}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5">
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* ── Visualização: Atual → Novo ───────────── */}
          <div className="flex items-stretch gap-3">
            {/* Agendamento atual */}
            <div className="flex-1 rounded-xl bg-slate-800/60 border border-slate-700/50 p-3 text-center">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Agendamento Atual</p>
              <p className="text-2xl font-bold text-slate-300 leading-none">{dataAtualDisplay.dia}</p>
              <p className="text-sm text-slate-500 mt-1">{dataAtualDisplay.hora}</p>
              {dataAtualDisplay.badge && (
                <span className="mt-2 inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-700/60 border border-slate-600/50 text-slate-400">
                  {dataAtualDisplay.badge}
                </span>
              )}
            </div>

            {/* Seta */}
            <div className="flex items-center justify-center">
              <div className="flex flex-col items-center gap-1">
                <ArrowDown className="w-5 h-5 text-blue-500/60" />
              </div>
            </div>

            {/* Novo agendamento */}
            <div className={cn(
              "flex-1 rounded-xl border p-3 text-center transition-all",
              novoDisplay
                ? isExpirado
                  ? "bg-rose-500/10 border-rose-500/30"
                  : "bg-blue-500/10 border-blue-500/30"
                : "bg-slate-800/30 border-slate-700/40 border-dashed"
            )}>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Novo Agendamento</p>
              {novoDisplay ? (
                <>
                  <p className={cn("text-2xl font-bold leading-none", isExpirado ? "text-rose-300" : "text-blue-300")}>
                    {novoDisplay.dia}
                  </p>
                  <p className={cn("text-sm mt-1", isExpirado ? "text-rose-400/70" : "text-blue-400/70")}>{novoDisplay.hora}</p>
                  <span className={cn(
                    "mt-2 inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                    isExpirado
                      ? "bg-rose-500/15 border-rose-500/30 text-rose-400"
                      : "bg-blue-500/15 border-blue-500/30 text-blue-400"
                  )}>
                    {novoDisplay.badge}
                  </span>
                </>
              ) : (
                <p className="text-slate-600 text-sm mt-2">—</p>
              )}
            </div>
          </div>

          {/* ── Inputs ──────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1.5">
                Nova Data <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={novaData}
                  min={hoje}
                  onChange={e => { setNovaData(e.target.value); setErro(""); }}
                  className="w-full pl-8 pr-2 py-2 text-xs bg-slate-800/80 border border-slate-700/60 rounded-lg text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1.5">
                Horário <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="time"
                  value={novoHorario}
                  onChange={e => { setNovoHorario(e.target.value); setErro(""); }}
                  className="w-full pl-8 pr-2 py-2 text-xs bg-slate-800/80 border border-slate-700/60 rounded-lg text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>
            </div>
          </div>

          {/* ── Motivo ──────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-400">
                Motivo do Reagendamento <span className="text-rose-400">*</span>
              </label>
              <span className="text-[10px] text-slate-600">{motivo.length}/500</span>
            </div>

            {/* Chips de sugestão */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {SUGESTOES.map(s => (
                <button
                  key={s}
                  onClick={() => { setMotivo(s); setErro(""); }}
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all",
                    motivo === s
                      ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                      : "bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-white hover:border-slate-600"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            <textarea
              value={motivo}
              onChange={e => { if (e.target.value.length <= 500) { setMotivo(e.target.value); setErro(""); } }}
              placeholder="Informe o motivo do reagendamento..."
              rows={3}
              className="w-full px-3 py-2 text-xs bg-slate-800/80 border border-slate-700/60 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 resize-none"
            />
          </div>

          {/* ── Validação visual ────────────────────── */}
          {novoDatetime && !erro && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium",
              isExpirado
                ? "bg-amber-500/10 border-amber-500/25 text-amber-400"
                : isValido
                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                : "bg-slate-800/40 border-slate-700/40 text-slate-500"
            )}>
              {isExpirado ? (
                <><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> Horário já expirado</>
              ) : isValido ? (
                <><Check className="w-3.5 h-3.5 flex-shrink-0" /> Agendamento válido</>
              ) : (
                <><Clock className="w-3.5 h-3.5 flex-shrink-0" /> Preencha o motivo para continuar</>
              )}
            </div>
          )}

          {/* ── Erro ────────────────────────────────── */}
          {erro && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/25">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
              <p className="text-xs text-rose-300">{erro}</p>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-white/6">
          <button
            onClick={onClose}
            disabled={salvarMutation.isPending}
            className="flex-1 py-2.5 text-sm font-medium text-slate-400 hover:text-white border border-slate-700/60 rounded-xl transition-colors hover:bg-white/3"
          >
            Cancelar
          </button>
          <button
            onClick={() => salvarMutation.mutate()}
            disabled={salvarMutation.isPending || !isValido}
            className="flex-1 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
          >
            {salvarMutation.isPending ? "Salvando..." : "Salvar Reagendamento"}
          </button>
        </div>
      </div>
    </div>
  );
}