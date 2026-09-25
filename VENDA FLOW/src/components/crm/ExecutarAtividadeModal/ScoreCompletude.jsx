import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, ChevronDown } from "lucide-react";

/**
 * Barra de progresso de completude do atendimento.
 * Exibe score, cor e checklist expansível.
 */
export default function ScoreCompletude({ score, itens }) {
  const [expanded, setExpanded] = useState(false);

  const color =
    score >= 80 ? "#22c55e" :
    score >= 50 ? "#f59e0b" :
    "#f87171";

  const bgColor =
    score >= 80 ? "rgba(34,197,94,0.10)" :
    score >= 50 ? "rgba(245,158,11,0.10)" :
    "rgba(248,113,113,0.10)";

  const borderColor =
    score >= 80 ? "rgba(34,197,94,0.25)" :
    score >= 50 ? "rgba(245,158,11,0.25)" :
    "rgba(248,113,113,0.25)";

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: bgColor, borderColor }}
    >
      {/* Header clicável */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
      >
        {/* Barra */}
        <div className="flex-1 h-2 rounded-full bg-slate-700/60 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: color }}
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>

        <span className="text-sm font-bold flex-shrink-0" style={{ color }}>
          {score}%
        </span>

        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />
        </motion.div>
      </button>

      {/* Checklist */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {itens.map((item) => (
                <div key={item.key} className="flex items-center gap-2 min-w-0">
                  {item.ok ? (
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
                  )}
                  <span
                    className="text-xs truncate"
                    style={{ color: item.ok ? "#86efac" : "#94a3b8" }}
                  >
                    {item.label}
                  </span>
                  <span className="text-[10px] text-slate-600 flex-shrink-0">
                    {item.peso}%
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}