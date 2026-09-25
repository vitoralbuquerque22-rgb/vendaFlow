/**
 * CRM Event Bus — Sprint 7.5 Hardening
 * Fonte única de verdade para nomes de eventos do cockpit.
 * Nunca use strings literais no track() — sempre CRM_EVENTS.X
 */
export const CRM_EVENTS = {
  ATENDIMENTO_INICIADO:          "atendimento_iniciado",
  ETAPA_CONCLUIDA:               "atendimento_etapa_concluida",
  RESULTADO_SELECIONADO:         "atendimento_resultado_selecionado",
  SUGESTAO_ACEITA:               "atendimento_sugestao_followup_aceita",
  FOLLOWUP_CRIADO:               "atendimento_followup_criado",
  RESUMO_IA:                     "atendimento_resumo_ia",
  ATENDIMENTO_FINALIZADO:        "atendimento_finalizado",
  MODAL_ABERTO_MS:               "cockpit_modal_aberto_ms",
  TIMELINE_LOAD_MS:              "cockpit_timeline_load_ms",
  WIZARD_ETAPA_CHANGE_MS:        "cockpit_wizard_change_ms",
  SAVE_MS:                       "cockpit_save_ms",
  IA_SUMMARY_MS:                 "cockpit_ia_summary_ms",
};

/**
 * Payload mínimo obrigatório para qualquer evento CRM.
 * Multi-tenant: sem tenant_id o evento é descartado.
 */
export function buildCrmPayload({ empresaId, userId, leadId, atendimentoId, extra = {} }) {
  return {
    tenant_id:      empresaId     || "",
    user_id:        userId        || "",
    lead_id:        leadId        || "",
    atendimento_id: atendimentoId || "",
    timestamp:      new Date().toISOString(),
    ...extra,
  };
}