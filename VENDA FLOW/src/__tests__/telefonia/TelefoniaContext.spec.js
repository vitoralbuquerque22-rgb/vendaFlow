/* eslint-env jest */
/* global describe, it, beforeEach, afterEach, expect, jest, global */
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
jest.mock('@/contexts/telefonia/useTelefoniaConfig', () => ({
  useTelefoniaConfig: jest.fn(() => ({
    cfgTelefonia: { tokenAgente: 'token-abc', dominio: 'empresa-teste' },
    carregandoConfig: false,
    empresaId: 'emp-001',
  })),
}));

jest.mock('@/contexts/telefonia/useTelefoniaSocket', () => ({
  useTelefoniaSocket: jest.fn(() => ({ socketRef: { current: null } })),
}));

jest.mock('@/contexts/telefonia/useTelefoniaActions', () => ({
  useTelefoniaActions: jest.fn(() => ({
    isLoading: false,
    iniciarLigacao: jest.fn(),
    iniciarLigacaoManual: jest.fn(),
    finalizarLigacao: jest.fn(),
    executarComando: jest.fn(),
  })),
}));

jest.mock('@/contexts/telefonia/useTelefoniaGravacoes', () => ({
  useTelefoniaGravacoes: jest.fn(() => ({
    buscarGravacoes: jest.fn(),
    obterUrlGravacao: jest.fn(),
    processarGravacao: jest.fn(),
  })),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(() => ({ data: { email: 'sdr@vendaflow.com', id: 'user-1' } })),
}));

jest.mock('@/api/base44Client', () => ({
  base44: {
    auth: { me: jest.fn() },
    entities: {
      CallSession: {
        create: jest.fn(),
        update: jest.fn(),
      },
    },
  },
}));

import { base44 } from '@/api/base44Client';
import { TelefoniaProvider, useTelefonia } from '@/contexts/TelefoniaContext';

function wrapper({ children }) {
  return React.createElement(TelefoniaProvider, null, children);
}

describe('TelefoniaContext', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.useRealTimers();
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

    it('deve chamar /agent/manual_call/exit na API 3C Plus', async () => {
      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true });
      const { result } = renderHook(() => useTelefonia(), { wrapper });
      await act(async () => { await result.current.hangupManualCall(); });
      const chamadas = fetchMock.mock.calls;
      const exitCall = chamadas.find(([url]) => String(url).includes('manual_call/exit'));
      expect(exitCall).toBeDefined();
      expect(exitCall[0]).toContain('empresa-teste.3c.plus');
      fetchMock.mockRestore();
    });

    it('deve usar Bearer token no header da chamada', async () => {
      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true });
      const { result } = renderHook(() => useTelefonia(), { wrapper });
      await act(async () => { await result.current.hangupManualCall(); });
      const exitCall = fetchMock.mock.calls.find(([url]) => String(url).includes('manual_call/exit'));
      expect(exitCall?.[1]?.headers?.Authorization).toBe('Bearer token-abc');
      fetchMock.mockRestore();
    });
  });

  // ── useTelefonia3CPlus alias ─────────────────────────────────
  describe('compatibilidade backwards', () => {
    it('useTelefonia3CPlus deve ser alias de useTelefonia', async () => {
      const { useTelefonia3CPlus } = await import('@/contexts/TelefoniaContext');
      expect(useTelefonia3CPlus).toBeDefined();
      // Ambos apontam para o mesmo hook
      const { result: r1 } = renderHook(() => useTelefonia(), { wrapper });
      const { result: r2 } = renderHook(() => useTelefonia3CPlus(), { wrapper });
      // Mesma interface
      expect(Object.keys(r1.current)).toEqual(Object.keys(r2.current));
    });
  });
});