/**
 * lib/funis.js
 * Funções puras de classificação dos 3 Funis.
 */

export function classificarFunilPorPagamento(lead) {
  // Estágios que fazem parte do pipeline de fechamento
  const PIPELINE_STATUSES = ["reuniao_agendada", "reuniao_realizada", "proposta_enviada", "em_negociacao"];
  const noPipeline = PIPELINE_STATUSES.includes(lead.status);

  const data = lead.data_promessa_pagamento || lead.prazo_proposta || lead.previsao_fechamento;
  if (data) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const promessa = new Date(data + "T12:00:00");
    const diffMs = promessa - hoje;
    const diffDias = diffMs / (1000 * 60 * 60 * 24);
    if (diffDias <= 1)  return "funil1";
    if (diffDias <= 7)  return "funil2";
    if (diffDias <= 30) return "funil3";
    // Data no passado — tratar como funil1 (urgente)
    if (diffDias < 0) return "funil1";
    return null;
  }

  // Fallback por status para leads sem data — garante que apareçam no pipeline
  if (!noPipeline) return null;
  if (lead.status === "em_negociacao" || lead.status === "proposta_enviada") return "funil2";
  if (lead.status === "reuniao_realizada") return "funil2";
  if (lead.status === "reuniao_agendada") return "funil3";
  return "funil3";
}

export function classificarFunil(lead) {
  return classificarFunilPorPagamento(lead);
}

export function getGrupoFechamento(lead) {
  if (!lead.data_promessa_pagamento) return "sem_previsao";
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const previsao = new Date(lead.data_promessa_pagamento + "T12:00:00");
  const diffDias = Math.ceil((previsao - hoje) / (1000 * 60 * 60 * 24));
  if (diffDias <= 0) return "hoje";
  if (diffDias <= 7) return "semana";
  if (diffDias <= 30) return "mes";
  return "futuro";
}

export function getPrevisaoLabel(lead) {
  const grupo = getGrupoFechamento(lead);
  const labels = {
    hoje: "Fecha hoje",
    semana: "Esta semana",
    mes: "Este mês",
    futuro: "Futuro",
    sem_previsao: "Sem previsão",
  };
  return labels[grupo] ?? "—";
}

export const ESTAGIO_LABEL = {
  proposta_enviada: "Proposta enviada",
  em_negociacao: "Em negociação",
  aguardando_decisao: "Aguardando decisão",
};

export function nomeDeEmail(email, usuariosMap) {
  if (!email) return null;
  const u = usuariosMap?.[email];
  if (u?.full_name) return u.full_name.split(" ")[0];
  return email.split("@")[0];
}

export function calcularTotalPipeline(leads) {
  return leads.reduce((sum, l) => sum + (l.valor_proposta || l.valor_potencial || 0), 0);
}

export function formatarValor(valor) {
  if (!valor) return "—";
  if (valor >= 1_000_000) return `R$ ${(valor / 1_000_000).toFixed(1)}M`;
  if (valor >= 1_000) return `R$ ${(valor / 1_000).toFixed(0)}k`;
  return `R$ ${valor}`;
}