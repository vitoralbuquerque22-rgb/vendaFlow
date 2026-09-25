/**
 * SPEC: useTelefoniaSocket
 *
 * Contrato dos eventos do agente (recebidos pela ponte do backend):
 *  - assina uma vez a sala telefonia:agente:<userId> (o navegador não recebe token do 3C);
 *  - cada evento recebido chega ao handler certo do TelefoniaContext;
 *  - avisos operacionais (agent-schedule, list-empty, reached-max-online-agents) têm rota própria.
 *
 * O socket é um singleton de módulo, então cada teste carrega o módulo do zero.
 */
import { vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockSocket = { on: vi.fn(), onAny: vi.fn(), once: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), connected: true };
vi.mock('@/contexts/telefonia/socketPonte', () => ({
  criarSocketPonte: vi.fn(() => mockSocket),
  salaAgente: (id) => `telefonia:agente:${id}`,
}));
vi.mock('@/contexts/telefonia/CallLifecycleManager', () => ({ callLifecycle: { dispatch: vi.fn() } }));

const CFG = { agenteHabilitado: true, integracaoId: 'integ-1', dominio: 'empresa-teste' };
const USER = { id: 'user-1' };

async function montar(extra = {}) {
  vi.resetModules();
  const { criarSocketPonte } = await import('@/contexts/telefonia/socketPonte');
  const { callLifecycle } = await import('@/contexts/telefonia/CallLifecycleManager');
  const { useTelefoniaSocket } = await import('@/contexts/telefonia/useTelefoniaSocket');
  const handlers = {
    onAtendimento: vi.fn(),
    onNaoAtendido: vi.fn(),
    onEncerramento: vi.fn(),
    onManualMode: vi.fn(),
    onManualAtendida: vi.fn(),
    onEventoAgente: vi.fn(),
    onLoginFailed: vi.fn(),
    onAvisoOperacional: vi.fn(),
    ...extra,
  };
  renderHook(() => useTelefoniaSocket({ cfgTelefonia: CFG, user: USER, ...handlers }));
  const emitir = (evento, data = {}) => mockSocket.onAny.mock.calls.at(-1)[0](evento, data);
  return { criarSocketPonte, callLifecycle, handlers, emitir };
}

describe('useTelefoniaSocket', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('conexão', () => {
    it('assina uma única vez a sala do agente do usuário, pela ponte do backend', async () => {
      const { criarSocketPonte } = await montar();
      expect(criarSocketPonte).toHaveBeenCalledTimes(1);
      expect(criarSocketPonte).toHaveBeenCalledWith('telefonia:agente:user-1');
    });

    it('não assina nada se o usuário não está habilitado como agente', async () => {
      vi.resetModules();
      const { criarSocketPonte } = await import('@/contexts/telefonia/socketPonte');
      const { useTelefoniaSocket } = await import('@/contexts/telefonia/useTelefoniaSocket');
      renderHook(() => useTelefoniaSocket({ cfgTelefonia: { agenteHabilitado: false, integracaoId: 'i' }, user: { id: 'u' } }));
      expect(criarSocketPonte).not.toHaveBeenCalled();
    });

    it('o navegador não usa socket.io-client do 3C nem token', async () => {
      const fonte = await import('@/contexts/telefonia/useTelefoniaSocket?raw');
      expect(fonte.default).not.toMatch(/from ['"]socket\.io-client['"]/);
      expect(fonte.default).not.toMatch(/https?:\/\/[\w.-]*3c\.plus/);
      expect(fonte.default).not.toMatch(/tokenAgente|api_token|query:\s*\{\s*token/);
    });
  });

  describe('roteamento para os handlers', () => {
    const casos = [
      ['call-was-connected', 'onAtendimento'],
      ['call-was-answered', 'onAtendimento'],
      ['call-answered', 'onAtendimento'],
      ['manual-call-was-answered', 'onManualAtendida'],
      ['call-was-not-answered', 'onNaoAtendido'],
      ['call-was-failed', 'onNaoAtendido'],
      ['call-was-busy', 'onNaoAtendido'],
      ['call-was-finished', 'onEncerramento'],
      ['call-was-abandoned', 'onEncerramento'],
      ['call-ended', 'onEncerramento'],
      ['agent-entered-manual', 'onManualMode'],
      ['agent-entered-manual-mode', 'onManualMode'],
      ['agent-is-idle', 'onEventoAgente'],
      ['agent-in-acw', 'onEventoAgente'],
      ['agent-was-logged-out', 'onEventoAgente'],
      ['agent-login-failed', 'onLoginFailed'],
      ['agent-schedule', 'onAvisoOperacional'],
      ['list-empty', 'onAvisoOperacional'],
      ['reached-max-online-agents', 'onAvisoOperacional'],
    ];

    it.each(casos)('"%s" chama somente %s', async (evento, esperado) => {
      const { handlers, emitir } = await montar();
      emitir(evento, { marcador: evento });
      for (const [nome, fn] of Object.entries(handlers)) {
        if (nome === esperado) expect(fn).toHaveBeenCalledTimes(1);
        else expect(fn).not.toHaveBeenCalled();
      }
    });

    it('passa (data, evento) para handlers de chamada e (evento, data) para agente/aviso', async () => {
      const { handlers, emitir } = await montar();
      emitir('call-was-not-answered', { id: 1 });
      emitir('agent-is-idle', { id: 2 });
      emitir('list-empty', { list: { id: 3 } });
      expect(handlers.onNaoAtendido).toHaveBeenCalledWith({ id: 1 }, 'call-was-not-answered');
      expect(handlers.onEventoAgente).toHaveBeenCalledWith('agent-is-idle', { id: 2 });
      expect(handlers.onAvisoOperacional).toHaveBeenCalledWith('list-empty', { list: { id: 3 } });
    });

    it('ligação MANUAL: call-was-connected é o ramal conectado, não atendimento do cliente', async () => {
      const onManualRamalConectado = vi.fn();
      const { handlers, emitir, callLifecycle } = await montar({ onManualRamalConectado });
      emitir('call-was-connected', { call: { id: 'call:1:2:abc', call_mode: 'manual' } });
      expect(onManualRamalConectado).toHaveBeenCalledTimes(1);
      expect(handlers.onAtendimento).not.toHaveBeenCalled();
      expect(callLifecycle.dispatch).not.toHaveBeenCalledWith('CONNECTED', expect.anything());
    });

    it('ligação do DISCADOR: call-was-connected continua sendo atendimento', async () => {
      const onManualRamalConectado = vi.fn();
      const { handlers, emitir } = await montar({ onManualRamalConectado });
      emitir('call-was-connected', { call: { id: 'call:1:2:xyz', call_mode: 'dialer' } });
      expect(handlers.onAtendimento).toHaveBeenCalledTimes(1);
      expect(onManualRamalConectado).not.toHaveBeenCalled();
    });

    it('manual-call-was-answered (cliente atendeu a manual) continua indo para onManualAtendida', async () => {
      const { handlers, emitir } = await montar();
      emitir('manual-call-was-answered', { call: { id: 'call:1:2:abc', call_mode: 'manual' } });
      expect(handlers.onManualAtendida).toHaveBeenCalledTimes(1);
      expect(handlers.onAtendimento).not.toHaveBeenCalled();
    });

    it('ignora eventos informativos do discador (call-was-created, call-is-trying, call-was-amd)', async () => {
      const { handlers, emitir, callLifecycle } = await montar();
      ['call-was-created', 'call-is-trying', 'call-was-amd', 'call-history-was-created'].forEach((e) => emitir(e));
      Object.values(handlers).forEach((fn) => expect(fn).not.toHaveBeenCalled());
      expect(callLifecycle.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('ciclo de vida da chamada', () => {
    it('call-was-connected dispara CONNECTED com os dados da chamada', async () => {
      const { emitir, callLifecycle } = await montar();
      emitir('call-was-connected', { call: { id: 'c1', telephony_id: 't1', campaign_id: 9 } });
      expect(callLifecycle.dispatch).toHaveBeenCalledWith('CONNECTED', expect.objectContaining({
        callId: 'c1', uniqueId: 't1', campaignId: 9,
      }));
    });

    it('call-was-finished dispara HANGUP e agent-was-logged-out dispara RESET', async () => {
      const { emitir, callLifecycle } = await montar();
      emitir('call-was-finished');
      emitir('agent-was-logged-out');
      expect(callLifecycle.dispatch).toHaveBeenCalledWith('HANGUP', { reason: 'call-was-finished' });
      expect(callLifecycle.dispatch).toHaveBeenCalledWith('RESET');
    });
  });
});
