import { vi } from 'vitest';
/**
 * SPEC: useTelefoniaAgent
 *
 * Verifica o gerenciamento de estado do agente na campanha 3C Plus.
 * Cobre: iniciarCronometroEstado, pararCronometroEstado, processarEventoAgente
 *
 * Técnica TDD:
 *  - Cada teste define o comportamento ESPERADO independente de implementação.
 *  - Se qualquer modificação alterar um desses comportamentos, o teste quebra.
 */
import { renderHook, act } from '@testing-library/react';
import { useTelefoniaAgent } from '@/contexts/telefonia/useTelefoniaAgent';

describe('useTelefoniaAgent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Estado inicial ───────────────────────────────────────────
  describe('estado inicial', () => {
    it('deve iniciar com status livre', () => {
      const { result } = renderHook(() => useTelefoniaAgent());
      expect(result.current.agentStatus.status).toBe('livre');
    });

    it('deve iniciar com campanha inativa', () => {
      const { result } = renderHook(() => useTelefoniaAgent());
      expect(result.current.agenteCampanhaAtiva).toBe(false);
    });

    it('deve iniciar com nomeCampanhaAtiva null', () => {
      const { result } = renderHook(() => useTelefoniaAgent());
      expect(result.current.nomeCampanhaAtiva).toBeNull();
    });

    it('deve iniciar com estadoCampanha idle', () => {
      const { result } = renderHook(() => useTelefoniaAgent());
      expect(result.current.estadoCampanha).toBe('idle');
    });

    it('deve iniciar com tempoEstado 0', () => {
      const { result } = renderHook(() => useTelefoniaAgent());
      expect(result.current.tempoEstado).toBe(0);
    });
  });

  // ── iniciarCronometroEstado ──────────────────────────────────
  describe('iniciarCronometroEstado', () => {
    it('deve mudar estadoCampanha para o estado passado', () => {
      const { result } = renderHook(() => useTelefoniaAgent());
      act(() => { result.current.iniciarCronometroEstado('falando'); });
      expect(result.current.estadoCampanha).toBe('falando');
    });

    it('deve resetar tempoEstado para 0 ao iniciar', () => {
      const { result } = renderHook(() => useTelefoniaAgent());
      act(() => {
        result.current.iniciarCronometroEstado('falando');
        vi.advanceTimersByTime(5000);
      });
      act(() => { result.current.iniciarCronometroEstado('tpa'); });
      expect(result.current.tempoEstado).toBe(0);
    });

    it('deve incrementar tempoEstado a cada segundo', () => {
      const { result } = renderHook(() => useTelefoniaAgent());
      act(() => { result.current.iniciarCronometroEstado('aguardando'); });
      act(() => { vi.advanceTimersByTime(3000); });
      expect(result.current.tempoEstado).toBe(3);
    });

    it('deve cancelar cronômetro anterior ao iniciar novo', () => {
      const { result } = renderHook(() => useTelefoniaAgent());
      act(() => { result.current.iniciarCronometroEstado('aguardando'); });
      act(() => { vi.advanceTimersByTime(2000); });
      act(() => { result.current.iniciarCronometroEstado('falando'); });
      act(() => { vi.advanceTimersByTime(1000); });
      // Deve ser 1s do novo estado, não 3s do acumulado
      expect(result.current.tempoEstado).toBe(1);
      expect(result.current.estadoCampanha).toBe('falando');
    });
  });

  // ── pararCronometroEstado ────────────────────────────────────
  describe('pararCronometroEstado', () => {
    it('deve zerar tempoEstado', () => {
      const { result } = renderHook(() => useTelefoniaAgent());
      act(() => {
        result.current.iniciarCronometroEstado('falando');
        vi.advanceTimersByTime(5000);
      });
      act(() => { result.current.pararCronometroEstado(); });
      expect(result.current.tempoEstado).toBe(0);
    });

    it('deve voltar estadoCampanha para idle', () => {
      const { result } = renderHook(() => useTelefoniaAgent());
      act(() => { result.current.iniciarCronometroEstado('tpa'); });
      act(() => { result.current.pararCronometroEstado(); });
      expect(result.current.estadoCampanha).toBe('idle');
    });

    it('não deve continuar incrementando após parar', () => {
      const { result } = renderHook(() => useTelefoniaAgent());
      act(() => { result.current.iniciarCronometroEstado('aguardando'); });
      act(() => { result.current.pararCronometroEstado(); });
      act(() => { vi.advanceTimersByTime(5000); });
      expect(result.current.tempoEstado).toBe(0);
    });
  });

  // ── processarEventoAgente ────────────────────────────────────
  describe('processarEventoAgente', () => {
    const eventosAguardando = ['agent-is-idle', 'agent-is-free', 'agent-left-manual-mode', 'agent-left-work-break'];
    const eventosFalando    = ['agent-is-connected', 'agent-entered-call'];
    const eventosTpa        = ['agent-in-acw', 'agent-entered-manual-acw'];

    eventosAguardando.forEach(evento => {
      it(`"${evento}" deve iniciar estado aguardando`, () => {
        const { result } = renderHook(() => useTelefoniaAgent());
        act(() => { result.current.processarEventoAgente(evento); });
        expect(result.current.estadoCampanha).toBe('aguardando');
      });
    });

    eventosFalando.forEach(evento => {
      it(`"${evento}" deve iniciar estado falando`, () => {
        const { result } = renderHook(() => useTelefoniaAgent());
        act(() => { result.current.processarEventoAgente(evento); });
        expect(result.current.estadoCampanha).toBe('falando');
      });
    });

    eventosTpa.forEach(evento => {
      it(`"${evento}" deve iniciar estado tpa`, () => {
        const { result } = renderHook(() => useTelefoniaAgent());
        act(() => { result.current.processarEventoAgente(evento); });
        expect(result.current.estadoCampanha).toBe('tpa');
      });
    });

    it('"agent-entered-work-break" deve marcar status em_pausa e parar cronômetro', () => {
      const { result } = renderHook(() => useTelefoniaAgent());
      act(() => { result.current.iniciarCronometroEstado('aguardando'); });
      act(() => { result.current.processarEventoAgente('agent-entered-work-break'); });
      expect(result.current.agentStatus.status).toBe('em_pausa');
      expect(result.current.estadoCampanha).toBe('idle');
    });

    it('"agent-was-logged-out" deve parar cronômetro, desativar campanha e limpar nome', () => {
      const { result } = renderHook(() => useTelefoniaAgent());
      act(() => {
        result.current.setAgenteCampanhaAtiva(true);
        result.current.setNomeCampanhaAtiva('Campanha Teste');
        result.current.iniciarCronometroEstado('falando');
      });
      act(() => { result.current.processarEventoAgente('agent-was-logged-out'); });
      expect(result.current.agenteCampanhaAtiva).toBe(false);
      expect(result.current.nomeCampanhaAtiva).toBeNull();
      expect(result.current.estadoCampanha).toBe('idle');
    });

    it('evento desconhecido não deve alterar estadoCampanha', () => {
      const { result } = renderHook(() => useTelefoniaAgent());
      act(() => { result.current.processarEventoAgente('evento-inexistente'); });
      expect(result.current.estadoCampanha).toBe('idle');
    });
  });

  // ── Cleanup ──────────────────────────────────────────────────
  describe('cleanup', () => {
    it('deve limpar intervalo ao desmontar', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      const { result, unmount } = renderHook(() => useTelefoniaAgent());
      act(() => { result.current.iniciarCronometroEstado('falando'); });
      unmount();
      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });
});