/**
 * useTelefoniaGravacoes
 * Responsabilidade única: buscar e processar gravações 3C Plus.
 */
import { useCallback } from 'react';
import { api } from '@/api/client';

export function useTelefoniaGravacoes({ empresaId }) {
  const buscarGravacoes = useCallback(async (params = {}) => {
    if (!empresaId) return [];
    try {
      const resultado = await api.functions.invoke('buscarGravacoes3CPlus', { empresaId, ...params });
      return resultado.data?.gravacoes || [];
    } catch (e) {
      console.error('[buscarGravacoes]', e.message);
      return [];
    }
  }, [empresaId]);

  const obterUrlGravacao = useCallback(async (callId) => {
    if (!empresaId || !callId) return null;
    try {
      const resultado = await api.functions.invoke('obterUrlGravacao3CPlus', { empresaId, call_id: callId });
      return resultado.data?.url || null;
    } catch (e) {
      console.error('[obterUrlGravacao]', e.message);
      return null;
    }
  }, [empresaId]);

  const processarGravacao = useCallback(async (callId) => {
    if (!empresaId || !callId) return null;
    try {
      const resultado = await api.functions.invoke('processarGravacao3CPlus', { empresaId, call_id: callId });
      return resultado.data || null;
    } catch (e) {
      console.error('[processarGravacao]', e.message);
      return null;
    }
  }, [empresaId]);

  return { buscarGravacoes, obterUrlGravacao, processarGravacao };
}