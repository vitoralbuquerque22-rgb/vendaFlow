import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Phone,
  MessageCircle,
  Mail,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
} from "lucide-react";

// Qualificação 3C Plus correspondente a cada resultado
const QUALIF_3C = {
  atendeu:        "Em negociação whatsApp",
  nao_atendeu:    "Sem contato / Ligação caiu",
  ocupado:        "Sem contato / Ligação caiu",
  caixa_postal:   "Sem contato / Ligação caiu",
  numero_invalido:"Telefone incorreto / Engano",
  respondeu:      "Em negociação whatsApp",
  outro:          null,
};

const resultadoConfig = {
  atendeu: {
    icon: CheckCircle2,
    label: "Atendeu",
    color: "emerald",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/50",
    text: "text-emerald-400",
    qualif3c: QUALIF_3C.atendeu,
  },
  nao_atendeu: {
    icon: XCircle,
    label: "Não Atendeu",
    color: "rose",
    bg: "bg-rose-500/10",
    border: "border-rose-500/50",
    text: "text-rose-400",
    qualif3c: QUALIF_3C.nao_atendeu,
  },
  ocupado: {
    icon: Clock,
    label: "Ocupado",
    color: "amber",
    bg: "bg-amber-500/10",
    border: "border-amber-500/50",
    text: "text-amber-400",
    qualif3c: QUALIF_3C.ocupado,
  },
  respondeu: {
    icon: CheckCircle2,
    label: "Respondeu",
    color: "emerald",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/50",
    text: "text-emerald-400",
    qualif3c: QUALIF_3C.respondeu,
  },
  caixa_postal: {
    icon: AlertCircle,
    label: "Caixa Postal",
    color: "slate",
    bg: "bg-slate-500/10",
    border: "border-slate-500/50",
    text: "text-slate-400",
    qualif3c: QUALIF_3C.caixa_postal,
  },
  numero_invalido: {
    icon: AlertCircle,
    label: "Número Inválido",
    color: "rose",
    bg: "bg-rose-500/10",
    border: "border-rose-500/50",
    text: "text-rose-400",
    qualif3c: QUALIF_3C.numero_invalido,
  },
};

export default function ResultadoCards({ options, value, onChange }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-300">Resultado da ligação *</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {options.map((option) => {
          const config = resultadoConfig[option.value] || resultadoConfig.ocupado;
          const Icon = config.icon;
          const isSelected = value === option.value;

          return (
            <motion.button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "relative p-4 rounded-xl border-2 transition-all duration-300 group overflow-hidden",
                isSelected
                  ? `${config.bg} ${config.border} shadow-lg shadow-${config.color}-500/30`
                  : "bg-slate-800/40 border-slate-700/40 hover:border-slate-600/60 hover:bg-slate-800/60"
              )}
            >
              {/* Background gradient ao selecionar */}
              {isSelected && (
                <motion.div
                  layoutId="resultadoGlow"
                  className={`absolute inset-0 ${config.bg} pointer-events-none`}
                  transition={{ type: "spring", stiffness: 200, damping: 30 }}
                />
              )}

              {/* Glow effect */}
              <div
                className={cn(
                  "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity",
                  `bg-gradient-to-br from-${config.color}-500/20 to-transparent`
                )}
              />

              <div className="relative space-y-2">
                <Icon className={cn("w-5 h-5", config.text, isSelected ? "opacity-100" : "opacity-60")} />
                <p className={cn("text-sm font-semibold text-white", isSelected ? "opacity-100" : "opacity-70")}>
                  {option.label}
                </p>
                {config.qualif3c && isSelected && (
                  <p className="text-[9px] text-slate-500 leading-tight">
                    3C: {config.qualif3c}
                  </p>
                )}
              </div>

              {/* Checkmark quando selecionado */}
              {isSelected && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute top-2 right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center"
                >
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}