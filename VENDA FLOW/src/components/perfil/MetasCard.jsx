import { motion } from "framer-motion";
import { Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function PremiumProgress({ value, color = "sky" }) {
  const colorMap = {
    sky: "from-sky-400 to-blue-500",
    violet: "from-violet-400 to-purple-500",
    emerald: "from-emerald-400 to-green-500",
    amber: "from-amber-400 to-orange-500",
    rose: "from-rose-400 to-red-500",
  };
  const glowMap = {
    sky: "rgba(56,189,248,0.4)",
    violet: "rgba(167,139,250,0.4)",
    emerald: "rgba(52,211,153,0.4)",
    amber: "rgba(251,191,36,0.4)",
    rose: "rgba(251,113,133,0.4)",
  };
  const clamped = Math.min(value, 100);
  return (
    <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 1.1, ease: "easeOut", delay: 0.15 }}
        className={cn("h-full rounded-full bg-gradient-to-r", colorMap[color])}
        style={{ boxShadow: `0 0 8px ${glowMap[color]}` }}
      />
    </div>
  );
}

const COLORS = ["sky", "violet", "emerald", "amber", "rose"];
const colorTextMap = {
  sky: "text-sky-400", violet: "text-violet-400",
  emerald: "text-emerald-400", amber: "text-amber-400", rose: "text-rose-400",
};
const colorBgMap = {
  sky: "bg-sky-500/10 border-sky-500/20",
  violet: "bg-violet-500/10 border-violet-500/20",
  emerald: "bg-emerald-500/10 border-emerald-500/20",
  amber: "bg-amber-500/10 border-amber-500/20",
  rose: "bg-rose-500/10 border-rose-500/20",
};

function MetaRow({ meta, index }) {
  const color = COLORS[index % COLORS.length];
  const pct = Math.round(Math.min(meta.percentual, 100));
  const isComplete = meta.percentual >= 100;
  const activeColor = isComplete ? "emerald" : color;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className={cn(
        "px-3 py-2.5 rounded-xl border transition-all duration-300",
        "bg-white/[0.02] border-white/[0.05] hover:border-white/10",
        isComplete && "border-emerald-500/25 bg-emerald-500/5"
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={cn("text-xs font-medium truncate", isComplete ? "text-emerald-400" : "text-slate-300")}>
            {meta.nome}
          </span>
          {isComplete && (
            <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full px-1.5 py-0.5 font-bold flex-shrink-0">
              ✓
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          <span className={cn("text-[11px] font-mono", colorTextMap[activeColor])}>
            {meta.realizado}<span className="text-slate-600">/{meta.meta}</span>
          </span>
          <span className={cn(
            "text-[10px] font-bold px-1.5 py-0.5 rounded-full border",
            isComplete ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" : cn(colorBgMap[color], colorTextMap[color])
          )}>
            {pct}%
          </span>
        </div>
      </div>
      <PremiumProgress value={meta.percentual} color={activeColor} />
    </motion.div>
  );
}

export default function MetasCard({ metas, mediaGeral }) {
  const now = new Date();

  return (
    <div className="rounded-2xl border border-white/[0.07] backdrop-blur-xl bg-gradient-to-br from-white/[0.05] to-white/[0.02] flex flex-col h-full">
      <div className="p-5 border-b border-white/[0.05]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10">
              <Target className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Metas do Mês</p>
              <p className="text-[11px] text-slate-500">{format(now, "MMMM 'de' yyyy", { locale: ptBR })}</p>
            </div>
          </div>
          {metas.length > 0 && (
            <span className={cn(
              "text-xs font-bold px-2.5 py-1 rounded-full border",
              mediaGeral >= 100 ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" :
              mediaGeral >= 70 ? "bg-sky-500/15 text-sky-400 border-sky-500/25" :
              "bg-amber-500/15 text-amber-400 border-amber-500/25"
            )}>
              {mediaGeral}%
            </span>
          )}
        </div>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        {metas.length > 0 ? (
          <div className="space-y-2">
            {metas.map((meta, i) => <MetaRow key={meta.tipo} meta={meta} index={i} />)}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center mb-3">
              <Target className="w-5 h-5 text-slate-600" />
            </div>
            <p className="text-slate-400 text-sm font-medium">Nenhuma meta definida</p>
            <p className="text-slate-600 text-[11px] mt-1">Fale com seu gestor</p>
          </div>
        )}
      </div>
    </div>
  );
}