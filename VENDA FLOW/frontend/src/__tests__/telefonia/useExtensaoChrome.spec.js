import { vi } from 'vitest';
/**
 * SPEC: useExtensaoChrome
 *
 * Verifica o handshake de detecção da extensão Chrome VendaFLOW.
 * Cobre todos os message types, o ping automático e o retry periódico.
 *
 * CRÍTICO: se o protocolo de handshake mudar (nomes dos eventos),
 * estes testes quebrarão — garantindo que a extensão e o CRM permaneçam em sincronia.
 */
import { renderHook, act } from '@testing-library/react';
import { useExtensaoChrome } from '@/hooks/useExtensaoChrome';

describe('useExtensaoChrome', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function dispararMensagem(type, origin = window.location.origin) {
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: { type }, origin }));
    });
  }

  // ── Estado inicial ───────────────────────────────────────────
  it('deve iniciar como não instalada', () => {
    const { result } = renderHook(() => useExtensaoChrome());
    expect(result.current.instalada).toBe(false);
  });

  // ── Detecção por anúncio espontâneo ─────────────────────────
  const tiposValidos = ['VENDAFLOW_EXTENSION_READY', 'VENDAFLOW_PONG', '3CPLUS_EXTENSION_READY'];

  tiposValidos.forEach(tipo => {
    it(`deve detectar extensão pelo tipo "${tipo}"`, () => {
      const { result } = renderHook(() => useExtensaoChrome());
      dispararMensagem(tipo);
      expect(result.current.instalada).toBe(true);
    });
  });

  it('não deve detectar extensão por tipo desconhecido', () => {
    const { result } = renderHook(() => useExtensaoChrome());
    dispararMensagem('OUTRO_TIPO');
    expect(result.current.instalada).toBe(false);
  });

  // ── Ping automático ──────────────────────────────────────────
  it('deve enviar VENDAFLOW_PING após 2s sem anúncio', () => {
    const postMessageSpy = vi.spyOn(window, 'postMessage');
    renderHook(() => useExtensaoChrome());
    act(() => { vi.advanceTimersByTime(2100); });
    expect(postMessageSpy).toHaveBeenCalledWith({ type: 'VENDAFLOW_PING' }, '*');
    postMessageSpy.mockRestore();
  });

  it('não deve enviar ping se extensão já foi detectada antes dos 2s', () => {
    const postMessageSpy = vi.spyOn(window, 'postMessage');
    const { result } = renderHook(() => useExtensaoChrome());
    dispararMensagem('VENDAFLOW_EXTENSION_READY');
    act(() => { vi.advanceTimersByTime(3000); });
    // Pode ter chamado com outros tipos mas não VENDAFLOW_PING
    const pingCalls = postMessageSpy.mock.calls.filter(c => c[0]?.type === 'VENDAFLOW_PING');
    expect(pingCalls).toHaveLength(0);
    postMessageSpy.mockRestore();
  });

  // ── Resposta ao PONG após ping ───────────────────────────────
  it('deve marcar instalada ao receber PONG após ping', () => {
    const { result } = renderHook(() => useExtensaoChrome());
    act(() => { vi.advanceTimersByTime(2100); }); // dispara ping
    dispararMensagem('VENDAFLOW_PONG');
    expect(result.current.instalada).toBe(true);
  });

  // ── Retry periódico ──────────────────────────────────────────
  it('deve reenviar ping a cada 15s enquanto não detectada', () => {
    const postMessageSpy = vi.spyOn(window, 'postMessage');
    renderHook(() => useExtensaoChrome());
    // Primeiro ping em 2s
    act(() => { vi.advanceTimersByTime(2100); });
    // Retry após 15s
    act(() => { vi.advanceTimersByTime(15000); });
    // Retry após mais 15s
    act(() => { vi.advanceTimersByTime(15000); });
    const pingCalls = postMessageSpy.mock.calls.filter(c => c[0]?.type === 'VENDAFLOW_PING');
    expect(pingCalls.length).toBeGreaterThanOrEqual(2);
    postMessageSpy.mockRestore();
  });

  it('não deve reenviar ping após extensão ser detectada', () => {
    const postMessageSpy = vi.spyOn(window, 'postMessage');
    const { result } = renderHook(() => useExtensaoChrome());
    act(() => { vi.advanceTimersByTime(2100); }); // primeiro ping
    dispararMensagem('VENDAFLOW_PONG'); // detectada!
    act(() => { vi.advanceTimersByTime(30000); }); // 2 ciclos de retry
    const pingCalls = postMessageSpy.mock.calls.filter(c => c[0]?.type === 'VENDAFLOW_PING');
    // Apenas 1 ping (o inicial), sem retries
    expect(pingCalls).toHaveLength(1);
    postMessageSpy.mockRestore();
  });

  // ── Idempotência ─────────────────────────────────────────────
  it('deve manter instalada: true mesmo recebendo múltiplos eventos', () => {
    const { result } = renderHook(() => useExtensaoChrome());
    dispararMensagem('VENDAFLOW_EXTENSION_READY');
    dispararMensagem('VENDAFLOW_EXTENSION_READY');
    dispararMensagem('VENDAFLOW_PONG');
    expect(result.current.instalada).toBe(true);
  });

  // ── Cleanup ──────────────────────────────────────────────────
  it('deve remover listener ao desmontar', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useExtensaoChrome());
    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });

  it('deve limpar timers ao desmontar', () => {
    const clearTimeoutSpy  = vi.spyOn(global, 'clearTimeout');
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    const { unmount } = renderHook(() => useExtensaoChrome());
    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });
});