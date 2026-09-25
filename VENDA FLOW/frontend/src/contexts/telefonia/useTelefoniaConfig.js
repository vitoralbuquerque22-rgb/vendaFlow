/**
 * useTelefoniaConfig
 * Responsabilidade única: carregar a configuração da integração 3C Plus e dizer se o
 * usuário logado está habilitado como agente (tem ramal, id 3C ou token cadastrado).
 *
 * Tokens do 3C não chegam ao navegador: as credenciais ficam no backend, que fala com a API
 * e com o socket do 3C Plus (ver contexts/telefonia/socketPonte.js).
 */
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useEmpresaAtual } from '@/components/hooks/useEmpresaAtual';

export function useTelefoniaConfig(user) {
  const { empresaId }           = useEmpresaAtual();
  const [cfgTelefonia, setCfg]  = useState(null);
  const [carregandoConfig, setCarregando] = useState(true);

  const { data: userProfile } = useQuery({
    queryKey: ['userProfile', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const p = await api.entities.UserProfile.filter({ user_email: user.email });
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
        const integracoes = await api.entities.Integracao.filter({
          empresaId, tipo: 'telefonia', ativa: true,
        });
        const integracao = integracoes.find(i => i.configuracao?.fornecedor === '3cplus');
        if (!integracao) { setCfg(null); return; }

        const cfg        = integracao.configuracao;
        const emailLower = (user.email || '').toLowerCase();

        const ramalDoProfile  = userProfile?.ramal_3cplus || null;
        const mapeamentoRamal = cfg.mapeamento_ramais || {};
        const ramalLegado     = mapeamentoRamal[emailLower] || mapeamentoRamal[user.email] || cfg.ramal_padrao || null;
        const ramalAgente     = ramalDoProfile || ramalLegado || null;

        // Agente habilitado: o backend consegue agir por ele (id 3C ou ramal com token de serviço,
        // ou token pessoal legado — o valor vem mascarado, só a presença importa)
        const agenteHabilitado = !!(userProfile?.id_3cplus || ramalAgente || userProfile?.token_3cplus);

        setCfg({
          dominio:      cfg.dominio || '',
          agenteHabilitado,
          ramalAgente,
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
  }, [empresaId, user?.email, userProfile?.id_3cplus, userProfile?.ramal_3cplus, userProfile?.token_3cplus]);

  return { cfgTelefonia, carregandoConfig, empresaId, userProfile };
}
