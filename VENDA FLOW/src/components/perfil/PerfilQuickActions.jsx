import { Pencil, TrendingUp, Target, Activity, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import GlassCard from "./GlassCard";

const ACTIONS = [
  {
    label: "Editar Perfil",
    icon: Pencil,
    gradient: "linear-gradient(135deg, hsl(199 89% 55% / 0.18), hsl(217 91% 60% / 0.10))",
    ring: "hsl(199 89% 55% / 0.35)",
    glow: "hsl(199 89% 55% / 0.5)",
    iconColor: "hsl(199 89% 70%)",
    key: "edit",
  },
  {
    label: "Desempenho",
    icon: TrendingUp,
    gradient: "linear-gradient(135deg, hsl(262 83% 60% / 0.18), hsl(282 83% 60% / 0.10))",
    ring: "hsl(262 83% 60% / 0.35)",
    glow: "hsl(262 83% 60% / 0.5)",
    iconColor: "hsl(262 83% 75%)",
    key: "desempenho",
  },
  {
    label: "Minhas Metas",
    icon: Target,
    gradient: "linear-gradient(135deg, hsl(160 84% 45% / 0.18), hsl(174 72% 50% / 0.10))",
    ring: "hsl(160 84% 45% / 0.35)",
    glow: "hsl(160 84% 45% / 0.5)",
    iconColor: "hsl(160 84% 60%)",
    key: "metas",
  },
  {
    label: "Atividade",
    icon: Activity,
    gradient: "linear-gradient(135deg, hsl(38 92% 55% / 0.18), hsl(20 90% 55% / 0.10))",
    ring: "hsl(38 92% 55% / 0.35)",
    glow: "hsl(38 92% 55% / 0.5)",
    iconColor: "hsl(38 92% 60%)",
    key: "atividade",
  },
];

export default function PerfilQuickActions({ onEditarPerfil, onDesempenho }) {
  const handlers = {
    edit: onEditarPerfil,
    desempenho: onDesempenho,
    metas: () => {},
    atividade: () => {},
  };

  return (
    <GlassCard glow="sky">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-3.5 h-3.5" style={{ color: "hsl(199 89% 70%)" }} />
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "hsl(220 15% 55%)" }}>
            Ações Rápidas
          </span>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <motion.button
                key={action.key}
                whileHover={{ y: -2, boxShadow: `0 10px 30px -10px ${action.glow}` }}
                whileTap={{ scale: 0.96 }}
                onClick={handlers[action.key]}
                className="relative flex flex-col items-center gap-2 p-3 rounded-xl text-xs font-semibold transition-all duration-300 overflow-hidden outline-none"
                style={{
                  background: action.gradient,
                  border: `1px solid ${action.ring}`,
                  color: action.iconColor,
                }}
              >
                {/* Top shine on hover */}
                <div className="pointer-events-none absolute inset-x-0 -top-px h-px"
                  style={{ background: "linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.30), transparent)" }} />

                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{
                    background: "hsl(0 0% 100% / 0.06)",
                    border: "1px solid hsl(0 0% 100% / 0.10)",
                  }}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span style={{ color: "#fff", fontSize: "11px" }}>{action.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
}