import { useQuery } from "@tanstack/react-query";
import { listarAtividadesDoLead } from "@/lib/services/leadService";
import { motion } from "framer-motion";
import {
  Phone, MessageCircle, Mail, Calendar, FileText,
  Star, Pencil, CheckCircle2,
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

const TIPO_CFG = {
  ligacao:          { icon: Phone,          color: "#34d399", bg: "rgba(52,211,153,0.1)",  label: "Ligação" },
  whatsapp:         { icon: MessageCircle,  color: "#4ade80", bg: "rgba(74,222,128,0.1)",  label: "WhatsApp" },
  email:            { icon: Mail,           color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  label: "E-mail" },
  reuniao_agendada: { icon: Calendar,       color: "#a78bfa", bg: "rgba(167,139,250,0.1)", label: "Reunião" },
  reuniao_realizada:{ icon: CheckCircle2,   color: "#22c55e", bg: "rgba(34,197,94,0.1)",   label: "Reunião realizada" },
  anotacao:         { icon: Pencil,         color: "#94a3b8", bg: "rgba(148,163,184,0.1)", label: "Anotação" },
  pesquisa:         { icon: FileText,       color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  label: "Pesquisa" },
};

function dateLabelAtividade(dateStr) {
  const d = new Date(dateStr);
  if (isToday(d)) return "Hoje";
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd/MM", { locale: ptBR });
}

export default function CockpitHistoricoPanel({ tarefa }) {
  const { data: atividades = [], isLoading } = useQuery({
    queryKey: ["cockpit-historico", tarefa?.lead_id],
    queryFn: () => listarAtividadesDoLead(tarefa?.lead_id, { limit: 30 }),
    enabled: !!tarefa?.lead_id,
  });

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ padding: "16px 14px" }}>
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Histórico</p>
        {atividades.length > 0 && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.2)", color: "#60a5fa" }}>
            {atividades.length}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
        {/* Atendimento atual (topo) */}
        <motion.div
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex gap-3 pb-3 border-b"
          style={{ borderColor: "rgba(255,255,255,0.05)" }}
        >
          <div className="flex flex-col items-center gap-1">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}>
              <Phone className="w-3 h-3 text-emerald-400" />
            </div>
            <div className="flex-1 w-px bg-slate-800" />
          </div>
          <div className="pb-2">
            <p className="text-[10px] font-semibold text-emerald-400">Agora</p>
            <p className="text-xs text-slate-300 font-medium mt-0.5">Atendimento atual</p>
          </div>
        </motion.div>

        {isLoading && (
          <div className="space-y-2 pt-2">
            {[1,2,3].map(i => (
              <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.03)" }} />
            ))}
          </div>
        )}

        {!isLoading && atividades.length === 0 && (
          <div className="pt-4 text-center">
            <p className="text-xs text-slate-600">Sem histórico anterior</p>
          </div>
        )}

        {atividades.map((atv, i) => {
          const cfg = TIPO_CFG[atv.tipo] || TIPO_CFG.anotacao;
          const Icon = cfg.icon;
          const isLast = i === atividades.length - 1;

          return (
            <motion.div
              key={atv.id}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex gap-3"
            >
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: cfg.bg, border: `1px solid ${cfg.color}30` }}
                >
                  <Icon className="w-3 h-3" style={{ color: cfg.color }} />
                </div>
                {!isLast && <div className="flex-1 w-px" style={{ background: "rgba(255,255,255,0.05)", minHeight: 12 }} />}
              </div>

              <div className="pb-3 min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-semibold text-slate-300 truncate">{cfg.label}</p>
                  <p className="text-[10px] text-slate-600 flex-shrink-0">{dateLabelAtividade(atv.created_date)}</p>
                </div>
                {atv.resultado && (
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">{atv.resultado.replace(/_/g, " ")}</p>
                )}
                {atv.observacao && (
                  <p className="text-[10px] text-slate-600 mt-0.5 line-clamp-2 leading-tight">{atv.observacao}</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}