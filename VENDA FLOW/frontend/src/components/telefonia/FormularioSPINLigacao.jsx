import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Clock, Lightbulb } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { carregarMapaNomes } from "@/lib/services/equipeService";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";

const CAMPOS_SPIN = [
  {
    key: "situacao",
    letra: "S",
    titulo: "Situação",
    descricao: "Contexto atual do cliente",
    placeholder: "Ex: Tem quanto tempo tem a oficina? Quantos carros atende por dia? Usa algum sistema hoje?",
    color: "from-sky-500 to-sky-400",
    glow: "shadow-sky-500/20",
    border: "border-sky-500/30",
    ring: "focus:ring-sky-500/20 focus:border-sky-500/50",
    obrigatorio: true,
  },
  {
    key: "problema",
    letra: "P",
    titulo: "Problema",
    descricao: "Dor ou dificuldade identificada",
    placeholder: "Ex: Quais os maiores problemas hoje? O que mais toma tempo? Onde perde mais dinheiro?",
    color: "from-violet-500 to-violet-400",
    glow: "shadow-violet-500/20",
    border: "border-violet-500/30",
    ring: "focus:ring-violet-500/20 focus:border-violet-500/50",
    obrigatorio: true,
  },
  {
    key: "implicacao",
    letra: "I",
    titulo: "Implicação",
    descricao: "Consequências do problema",
    placeholder: "Ex: Quanto isso custa por mês? Quantos clientes perde? Como afeta a equipe?",
    color: "from-amber-500 to-amber-400",
    glow: "shadow-amber-500/20",
    border: "border-amber-500/30",
    ring: "focus:ring-amber-500/20 focus:border-amber-500/50",
    obrigatorio: false,
  },
  {
    key: "necessidade",
    letra: "N",
    titulo: "Necessidade",
    descricao: "O que o cliente precisa",
    placeholder: "Ex: O que seria ideal para resolver? O que mudaria se tivesse uma solução?",
    color: "from-emerald-500 to-emerald-400",
    glow: "shadow-emerald-500/20",
    border: "border-emerald-500/30",
    ring: "focus:ring-emerald-500/20 focus:border-emerald-500/50",
    obrigatorio: false,
  },
  {
    key: "proximo_passo",
    letra: "→",
    titulo: "Próximo passo",
    descricao: "O que ficou combinado",
    placeholder: "Ex: Reunião agendada para X, vai pensar e ligar de volta, pediu proposta...",
    color: "from-rose-500 to-rose-400",
    glow: "shadow-rose-500/20",
    border: "border-rose-500/30",
    ring: "focus:ring-rose-500/20 focus:border-rose-500/50",
    obrigatorio: true,
  },
];

export default function FormularioSPINLigacao({ spin, onChange, erro, spinAnteriores = [] }) {
  const [expandido, setExpandido]           = useState(null);
  const [mostrarAnteriores, setMostrarAnteriores] = useState(false);
  const { empresaId } = useEmpresaAtual();
  const { data: mapaNomes = new Map() } = useQuery({
    queryKey: ["mapaNomes", empresaId],
    queryFn: () => carregarMapaNomes(empresaId),
    enabled: !!empresaId,
    staleTime: 120000,
  });

  const handleChange = (key, value) => {
    onChange({ ...spin, [key]: value });
  };

  const camposPreenchidos = CAMPOS_SPIN.filter(c => spin[c.key]?.trim().length > 0).length;
  const progresso = Math.round((camposPreenchidos / CAMPOS_SPIN.length) * 100);

  return (
    <div className="space-y-3">
      {/* ── Progresso ─────────────────────────────────── */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
          SPIN Selling — {camposPreenchidos}/{CAMPOS_SPIN.length} campos
        </p>
        <span className={cn(
          "text-xs font-semibold",
          camposPreenchidos >= 3 ? "text-emerald-400" : "text-amber-400"
        )}>
          {camposPreenchidos >= 3 ? "✓ Mínimo atingido" : "Mín. 3 campos"}
        </span>
      </div>

      {/* Barra de progresso */}
      <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            camposPreenchidos >= 3
              ? "bg-gradient-to-r from-sky-500 to-emerald-400"
              : "bg-gradient-to-r from-sky-500 to-violet-500"
          )}
          style={{ width: `${progresso}%` }}
        />
      </div>

      {/* ── Erro de validação ─────────────────────────── */}
      {erro && camposPreenchidos < 3 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
          <span className="text-xs text-rose-300">
            Preencha pelo menos Situação, Problema e Próximo passo para finalizar.
          </span>
        </div>
      )}

      {/* ── Campos SPIN ───────────────────────────────── */}
      {CAMPOS_SPIN.map((campo) => {
        const preenchido = spin[campo.key]?.trim().length > 0;
        const aberto = expandido === campo.key || preenchido;

        return (
          <div
            key={campo.key}
            className={cn(
              "rounded-xl border transition-all duration-200 overflow-hidden",
              preenchido
                ? cn("border-opacity-40", campo.border, "bg-slate-800/40")
                : "border-slate-700/40 bg-slate-800/30",
              erro && campo.obrigatorio && !preenchido && "border-rose-500/40 bg-rose-500/5"
            )}
          >
            {/* Header do campo */}
            <button
              onClick={() => setExpandido(aberto ? null : campo.key)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
            >
              {/* Letra SPIN */}
              <div className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold text-white bg-gradient-to-br shadow-sm",
                preenchido ? campo.color : "from-slate-700 to-slate-600",
                preenchido && campo.glow
              )}>
                {campo.letra}
              </div>

              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    "text-xs font-semibold",
                    preenchido ? "text-slate-200" : "text-slate-400"
                  )}>
                    {campo.titulo}
                  </span>
                  {campo.obrigatorio && (
                    <span className="text-[10px] text-rose-400/70">*</span>
                  )}
                </div>
                {!preenchido && (
                  <p className="text-[10px] text-slate-600 truncate">{campo.descricao}</p>
                )}
                {preenchido && !aberto && (
                  <p className="text-[10px] text-slate-500 truncate">{spin[campo.key]}</p>
                )}
              </div>

              {preenchido && (
                <div className={cn("w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br text-white text-[8px]", campo.color)}>
                  ✓
                </div>
              )}

              <div className="text-slate-600 flex-shrink-0">
                {aberto ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </div>
            </button>

            {/* Textarea */}
            {aberto && (
              <div className="px-3 pb-3">
                <textarea
                  value={spin[campo.key]}
                  onChange={e => handleChange(campo.key, e.target.value)}
                  placeholder={campo.placeholder}
                  rows={3}
                  autoFocus
                  className={cn(
                    "w-full px-3 py-2.5 rounded-xl bg-slate-900/60 border text-sm text-slate-200",
                    "placeholder-slate-700 resize-none focus:outline-none transition-all",
                    campo.ring,
                    "border-slate-700/50"
                  )}
                />
              </div>
            )}
          </div>
        );
      })}

      {/* ── SPIN anteriores ───────────────────────────── */}
      {spinAnteriores.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setMostrarAnteriores(v => !v)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <Clock className="w-3 h-3" />
            {spinAnteriores.length} SPIN{spinAnteriores.length > 1 ? "s" : ""} anteriores
            {mostrarAnteriores ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {mostrarAnteriores && (
            <div className="mt-2 space-y-2">
              {spinAnteriores.slice(0, 3).map((anterior, i) => (
                <div key={i} className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-slate-500 font-medium">
                      {mapaNomes.get((anterior.sdr_email || '').toLowerCase()) || anterior.sdr_email?.split("@")[0]}
                    </span>
                    <span className="text-[10px] text-slate-600">
                      {anterior.data_ligacao
                        ? format(new Date(anterior.data_ligacao), "dd/MM 'às' HH:mm", { locale: ptBR })
                        : ""}
                    </span>
                  </div>
                  {[
                    { key: "situacao", label: "S" },
                    { key: "problema", label: "P" },
                    { key: "proximo_passo", label: "→" },
                  ].filter(f => anterior[f.key]).map(({ key, label }) => (
                    <div key={key} className="flex gap-2 text-xs mt-1">
                      <span className="text-slate-600 w-4 flex-shrink-0">{label}</span>
                      <span className="text-slate-400 line-clamp-1">{anterior[key]}</span>
                    </div>
                  ))}

                  {/* Botão usar como base */}
                  <button
                    onClick={() => {
                      onChange({
                        situacao:      anterior.situacao || "",
                        problema:      anterior.problema || "",
                        implicacao:    anterior.implicacao || "",
                        necessidade:   anterior.necessidade || "",
                        proximo_passo: "",
                      });
                      setMostrarAnteriores(false);
                    }}
                    className="mt-2 text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-1"
                  >
                    <Lightbulb className="w-3 h-3" />
                    Usar como base
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}