import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Target, Edit3, BarChart3, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PerformanceIndicator from "@/components/crm/PerformanceIndicator";

function GlassCard({ children, className = "", glow = false }) {
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.005 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "rounded-2xl border border-white/[0.07] backdrop-blur-xl",
        "bg-gradient-to-br from-white/[0.05] to-white/[0.02]",
        glow && "shadow-lg shadow-sky-500/10",
        "transition-all duration-300",
        className
      )}>
      
      {children}
    </motion.div>);

}

const colorTextMap = {
  sky: "text-sky-400", violet: "text-violet-400",
  emerald: "text-emerald-400", amber: "text-amber-400", rose: "text-rose-400"
};
const colorBadgeMap = {
  sky: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  violet: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  rose: "bg-rose-500/10 text-rose-400 border-rose-500/20"
};

export default function PerfilSidebar({
  user, papel, inicial, performanceIndicador, recordItems,
  onEditarPerfil, onAbrirDesempenho
}) {
  return (
    <div className="space-y-4">
      {/* User card */}
      <GlassCard glow>
        
















        
      </GlassCard>

      {/* Performance */}
      {performanceIndicador &&
      <GlassCard glow>
          <div className="p-4">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-3">Performance</p>
            <PerformanceIndicator value={performanceIndicador.value} type={performanceIndicador.type} size="sm" />
          </div>
        </GlassCard>
      }

      {/* Recordes */}
      {recordItems.length > 0 ?
      <GlassCard>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-amber-500/10">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <p className="text-xs font-semibold text-white">Recordes</p>
            </div>
            <div className="space-y-1.5">
              {recordItems.map((r) =>
            <div key={r.label} className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                  <span className="text-[11px] text-slate-400">{r.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("text-sm font-bold", colorTextMap[r.color])}>{r.value}</span>
                    <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded-full border", colorBadgeMap[r.color])}>
                      {format(new Date(r.mes), "MMM/yy", { locale: ptBR })}
                    </span>
                  </div>
                </div>
            )}
            </div>
          </div>
        </GlassCard> :

      <GlassCard>
          <div className="p-4 text-center">
            <Trophy className="w-5 h-5 text-amber-400/30 mx-auto mb-2" />
            <p className="text-xs text-slate-600">Nenhum recorde ainda</p>
          </div>
        </GlassCard>
      }

      {/* Quick Actions */}
      <GlassCard>
        <div className="p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-3">Ações Rápidas</p>
          <div className="grid grid-cols-2 gap-2">
            {[
            { label: "Editar Perfil", icon: Edit3, color: "sky", action: onEditarPerfil },
            { label: "Desempenho", icon: BarChart3, color: "violet", action: onAbrirDesempenho },
            { label: "Minhas Metas", icon: Target, color: "emerald", action: () => {} },
            { label: "Atividade", icon: Activity, color: "amber", action: () => {} }].
            map((item) => {
              const Icon = item.icon;
              const cMap = {
                sky: "bg-sky-500/10 text-sky-400 border-sky-500/15 hover:border-sky-500/30 hover:bg-sky-500/15",
                violet: "bg-violet-500/10 text-violet-400 border-violet-500/15 hover:border-violet-500/30 hover:bg-violet-500/15",
                emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/15 hover:border-emerald-500/30 hover:bg-emerald-500/15",
                amber: "bg-amber-500/10 text-amber-400 border-amber-500/15 hover:border-amber-500/30 hover:bg-amber-500/15"
              };
              return (
                <motion.button
                  key={item.label}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={item.action}
                  className={cn("flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all duration-200 text-center", cMap[item.color])}>
                  
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-[9px] font-medium leading-tight">{item.label}</span>
                </motion.button>);

            })}
          </div>
        </div>
      </GlassCard>
    </div>);

}