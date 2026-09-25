import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { listarLeads } from "@/lib/services/leadService";
import { listarVinculos, vinculosParaUsuarios } from "@/lib/services/equipeService";
import { classificarFunilPorPagamento, calcularTotalPipeline } from "../../lib/funis";
import PainelFunil from "./PainelFunil";
import FunisHeader from "./FunisHeader";

export default function FunisView({ leads: leadsExternos, usuarios: usuariosExternos }) {
  const { empresaId } = useEmpresaAtual();
  const { data: leadsQuery = [] } = useQuery({ queryKey: ["leads-funis", empresaId], queryFn: () => listarLeads(empresaId), enabled: !!empresaId && !leadsExternos });
  const { data: usuariosQuery = [] } = useQuery({ queryKey: ["usuarios-funis", empresaId], queryFn: async () => { const vinculos = await listarVinculos(empresaId); return vinculosParaUsuarios(vinculos).map(u => ({ ...u, role: u.papel })); }, enabled: !!empresaId && !usuariosExternos });
  const todosLeads = leadsExternos || leadsQuery;
  const todosUsuarios = usuariosExternos || usuariosQuery;
  const usuariosMap = useMemo(() => { const m = {}; todosUsuarios.forEach(u => { m[u.email] = u; }); return m; }, [todosUsuarios]);
  const [filtroSDR, setFiltroSDR] = useState("todos");
  const [filtroCloser, setFiltroCloser] = useState("todos");
  const [filtroEquipe, setFiltroEquipe] = useState("todos");
  const sdrs = useMemo(() => todosUsuarios.filter(u => ["sdr","closer","gestor"].includes(u.role)), [todosUsuarios]);
  const closers = useMemo(() => todosUsuarios.filter(u => u.role === "closer"), [todosUsuarios]);
  const equipes = useMemo(() => [...new Set(todosLeads.map(l => l.equipe).filter(Boolean))], [todosLeads]);
  const leadsFiltrados = useMemo(() => todosLeads.filter(l => {
    if (filtroSDR !== "todos" && l.sdr_responsavel !== filtroSDR) return false;
    if (filtroCloser !== "todos" && l.closer_responsavel !== filtroCloser) return false;
    if (filtroEquipe !== "todos" && l.equipe !== filtroEquipe) return false;
    return true;
  }), [todosLeads, filtroSDR, filtroCloser, filtroEquipe]);
  const funil1 = useMemo(() => leadsFiltrados.filter(l => classificarFunilPorPagamento(l) === "funil1"), [leadsFiltrados]);
  const funil2 = useMemo(() => leadsFiltrados.filter(l => classificarFunilPorPagamento(l) === "funil2"), [leadsFiltrados]);
  const funil3 = useMemo(() => leadsFiltrados.filter(l => classificarFunilPorPagamento(l) === "funil3"), [leadsFiltrados]);
  const semPromessa = useMemo(() => leadsFiltrados.filter(l => !l.data_promessa_pagamento), [leadsFiltrados]);
  const totalForecast = useMemo(() => calcularTotalPipeline([...funil1, ...funil2, ...funil3]), [funil1, funil2, funil3]);
  return (
    <div style={{ padding: "8px 0" }}>
      <FunisHeader sdrs={sdrs} closers={closers} equipes={equipes} filtroSDR={filtroSDR} filtroCloser={filtroCloser} filtroEquipe={filtroEquipe} onFiltroSDR={setFiltroSDR} onFiltroCloser={setFiltroCloser} onFiltroEquipe={setFiltroEquipe} totalPipeline={totalForecast} fechamHoje={funil1.length} semProximoPasso={semPromessa.length} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "8px 14px", borderRadius: 10, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
        <span style={{ fontSize: 14 }}>💰</span>
        <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>
          Leads agrupados por <strong style={{ color: "#94a3b8" }}>data de promessa de pagamento</strong> — registrada ao enviar proposta.
          Leads sem data são distribuídos automaticamente por estágio do pipeline.
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 12 }}>
        {["Até Hoje/Amanhã", "→", "Até 7 dias", "→", "Até 30 dias"].map((item, i) => (
          <span key={i} style={{ fontSize: 11, fontWeight: item === "→" ? 400 : 600, color: item === "→" ? "#1e293b" : "#334155", letterSpacing: item === "→" ? 0 : "0.05em" }}>{item}</span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <PainelFunil funil="funil3" leads={funil3} usuariosMap={usuariosMap} modo="forecast" />
        <PainelFunil funil="funil2" leads={funil2} usuariosMap={usuariosMap} modo="forecast" />
        <PainelFunil funil="funil1" leads={funil1} usuariosMap={usuariosMap} modo="forecast" />
      </div>
    </div>
  );
}