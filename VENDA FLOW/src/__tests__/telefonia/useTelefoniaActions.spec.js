/* eslint-env jest */
/* global describe, it, beforeEach, afterEach, expect, jest */
/**
 * SPEC: useTelefoniaActions
 *
 * Verifica as ações de discagem e controle de ligação.
 * Cobre: iniciarLigacao, iniciarLigacaoManual, finalizarLigacao, executarComando
 *
 * TDD: testa contratos — entradas e saídas — não implementação.
 * Cada mock simula o comportamento do backend (base44.functions.invoke).
 */
import { renderHook, act } from '@testing-library/react';
import { useTelefoniaActions } from '@/contexts/telefonia/useTelefoniaActions';

// ── Mock base44 ──────────────────────────────────────────────
jest.mock('@/api/base44Client', () => ({
  base44: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));
import { base44 } from '@/api/base44Client';

const DEFAULT_PARAMS = {
  empresaId: 'emp-001',
  user: { email: 'sdr@vendaflow.com' },
  cfgTelefonia: { tokenAgente: 'token-abc', dominio: 'teste' },
  callSession: null,
  setCallSession: jest.fn(),
  setLeadCallStatus: jest.fn(),
  setModalAtendimentoAberto: jest.fn(),
  setCronometro: jest.fn(),
  callSessionRef: { current: null },
  iniciarCronometroEstado: jest.fn(),
};

function renderActions(overrides = {}) {
  const params = { ...DEFAULT_PARAMS, ...overrides };
  return renderHook(() => useTelefoniaActions(params));
}

describe('useTelefoniaActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── iniciarLigacao ───────────────────────────────────────────
  describe('iniciarLigacao', () => {
    it('deve retornar erro se lead_id não fornecido', async () => {
      const { result } = renderActions();
      let res;
      await act(async () => { res = await result.current.iniciarLigacao(null, 'Fulano'); });
      expect(res.sucesso).toBe(false);
      expect(res.erro).toMatch(/lead_id/i);
      expect(base44.functions.invoke).not.toHaveBeenCalled();
    });

    it('deve retornar erro se usuário não logado', async () => {
      const { result } = renderActions({ user: null });
      let res;
      await act(async () => { res = await result.current.iniciarLigacao('lead-1', 'Fulano'); });
      expect(res.sucesso).toBe(false);
      expect(base44.functions.invoke).not.toHaveBeenCalled();
    });

    it('deve chamar iniciarLigacao3CPlus com params corretos', async () => {
      base44.functions.invoke.mockResolvedValue({ data: { success: true, call_session_id: 'sess-1' } });
      const { result } = renderActions();
      await act(async () => { await result.current.iniciarLigacao('lead-1', 'Fulano'); });
      expect(base44.functions.invoke).toHaveBeenCalledWith('iniciarLigacao3CPlus', expect.objectContaining({
        empresaId: 'emp-001',
        lead_id: 'lead-1',
      }));
    });

    it('deve criar callSession no estado ao ter sucesso', async () => {
      base44.functions.invoke.mockResolvedValue({ data: { success: true, call_session_id: 'sess-1' } });
      const setCallSession = jest.fn();
      const callSessionRef = { current: null };
      const { result } = renderActions({ setCallSession, callSessionRef });
      await act(async () => { await result.current.iniciarLigacao('lead-1', 'João'); });
      expect(setCallSession).toHaveBeenCalledWith(expect.objectContaining({
        id: 'sess-1',
        lead_id: 'lead-1',
        lead_nome: 'João',
        status: 'iniciando',
      }));
      expect(callSessionRef.current).toMatchObject({ id: 'sess-1' });
    });

    it('deve marcar leadCallStatus como discando ao ter sucesso', async () => {
      base44.functions.invoke.mockResolvedValue({ data: { success: true, call_session_id: 'sess-1' } });
      const setLeadCallStatus = jest.fn();
      const { result } = renderActions({ setLeadCallStatus });
      await act(async () => { await result.current.iniciarLigacao('lead-1', 'João'); });
      expect(setLeadCallStatus).toHaveBeenCalledWith('discando');
    });

    it('deve retornar sucesso: false quando backend retorna success: false', async () => {
      base44.functions.invoke.mockResolvedValue({ data: { success: false, error: 'Lead bloqueado' } });
      const { result } = renderActions();
      let res;
      await act(async () => { res = await result.current.iniciarLigacao('lead-1', 'João'); });
      expect(res.sucesso).toBe(false);
      expect(res.erro).toBe('Lead bloqueado');
    });

    it('deve retornar sucesso: false em caso de exceção', async () => {
      base44.functions.invoke.mockRejectedValue(new Error('Timeout'));
      const { result } = renderActions();
      let res;
      await act(async () => { res = await result.current.iniciarLigacao('lead-1', 'João'); });
      expect(res.sucesso).toBe(false);
      expect(res.erro).toContain('Timeout');
    });

    it('deve passar origem e campanha_id nas opções', async () => {
      base44.functions.invoke.mockResolvedValue({ data: { success: true, call_session_id: 'sess-2' } });
      const { result } = renderActions();
      await act(async () => {
        await result.current.iniciarLigacao('lead-1', 'João', { origem: 'power_dialer', campanha_id: 'camp-5' });
      });
      expect(base44.functions.invoke).toHaveBeenCalledWith('iniciarLigacao3CPlus', expect.objectContaining({
        origem: 'power_dialer',
        campanha_id: 'camp-5',
      }));
    });
  });

  // ── iniciarLigacaoManual ─────────────────────────────────────
  describe('iniciarLigacaoManual', () => {
    it('deve chamar iniciarDiscagemManual3CPlus com empresaId', async () => {
      base44.functions.invoke.mockResolvedValue({ data: { success: true } });
      const { result } = renderActions();
      await act(async () => {
        await result.current.iniciarLigacaoManual({ telefone_manual: '11999990000', lead_nome: 'João' });
      });
      expect(base44.functions.invoke).toHaveBeenCalledWith('iniciarDiscagemManual3CPlus', expect.objectContaining({
        empresaId: 'emp-001',
        telefone_manual: '11999990000',
        lead_nome: 'João',
      }));
    });

    it('não deve chamar backend se empresaId ausente', async () => {
      const { result } = renderActions({ empresaId: null });
      await act(async () => { await result.current.iniciarLigacaoManual({ telefone_manual: '11999990000' }); });
      expect(base44.functions.invoke).not.toHaveBeenCalled();
    });

    it('deve retornar os dados do backend', async () => {
      base44.functions.invoke.mockResolvedValue({ data: { success: true, call_session_id: 'manual-1' } });
      const { result } = renderActions();
      let res;
      await act(async () => {
        res = await result.current.iniciarLigacaoManual({ telefone_manual: '11999990000' });
      });
      expect(res).toMatchObject({ success: true, call_session_id: 'manual-1' });
    });
  });

  // ── finalizarLigacao ─────────────────────────────────────────
  describe('finalizarLigacao', () => {
    const callSessionAtiva = { id: 'sess-99', lead_id: 'lead-1' };

    it('não deve chamar backend se callSession nula', async () => {
      const { result } = renderActions({ callSession: null });
      await act(async () => { await result.current.finalizarLigacao('atendeu', null, ''); });
      expect(base44.functions.invoke).not.toHaveBeenCalled();
    });

    it('deve chamar finalizarLigacao3CPlus com call_session_id', async () => {
      base44.functions.invoke.mockResolvedValue({ data: { sucesso: true } });
      const { result } = renderActions({ callSession: callSessionAtiva });
      await act(async () => { await result.current.finalizarLigacao('atendeu', null, 'obs'); });
      expect(base44.functions.invoke).toHaveBeenCalledWith('finalizarLigacao3CPlus', expect.objectContaining({
        call_session_id: 'sess-99',
        resultado: 'atendeu',
        observacao: 'obs',
      }));
    });

    it('deve marcar leadCallStatus como encerrado após sucesso', async () => {
      base44.functions.invoke.mockResolvedValue({ data: { sucesso: true } });
      const setLeadCallStatus = jest.fn();
      const { result } = renderActions({ callSession: callSessionAtiva, setLeadCallStatus });
      await act(async () => { await result.current.finalizarLigacao('atendeu'); });
      expect(setLeadCallStatus).toHaveBeenCalledWith('encerrado');
    });

    it('deve iniciar cronômetro TPA após finalizar', async () => {
      base44.functions.invoke.mockResolvedValue({ data: { sucesso: true } });
      const iniciarCronometroEstado = jest.fn();
      const { result } = renderActions({ callSession: callSessionAtiva, iniciarCronometroEstado });
      await act(async () => { await result.current.finalizarLigacao('atendeu'); });
      expect(iniciarCronometroEstado).toHaveBeenCalledWith('tpa');
    });

    it('deve passar spin se fornecido', async () => {
      base44.functions.invoke.mockResolvedValue({ data: { sucesso: true } });
      const spin = { situacao: 'Interessado', problema: 'Custo alto' };
      const { result } = renderActions({ callSession: callSessionAtiva });
      await act(async () => { await result.current.finalizarLigacao('atendeu', spin, ''); });
      expect(base44.functions.invoke).toHaveBeenCalledWith('finalizarLigacao3CPlus', expect.objectContaining({
        spin,
      }));
    });
  });

  // ── executarComando ──────────────────────────────────────────
  describe('executarComando', () => {
    it('deve chamar executarComando3CPlus com comando', async () => {
      base44.functions.invoke.mockResolvedValue({ data: {} });
      const { result } = renderActions();
      await act(async () => { await result.current.executarComando('agent-pause', { intervalo_id: '1' }); });
      expect(base44.functions.invoke).toHaveBeenCalledWith('executarComando3CPlus', expect.objectContaining({
        empresaId: 'emp-001',
        comando: 'agent-pause',
        intervalo_id: '1',
      }));
    });

    it('não deve chamar backend se empresaId ausente', async () => {
      const { result } = renderActions({ empresaId: null });
      await act(async () => { await result.current.executarComando('agent-pause'); });
      expect(base44.functions.invoke).not.toHaveBeenCalled();
    });
  });

  // ── isLoading ────────────────────────────────────────────────
  describe('isLoading', () => {
    it('deve ser false no estado inicial', () => {
      const { result } = renderActions();
      expect(result.current.isLoading).toBe(false);
    });

    it('deve ser true durante iniciarLigacao', async () => {
      let resolveInvoke;
      base44.functions.invoke.mockReturnValue(new Promise(r => { resolveInvoke = r; }));
      const { result } = renderActions();
      act(() => { result.current.iniciarLigacao('lead-1', 'João'); });
      expect(result.current.isLoading).toBe(true);
      await act(async () => { resolveInvoke({ data: { success: true, call_session_id: 'x' } }); });
      expect(result.current.isLoading).toBe(false);
    });
  });
});