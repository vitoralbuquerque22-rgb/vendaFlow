import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useEmpresaAtual } from '@/components/hooks/useEmpresaAtual';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, AlertCircle, Loader2, Key, Phone } from 'lucide-react';
import { toast } from 'sonner';

export default function ConfiguracaoToken3CPlus() {
  const { empresaId } = useEmpresaAtual();
  const queryClient = useQueryClient();

  const [token, setToken] = useState('');
  const [ramal, setRamal] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [validando, setValidando] = useState(false);
  const [validado, setValidado] = useState(false);
  const [erro, setErro] = useState('');
  const [dominioApp, setDominioApp] = useState('');

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  const { data: userProfile } = useQuery({
    queryKey: ['userProfile', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      return profiles[0] || null;
    },
    enabled: !!user?.email,
  });

  // Carregar domínio da integração
  useEffect(() => {
    if (!empresaId) return;
    base44.entities.Integracao.filter({ empresaId, tipo: 'telefonia', ativa: true })
      .then(integracoes => {
        const integracao = integracoes.find(i => i.configuracao?.fornecedor === '3cplus');
        if (integracao) setDominioApp(integracao.configuracao?.dominio || '');
      });
  }, [empresaId]);

  // Pré-preencher token e ramal salvos
  useEffect(() => {
    if (userProfile?.token_3cplus) {
      setToken(userProfile.token_3cplus);
      setValidado(true);
    }
    if (userProfile?.ramal_3cplus) {
      setRamal(userProfile.ramal_3cplus);
    }
  }, [userProfile]);

  const validarToken = async () => {
    if (!token.trim()) return;
    if (!dominioApp) {
      setErro('Domínio 3C Plus não configurado. Configure em Integrações → Telefonia antes de validar o token.');
      return;
    }
    setValidando(true);
    setErro('');
    setValidado(false);
    try {
      // Validar token via serverless — token digitado é testado no backend (/agent/campaigns)
      const resp = await base44.functions.invoke('testar3CPlus', {
        token: token.trim(),
        dominio: dominioApp,
        endpoint: '/agent/campaigns',
        method: 'GET',
      });
      if (resp.data?.success) {
        setValidado(true);
      } else {
        setErro('Token inválido ou sem permissão. Verifique no painel 3C Plus.');
      }
    } catch (e) {
      setErro('Erro ao validar token. Verifique sua conexão.');
    } finally {
      setValidando(false);
    }
  };

  const salvarToken = async () => {
    if (!validado) return;
    if (!ramal.trim()) {
      setErro('Ramal 3C Plus é obrigatório para usar click-to-call.');
      return;
    }
    setSalvando(true);
    try {
      const resp = await base44.functions.invoke('salvarTokenAgente3CPlus', {
        token: token.trim(),
        ramal: ramal.trim(),
      });
      if (!resp.data?.success) {
        throw new Error(resp.data?.error || 'Não foi possível salvar o token.');
      }
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      toast.success('Token 3C Plus configurado com sucesso!');
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      toast.error('Erro ao salvar token', { description: msg });
    } finally {
      setSalvando(false);
    }
  };

  const tokenSincronizado = userProfile?.['3cplus_sincronizado'] && userProfile?.token_3cplus;

  return (
    <div className="space-y-4">
      {/* Status atual */}
      {tokenSincronizado ? (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-300">3C Plus configurado</p>
            <p className="text-[11px] text-emerald-400/70 mt-0.5">
              {userProfile.ramal_3cplus ? `Ramal ${userProfile.ramal_3cplus} · ` : ''}Sincronizado em {new Date(userProfile['3cplus_sincronizado_em']).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-300">Token 3C Plus não configurado</p>
            <p className="text-[11px] text-amber-400/70 mt-0.5">Configure abaixo para usar o softphone</p>
          </div>
        </div>
      )}

      {/* Como obter o token */}
      <div className="px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
        <p className="text-xs font-semibold text-slate-400">Como obter seu token 3C Plus</p>
        <ol className="space-y-1 text-[11px] text-slate-500 list-decimal list-inside">
          <li>Acesse o painel 3C Plus</li>
          <li>Vá em <strong className="text-slate-400">Configurações → Usuários</strong></li>
          <li>Clique no seu usuário</li>
          <li>Copie o <strong className="text-slate-400">Token API</strong> e o <strong className="text-slate-400">Ramal</strong></li>
        </ol>
      </div>

      {/* Campo do token */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-400">Token API 3C Plus</label>
        <div className="flex gap-2">
          <input
            type="password"
            value={token}
            onChange={e => { setToken(e.target.value); setValidado(false); setErro(''); }}
            placeholder="Cole seu token aqui..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500/50 font-mono transition-all"
          />
          <button
            onClick={validarToken}
            disabled={!token.trim() || validando}
            className="px-4 py-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sm font-semibold text-sky-400 hover:bg-sky-500/20 transition-all disabled:opacity-40 flex-shrink-0"
          >
            {validando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Validar'}
          </button>
        </div>
      </div>

      {/* Campo do ramal */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-400">Ramal 3C Plus <span className="text-rose-400">*</span></label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="tel"
            value={ramal}
            onChange={e => { setRamal(e.target.value); setErro(''); }}
            placeholder="Ex: 1001"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500/50 transition-all"
          />
        </div>
        <p className="text-[10px] text-slate-500">Obrigatório para click-to-call (POST /click2call exige extension)</p>
      </div>

      {/* Erro */}
      {erro && (
        <div className="flex items-center gap-2 text-[11px] text-rose-400">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {erro}
        </div>
      )}

      {/* Token validado */}
      {validado && (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <p className="text-xs font-semibold text-emerald-300">Token válido — {user?.email}</p>
        </div>
      )}

      {/* Botão salvar */}
      <button
        onClick={salvarToken}
        disabled={!validado || salvando}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 via-violet-500 to-emerald-500 text-white text-sm font-semibold transition-all disabled:opacity-40"
      >
        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
        {salvando ? 'Salvando...' : 'Salvar configuração'}
      </button>
    </div>
  );
}