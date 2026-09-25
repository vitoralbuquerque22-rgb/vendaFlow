import { Clock, User, Users, Briefcase, Calendar } from "lucide-react";
import { nomeDeEmail, formatarValor, ESTAGIO_LABEL, getGrupoFechamento } from "../../lib/funis";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_LABEL = {
  novo: "Novo",
  em_cadencia: "Em cadência",
  respondeu: "Respondeu",
  reuniao_agendada: "Reunião agendada",
  reuniao_realizada: "Reunião realizada",
  qualificado: "Qualificado",
};

const GRUPO_COR = {
  hoje:        { bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.30)",  text: "#10b981", label: "Fecha hoje"   },
  semana:      { bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.28)",  text: "#f59e0b", label: "Esta semana" },
  mes:         { bg: "rgba(99,102,241,0.10)",  border: "rgba(99,102,241,0.25)",  text: "#818cf8", label: "Este mês"    },
  futuro:      { bg: "rgba(100,116,139,0.08)", border: "rgba(100,116,139,0.20)", text: "#64748b", label: "Futuro"      },
  sem_previsao:{ bg: "rgba(100,116,139,0.06)", border: "rgba(100,116,139,0.15)", text: "#475569", label: "Sem previsão"},
};

// ── Mini crachá de pessoa ─────────────────────────────────────
function Cracha({ label, nome, bgColor, borderColor, iconColor, Icon }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div style={{
        width: 18, height: 18, borderRadius: 99, flexShrink: 0,
        background: bgColor, border: `1px solid ${borderColor}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon style={{ width: 10, height: 10, color: iconColor }} />
      </div>
      <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500, whiteSpace: "nowrap" }}>
        <span style={{ color: "#475569" }}>{label} </span>
        <strong style={{ color: "#cbd5e1", fontWeight: 600 }}>{nome}</strong>
      </span>
    </div>
  );
}

export default function CardLeadFunil({ lead, cor, funil, usuariosMap, onClick }) {
  const sdrNome       = nomeDeEmail(lead.sdr_responsavel,     usuariosMap);
  const closerNome    = nomeDeEmail(lead.closer_responsavel,  usuariosMap);

  // "Vendedor" = quem tem o papel de vendedor no vínculo — pode ser sdr_responsavel ou closer_responsavel
  // Aqui exibimos ambos como papéis distintos
  const grupo    = funil === "funil1" ? getGrupoFechamento(lead) : null;
  const grupoCor = grupo ? GRUPO_COR[grupo] : null;

  const dataPromessaFmt = lead.data_promessa_pagamento
    ? format(new Date(lead.data_promessa_pagamento + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })
    : null;
  const tipoPromessa = lead.tipo_promessa;

  return (
    <button
      onClick={() => onClick?.(lead)}
      style={{
        width: "100%", textAlign: "left",
        background: "rgba(255,255,255,0.025)",
        border: `1px solid ${cor}22`,
        borderRadius: 12, padding: "11px 13px",
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.18s ease",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = `${cor}0d`;
        e.currentTarget.style.borderColor = `${cor}44`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = "rgba(255,255,255,0.025)";
        e.currentTarget.style.borderColor = `${cor}22`;
      }}
    >
      {/* ── Linha 1: badges de contexto ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6, flexWrap: "wrap" }}>
        {/* Previsão de fechamento (só funil 1) */}
        {grupoCor && (
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
            background: grupoCor.bg, border: `1px solid ${grupoCor.border}`,
            color: grupoCor.text, borderRadius: 99, padding: "1px 8px",
          }}>
            {grupoCor.label}
          </span>
        )}
        {/* Status do lead */}
        <span style={{
          fontSize: 10, fontWeight: 600,
          background: `${cor}12`, border: `1px solid ${cor}28`,
          color: cor, borderRadius: 99, padding: "1px 7px",
        }}>
          {STATUS_LABEL[lead.status] || lead.status}
        </span>
        {/* Estágio de negociação */}
        {lead.estagio_negociacao && (
          <span style={{
            fontSize: 10,
            background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.22)",
            color: "#fbbf24", borderRadius: 99, padding: "1px 7px",
          }}>
            {ESTAGIO_LABEL[lead.estagio_negociacao]}
          </span>
        )}
      </div>

      {/* ── Linha 2: nome lead + valor potencial ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: 13, fontWeight: 700, color: "#e2e8f0", margin: 0,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {lead.nome}
          </p>
          {lead.empresa && (
            <p style={{ fontSize: 11, color: "#64748b", margin: "2px 0 0", display: "flex", alignItems: "center", gap: 3 }}>
              <Briefcase style={{ width: 9, height: 9 }} />
              {lead.empresa}
            </p>
          )}
        </div>
        {lead.valor_potencial > 0 && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: cor }}>
              {formatarValor(lead.valor_potencial)}
            </span>
            <p style={{ fontSize: 9, color: "#334155", margin: 0 }}>potencial</p>
          </div>
        )}
      </div>

      {/* ── Linha 3: crachás SDR / Closer ── */}
      {(sdrNome || closerNome) && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          marginTop: 8, paddingTop: 7,
          borderTop: "1px solid rgba(255,255,255,0.04)",
          flexWrap: "wrap",
        }}>
          {sdrNome && (
            <Cracha
              label="SDR"
              nome={sdrNome}
              bgColor="rgba(99,102,241,0.15)"
              borderColor="rgba(99,102,241,0.30)"
              iconColor="#818cf8"
              Icon={User}
            />
          )}
          {closerNome && (
            <Cracha
              label="Closer"
              nome={closerNome}
              bgColor="rgba(16,185,129,0.15)"
              borderColor="rgba(16,185,129,0.30)"
              iconColor="#10b981"
              Icon={Users}
            />
          )}
        </div>
      )}

      {/* ── Linha 4: próximo passo ── */}
      {lead.proximo_passo && (
        <div style={{
          display: "flex", alignItems: "center", gap: 5, marginTop: 7,
          background: "rgba(255,255,255,0.03)", borderRadius: 7, padding: "4px 8px",
        }}>
          <Clock style={{ width: 10, height: 10, color: "#475569", flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {lead.proximo_passo}
          </span>
        </div>
      )}

      {dataPromessaFmt && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5 }}>
          <Calendar style={{ width: 10, height: 10, color: tipoPromessa === "confirmado" ? "#10b981" : "#f59e0b", flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: tipoPromessa === "confirmado" ? "#10b981" : "#f59e0b", fontWeight: 600 }}>
            {tipoPromessa === "confirmado" ? "✅ Pag. confirmado:" : "🤔 Pensa até:"} {dataPromessaFmt}
          </span>
        </div>
      )}
    </button>
  );
}