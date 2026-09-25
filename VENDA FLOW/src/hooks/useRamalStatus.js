/**
 * useRamalStatus — rastreia o registro do ramal WebRTC via extensão Chrome.
 * Protocolo (window.postMessage):
 *   CRM → Ext: VENDAFLOW_GET_RAMAL_STATUS → Ext: VENDAFLOW_RAMAL_STATUS { registered }
 *   Ext → CRM: VENDAFLOW_RAMAL_REGISTERED / VENDAFLOW_RAMAL_UNREGISTERED
 *
 * Usado pela máquina de estados de login para aguardar o ramal antes do
 * /agent/connect + /agent/login (evita agent-login-failed por ramal não pronto).
 */
import { useState, useEffect, useRef, useCallback } from 'react';

export function useRamalStatus() {
  const [ramalRegistrado, setRamalRegistrado] = useState(false);
  const registradoRef = useRef(false);

  useEffect(() => {
    function onMessage(event) {
      if (event.source !== window) return;
      const t = event.data?.type;
      if (t === 'VENDAFLOW_RAMAL_REGISTERED') {
        registradoRef.current = true;
        setRamalRegistrado(true);
      } else if (t === 'VENDAFLOW_RAMAL_UNREGISTERED') {
        registradoRef.current = false;
        setRamalRegistrado(false);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Consulta sob demanda o status atual do ramal (resolve rápido; ideal após F5).
  const consultarRamal = useCallback((timeoutMs = 1500) => {
    return new Promise((resolve) => {
      let resolvido = false;
      const finalizar = (val) => {
        if (resolvido) return;
        resolvido = true;
        window.removeEventListener('message', onResp);
        resolve(val);
      };
      function onResp(event) {
        if (event.source !== window) return;
        if (event.data?.type === 'VENDAFLOW_RAMAL_STATUS') {
          registradoRef.current = !!event.data.registered;
          setRamalRegistrado(!!event.data.registered);
          finalizar(!!event.data.registered);
        }
      }
      window.addEventListener('message', onResp);
      window.postMessage({ type: 'VENDAFLOW_GET_RAMAL_STATUS' }, '*');
      setTimeout(() => finalizar(registradoRef.current), timeoutMs);
    });
  }, []);

  // Aguarda o ramal registrar: consulta primeiro (F5 instantâneo); se não,
  // espera o evento VENDAFLOW_RAMAL_REGISTERED até timeoutMs. Resolve boolean.
  const aguardarRamalRegistrado = useCallback(async (timeoutMs = 8000) => {
    const jaRegistrado = await consultarRamal();
    if (jaRegistrado) return true;
    return new Promise((resolve) => {
      let resolvido = false;
      const finalizar = (val) => {
        if (resolvido) return;
        resolvido = true;
        window.removeEventListener('message', onEvt);
        clearTimeout(timer);
        resolve(val);
      };
      function onEvt(event) {
        if (event.source !== window) return;
        if (event.data?.type === 'VENDAFLOW_RAMAL_REGISTERED') {
          registradoRef.current = true;
          setRamalRegistrado(true);
          finalizar(true);
        }
      }
      window.addEventListener('message', onEvt);
      const timer = setTimeout(() => finalizar(false), timeoutMs);
    });
  }, [consultarRamal]);

  return { ramalRegistrado, consultarRamal, aguardarRamalRegistrado };
}