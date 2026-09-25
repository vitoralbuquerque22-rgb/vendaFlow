/**
 * SPEC: useTelefoniaActions
 *
 * Contrato do login/logout do agente na campanha 3C Plus:
 *   SET_AGENT → ramal registrado → /agent/connect → /agent/login → confirmação pelo socket.
 * A API responde 204 para tudo; quem diz se deu certo é o evento do socket.
 */
import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/api/client', () => ({ api: { functions: { invoke: vi.fn() } } }));
vi.mock('@/hooks/useRamalStatus', () => ({ useRamalStatus: vi.fn() }));

import { api } from '@/api/client';
import { useRamalStatus } from '@/hooks/useRamalStatus';
import { useTelefoniaActions } from '@/contexts/telefonia/useTelefoniaActions';
import { LOGIN_STATUS } from '@/contexts/telefonia/TELEFONIA_ENGINE';

// Socket falso: guarda os listeners e permite emitir eventos
function criarSocket() {
  const listeners = {};
  return {
    listeners,
    on: vi.fn((ev, h) => { (listeners[ev] ??= new Set()).add(h); }),
    off: vi.fn((ev, h) => { listeners[ev]?.delete(h); }),
    emitir: (ev, data) => [...(listeners[ev] ?? [])].forEach((h) => h(data)),
    ouvindo: (ev) => (listeners[ev]?.size ?? 0) > 0,
  };
}

function montar({ ramalOk = true } = {}) {
  const socket = criarSocket();
  const marcarLoginPending = vi.fn();
  useRamalStatus.mockReturnValue({ aguardarRamalRegistrado: vi.fn().mockResolvedValue(ramalOk) });
  const { result } = renderHook(() =>
    useTelefoniaActions({ empresaId: 'emp-1', marcarLoginPending, socketRef: { current: socket } }),
  );
  return { result, socket, marcarLoginPending };
}

const OPCOES = { dominio: 'empresa-teste' };

describe('useTelefoniaActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.functions.invoke.mockResolvedValue({ data: {} });
  });
  afterEach(() => vi.useRealTimers());

  describe('loginCampanha', () => {
    async function iniciarLogin(ctx, opcoes = OPCOES) {
      let promessa;
      act(() => { promessa = ctx.result.current.loginCampanha(42, opcoes); });
      // espera o hook chegar na etapa de ouvir o socket
      await vi.waitFor(() => expect(ctx.socket.ouvindo('agent-is-idle')).toBe(true));
      // embrulhada: retornar a promise direto faria o await esperar o login terminar
      return { promessa };
    }

    it('pede o registro do ramal, conecta e faz login na ordem da documentação', async () => {
      const ctx = montar();
      const postMessage = vi.spyOn(window, 'postMessage');
      const { promessa } = await iniciarLogin(ctx);
      ctx.socket.emitir('agent-is-idle');
      await expect(promessa).resolves.toEqual({ status: LOGIN_STATUS.CONNECTED });

      expect(postMessage).toHaveBeenCalledWith({ type: 'VENDAFLOW_SET_AGENT', config: { empresaId: 'emp-1', dominio: 'empresa-teste' } }, '*');
      const comandos = api.functions.invoke.mock.calls.map(([, p]) => p.comando);
      expect(comandos).toEqual(['agent-connect', 'agent-login']);
      expect(api.functions.invoke.mock.calls[1][1]).toMatchObject({ empresaId: 'emp-1', campanha_id: 42 });
    });

    it('aceita agent-entered-manual como confirmação (login em modo manual)', async () => {
      const ctx = montar();
      const { promessa } = await iniciarLogin(ctx);
      ctx.socket.emitir('agent-entered-manual');
      await expect(promessa).resolves.toEqual({ status: LOGIN_STATUS.CONNECTED });
    });

    it('falha com LOGIN_FALHOU quando o 3C emite agent-login-failed', async () => {
      const ctx = montar();
      const { promessa } = await iniciarLogin(ctx);
      ctx.socket.emitir('agent-login-failed');
      await expect(promessa).rejects.toThrow(/^LOGIN_FALHOU/);
      expect(ctx.marcarLoginPending).toHaveBeenLastCalledWith(false);
    });

    it('falha com LIMITE_AGENTES quando a empresa atinge o limite de agentes logados', async () => {
      const ctx = montar();
      const { promessa } = await iniciarLogin(ctx);
      ctx.socket.emitir('reached-max-online-agents');
      await expect(promessa).rejects.toThrow(/^LIMITE_AGENTES/);
    });

    it('remove todos os listeners do socket ao terminar', async () => {
      const ctx = montar();
      const { promessa } = await iniciarLogin(ctx);
      ctx.socket.emitir('agent-is-idle');
      await promessa;
      const restantes = Object.entries(ctx.socket.listeners).filter(([, s]) => s.size > 0).map(([ev]) => ev);
      expect(restantes).toEqual([]);
    });

    it('sem evento do socket: assume conectado depois do tempo limite, com aviso', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const ctx = montar();
      const { promessa } = await iniciarLogin(ctx);
      await vi.advanceTimersByTimeAsync(4000);
      await expect(promessa).resolves.toEqual({ status: LOGIN_STATUS.CONNECTED, warning: 'sem_confirmacao_socket' });
    });

    it('não faz login se o ramal não registrar', async () => {
      const ctx = montar({ ramalOk: false });
      let erro;
      await act(async () => {
        await ctx.result.current.loginCampanha(42, OPCOES).catch((e) => { erro = e; });
      });
      expect(erro.message).toMatch(/^RAMAL_NAO_REGISTRADO/);
      expect(api.functions.invoke).not.toHaveBeenCalled();
    });

    it('nunca envia token ao ramal, mesmo se o chamador passar um', async () => {
      const ctx = montar();
      const postMessage = vi.spyOn(window, 'postMessage');
      const { promessa } = await iniciarLogin(ctx, { token: '3cs_segredo', dominio: 'empresa-teste' });
      ctx.socket.emitir('agent-is-idle');
      await promessa;
      const setAgent = postMessage.mock.calls.find(([m]) => m?.type === 'VENDAFLOW_SET_AGENT');
      expect(JSON.stringify(setAgent)).not.toContain('3cs_segredo');
    });

    it('exige campanha', async () => {
      const ctx = montar();
      await expect(ctx.result.current.loginCampanha(null, OPCOES)).rejects.toThrow(/obrigatórios/);
    });

    it('ignora um segundo login enquanto o primeiro está em andamento', async () => {
      const ctx = montar();
      const { promessa: primeiro } = await iniciarLogin(ctx);
      await expect(ctx.result.current.loginCampanha(42, OPCOES)).resolves.toEqual({ status: 'already_in_progress' });
      ctx.socket.emitir('agent-is-idle');
      await primeiro;
    });
  });

  describe('sairDaCampanha', () => {
    it('confirma pelo evento agent-was-logged-out', async () => {
      const ctx = montar();
      let promessa;
      act(() => { promessa = ctx.result.current.sairDaCampanha(); });
      await vi.waitFor(() => expect(ctx.socket.ouvindo('agent-was-logged-out')).toBe(true));
      ctx.socket.emitir('agent-was-logged-out');
      await expect(promessa).resolves.toEqual({ status: 'confirmed_via_socket' });
      expect(api.functions.invoke).toHaveBeenCalledWith('executarComando3CPlus', expect.objectContaining({ comando: 'agent-logout' }));
    });

    it('libera a tela depois de 2,5s mesmo sem o evento', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const ctx = montar();
      let promessa;
      act(() => { promessa = ctx.result.current.sairDaCampanha(); });
      await vi.waitFor(() => expect(ctx.socket.ouvindo('agent-was-logged-out')).toBe(true));
      await vi.advanceTimersByTimeAsync(2500);
      await expect(promessa).resolves.toEqual({ status: 'assumed_offline' });
    });
  });

  describe('listarCampanhas', () => {
    it('devolve a lista vinda do backend', async () => {
      api.functions.invoke.mockResolvedValue({ dados: { data: [{ id: 1, name: 'Campanha A' }] } });
      const ctx = montar();
      await expect(ctx.result.current.listarCampanhas()).resolves.toEqual([{ id: 1, name: 'Campanha A' }]);
    });

    it('devolve lista vazia se o backend falhar', async () => {
      api.functions.invoke.mockRejectedValue(new Error('falhou'));
      const ctx = montar();
      await expect(ctx.result.current.listarCampanhas()).resolves.toEqual([]);
    });
  });
});
