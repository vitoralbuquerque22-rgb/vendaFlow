/**
 * Cockpit SLA — limites de latência em ms (Ajuste 7)
 * Nunca hardcode esses valores nos hooks — sempre importe daqui.
 */
export const COCKPIT_SLA = {
  modal_open_ms:    300,
  timeline_load_ms: 500,
  wizard_change_ms: 100,
  save_ms:          800,
  ia_summary_ms:    2000,
};