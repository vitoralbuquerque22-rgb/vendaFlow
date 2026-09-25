import { Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import GlassCard from "./GlassCard";

export default function PerfilRecordes({ recordes = [] }) {
  return (
    <GlassCard glow="amber">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: "hsl(38 92% 55% / 0.12)",
              border: "1px solid hsl(38 92% 55% / 0.30)",
            }}
          >
            <Trophy className="w-4 h-4" style={{ color: "hsl(38 92% 60%)" }} />
          </div>
          <span className="text-sm font-semibold" style={{ color: "#fff" }}>Recordes</span>
        </div>

        {/* Records */}
        <div className="space-y-2">
          {recordes.length === 0 ? (
            <div className="py-6 text-center">
              <Trophy className="w-8 h-8 mx-auto mb-2 opacity-20" style={{ color: "hsl(38 92% 55%)" }} />
              <p className="text-xs" style={{ color: "hsl(220 15% 40%)" }}>Nenhum recorde ainda</p>
            </div>
          ) : (
            recordes.map((r, i) => (
              <motion.div
                key={r.label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                style={{
                  background: "hsl(0 0% 100% / 0.03)",
                  border: "1px solid hsl(0 0% 100% / 0.06)",
                }}
              >
                <span className="text-xs font-medium" style={{ color: "hsl(220 15% 75%)" }}>{r.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold" style={{ color: "#fff" }}>{r.valor}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: "hsl(0 72% 55% / 0.12)",
                      border: "1px solid hsl(0 72% 55% / 0.30)",
                      color: "hsl(0 72% 72%)",
                    }}
                  >
                    {(() => {
                      try { return format(new Date(r.mes + "-01"), "MMM/yy", { locale: ptBR }); } catch { return r.mes; }
                    })()}
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </GlassCard>
  );
}