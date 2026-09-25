/**
 * ScoreDuplo — Exibe Completude + Qualidade separados.
 * Substitui ScoreCompletude (que só mostrava completude).
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, ChevronDown, AlertTriangle } from "lucide-react";

function colorFor(v) {
  if (v >= 80) return "#22c55e";
  if (v >= 50) return "#f59e0b";
  return "#f87171";
}
function bgFor(v) {
  if (v >= 80) return "rgba(34,197,94,0.08)";
  if (v >= 50) return "rgba(245,158,11,0.08)";
  return "rgba(248,113,113,0.08)";
}
function borderFor(v) {
  if (v >= 80) return "rgba(34,197,94,0.20)";
  if (v >= 50) return "rgba(245,158,11,0.20)";
  return "rgba(248,113,113,0.20)";
}

function MiniBar({ value, label }) {
  const c = colorFor(value);
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <span className="text-[10px] text-slate-500 flex-shrink-0 w-16 truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-700/60 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: c }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs font-bold flex-shrink-0 w-9 text-right" style={{ color: c }}>
        {value}%
      </span>
    </div>
  );
}

export default function ScoreDuplo({ completude, qualidade, itensCompletude, itensQualidade, avisos }) {
  const [expanded, setExpanded] = useState(false);
  const avgScore = Math.round((completude + qualidade) / 2);
  const borderColor = borderFor(avgScore);
  const bgColor     = bgFor(avgScore);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: bgColor, borderColor }}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-2 text-left"
      >
        <div className="flex-1 flex flex-col gap-1">
          <MiniBar value={completude} label="Completude" />
          <MiniBar value={qualidade}  label="Qualidade"  />
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" />
        </motion.div>
      </button>

      {/* Detalhe */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-3">

              {/* Completude checklist */}
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">
                  Completude
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {itensCompletude.map((item) => (
                    <div key={item.key} className="flex items-center gap-1.5 min-w-0">
                      {item.ok
                        ? <CheckCircle2 className="w-3 h-3 flex-shrink-0 text-emerald-400" />
                        : <AlertCircle  className="w-3 h-3 flex-shrink-0 text-amber-400" />
                      }
                      <span className="text-[11px] truncate" style={{ color: item.ok ? "#86efac" : "#94a3b8" }}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Qualidade avisos */}
              {avisos.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">
                    Pontos de melhoria
                  </p>
                  <div className="space-y-1">
                    {avisos.map((a, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 flex-shrink-0 text-amber-400" />
                        <span className="text-[11px] text-amber-300/80">{a}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}