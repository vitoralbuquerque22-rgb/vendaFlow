import { ChevronRight } from "lucide-react";
import CardLeadFunil from "./CardLeadFunil";
import { calcularTotalPipeline, formatarValor } from "../../lib/funis";

const CONFIG = {
  pipeline: {
    funil3: { label: "Funil 3 — Prospecção",     sublabel: "Dinheiro do Mês",    cor: "#6366f1", largura: "100%" },
    funil2: { label: "Funil 2 — Desenvolvimento", sublabel: "Dinheiro da Semana", cor: "#f59e0b", largura: "78%"  },
    funil1: { label: "Funil 1 — Fechamento",      sublabel: "Dinheiro de Hoje",   cor: "#10b981", largura: "56%"  },
  },
  forecast: {
    funil3: { label: "Funil 3 — Até 30 dias",    sublabel: "Dinheiro do Mês",    cor: "#6366f1", largura: "100%" },
    funil2: { label: "Funil 2 — Até 7 dias",     sublabel: "Dinheiro da Semana", cor: "#f59e0b", largura: "78%"  },
    funil1: { label: "Funil 1 — 24 horas",       sublabel: "Dinheiro de Hoje",   cor: "#10b981", largura: "56%"  },
  },
};

export default function PainelFunil({ funil, leads, usuariosMap, onLeadClick, modo = "pipeline" }) {
  const cfg = (CONFIG[modo] || CONFIG.pipeline)[funil];
  const cor = cfg.cor;
  const total = calcularTotalPipeline(leads);

  return (
    <div style={{
      flex: 1,
      background: "linear-gradient(180deg, rgba(13,20,40,0.95) 0%, rgba(8,14,28,0.98) 100%)",
      border: `1px solid ${cor}22`,
      borderRadius: 18,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      minWidth: 0,
      boxShadow: `0 0 32px ${cor}06`,
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: "14px 16px 12px",
        borderBottom: `1px solid ${cor}12`,
        background: `linear-gradient(135deg, ${cor}0d, transparent)`,
      }}>
        {/* Mini funil visual — trapézios */}
        <div style={{ marginBottom: 12 }}>
          {["funil3", "funil2", "funil1"].map((f, i) => {
            const isAtivo = f === funil;
            const larguras = ["100%", "75%", "50%"];
            return (
              <div key={f} style={{
                height: 10,
                width: larguras[i],
                marginLeft: "auto",
                marginRight: "auto",
                marginBottom: i < 2 ? 2 : 0,
                borderRadius: 3,
                background: isAtivo
                  ? `linear-gradient(90deg, ${cor}66, ${cor}44)`
                  : `${cor}14`,
                border: isAtivo ? `1px solid ${cor}55` : `1px solid ${cor}18`,
                transition: "all 0.2s",
              }} />
            );
          })}
        </div>

        <p style={{ fontSize: 10, fontWeight: 700, color: cor, letterSpacing: "0.07em", textTransform: "uppercase", margin: 0 }}>
          {cfg.sublabel}
        </p>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1", margin: "2px 0 10px" }}>
          {cfg.label}
        </p>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>{leads.length}</span>
            <span style={{ fontSize: 11, color: "#475569", marginLeft: 5 }}>oportunidades</span>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: cor, margin: 0 }}>{formatarValor(total)}</p>
            <p style={{ fontSize: 10, color: "#475569", margin: 0 }}>em pipeline</p>
          </div>
        </div>
      </div>

      {/* ── Lista de leads ── */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        maxHeight: 480,
      }}>
        {leads.length === 0 ? (
          <div style={{ padding: "32px 0", textAlign: "center" }}>
            <p style={{ fontSize: 12, color: "#334155" }}>Nenhum lead neste funil</p>
          </div>
        ) : (
          leads.map(lead => (
            <CardLeadFunil
              key={lead.id}
              lead={lead}
              cor={cor}
              funil={funil}
              usuariosMap={usuariosMap}
              onClick={onLeadClick}
            />
          ))
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{
        padding: "8px 14px",
        borderTop: `1px solid ${cor}10`,
        display: "flex",
        justifyContent: "flex-end",
      }}>
        <span style={{
          fontSize: 11, color: cor, cursor: "pointer",
          background: `${cor}0e`, border: `1px solid ${cor}22`,
          borderRadius: 99, padding: "3px 10px",
          display: "flex", alignItems: "center", gap: 3,
        }}>
          Ver todos <ChevronRight style={{ width: 11, height: 11 }} />
        </span>
      </div>
    </div>
  );
}