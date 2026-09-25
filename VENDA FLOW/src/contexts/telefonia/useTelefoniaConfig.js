/**
 * useTelefoniaConfig
 * Responsabilidade única: carregar configuração da integração 3C Plus,
 * token do agente (UserProfile > mapeamento legado) e ramal.
 * T6: token/ramal disponíveis para outros sub-hooks via retorno.
 */
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useEmpresaAtual } from '@/components/hooks/useEmpresaAtual';

export function useTelefoniaConfig(user) {
  const { empresaId }           = useEmpresaAtual();
  const [cfgTelefonia, setCfg]  = useState(null);
  const [carregandoConfig, setCarregando] = useState(true);

  const { data: userProfile } = useQuery({
    queryKey: ['userProfile', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const p = await base44.entities.UserProfile.filter({ user_email: user.email });
      return p[0] || null;
    },
    enabled: !!user?.email,
    staleTime: 60000,       // cache 1 min — evita refetch a cada remount
    refetchOnMount: false,  // não recarregar config a cada remount (causava reconexão de socket)
  });

  useEffect(() => {
    if (!empresaId || !user?.email) return;
    if (userProfile === undefined) return;

    async function carregar() {
      setCarregando(true);
      try {
        const integracoes = await base44.entities.Integracao.filter({
          empresaId, tipo: 'telefonia', ativa: true,
        });
        const integracao = integracoes.find(i => i.configuracao?.fornecedor === '3cplus');
        if (!integracao) { setCfg(null); return; }

        const cfg        = integracao.configuracao;
        const emailLower = (user.email || '').toLowerCase();

        const tokenDoProfile = userProfile?.token_3cplus || null;
        const mapeamento     = cfg.mapeamento_agentes || {};
        const tokenLegado    = mapeamento[emailLower] || mapeamento[user.email] || cfg.token_agente || null;
        const tokenGestorCfg = cfg.token_gestor || '';
        // Protecao: token_gestor no socket recebe eventos de TODOS os agentes
        const tokenAgenteSeguro = (tokenDoProfile && tokenDoProfile !== tokenGestorCfg)
          ? tokenDoProfile : null;
        const tokenAgente    = tokenAgenteSeguro || tokenLegado || null;

        // Se o token está encriptado (prefixo enc:), decriptar via serverless
        let tokenFinal = tokenAgente;
        if (tokenFinal && tokenFinal.startsWith('enc:')) {
          try {
            const resp = await base44.functions.invoke('executarComando3CPlus', {
              empresaId,
              comando: 'get-agent-token',
            });
            const decrypted = resp?.data?.dados?.token || null;
            if (decrypted && !decrypted.startsWith('enc:')) {
              tokenFinal = decrypted;
            }
          } catch (e) {
            console.warn('[useTelefoniaConfig] falha ao decriptar token:', e.message);
          }
        }

        const ramalDoProfile  = userProfile?.ramal_3cplus || null;
        const mapeamentoRamal = cfg.mapeamento_ramais || {};
        const ramalLegado     = mapeamentoRamal[emailLower] || mapeamentoRamal[user.email] || cfg.ramal_padrao || null;
        const ramalAgente     = ramalDoProfile || ramalLegado || null;

        setCfg({
          dominio:      cfg.dominio || '',
          tokenAgente:  tokenFinal,
          ramalAgente,
          tokenGestor:  cfg.token_gestor || '',
          campanhaId:   cfg.campanha_id_padrao || '',
          fornecedor:   '3cplus',
          integracaoId: integracao.id,
        });
      } catch (e) {
        console.warn('[useTelefoniaConfig] erro:', e.message);
        setCfg(null);
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, [empresaId, user?.email, userProfile?.token_3cplus]);

  return { cfgTelefonia, carregandoConfig, empresaId, userProfile };
}