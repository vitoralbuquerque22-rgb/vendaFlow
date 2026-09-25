import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Gera e copia o link de convite. O colaborador abre o link, faz login/cadastro
 * e cai direto na empresa que o convidou (AceitarConvite lê ?convite=CODIGO).
 */
export function gerarLinkConvite(codigo) {
  return `${window.location.origin}/AceitarConvite?convite=${codigo}`;
}

export default function CopiarLinkConvite({ codigo, variant = "button", className }) {
  const [copiado, setCopiado] = useState(false);
  const link = gerarLinkConvite(codigo);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const el = document.createElement("textarea");
      el.value = link;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopiado(true);
    toast.success("Link de convite copiado!");
    setTimeout(() => setCopiado(false), 2000);
  };

  if (variant === "icon") {
    return (
      <button
        onClick={copiar}
        title="Copiar link de convite"
        className={cn("h-7 px-2 flex items-center gap-1 rounded-md text-xs text-sky-400/60 hover:text-sky-400 transition-colors", className)}
      >
        {copiado ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {copiado ? "Copiado" : "Copiar link"}
      </button>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 p-3 bg-slate-800 rounded-lg border border-slate-700">
        <p className="flex-1 text-xs text-slate-300 font-mono truncate">{link}</p>
        <button
          onClick={copiar}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-sky-500/15 text-sky-300 hover:bg-sky-500/25 transition-colors flex-shrink-0"
        >
          {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>
      <p className="text-[11px] text-slate-500">O colaborador abre este link, faz login e entra direto na sua empresa.</p>
    </div>
  );
}