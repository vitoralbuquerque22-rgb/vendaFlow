import { motion } from "framer-motion";
import { Phone, Timer, Clock, User, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

function fmt(s = 0) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const TEMP_CFG = {
  quente: { label: "🔥 Quente", color: "#22c55e", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.3)" },
  morno:  { label: "🟡 Morno",  color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" },
  frio:   { label: "❄️ Frio",   color: "#60a5fa", bg: "rgba(96,165,250,0.12)", border: "rgba(96,165,250,0.3)" },
};

export default function CockpitHeader({ tarefa, duracaoLigacao = 0, tmaAtual = 0, leadCallStatus, temperatura, sdrNome }) {
  const emLigacao = leadCallStatus === "em_ligacao";
  const encerrado = leadCallStatus === "encerrado";
  const tempCfg = TEMP_CFG[temperatura] || null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex-shrink-0 flex items-center justify-between gap-4 px-5 py-3 border-b"
      style={{
        background: "linear-gradient(90deg, rgba(15,23,42,0.98) 0%, rgba(10,16,32,0.99) 100%)",
        borderColor: emLigacao ? "rgba(34,197,94,0.2)" : encerrado ? "rgba(100,116,139,0.2)" : "rgba(255,255,255,0.06)",
        boxShadow: emLigacao ? "0 2px 20px rgba(34,197,94,0.08)" : "none",
      }}
    >
      {/* Status pill */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{
            background: emLigacao ? "rgba(34,197,94,0.12)" : encerrado ? "rgba(100,116,139,0.12)" : "rgba(245,158,11,0.12)",
            border: emLigacao ? "1px solid rgba(34,197,94,0.3)" : encerrado ? "1px solid rgba(100,116,139,0.3)" : "1px solid rgba(245,158,11,0.3)",
          }}
        >
          <div
            className={cn("w-2 h-2 rounded-full flex-shrink-0", emLigacao && "animate-pulse")}
            style={{ background: emLigacao ? "#22c55e" : encerrado ? "#64748b" : "#f59e0b" }}
          />
          <span className="text-xs font-bold" style={{ color: emLigacao ? "#22c55e" : encerrado ? "#94a3b8" : "#f59e0b" }}>
            {emLigacao ? "EM LIGAÇÃO" : encerrado ? "ENCERRADA" : "INICIANDO"}
          </span>
        </div>

        <div className="flex items-center gap-1 text-slate-500 text-xs">
          <Phone className="w-3 h-3" />
          <span className="font-medium text-slate-300 truncate max-w-[160px]">
            {tarefa?.lead_nome || tarefa?.lead_telefone}
          </span>
        </div>
      </div>

      {/* Métricas centrais */}
      <div className="flex items-center gap-5">
        {/* Duração */}
        <div className="flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs text-slate-500">Ligação</span>
          <span className={cn("font-mono text-sm font-bold", emLigacao ? "text-emerald-400" : "text-slate-400")}>
            {fmt(duracaoLigacao)}
          </span>
        </div>

        <div className="w-px h-4 bg-slate-700" />

        {/* TMA */}
        <div className="flex items-center gap-1.5">
          <Timer className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-xs text-slate-500">TMA</span>
          <span className="font-mono text-sm font-bold text-sky-400">{fmt(tmaAtual)}</span>
        </div>

        {sdrNome && (
          <>
            <div className="w-px h-4 bg-slate-700" />
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-xs text-slate-400">{sdrNome}</span>
            </div>
          </>
        )}

        {tempCfg && (
          <>
            <div className="w-px h-4 bg-slate-700" />
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: tempCfg.bg, border: `1px solid ${tempCfg.border}`, color: tempCfg.color }}
            >
              {tempCfg.label}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}