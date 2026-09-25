import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * GlassCard — base card reutilizável do design system VendaFlow Perfil.
 * Props:
 *   glow: "sky" | "violet" | "emerald" | "amber" | "rose" (optional)
 *   hover: boolean — ativa translateY(-2px) no hover
 *   className, style, children
 */

const GLOW = {
  sky:     "hsl(199 89% 55% / 0.12)",
  violet:  "hsl(262 83% 60% / 0.12)",
  emerald: "hsl(160 84% 45% / 0.12)",
  amber:   "hsl(38 92% 55% / 0.12)",
  rose:    "hsl(0 72% 55% / 0.12)",
};

export default function GlassCard({ children, className = "", style = {}, glow, hover = true }) {
  return (
    <motion.div
      whileHover={hover ? { y: -2 } : {}}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn("relative rounded-2xl overflow-hidden", className)}
      style={{
        background: "hsl(222 47% 7% / 0.6)",
        border: "1px solid hsl(0 0% 100% / 0.06)",
        boxShadow: "0 8px 32px -12px hsl(222 47% 2% / 0.6), inset 0 1px 0 hsl(0 0% 100% / 0.04)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        ...style,
      }}
    >
      {/* Ambient glow blob */}
      {glow && (
        <div
          className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full"
          style={{
            background: `radial-gradient(circle, ${GLOW[glow]}, transparent 70%)`,
            filter: "blur(24px)",
          }}
        />
      )}
      {/* Top sheen */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.06), transparent)" }}
      />
      <div className="relative">{children}</div>
    </motion.div>
  );
}