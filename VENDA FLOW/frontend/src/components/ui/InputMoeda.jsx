import React, { useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * InputMoeda — campo de entrada formatado como moeda BRL (R$).
 * Armazena o valor numérico em centavos internamente e exibe
 * o formato "R$ 1.234,56" enquanto o usuário digita.
 *
 * Props:
 *   value        — número (float) ex: 1234.56
 *   onChange     — (number | undefined) => void
 *   placeholder  — string
 *   className    — className extra para o input
 *   disabled     — boolean
 */
export default function InputMoeda({ value, onChange, placeholder = "R$ 0,00", className, disabled }) {
  const inputRef = useRef(null);

  // Formata número → "R$ 1.234,56"
  const formatar = (num) => {
    if (num === undefined || num === null || isNaN(num)) return "";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
  };

  const handleKeyDown = (e) => {
    // Permite: Backspace, Delete, Tab, Escape, Enter, setas, Home, End
    const allowed = ["Backspace", "Delete", "Tab", "Escape", "Enter", "ArrowLeft", "ArrowRight", "Home", "End"];
    if (allowed.includes(e.key)) return;
    // Permite só dígitos
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleInput = (e) => {
    // Pega só os dígitos do que foi digitado
    const raw = e.target.value.replace(/\D/g, "");
    if (raw === "") { onChange(undefined); return; }
    const centavos = parseInt(raw, 10);
    const float = centavos / 100;
    onChange(float);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      disabled={disabled}
      placeholder={placeholder}
      value={value !== undefined && value !== null && value !== "" ? formatar(value) : ""}
      onKeyDown={handleKeyDown}
      onInput={handleInput}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
    />
  );
}