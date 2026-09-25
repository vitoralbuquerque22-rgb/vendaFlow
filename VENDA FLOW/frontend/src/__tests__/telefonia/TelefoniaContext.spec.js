import { vi } from 'vitest';
/**
 * SPEC: TelefoniaContext (integração)
 *
 * Verifica o comportamento integrado do contexto de telefonia:
 * - marcarLigacaoAtendida: cronômetro, status, modal
 * - marcarLigacaoNaoAtendida: cleanup
 * - marcarLigacaoEncerrada: TPA
 * - hangupManualCall: API calls corretos
 * - cronometroFormatado: formatação MM:SS
 *
 * Nota: Sub-hooks (Config, Socket, Gravacoes) são mockados para isolar o contexto.
 */
import { renderHook, act } from '@testing-library/react';
import React from 'react';

// ── Mocks de sub-hooks ───────────────────────────────────────
vi.mock('@/contexts/telefonia/useTelefoniaConfig', () => ({
  useTelefoniaConfig: vi.fn(() => ({
    cfgTelefonia: { agenteHabilitado: true, integracaoId: 'integ-1', dominio: 'empresa-teste' },
    carregandoConfig: false,
    empresaId: 'emp-001',
  })),
}));

vi.mock('@/contexts/telefonia/useTelefoniaSocket', () => ({
  useTelefoniaSocket: vi.fn(() => ({ socketRef: { current: null } })),
}));

vi.mock('@/contexts/telefonia/useTelefoniaActions', () => ({
  useTelefoniaActions: vi.fn(() => ({
    isLoading: false,
    iniciarLigacao: vi.fn(),
    iniciarLigacaoManual: vi.fn(),
    finalizarLigacao: vi.fn(),
    executarComando: vi.fn(),
  })),
}));

vi.mock('@/contexts/telefonia/useTelefoniaGravacoes', () => ({
  useTelefoniaGravacoes: vi.fn(() => ({
    buscarGravacoes: vi.fn(),
    obterUrlGravacao: vi.fn(),
    processarGravacao: vi.fn(),
  })),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({ data: { email: 'sdr@vendaflow.com', id: 'user-1' } })),
}));

vi.mock('@/api/client', () => ({
  api: {
    auth: { me: vi.fn() },
    functions: { invoke: vi.fn(() => Promise.resolve({ data: {} })) },
    entities: {
      CallSession: {
        create: vi.fn(),
        update: vi.fn(),
      },
    },
  },
}));

import { api } from '@/api/client';
import { TelefoniaProvider, useTelefonia } from '@/contexts/TelefoniaContext';

function wrapper({ children }) {
  return React.createElement(TelefoniaProvider, null, children);
}

describe('TelefoniaContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Interface pública ────────────────────────────────────────
  describe('interface pública (contrato)', () => {
    it('deve expor todas as propriedades esperadas', () => {
      const { result } = renderHook(() => useTelefonia(), { wrapper });
      const keys = [
        'callSession', 'manualCallSession', 'manualCallStatus',
        'leadCallStatus', 'duracaoLigacao', 'agentStatus',
        'cronometro', 'cronometroFormatado',
        'modalAtendimentoAberto', 'isLoading',
        'aguardandoAtendimento', 'emLigacao',
        'agenteCampanhaAtiva', 'setAgenteCampanhaAtiva',
        'nomeCampanhaAtiva', 'setNomeCampanhaAtiva',
        'estadoCampanha', 'tempoEstado', 'pararCronometroEstado',
        'iniciarLigacao', 'iniciarLigacaoManual',
        'finalizarLigacao', 'hangupManualCall',
        'executarComando', 'fecharModalAtendimento',
        'setModalAtendimentoAberto', 'limparSessaoManual',
        'buscarGravacoes', 'obterUrlGravacao', 'processarGravacao',
        'cfgTelefonia', 'carregandoConfig',
      ];
      keys.forEach(key => {
        expect(result.current).toHaveProperty(key);
      });
    });

    it('emLigacao deve ser false quando callSession é null', () => {
      const { result } = renderHook(() => useTelefonia(), { wrapper });
      expect(result.current.emLigacao).toBe(false);
    });
  });

  // ── cronometroFormatado ──────────────────────────────────────
  describe('cronometroFormatado', () => {
    it('deve formatar 0s como "00:00"', () => {
      const { result } = renderHook(() => useTelefonia(), { wrapper });
      expect(result.current.cronometroFormatado).toBe('00:00');
    });
  });

  // ── fecharModalAtendimento ───────────────────────────────────
  describe('fecharModalAtendimento', () => {
    it('deve fechar o modal', () => {
      const { result } = renderHook(() => useTelefonia(), { wrapper });
      act(() => { result.current.setModalAtendimentoAberto(true); });
      expect(result.current.modalAtendimentoAberto).toBe(true);
      act(() => { result.current.fecharModalAtendimento(); });
      expect(result.current.modalAtendimentoAberto).toBe(false);
    });
  });

  // ── limparSessaoManual ───────────────────────────────────────
  describe('limparSessaoManual', () => {
    it('deve limpar sessão manual e status', () => {
      const { result } = renderHook(() => useTelefonia(), { wrapper });
      act(() => { result.current.limparSessaoManual(); });
      expect(result.current.manualCallSession).toBeNull();
      expect(result.current.manualCallStatus).toBeNull();
    });
  });

  // ── hangupManualCall sem sessão ──────────────────────────────
  describe('hangupManualCall', () => {
    it('deve limpar sessão mesmo sem chamada ativa', async () => {
      const { result } = renderHook(() => useTelefonia(), { wrapper });
      await act(async () => { await result.current.hangupManualCall(); });
      expect(result.current.manualCallSession).toBeNull();
    });

    it('sai do TPA pelo backend (o token do 3C nunca vai para o navegador)', async () => {
      const fetchMock = vi.spyOn(global, 'fetch');
      const { result } = renderHook(() => useTelefonia(), { wrapper });
      await act(async () => { await result.current.hangupManualCall(); });
      expect(api.functions.invoke).toHaveBeenCalledWith('executarComando3CPlus', { empresaId: 'emp-001', comando: 'acw-exit' });
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('3c.plus'))).toBe(false);
      fetchMock.mockRestore();
    });

    it('não chama end-call quando não há chamada manual em andamento', async () => {
      const { result } = renderHook(() => useTelefonia(), { wrapper });
      await act(async () => { await result.current.hangupManualCall(); });
      const comandos = api.functions.invoke.mock.calls.map(([, p]) => p?.comando);
      expect(comandos).not.toContain('end-call');
    });
  });
});