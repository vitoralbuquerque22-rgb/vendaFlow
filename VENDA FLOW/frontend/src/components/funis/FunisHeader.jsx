import { formatarValor } from "../../lib/funis";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertCircle, TrendingUp, Zap } from "lucide-react";

/**
 * FunisHeader
 * Barra de filtros (SDR / Closer / Equipe) + KPIs rápidos de pipeline.
 * Componente puramente visual — recebe dados e callbacks, não faz fetch.
 */
export default function FunisHeader({
  sdrs = [],
  closers = [],
  equipes = [],
  filtroSDR,
  filtroCloser,
  filtroEquipe,
  onFiltroSDR,
  onFiltroCloser,
  onFiltroEquipe,
  totalPipeline = 0,
  fechamHoje = 0,
  semProximoPasso = 0,
}) {
  const kpis = [
    {
      label: "Pipeline total",
      value: formatarValor(totalPipeline),
      cor: "#818cf8",
      Icon: TrendingUp,
    },
    {
      label: "Fecham hoje",
      value: String(fechamHoje),
      cor: "#10b981",
      Icon: Zap,
    },
    {
      label: "Sem próx. ação",
      value: String(semProximoPasso),
      cor: semProximoPasso > 0 ? "#f87171" : "#334155",
      Icon: AlertCircle,
    },
  ];

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      marginBottom: 16, flexWrap: "wrap",
    }}>
      {/* ── Label ── */}
      <span style={{ fontSize: 12, color: "#475569", flexShrink: 0 }}>Filtrar:</span>

      {/* ── Filtro SDR ── */}
      <Select value={filtroSDR} onValueChange={onFiltroSDR}>
        <SelectTrigger className="w-36 h-8 text-xs bg-slate-900/80 border-slate-700/60 text-slate-300">
          <SelectValue placeholder="SDR" />
        </SelectTrigger>
        <SelectContent className="bg-slate-800 border-slate-700">
          <SelectItem value="todos">Todos SDRs</SelectItem>
          {sdrs.map(u => (
            <SelectItem key={u.email} value={u.email}>
              {u.full_name?.split(" ")[0] || u.email.split("@")[0]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* ── Filtro Closer ── */}
      <Select value={filtroCloser} onValueChange={onFiltroCloser}>
        <SelectTrigger className="w-36 h-8 text-xs bg-slate-900/80 border-slate-700/60 text-slate-300">
          <SelectValue placeholder="Closer" />
        </SelectTrigger>
        <SelectContent className="bg-slate-800 border-slate-700">
          <SelectItem value="todos">Todos Closers</SelectItem>
          {closers.map(u => (
            <SelectItem key={u.email} value={u.email}>
              {u.full_name?.split(" ")[0] || u.email.split("@")[0]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* ── Filtro Equipe (só se houver) ── */}
      {equipes.length > 0 && (
        <Select value={filtroEquipe} onValueChange={onFiltroEquipe}>
          <SelectTrigger className="w-36 h-8 text-xs bg-slate-900/80 border-slate-700/60 text-slate-300">
            <SelectValue placeholder="Equipe" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="todos">Todas Equipes</SelectItem>
            {equipes.map(eq => (
              <SelectItem key={eq} value={eq}>{eq}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* ── KPIs ── */}
      <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
        {kpis.map((kpi, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 10, padding: "6px 12px",
          }}>
            <kpi.Icon style={{ width: 14, height: 14, color: kpi.cor, flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: kpi.cor, margin: 0, lineHeight: 1 }}>
                {kpi.value}
              </p>
              <p style={{ fontSize: 10, color: "#334155", margin: 0, marginTop: 2 }}>
                {kpi.label}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}