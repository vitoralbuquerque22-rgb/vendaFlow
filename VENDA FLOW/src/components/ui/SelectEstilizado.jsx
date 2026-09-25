/**
 * SelectEstilizado — Dropdown premium dark com estilo VendaFLOW
 *
 * Visual: fundo escuro (#0A1023), item selecionado com gradiente laranja,
 * checkmark à direita, borda sutil, bordas arredondadas.
 *
 * Props:
 *   value       — valor atual (string)
 *   onChange    — função chamada com o novo valor
 *   options     — array de { value: string, label: string }
 *   placeholder — texto quando nenhum valor selecionado (opcional)
 *   className   — classes extras para o trigger (opcional)
 *   style       — estilos extras para o trigger (opcional)
 *   disabled    — boolean (opcional)
 *
 * Uso:
 *   import SelectEstilizado from "@/components/ui/SelectEstilizado";
 *
 *   <SelectEstilizado
 *     value={visualizacao}
 *     onChange={setVisualizacao}
 *     options={[
 *       { value: "sdr",          label: "Dashboard SDR" },
 *       { value: "closer",       label: "Dashboard Closer" },
 *       { value: "bdr",          label: "Dashboard BDR" },
 *       { value: "vendedor",     label: "Dashboard Vendedor" },
 *       { value: "telemarketing",label: "Dashboard Telemarketing" },
 *     ]}
 *   />
 */

import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function SelectEstilizado({
  value,
  onChange,
  options = [],
  placeholder = "Selecionar...",
  className = "",
  style = {},
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const selected = options.find((o) => o.value === value);

  // Fechar ao clicar fora
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (val) => {
    onChange(val);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative" style={{ userSelect: "none" }}>
      {/* ── Trigger ── */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          "flex items-center justify-between gap-2 px-3 py-2 text-sm font-semibold transition-all duration-200 outline-none",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        style={{
          minWidth: 160,
          height: 38,
          background: "rgba(15,23,42,0.85)",
          border: open
            ? "1px solid rgba(255,107,53,0.55)"
            : "1px solid rgba(255,255,255,0.10)",
          borderRadius: 10,
          color: "#E2E8F0",
          boxShadow: open ? "0 0 0 3px rgba(255,107,53,0.12)" : "none",
          ...style,
        }}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown
          className="flex-shrink-0 transition-transform duration-200"
          style={{
            width: 15,
            height: 15,
            color: "#94A3B8",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {/* ── Dropdown ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute z-[9999] min-w-full"
            style={{
              top: "calc(100% + 6px)",
              left: 0,
              background: "#0A1023",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 12,
              padding: "4px",
              boxShadow: "0 16px 48px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.35)",
              backdropFilter: "blur(20px)",
              minWidth: 200,
            }}
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm font-medium text-left transition-all duration-150 outline-none"
                  style={{
                    borderRadius: 8,
                    color: isSelected ? "#FFFFFF" : "#CBD5E1",
                    background: isSelected
                      ? "linear-gradient(90deg, #FF6B35 0%, #FF8C42 100%)"
                      : "transparent",
                    boxShadow: isSelected
                      ? "0 0 18px rgba(255,107,53,0.35)"
                      : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                      e.currentTarget.style.color = "#FFFFFF";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "#CBD5E1";
                    }
                  }}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <Check
                      style={{ width: 14, height: 14, flexShrink: 0, color: "#FFFFFF" }}
                    />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}