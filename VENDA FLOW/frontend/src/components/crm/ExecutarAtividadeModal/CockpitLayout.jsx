import CockpitLeadPanel from "./CockpitLeadPanel";
import CockpitHistoricoPanel from "./CockpitHistoricoPanel";

/**
 * CockpitLayout — grid 3 colunas
 * Coluna esquerda: perfil do lead
 * Coluna central: formulário (children)
 * Coluna direita: histórico/timeline
 */
export default function CockpitLayout({ tarefa, children }) {
  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* ── Coluna esquerda: Lead ── */}
      <div
        className="flex-shrink-0 overflow-y-auto border-r"
        style={{
          width: 240,
          borderColor: "rgba(255,255,255,0.05)",
          background: "rgba(8,12,24,0.6)",
        }}
      >
        <CockpitLeadPanel tarefa={tarefa} />
      </div>

      {/* ── Coluna central: formulário ── */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </div>

      {/* ── Coluna direita: Histórico ── */}
      <div
        className="flex-shrink-0 border-l overflow-hidden"
        style={{
          width: 220,
          borderColor: "rgba(255,255,255,0.05)",
          background: "rgba(8,12,24,0.6)",
        }}
      >
        <CockpitHistoricoPanel tarefa={tarefa} />
      </div>
    </div>
  );
}