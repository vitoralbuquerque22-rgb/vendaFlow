import { useState } from "react";
import { Users, TrendingUp, Target, ChevronRight, DollarSign, Calendar, Phone, MessageCircle, Clock, AlertCircle, CheckCircle2, Flame, Zap, Layers } from "lucide-react";

const VENDEDORES = ["João Silva", "Maria Santos", "Pedro Oliveira"];

const mockFunis = {
  funil3: {
    label: "Funil 3 — Prospecção",
    sublabel: "Dinheiro do Mês",
    cor: "#6366f1",
    corBg: "rgba(99,102,241,0.08)",
    corBorder: "rgba(99,102,241,0.25)",
    icon: Layers,
    leads: [
      { nome: "Oficina Central", valor: 10000, status: "em_cadencia", acao: "Ligar hoje 14h", dias: 3 },
      { nome: "Auto Forte", valor: 8000, status: "novo", acao: "Primeiro contato", dias: 0 },
      { nome: "Mecânica Irmãos", valor: 12000, status: "respondeu", acao: "WhatsApp amanhã", dias: 5 },
      { nome: "Garage Plus", valor: 9000, status: "em_cadencia", acao: "Email dia 3", dias: 2 },
      { nome: "Top Pneus", valor: 7000, status: "novo", acao: "Cold call hoje", dias: 0 },
    ],
  },
  funil2: {
    label: "Funil 2 — Desenvolvimento",
    sublabel: "Dinheiro da Semana",
    cor: "#f59e0b",
    corBg: "rgba(245,158,11,0.08)",
    corBorder: "rgba(245,158,11,0.25)",
    icon: TrendingUp,
    leads: [
      { nome: "Officina Premium", valor: 15000, status: "reuniao_realizada", acao: "Enviar proposta", dias: 2, obstaculo: "Avaliando com sócio" },
      { nome: "Mega Auto", valor: 10000, status: "reuniao_agendada", acao: "Reunião amanhã 10h", dias: 1, obstaculo: "Organizando caixa" },
      { nome: "Speed Car", valor: 12000, status: "reuniao_realizada", acao: "Follow-up sexta", dias: 4, obstaculo: "Comparando opções" },
    ],
  },
  funil1: {
    label: "Funil 1 — Fechamento",
    sublabel: "Dinheiro de Hoje",
    cor: "#10b981",
    corBg: "rgba(16,185,129,0.08)",
    corBorder: "rgba(16,185,129,0.25)",
    icon: Flame,
    leads: [
      { nome: "João Auto Center", valor: 12000, estagio: "Proposta aceita", acao: "Ligar 10h", previsao: "hoje", quente: true },
      { nome: "Oficina Premium", valor: 8000, estagio: "Aguardando contrato", acao: "Enviar contrato", previsao: "hoje", quente: true },
      { nome: "Mecânica Forte", valor: 15000, estagio: "Em negociação", acao: "Follow-up 14h", previsao: "semana", quente: false },
    ],
  },
};

function FunilShape({ cor, posicao }) {
  // posicao: 0=topo(largo), 1=meio, 2=baixo(estreito)
  const larguras = [220, 170, 120];
  const w = larguras[posicao];
  return (
    <div style={{
      width: w,
      height: 52,
      background: `linear-gradient(135deg, ${cor}22, ${cor}44)`,
      border: `1px solid ${cor}55`,
      borderRadius: 10,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      margin: "0 auto",
      transition: "all 0.3s ease",
      clipPath: posicao === 0
        ? "polygon(5% 0%, 95% 0%, 90% 100%, 10% 100%)"
        : posicao === 1
        ? "polygon(10% 0%, 90% 0%, 85% 100%, 15% 100%)"
        : "polygon(15% 0%, 85% 0%, 80% 100%, 20% 100%)",
    }}>
    </div>
  );
}

function CardLead({ lead, cor, tipo }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: `1px solid ${cor}30`,
      borderRadius: 12,
      padding: "10px 14px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          {tipo === "funil1" && lead.quente && (
            <span style={{ fontSize: 10, background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 99, padding: "1px 7px", fontWeight: 700 }}>
              🔥 QUENTE
            </span>
          )}
          {tipo === "funil1" && (
            <span style={{ fontSize: 10, background: `${cor}15`, color: cor, border: `1px solid ${cor}30`, borderRadius: 99, padding: "1px 7px", fontWeight: 600 }}>
              {lead.previsao === "hoje" ? "Fecha hoje" : lead.previsao === "semana" ? "Esta semana" : "Este mês"}
            </span>
          )}
          {tipo === "funil2" && lead.obstaculo && (
            <span style={{ fontSize: 10, background: "rgba(245,158,11,0.1)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 99, padding: "1px 7px" }}>
              {lead.obstaculo}
            </span>
          )}
        </div>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {lead.nome}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
          <Clock style={{ width: 11, height: 11, color: "#64748b" }} />
          <span style={{ fontSize: 11, color: "#64748b" }}>{lead.acao}</span>
        </div>
        {tipo === "funil1" && lead.estagio && (
          <span style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, display: "block" }}>{lead.estagio}</span>
        )}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: cor }}>
          R$ {(lead.valor / 1000).toFixed(0)}k
        </p>
      </div>
    </div>
  );
}

function PainelFunil({ funil, dados, posicao }) {
  const Icon = dados.icon;
  const total = dados.leads.reduce((s, l) => s + l.valor, 0);
  const cor = dados.cor;

  return (
    <div style={{
      flex: 1,
      background: "linear-gradient(180deg, rgba(13,20,40,0.95) 0%, rgba(8,14,28,0.98) 100%)",
      border: `1px solid ${cor}25`,
      borderRadius: 20,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      boxShadow: `0 0 40px ${cor}08`,
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px 14px",
        borderBottom: `1px solid ${cor}15`,
        background: `linear-gradient(135deg, ${cor}10, transparent)`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 12,
            background: `${cor}18`, border: `1px solid ${cor}35`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 16px ${cor}20`,
          }}>
            <Icon style={{ width: 16, height: 16, color: cor }} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: cor, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {dados.sublabel}
            </p>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1", marginTop: 1 }}>
              {dados.label}
            </p>
          </div>
        </div>

        {/* Mini funil visual */}
        <div style={{ margin: "12px 0 10px", position: "relative" }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              height: 14,
              marginBottom: 3,
              background: i === posicao
                ? `linear-gradient(90deg, ${cor}55, ${cor}33)`
                : `${cor}15`,
              border: i === posicao ? `1px solid ${cor}60` : `1px solid ${cor}20`,
              borderRadius: 4,
              width: `${100 - i * 18}%`,
              margin: `0 auto ${i < 2 ? '3px' : '0'}`,
              transition: "all 0.3s",
            }} />
          ))}
        </div>

        {/* Totais */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
          <div>
            <span style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>
              {dados.leads.length}
            </span>
            <span style={{ fontSize: 12, color: "#64748b", marginLeft: 5 }}>oportunidades</span>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: cor }}>
              R$ {(total / 1000).toFixed(0)}k
            </span>
            <p style={{ fontSize: 10, color: "#475569" }}>em pipeline</p>
          </div>
        </div>
      </div>

      {/* Lista de leads */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        {dados.leads.map((lead, i) => (
          <CardLead key={i} lead={lead} cor={cor} tipo={funil} />
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: "10px 16px",
        borderTop: `1px solid ${cor}12`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 11, color: "#475569" }}>
          {funil === "funil1" ? "Meta: 3 quentes/dia" : funil === "funil2" ? "Meta: 10 em dev." : "Meta: 12 em prospecção"}
        </span>
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          fontSize: 11, color: cor, cursor: "pointer",
          background: `${cor}10`, border: `1px solid ${cor}25`,
          borderRadius: 99, padding: "3px 10px",
        }}>
          Ver todos <ChevronRight style={{ width: 12, height: 12 }} />
        </div>
      </div>
    </div>
  );
}

export default function MockupFunis() {
  const [vendedorSelecionado, setVendedorSelecionado] = useState("João Silva");

  const totalPipeline = Object.values(mockFunis).flatMap(f => f.leads).reduce((s, l) => s + l.valor, 0);
  const fechamHoje = mockFunis.funil1.leads.filter(l => l.previsao === "hoje").length;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#070b12",
      padding: "28px 24px",
      fontFamily: "'Inter', sans-serif",
    }}>

      {/* Título da seção */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 4, height: 22, borderRadius: 99,
            background: "linear-gradient(180deg, #6366f1, #10b981)",
          }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>
            Visão dos 3 Funis
          </h2>
          <span style={{
            fontSize: 11, background: "rgba(99,102,241,0.15)", color: "#818cf8",
            border: "1px solid rgba(99,102,241,0.3)", borderRadius: 99, padding: "2px 10px", fontWeight: 600,
          }}>
            MOCKUP
          </span>
        </div>
        <p style={{ fontSize: 13, color: "#475569", margin: 0 }}>
          Dentro do Dashboard existente — aba dedicada aos funis de vendas
        </p>
      </div>

      {/* Seletor de vendedor + resumo rápido */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 20, gap: 16, flexWrap: "wrap",
      }}>
        {/* Seletor */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "#64748b" }}>Visualizando:</span>
          <div style={{ display: "flex", gap: 6 }}>
            {["Equipe toda", ...VENDEDORES].map(v => (
              <button
                key={v}
                onClick={() => setVendedorSelecionado(v)}
                style={{
                  fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 99, cursor: "pointer",
                  background: vendedorSelecionado === v ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)",
                  color: vendedorSelecionado === v ? "#818cf8" : "#64748b",
                  border: vendedorSelecionado === v ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.07)",
                  transition: "all 0.2s",
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* KPIs rápidos */}
        <div style={{ display: "flex", gap: 12 }}>
          {[
            { label: "Pipeline total", value: `R$ ${(totalPipeline/1000).toFixed(0)}k`, cor: "#818cf8" },
            { label: "Fecham hoje", value: `${fechamHoje} leads`, cor: "#10b981" },
            { label: "Sem próx. ação", value: "2 leads", cor: "#f87171" },
          ].map((kpi, i) => (
            <div key={i} style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12, padding: "8px 14px",
            }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: kpi.cor, margin: 0 }}>{kpi.value}</p>
              <p style={{ fontSize: 11, color: "#475569", margin: 0, marginTop: 2 }}>{kpi.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Seta de fluxo entre funis */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 6, marginBottom: 14,
      }}>
        {["Prospecção", "→", "Desenvolvimento", "→", "Fechamento"].map((item, i) => (
          <span key={i} style={{
            fontSize: 12,
            color: item === "→" ? "#334155" : "#475569",
            fontWeight: item === "→" ? 400 : 600,
            letterSpacing: item === "→" ? 0 : "0.05em",
          }}>
            {item}
          </span>
        ))}
      </div>

      {/* Os 3 funis lado a lado */}
      <div style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
        <PainelFunil funil="funil3" dados={mockFunis.funil3} posicao={0} />
        <PainelFunil funil="funil2" dados={mockFunis.funil2} posicao={1} />
        <PainelFunil funil="funil1" dados={mockFunis.funil1} posicao={2} />
      </div>

      {/* Nota */}
      <div style={{
        marginTop: 20, padding: "12px 16px",
        background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)",
        borderRadius: 12, display: "flex", alignItems: "flex-start", gap: 10,
      }}>
        <AlertCircle style={{ width: 16, height: 16, color: "#818cf8", flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 12, color: "#64748b", margin: 0, lineHeight: 1.6 }}>
          <strong style={{ color: "#818cf8" }}>Este é um mockup visual.</strong>{" "}
          Os dados são fictícios. Na implementação real, os funis serão alimentados automaticamente pelos status dos leads.
          O campo <strong style={{ color: "#94a3b8" }}>previsão de fechamento</strong> e{" "}
          <strong style={{ color: "#94a3b8" }}>estágio de negociação</strong> precisariam ser adicionados à entidade Lead.
        </p>
      </div>
    </div>
  );
}