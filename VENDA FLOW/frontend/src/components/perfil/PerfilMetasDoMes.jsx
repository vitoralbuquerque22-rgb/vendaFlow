import { Target } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import GlassCard from "./GlassCard";

function ProgressRow({ meta, index }) {
  const { nome, realizado, meta: total, percentual, accent } = meta;
  const pct = Math.min(Math.round(percentual), 100);
  const cssAccent = `hsl(${accent})`;
  const cssAccentFaint = `hsl(${accent} / 0.12)`;
  const cssAccentRing = `hsl(${accent} / 0.30)`;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      whileHover={{ background: "hsl(0 0% 100% / 0.05)" }}
      className="flex flex-col gap-2 px-3.5 py-2.5 rounded-xl transition-all duration-200"
      style={{
        background: "hsl(0 0% 100% / 0.03)",
        border: "1px solid hsl(0 0% 100% / 0.05)",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: "hsl(220 15% 75%)" }}>{nome}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono" style={{ color: "hsl(220 15% 55%)" }}>
            {realizado}<span style={{ color: "hsl(220 15% 40%)" }}>/{total}</span>
          </span>
          <span className="text-xs font-bold px-1.5 py-0.5 rounded-full"
            style={{
              background: cssAccentFaint,
              boxShadow: `inset 0 0 0 1px ${cssAccentRing}`,
              color: `hsl(${accent.split(" ")[0]} ${accent.split(" ")[1]} 75%)`,
            }}
          >
            {pct}%
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(0 0% 100% / 0.05)" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(pct, 2)}%` }}
          transition={{ duration: 0.7, ease: "easeOut", delay: index * 0.06 + 0.1 }}
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, ${cssAccent}, hsl(${accent} / 0.6))`,
            boxShadow: `0 0 12px hsl(${accent} / 0.6)`,
          }}
        />
      </div>
    </motion.div>
  );
}

export default function PerfilMetasDoMes({ metas = [], mediaGeral = 0 }) {
  const now = new Date();

  return (
    <GlassCard glow="emerald">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "hsl(160 84% 45% / 0.12)", border: "1px solid hsl(160 84% 45% / 0.30)" }}>
              <Target className="w-4 h-4" style={{ color: "hsl(160 84% 60%)" }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "#fff" }}>Metas do Mês</p>
              <p className="text-xs" style={{ color: "hsl(220 15% 55%)" }}>
                {format(now, "MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>
          {metas.length > 0 && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{
                background: "hsl(262 83% 60% / 0.12)",
                border: "1px solid hsl(262 83% 60% / 0.30)",
                color: "hsl(262 83% 75%)",
              }}
            >
              {mediaGeral}%
            </span>
          )}
        </div>

        {/* Goals */}
        <div className="space-y-2">
          {metas.length === 0 ? (
            <div className="py-8 text-center">
              <Target className="w-8 h-8 mx-auto mb-2 opacity-20" style={{ color: "hsl(160 84% 45%)" }} />
              <p className="text-xs font-medium" style={{ color: "hsl(220 15% 55%)" }}>Nenhuma meta definida</p>
              <p className="text-xs mt-0.5" style={{ color: "hsl(220 15% 40%)" }}>Fale com seu gestor</p>
            </div>
          ) : (
            metas.map((meta, i) => <ProgressRow key={meta.nome} meta={meta} index={i} />)
          )}
        </div>
      </div>
    </GlassCard>
  );
}