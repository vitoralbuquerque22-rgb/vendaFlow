import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone, PhoneOff, User, Building2, Clock, ChevronRight,
  Mic, MicOff, FileText, CheckCircle2, AlertCircle,
  TrendingUp, MessageSquare, Calendar, X, Loader2, Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ActivityTimeline from "@/components/crm/ActivityTimeline";
import FormularioSPINLigacao from "@/components/telefonia/FormularioSPINLigacao";

// Resultados que NÃO exigem SPIN
const RESULTADOS_SEM_SPIN = new Set(["nao_atendeu", "ocupado", "caixa_postal", "numero_invalido"]);

const RESULTADOS = [
  { value: "atendeu",          label: "Atendeu",          color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  { value: "reuniao_agendada", label: "Reunião agendada", color: "text-sky-400 border-sky-500/30 bg-sky-500/10" },
  { value: "qualificado",      label: "Qualificado",      color: "text-violet-400 border-violet-500/30 bg-violet-500/10" },
  { value: "sem_interesse",    label: "Sem interesse",    color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  { value: "desqualificado",   label: "Desqualificado",   color: "text-rose-400 border-rose-500/30 bg-rose-500/10" },
  { value: "nao_atendeu",      label: "Não atendeu",      color: "text-slate-400 border-slate-500/30 bg-slate-500/10" },
  { value: "ocupado",          label: "Ocupado",          color: "text-slate-400 border-slate-500/30 bg-slate-500/10" },
  { value: "caixa_postal",     label: "Caixa postal",     color: "text-slate-400 border-slate-500/30 bg-slate-500/10" },
];

export default function LeadCallAttendanceModal({ telefonia, callSession, onClose }) {
  const [abaAtiva, setAbaAtiva]         = useState("atendimento");
  const [resultado, setResultado]       = useState(null);
  const [spin, setSpin]                 = useState({ situacao: "", problema: "", implicacao: "", necessidade: "", proximo_passo: "" });
  const [observacao, setObservacao]     = useState("");
  const [finalizando, setFinalizando]   = useState(false);
  const [spinErro, setSpinErro]         = useState(false);

  const {
    cronometroFormatado,
    finalizarLigacao,
  } = telefonia;

  // Buscar dados completos do lead
  const { data: lead } = useQuery({
    queryKey: ["leadModal", callSession?.lead_id],
    queryFn: async () => {
      if (!callSession?.lead_id) return null;
      const leads = await base44.entities.Lead.filter({ id: callSession.lead_id });
      return leads[0] || null;
    },
    enabled: !!callSession?.lead_id,
  });

  // Buscar atividades do lead
  const { data: atividades = [] } = useQuery({
    queryKey: ["atividades-lead-modal", lead?.id],
    queryFn: () => lead?.id
      ? base44.entities.Atividade.filter({ lead_id: lead.id }, "-created_date", 50)
      : [],
    enabled: !!lead?.id,
    refetchInterval: 30000,
  });

  // Buscar SpinRespostas anteriores deste lead
  const { data: spinAnteriores = [] } = useQuery({
    queryKey: ["spin-anteriores", lead?.id],
    queryFn: () => lead?.id
      ? base44.entities.SpinResposta.filter({ lead_id: lead.id }, "-created_date", 5)
      : [],
    enabled: !!lead?.id,
  });

  const exigeSpin = resultado && !RESULTADOS_SEM_SPIN.has(resultado);

  const spinPreenchido = (() => {
    const campos = [spin.situacao, spin.problema, spin.implicacao, spin.necessidade, spin.proximo_passo];
    return campos.filter(v => v?.trim?.().length > 0).length >= 3;
  })();

  const podeEncerrar = resultado && (!exigeSpin || spinPreenchido);

  const handleFinalizar = async () => {
    if (!resultado) { return; }
    if (exigeSpin && !spinPreenchido) {
      setSpinErro(true);
      setAbaAtiva("spin");
      return;
    }

    setFinalizando(true);
    const res = await finalizarLigacao(resultado, exigeSpin ? spin : null, observacao);

    if (res?.sucesso) {
      onClose?.();
    }
    setFinalizando(false);
  };

  const resultadoCfg = RESULTADOS.find(r => r.value === resultado);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="relative w-full max-w-2xl mx-4 rounded-2xl overflow-hidden border border-slate-700/60 shadow-2xl shadow-black/60"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #0c1628 50%, #0f172a 100%)" }}
      >
        {/* ── Barra superior com status ──────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/60 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/20">
              <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              <span className="text-xs font-semibold text-sky-300">Em ligação</span>
            </div>
            <span className="text-lg font-mono font-bold text-white tabular-nums">
              {cronometroFormatado}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {resultado && (
              <Badge className={cn("text-xs border px-2 py-0.5 font-medium", resultadoCfg?.color)}>
                {resultadoCfg?.label}
              </Badge>
            )}
            {/* Botão minimizar */}
            <button
              onClick={onClose}
              title="Minimizar"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-700/60 transition-all"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── Header do lead ────────────────────────────── */}
        <div className="px-5 py-4 border-b border-slate-800/40">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-500/20 to-violet-500/20 border border-slate-700/50 flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-sky-400" />
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white truncate">
                {lead?.nome || callSession?.lead_nome || "Lead"}
              </h2>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                {lead?.empresa && (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {lead.empresa}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {lead?.telefone || callSession?.lead_telefone}
                </span>
                {lead?.status && (
                  <span className="px-1.5 py-0.5 rounded-md bg-slate-800 border border-slate-700/50 capitalize">
                    {lead.status.replace(/_/g, " ")}
                  </span>
                )}
              </div>
            </div>

            {/* Total de ligações anteriores */}
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-bold text-white">{atividades.filter(a => a.tipo === "ligacao").length}</p>
              <p className="text-[10px] text-slate-500">ligações</p>
            </div>
          </div>
        </div>

        {/* ── Tabs ──────────────────────────────────────── */}
        <div className="px-5 pt-3">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/80 border border-slate-800/60 w-fit">
            {[
              { value: "atendimento", label: "Qualificação", icon: CheckCircle2 },
              { value: "spin",        label: "SPIN",         icon: FileText, badge: exigeSpin && !spinPreenchido ? "!" : null },
              { value: "historico",   label: "Histórico",    icon: Clock, badge: atividades.length || null },
              { value: "lead",        label: "Dados",        icon: User },
            ].map(({ value, label, icon: Icon, badge }) => (
              <button
                key={value}
                onClick={() => { setAbaAtiva(value); if (value === "spin") setSpinErro(false); }}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                  abaAtiva === value
                    ? "bg-gradient-to-r from-sky-500 to-violet-500 text-white shadow-md shadow-sky-500/20"
                    : "text-slate-500 hover:text-slate-300"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {badge && (
                  <span className={cn(
                    "absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center",
                    badge === "!" ? "bg-rose-500 text-white" : "bg-sky-500/80 text-white"
                  )}>
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Conteúdo das tabs ─────────────────────────── */}
        <div className="px-5 py-4 overflow-y-auto" style={{ maxHeight: 380 }}>
          <AnimatePresence mode="wait">
            {/* ── ABA: Qualificação ── */}
            {abaAtiva === "atendimento" && (
              <motion.div key="atendimento" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }} className="space-y-4">
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-3">
                    Como foi a ligação?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {RESULTADOS.map(r => (
                      <button
                        key={r.value}
                        onClick={() => setResultado(r.value)}
                        className={cn(
                          "px-3 py-2.5 rounded-xl border text-xs font-medium text-left transition-all duration-150",
                          resultado === r.value
                            ? cn(r.color, "ring-1 ring-offset-1 ring-offset-slate-900", r.color.includes("sky") ? "ring-sky-500/50" : r.color.includes("emerald") ? "ring-emerald-500/50" : r.color.includes("violet") ? "ring-violet-500/50" : r.color.includes("amber") ? "ring-amber-500/50" : r.color.includes("rose") ? "ring-rose-500/50" : "ring-slate-500/50")
                            : "border-slate-700/50 bg-slate-800/60 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                        )}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Observação */}
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Observação</p>
                  <textarea
                    value={observacao}
                    onChange={e => setObservacao(e.target.value)}
                    placeholder="Anotações sobre a ligação..."
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 text-sm text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 transition-all"
                  />
                </div>

                {/* Aviso SPIN */}
                {exigeSpin && !spinPreenchido && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <p className="text-xs text-amber-300">
                      Preencha o formulário SPIN antes de finalizar.
                      <button onClick={() => setAbaAtiva("spin")} className="ml-1 underline text-amber-400 font-medium">
                        Ir para SPIN
                      </button>
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── ABA: SPIN ── */}
            {abaAtiva === "spin" && (
              <motion.div key="spin" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}>
                <FormularioSPINLigacao
                  spin={spin}
                  onChange={setSpin}
                  erro={spinErro}
                  spinAnteriores={spinAnteriores}
                />
              </motion.div>
            )}

            {/* ── ABA: Histórico ── */}
            {abaAtiva === "historico" && (
              <motion.div key="historico" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}>
                {atividades.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Clock className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Nenhuma atividade anterior</p>
                  </div>
                ) : (
                  <ActivityTimeline atividades={atividades} />
                )}
              </motion.div>
            )}

            {/* ── ABA: Dados do lead ── */}
            {abaAtiva === "lead" && (
              <motion.div key="lead" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }} className="space-y-3">
                {[
                  { label: "Nome",     value: lead?.nome },
                  { label: "Telefone", value: lead?.telefone },
                  { label: "E-mail",   value: lead?.email },
                  { label: "Empresa",  value: lead?.empresa },
                  { label: "Cargo",    value: lead?.cargo },
                  { label: "Origem",   value: lead?.origem?.replace(/_/g, " ") },
                  { label: "Campanha", value: lead?.campanha },
                  { label: "Produto",  value: lead?.produto_interesse_nome },
                ].filter(f => f.value).map(({ label, value }) => (
                  <div key={label} className="flex items-start gap-3 py-2 border-b border-slate-800/40 last:border-0">
                    <span className="text-xs text-slate-500 w-20 flex-shrink-0 pt-0.5">{label}</span>
                    <span className="text-sm text-slate-200 flex-1">{value}</span>
                  </div>
                ))}
                {lead?.observacoes && (
                  <div className="pt-2">
                    <p className="text-xs text-slate-500 mb-1">Observações</p>
                    <p className="text-sm text-slate-400 italic">{lead.observacoes}</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Footer com ações ──────────────────────────── */}
        <div className="px-5 py-4 border-t border-slate-800/60 bg-slate-900/40 flex items-center gap-3">
          {/* Botão minimizar */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 hover:bg-slate-700/40 border border-slate-700/50 text-xs"
          >
            <Minus className="w-3.5 h-3.5 mr-1.5" />
            Minimizar
          </Button>

          <div className="flex-1" />

          {/* Botão finalizar */}
          <button
            onClick={handleFinalizar}
            disabled={!podeEncerrar || finalizando}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200",
              podeEncerrar && !finalizando
                ? "bg-gradient-to-r from-sky-500 to-violet-500 hover:from-sky-400 hover:to-violet-400 text-white shadow-lg shadow-sky-500/25 hover:shadow-sky-500/35 active:scale-[0.98]"
                : "bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700/50"
            )}
          >
            {finalizando
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Finalizando...</>
              : <><CheckCircle2 className="w-4 h-4" /> Finalizar ligação</>
            }
          </button>
        </div>
      </motion.div>
    </div>
  );
}