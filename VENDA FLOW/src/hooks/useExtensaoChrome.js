/**
 * useExtensaoChrome
 *
 * Detecta se a extensão Chrome VendaFLOW está instalada.
 *
 * Protocolo de handshake (ambos os lados devem implementar):
 *   CRM → Extensão : postMessage({ type: 'VENDAFLOW_PING' })
 *   Extensão → CRM : postMessage({ type: 'VENDAFLOW_PONG' })
 *   Extensão → CRM : postMessage({ type: 'VENDAFLOW_EXTENSION_READY' })  ← anúncio espontâneo ao carregar
 *
 * Também aceita os tipos legados da 3C Plus:
 *   '3CPLUS_EXTENSION_READY'
 *
 * Estratégia:
 * 1. Escuta anúncio espontâneo imediato (extensão carrega depois do React)
 * 2. Após 1s, envia PING e aguarda PONG por 2s (extensão já estava carregada)
 * 3. Re-testa a cada 10s para cobrir instalação em tempo real (sem recarregar a página)
 * 4. Também verifica via DOM (content scripts injetam atributo data-vendaflow-ext no <html>)
 *
 * Retorna: { instalada: boolean }
 */
import { useState, useEffect, useRef } from "react";

const READY_TYPES = new Set([
  'VENDAFLOW_EXTENSION_READY',
  'VENDAFLOW_PONG',
  '3CPLUS_EXTENSION_READY',
]);

export function useExtensaoChrome() {
  const [instalada, setInstalada] = useState(false);
  const detectadoRef = useRef(false);

  useEffect(() => {
    let pingTimer = null;
    let pongTimer = null;
    let retryTimer = null;

    const marcarInstalada = () => {
      if (detectadoRef.current) return;
      detectadoRef.current = true;
      setInstalada(true);
      clearTimeout(pingTimer);
      clearTimeout(pongTimer);
      clearInterval(retryTimer);
      console.log('[VendaFLOW] ✅ Extensão Chrome detectada');
    };

    // Verificação via DOM — extensões podem injetar atributos/elementos
    const verificarDOM = () => {
      if (detectadoRef.current) return;
      // Checa se a extensão injetou um marcador no DOM
      if (document.documentElement.hasAttribute('data-vendaflow-ext')
          || document.getElementById('vendaflow-extension-marker')
          || document.querySelector('[data-3cplus-extension]')) {
        marcarInstalada();
      }
    };

    const handleMessage = (event) => {
      // Aceitar mensagens da própria window (content scripts da extensão postam na mesma window)
      // Não restringir por origin — extensões Chrome enviam com origin da página,
      // mas em alguns ambientes (iframes, dev servers) o origin pode divergir.
      // A segurança vem do tipo da mensagem (VENDAFLOW_*/3CPLUS_*), não do origin.
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (READY_TYPES.has(data.type)) {
        marcarInstalada();
      }
    };

    window.addEventListener('message', handleMessage);

    // Verificação imediata via DOM (extensão pode ter carregado antes do React)
    verificarDOM();

    // Estratégia 1: ping após 1s (extensão já estava carregada antes do React montar)
    const tentarPing = () => {
      if (detectadoRef.current) return;
      verificarDOM();
      if (detectadoRef.current) return;
      window.postMessage({ type: 'VENDAFLOW_PING' }, '*');
      pongTimer = setTimeout(() => {
        if (!detectadoRef.current) {
          console.log('[VendaFLOW] Extensão não respondeu ao ping');
        }
      }, 2000);
    };

    pingTimer = setTimeout(tentarPing, 1000);

    // Estratégia 2: re-testa a cada 10s — para quando detectar ou após 6 tentativas (~1min)
    let tentativas = 0;
    const MAX_TENTATIVAS = 6;
    retryTimer = setInterval(() => {
      if (detectadoRef.current) {
        clearInterval(retryTimer);
        return;
      }
      tentativas++;
      if (tentativas >= MAX_TENTATIVAS) {
        clearInterval(retryTimer);
        return;
      }
      tentarPing();
    }, 10000);

    // Estratégia 3: MutationObserver — detectar quando extensão injeta marcador no DOM
    const observer = new MutationObserver(() => verificarDOM());
    observer.observe(document.documentElement, { attributes: true, childList: true, subtree: false });

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(pingTimer);
      clearTimeout(pongTimer);
      clearInterval(retryTimer);
      observer.disconnect();
    };
  }, []);

  return { instalada };
}