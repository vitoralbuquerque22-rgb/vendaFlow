import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Check, X } from "lucide-react";

const STATES = {
  idle: {
    label: "Atualizar",
    Icon: RefreshCw,
    bg: "rgba(15, 23, 42, 0.6)",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    color: "#e2e8f0",
    shadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.6)",
  },
  loading: {
    label: "Atualizando…",
    Icon: RefreshCw,
    bg: "rgba(30, 41, 59, 0.8)",
    border: "1px solid rgba(148, 163, 184, 0.28)",
    color: "#cbd5e1",
  },
  success: {
    label: "Atualizado",
    Icon: Check,
    bg: "rgba(16, 185, 129, 0.15)",
    border: "1px solid rgba(16, 185, 129, 0.5)",
    color: "#34d399",
    shadow: "0 0 0 4px rgba(16,185,129,0.08), 0 8px 24px -12px rgba(16,185,129,0.4)",
    holdMs: 1600,
  },
  error: {
    label: "Falhou",
    Icon: X,
    bg: "rgba(239, 68, 68, 0.12)",
    border: "1px solid rgba(239, 68, 68, 0.5)",
    color: "#f87171",
    holdMs: 1600,
  },
};

/**
 * ButtonAtualizar — botão com estados idle → loading → success/error → idle
 * 
 * Props:
 *   onClick: async () => void   — deve ser uma função async (ou retornar Promise)
 *   label?: string              — texto padrão no estado idle (default "Atualizar")
 *   className?: string
 */
export default function ButtonAtualizar({ onClick, label, className = "" }) {
  const [status, setStatus] = useState("idle");
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const cfg = STATES[status];

  const handleClick = async () => {
    if (status !== "idle") return;
    setStatus("loading");
    try {
      await onClick?.();
      setStatus("success");
      timerRef.current = setTimeout(() => setStatus("idle"), STATES.success.holdMs);
    } catch {
      setStatus("error");
      timerRef.current = setTimeout(() => setStatus("idle"), STATES.error.holdMs);
    }
  };

  const iconVariants = {
    loading: { rotate: [0, 360], transition: { duration: 0.9, ease: "linear", repeat: Infinity } },
    success: { scale: [0.6, 1.15, 1], transition: { duration: 0.35, ease: "easeOut" } },
    error:   { x: [0, -4, 4, -3, 3, 0], transition: { duration: 0.4 } },
    idle:    {},
  };

  return (
    <motion.button
      onClick={handleClick}
      disabled={status === "loading"}
      aria-busy={status === "loading"}
      whileHover={status === "idle" ? { scale: 1.02, filter: "brightness(1.05)" } : {}}
      whileTap={status === "idle" ? { scale: 0.97 } : {}}
      animate={{
        background: cfg.bg,
        border: cfg.border,
        color: cfg.color,
        boxShadow: cfg.shadow || "none",
      }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 8,
        paddingBottom: 8,
        borderRadius: 10,
        fontSize: 14,
        fontWeight: 500,
        minWidth: 132,
        cursor: status === "loading" ? "wait" : status === "success" ? "default" : "pointer",
        outline: "none",
        border: "none",
        whiteSpace: "nowrap",
        justifyContent: "center",
      }}
      className={className}
    >
      <motion.span
        key={status + "-icon"}
        variants={iconVariants}
        animate={status}
        style={{ display: "flex", flexShrink: 0 }}
      >
        <cfg.Icon size={16} />
      </motion.span>

      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={status}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          aria-live="polite"
        >
          {status === "idle" && label ? label : cfg.label}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}