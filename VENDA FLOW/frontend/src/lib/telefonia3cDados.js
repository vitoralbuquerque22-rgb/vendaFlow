/**
 * telefonia3cDados — normaliza o payload dos eventos do Socket.io do 3C Plus
 * conforme a Biblioteca de Dados oficial.
 *
 * O evento `call-was-connected` (chamada conectada ao agente) é o mais rico:
 * traz empresa, chamada, campanha, qualificações, agente e mailing. Todos os
 * campos da chamada vivem em `event.call`.
 *
 * Extrai apenas o que o CRM usa: identificação (número, mailing), campanha,
 * protocolo (sid), modo, gravação, qualification_list_id e o nome do cliente
 * vindo do mailing importado.
 */

// Extrai o nome do cliente de mailing_data.data (campos do mailing importado).
// Pode vir como objeto { nome, telefone, ... } ou array [{ column, value }].
function extrairNomeMailing(mailingData) {
  if (!mailingData) return null;
  const campos = mailingData.data ?? mailingData.fields ?? null;
  if (!campos) return mailingData.name || null;

  if (Array.isArray(campos)) {
    const campoNome = campos.find(c => {
      const chave = String(c?.column || c?.name || c?.key || '').toLowerCase();
      return chave === 'nome' || chave === 'name' || chave === 'cliente' || chave === 'contato';
    });
    return campoNome?.value || campoNome?.valor || null;
  }
  if (typeof campos === 'object') {
    return campos.nome || campos.name || campos.cliente || campos.contato || null;
  }
  return null;
}

// Extrai a lista de qualificações que já vem embutida no evento call-was-connected.
// Evita um round-trip ao backend quando o 3C já entrega as qualificações no socket.
function extrairQualificacoesEvento(event) {
  const lista = event?.qualifications || event?.campaign?.qualifications || event?.call?.qualifications || null;
  if (!Array.isArray(lista) || lista.length === 0) return [];
  return lista.map(q => ({
    id: q.id,
    nome: q.name,
    behavior: q.behavior,
    comportamento: q.readable_behavior_text || q.behavior_text || '',
    is_conversion: !!q.is_conversion,
    is_dmc: !!q.is_dmc,
    cor: q.color || null,
  }));
}

export function extrairDadosCall3C(event) {
  // O evento traz { type, company, call, campaign, qualifications, agent, mailing_data }
  // mas alguns handlers já entregam o `call` direto.
  const call = event?.call || event || {};
  const mailing = event?.mailing_data || call.mailing_data || call.mailing || null;
  const campaign = event?.campaign || null;

  const telefone = String(call.number || call.phone || mailing?.phone || '').replace(/\D/g, '');
  const modo = call.mode || event?.mode || null;

  return {
    chamada_id: call.id || null,
    telefone,
    telefone_mailing: mailing?.phone ? String(mailing.phone).replace(/\D/g, '') : null,
    nome_mailing: extrairNomeMailing(mailing),
    cpf: mailing?.cpf || null,
    identifier: mailing?.identifier || null,
    campanha_id: call.campaign_id || campaign?.id || mailing?.campaign_id || null,
    campanha_nome: call.campaign || campaign?.name || null,
    lista_nome: call.list || null,
    protocolo: call.sid || null,
    modo,
    // acw_manual = chamada manual em TPA; manual = chamada manual comum
    is_manual: modo === 'manual' || modo === 'acw_manual',
    is_manual_acw: modo === 'acw_manual',
    gravacao_url: call.recording || null,
    call_date: call.call_date_rfc3339 || call.call_date || null,
    hangup_cause: call.hangup_cause || call.hangup_cause_id || null,
    is_conversion: !!call.is_conversion,
    is_dmc: !!call.is_dmc,
    qualification_list_id: campaign?.qualification_list_id || call.qualification_list_id || null,
    qualificacoes: extrairQualificacoesEvento(event),
  };
}