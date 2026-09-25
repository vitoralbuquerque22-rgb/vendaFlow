import { useState } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import GlassCard from "./GlassCard";

export default function PerfilComposer({ user }) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);

  const showEmpty = value.length === 0 && !focused;

  return (
    <GlassCard glow="sky">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: "hsl(160 84% 45% / 0.12)",
                border: "1px solid hsl(160 84% 45% / 0.30)",
              }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "hsl(160 84% 60%)" }} />
            </div>
            <span className="text-sm font-semibold" style={{ color: "#fff" }}>Anotação rápida</span>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: "hsl(199 89% 55% / 0.12)",
              border: "1px solid hsl(199 89% 55% / 0.30)",
              color: "hsl(199 89% 70%)",
            }}
          >
            Beta
          </span>
        </div>

        {/* Empty state */}
        <AnimatePresence>
          {showEmpty && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center text-center py-6 mb-3"
            >
              <div className="relative w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                style={{
                  background: "linear-gradient(135deg, hsl(199 89% 55% / 0.2), hsl(262 83% 60% / 0.2))",
                  border: "1px solid hsl(0 0% 100% / 0.10)",
                  boxShadow: "0 0 24px hsl(199 89% 55% / 0.3)",
                }}
              >
                <div className="absolute inset-0 rounded-xl blur-xl opacity-60"
                  style={{ background: "hsl(199 89% 55% / 0.3)" }} />
                <Sparkles className="relative w-5 h-5" style={{ color: "hsl(199 89% 70%)" }} />
              </div>
              <p className="text-sm font-semibold mb-1" style={{ color: "#fff" }}>Sem anotações ainda</p>
              <p className="text-xs leading-relaxed" style={{ color: "hsl(220 15% 55%)" }}>
                Comece registrando uma observação sobre o seu dia.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Textarea */}
        <textarea
          rows={2}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Escreva uma nota sobre seu dia..."
          className="w-full text-sm resize-none outline-none transition-all duration-150"
          style={{
            background: "hsl(222 47% 5% / 0.8)",
            border: focused ? "2px solid hsl(199 89% 55% / 0.5)" : "1px solid hsl(0 0% 100% / 0.08)",
            borderRadius: "12px",
            color: "#fff",
            padding: "10px 14px",
            boxShadow: focused ? "0 0 0 4px hsl(199 89% 55% / 0.08)" : "none",
          }}
        />

        {/* Save button */}
        {(value.length > 0 || focused) && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-end mt-2"
          >
            <button
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-all"
              style={{
                background: "linear-gradient(135deg, hsl(199 89% 55%), hsl(262 83% 60%))",
                boxShadow: "0 4px 14px -4px hsl(217 91% 60% / 0.6)",
                fontSize: "11.5px",
              }}
              onClick={() => { setValue(""); setFocused(false); }}
            >
              Salvar
            </button>
          </motion.div>
        )}
      </div>
    </GlassCard>
  );
}