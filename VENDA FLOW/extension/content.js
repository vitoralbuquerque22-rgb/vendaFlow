/* eslint-disable no-undef */
/**
 * Content Script — injetado no VendaFlow CRM (v1.1)
 *
 * Protocolo:
 *   CRM → Ext : VENDAFLOW_PING              → Ext responde VENDAFLOW_PONG
 *   CRM → Ext : VENDAFLOW_SET_AGENT         → registra ramal em background
 *   CRM → Ext : VENDAFLOW_GET_RAMAL_STATUS  → Ext responde VENDAFLOW_RAMAL_STATUS { registered }
 *   Ext → CRM : VENDAFLOW_EXTENSION_READY   → anúncio ao carregar
 *   Ext → CRM : VENDAFLOW_RAMAL_REGISTERED  → ramal WebRTC registrado e pronto
 *   Ext → CRM : VENDAFLOW_RAMAL_UNREGISTERED → ramal caiu (aba fechada)
 */

window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) return;

  if (event.data?.type === 'VENDAFLOW_PING') {
    window.postMessage({ type: 'VENDAFLOW_PONG' }, '*');
  }

  if (event.data?.type === 'VENDAFLOW_SET_AGENT') {
    chrome.runtime.sendMessage({ type: 'SET_AGENT_CONFIG', config: event.data.config });
  }

  if (event.data?.type === 'VENDAFLOW_GET_RAMAL_STATUS') {
    try {
      chrome.runtime.sendMessage({ type: 'GET_RAMAL_STATUS' }, (resp) => {
        window.postMessage({ type: 'VENDAFLOW_RAMAL_STATUS', registered: !!resp?.registered }, '*');
      });
    } catch {
      window.postMessage({ type: 'VENDAFLOW_RAMAL_STATUS', registered: false }, '*');
    }
  }
});

// Eventos vindos do background (registro do ramal)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'RAMAL_REGISTERED') {
    window.postMessage({ type: 'VENDAFLOW_RAMAL_REGISTERED' }, '*');
  }
  if (msg?.type === 'RAMAL_UNREGISTERED') {
    window.postMessage({ type: 'VENDAFLOW_RAMAL_UNREGISTERED' }, '*');
  }
});

document.documentElement.setAttribute('data-vendaflow-ext', 'true');
window.postMessage({ type: 'VENDAFLOW_EXTENSION_READY' }, '*');
console.log('[VendaFlow Extension] Content script ativo (v1.1)');
