import { useEffect, useRef } from 'react';
import { api } from '@/api/client';
import { TIMEOUTS } from './TELEFONIA_ENGINE';

export function useTelefoniaHeartbeat({
  empresaId,
  current3CSession,
  socketRef,
  _aplicarStatus3C,
  pararCronometroEstado,
  setCurrent3CSession,
  setAgenteCampanhaAtiva,
  setNomeCampanhaAtiva,
  SESSION_VAZIA,
}) {
  const heartbeatRef = useRef(null);

  useEffect(() => {
    function checarCondicoes() {
      if (document.visibilityState !== 'visible') return false;
      if (!empresaId) return false;
      if (!current3CSession?.connected) return false;
      if (!socketRef?.current?.connected) return false;
      return true;
    }

    async function heartbeat() {
      if (!checarCondicoes()) return;

      try {
        const resp = await api.functions.invoke('executarComando3CPlus', {
          empresaId,
          comando: 'get-logged-campaign',
        });

        const dados = resp?.data?.dados ?? resp?.dados;
        const campaign = dados?.data ?? dados ?? null;
        const campaignId3C = campaign?.id ?? null;
        const campaignName3C = campaign?.name ?? null;
        const localCampaignId = current3CSession?.campaignId;

        if (campaignId3C && localCampaignId) {
          if (String(campaignId3C) !== String(localCampaignId)) {
            // Campanha mudou na 3C — corrigir local
            _aplicarStatus3C?.('idle', { id: campaignId3C, name: campaignName3C }, null);
          }
          // Mesma campanha — estado ok, nada a fazer
        } else if (!campaignId3C && localCampaignId) {
          console.warn('[Heartbeat] loggedCampaign vazio — ignorando (endpoint não-confiável p/ webphone:false); logout real vem via agent-was-logged-out');
        }
        // Se campaignId3C existe mas local não tem — será tratado pelo restoreAgentState
      } catch (e) {
        console.warn('[Heartbeat] falha na reconciliação:', e.message);
      }
    }

    // Iniciar heartbeat se condições atendidas
    if (checarCondicoes()) {
      heartbeatRef.current = setInterval(heartbeat, TIMEOUTS.HEARTBEAT_INTERVAL);
    }

    // Reagir a mudanças de visibilidade
    function handleVisibility() {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      if (checarCondicoes()) {
        // Reconciliar imediatamente ao voltar para a aba
        heartbeat();
        heartbeatRef.current = setInterval(heartbeat, TIMEOUTS.HEARTBEAT_INTERVAL);
      }
    }

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [
    empresaId,
    current3CSession?.connected,
    current3CSession?.campaignId,
    socketRef,
    _aplicarStatus3C,
    pararCronometroEstado,
    setCurrent3CSession,
    setAgenteCampanhaAtiva,
    setNomeCampanhaAtiva,
    SESSION_VAZIA,
  ]);
}