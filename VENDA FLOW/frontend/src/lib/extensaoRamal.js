/**
 * extensaoRamal — comunicação com a extensão Chrome VendaFlow (v1.1+)
 * sobre o estado de registro do ramal WebRTC.
 *
 * Eventos:
 *   CRM → Ext : VENDAFLOW_GET_RAMAL_STATUS
 *   Ext → CRM : VENDAFLOW_RAMAL_STATUS { registered }
 *   Ext → CRM : VENDAFLOW_RAMAL_REGISTERED   (espontâneo, quando o ramal registra)
 */

/**
 * Consulta o status do ramal. Extensões antigas (v1.0) não respondem —
 * nesse caso resolve { present: false } após o timeout.
 */
export function consultarRamalExtensao(timeoutMs = 1500) {
  return new Promise((resolve) => {
    let done = false;
    const onMsg = (e) => {
      if (e.data?.type === 'VENDAFLOW_RAMAL_STATUS') finish({ present: true, registered: !!e.data.registered });
    };
    const finish = (r) => {
      if (done) return;
      done = true;
      window.removeEventListener('message', onMsg);
      resolve(r);
    };
    window.addEventListener('message', onMsg);
    window.postMessage({ type: 'VENDAFLOW_GET_RAMAL_STATUS' }, '*');
    setTimeout(() => finish({ present: false, registered: false }), timeoutMs);
  });
}

/**
 * Aguarda o evento VENDAFLOW_RAMAL_REGISTERED (ou status registered via poll).
 * Resolve true quando o ramal registrar, false no timeout.
 */
export function aguardarRamalRegistrado(timeoutMs = 12000) {
  return new Promise((resolve) => {
    let done = false;
    let pollTimer = null;
    let timeoutTimer = null;
    const onMsg = (e) => {
      const t = e.data?.type;
      if (t === 'VENDAFLOW_RAMAL_REGISTERED') finish(true);
      if (t === 'VENDAFLOW_RAMAL_STATUS' && e.data.registered) finish(true);
    };
    const finish = (ok) => {
      if (done) return;
      done = true;
      window.removeEventListener('message', onMsg);
      clearInterval(pollTimer);
      clearTimeout(timeoutTimer);
      resolve(ok);
    };
    window.addEventListener('message', onMsg);
    // Poll de segurança — cobre o caso do evento ter sido emitido antes do listener
    pollTimer = setInterval(() => window.postMessage({ type: 'VENDAFLOW_GET_RAMAL_STATUS' }, '*'), 2000);
    window.postMessage({ type: 'VENDAFLOW_GET_RAMAL_STATUS' }, '*');
    timeoutTimer = setTimeout(() => finish(false), timeoutMs);
  });
}