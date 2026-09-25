import { useState, useEffect } from "react";
import { api } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { buscarUserProfile, buscarIntegracaoTelefonia, atualizarIntegracao, buscarCallSessionPorId as _buscarIntegracaoPorId } from "@/lib/services/telefoniaService";
import { listarEquipes } from "@/lib/services/equipeService";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { useTelefonia } from "@/contexts/TelefoniaContext";
import { usePermissions } from "@/components/hooks/usePermissions";
import { cn } from "@/lib/utils";
import { Radio, CheckCircle2, Loader2, LogOut, RefreshCw, AlertCircle, Settings2, Eye, EyeOff, Search } from "lucide-react";
import { useTelefoniaActions } from '@/contexts/telefonia/useTelefoniaActions';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import AtribuirCampanhasEquipe from "./AtribuirCampanhasEquipe";

export default function SeletorCampanha() {
  const { empresaId } = useEmpresaAtual();
  const telefonia = useTelefonia();
  const [campanhas, setCampanhas]           = useState([]);
  const [carregando, setCarregando]         = useState(true);
  const [entrando, setEntrando]             = useState(false);
  const [saindo, setSaindo]                 = useState(false);
  const [reconectando, setReconectando]     = useState(false);
  const [campanhaAtiva, setCampanhaAtiva]   = useState(null);
  const [agenteHabilitado, setAgenteHabilitado] = useState(false);
  const [dominioApp, setDominioApp]         = useState(null);
  const [tentativaBloqueada, setTentativaBloqueada] = useState(null); // id da campanha que o SDR tentou entrar

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.auth.me(),
  });

  const { data: userProfile } = useQuery({
    queryKey: ["userProfile", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      return buscarUserProfile(user.email);
    },
    enabled: !!user?.email,
  });

  const { loginCampanha, sairDaCampanha: sairViaActions, restaurarEstadoAgente } = useTelefoniaActions({
    empresaId,
    marcarLoginPending: telefonia?.marcarLoginPending,
    socketRef: telefonia?.socketRef,
  });

  const loginPending = telefonia?.loginPending;

  const { nivel } = usePermissions();
  const isGestorOuAdmin = nivel >= 4;

  // ── Fonte da verdade: current3CSession (restaurado do 3C+ no mount) ──
  const session3C = telefonia?.current3CSession;
  const campanhaAtivaCtx = session3C?.connected
    ? { id: session3C.campaignId, nome: session3C.campaignName || telefonia?.nomeCampanhaAtiva || "" }
    : (telefonia?.agenteCampanhaAtiva
      ? { id: campanhaAtiva?.id || null, nome: telefonia?.nomeCampanhaAtiva || "" }
      : null);

  // Sincronizar estado local com current3CSession (fonte da verdade = 3C+)
  useEffect(() => {
    if (!session3C) return;
    if (session3C.connected && session3C.campaignId) {
      setCampanhaAtiva({ id: session3C.campaignId, nome: session3C.campaignName || "" });
      setTentativaBloqueada(null);
    } else if (!session3C.connected && campanhaAtiva) {
      setCampanhaAtiva(null);
      setTentativaBloqueada(null);
    }
  }, [session3C?.connected, session3C?.campaignId]);

  useEffect(() => {
    if (!empresaId || !user?.email) return;
    async function carregar() {
      setCarregando(true);
      try {
        const integracao = await buscarIntegracaoTelefonia(empresaId);
        if (!integracao) return;
        setDominioApp(integracao.configuracao?.dominio || null);

        // O SDR precisa estar cadastrado como agente (ramal/id 3C); o token fica no backend
        const profile = await buscarUserProfile(user.email);
        setAgenteHabilitado(!!(profile?.id_3cplus || profile?.ramal_3cplus || profile?.token_3cplus || integracao.configuracao?.mapeamento_ramais?.[(user.email || '').toLowerCase()]));

        // Buscar campanhas via serverless (token decriptado no backend)
        let lista = [];
        try {
          const campanhasResp = await api.functions.invoke('executarComando3CPlus', {
            empresaId,
            comando: 'get-campaigns',
          });
          const campanhasData = campanhasResp?.data?.dados?.data || campanhasResp?.data?.dados || [];
          lista = campanhasData.map((c) => ({
            id:    String(c.id),
            nome:  c.name || `Campanha ${c.id}`,
            ativa: c.active !== false,
            tipo:  c.is_predictive ? "preditivo" : "manual",
          }));
        } catch (e) {
          console.warn('[SeletorCampanha] erro ao buscar campanhas via serverless:', e.message);
        }

          // Filtro 1: habilitadas globalmente pelo admin
          const cfgLocal = integracao.configuracao || {};
          const habilitadasSalvas = cfgLocal.campanhas_habilitadas || [];
          const globalFiltrada = habilitadasSalvas.length > 0
            ? lista.filter(c => c.ativa && habilitadasSalvas.includes(String(c.id)))
            : lista.filter(c => c.ativa);

          // Filtro 2: campanhas por equipe + individual do SDR
          let campanhasPermitidas = null;
          try {
            const individual = (profile?.campanhas_permitidas || []).map(String);
            const todasEquipes = await listarEquipes(empresaId);
            const minhasEquipes = todasEquipes.filter(e => (e.membros || []).includes(user.email));
            const porEquipe = minhasEquipes.flatMap(e => (e.campanhas_permitidas || []).map(String));
            const union = [...new Set([...individual, ...porEquipe])];
            if (union.length > 0) campanhasPermitidas = new Set(union);
          } catch (e) {
            console.warn("[SeletorCampanha] erro ao buscar permissões:", e.message);
          }

          const listaFiltrada = campanhasPermitidas
            ? globalFiltrada.filter(c => campanhasPermitidas.has(String(c.id)))
            : globalFiltrada;

          // Verificar estado real do 3C Plus via serverless
          try {
            const rLogged = await api.functions.invoke('executarComando3CPlus', {
              empresaId,
              comando: 'get-logged-campaign',
            });
            const dadosLogged = rLogged?.data?.dados?.data || rLogged?.data?.dados || null;
            if (!dadosLogged?.id) {
              setCampanhaAtiva(null);
              setTentativaBloqueada(null);
              if (telefonia?.agenteCampanhaAtiva || telefonia?.current3CSession?.connected) {
                telefonia?.setNomeCampanhaAtiva?.(null);
                telefonia?.setAgenteCampanhaAtiva?.(false);
                window.dispatchEvent(new CustomEvent('vendaflow:campanha-alterada', {
                  detail: { ativa: false, nome: null },
                }));
              }
            } else {
              const nomeReal = dadosLogged?.name || null;
              if (nomeReal && telefonia?.agenteCampanhaAtiva) {
                telefonia?.setNomeCampanhaAtiva?.(nomeReal);
              }
            }
          } catch (e) {
            console.warn('[SeletorCampanha] verificação loggedCampaign falhou:', e.message);
          }

          setCampanhas(listaFiltrada);
      } catch (e) {
        console.warn("[SeletorCampanha] Erro:", e.message);
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, [empresaId, user?.email]);

  const entrarCampanha = async (campanha) => {
    if (!agenteHabilitado) return;

    // Guard: deve sair da campanha atual antes de entrar em outra
    if (campanhaAtiva && campanhaAtiva.id !== campanha.id) {
      setTentativaBloqueada(campanha.id);
      setTimeout(() => setTentativaBloqueada(null), 4000);
      return;
    }
    setTentativaBloqueada(null);

    setEntrando(true);
    try {
      // Delegar para a máquina de estados centralizada:
      // SET_AGENT → aguarda ramal → connect → login → aguarda agent-is-idle
      await loginCampanha(campanha.id, { dominio: dominioApp });

      // Sucesso confirmado
      setCampanhaAtiva(campanha);
      telefonia?.setNomeCampanhaAtiva?.(campanha.nome);
      telefonia?.setAgenteCampanhaAtiva?.(true);
      window.dispatchEvent(new CustomEvent('vendaflow:campanha-alterada', {
        detail: { ativa: true, nome: campanha.nome, id: campanha.id },
      }));
      toast.success(`Entrou na campanha: ${campanha.nome}`);

      // Salvar preferência no perfil (fire-and-forget)
      try {
        const { atualizarUserProfile } = await import("@/lib/services/telefoniaService");
        const profileSave = await buscarUserProfile(user.email);
        if (profileSave?.id) {
          await atualizarUserProfile(profileSave.id, {
            campanha_preferencial_id: String(campanha.id),
            campanha_preferencial_nome: campanha.nome,
          });
        }
      } catch {}
    } catch (e) {
      toast.error("Erro ao entrar na campanha", { description: e.message });
    } finally {
      setEntrando(false);
    }
  };

  const sairCampanha = async () => {
    if (!agenteHabilitado) return;
    setSaindo(true);
    try {
      await sairViaActions();
      setCampanhaAtiva(null);
      telefonia?.setNomeCampanhaAtiva?.(null);
      telefonia?.setAgenteCampanhaAtiva?.(false);
      telefonia?.pararCronometroEstado?.();
      telefonia?.setCurrent3CSession?.(telefonia?.SESSION_VAZIA);
      window.dispatchEvent(new CustomEvent('vendaflow:campanha-alterada', { detail: { ativa: false, nome: null } }));
      toast.success('Saiu da campanha');
    } catch (e) {
      toast.error('Erro ao sair da campanha', { description: e.message });
    } finally {
      setSaindo(false);
    }
  };

  // ── Painel Admin: gestão de campanhas 3C Plus ────────────────
  const [campanhasAdmin, setCampanhasAdmin]   = useState([]);
  const [carregandoAdmin, setCarregandoAdmin] = useState(false);
  const [salvandoAdmin, setSalvandoAdmin]     = useState(false);
  const [habilitadasSalvas, setHabilitadasSalvas]       = useState(new Set()); // estado do banco — define os grupos
  const [habilitadasPendentes, setHabilitadasPendentes] = useState(new Set()); // estado editado — define checkboxes
  const [temAlteracoes, setTemAlteracoes]               = useState(false);
  const [integracaoId, setIntegracaoId]                 = useState(null);
  const [buscaAdmin, setBuscaAdmin]           = useState("");
  const [agrupar, setAgrupar]                 = useState(true);

  useEffect(() => {
    if (!isGestorOuAdmin || !empresaId) return;
    async function carregarAdmin() {
      setCarregandoAdmin(true);
      try {
        const integracao = await buscarIntegracaoTelefonia(empresaId);
        if (!integracao) return;
        setIntegracaoId(integracao.id);
        const cfg = integracao.configuracao || {};

        // Carregar lista de campanhas habilitadas salvas
        const salvas = cfg.campanhas_habilitadas || [];
        const setInicial = new Set(salvas.map(String));
        setHabilitadasSalvas(new Set(setInicial));   // grupos — não muda até salvar
        setHabilitadasPendentes(new Set(setInicial)); // checkboxes — editável
        setTemAlteracoes(false);

        // Buscar todas as campanhas da conta via serverless (token_gestor no backend)
        const resp = await api.functions.invoke('executarComando3CPlus', {
          empresaId,
          comando: 'get-all-campaigns',
        });
        const dados = resp?.data?.dados ?? resp?.dados ?? {};
        const lista = Array.isArray(dados) ? dados : (dados.data || []);
        setCampanhasAdmin(lista.map(c => ({
          id:   String(c.id),
          nome: c.name || `Campanha ${c.id}`,
          tipo: c.is_predictive ? 'preditivo' : 'manual',
          ativa: c.active !== false,
        })));
      } catch (e) {
        console.warn('[SeletorCampanha Admin] erro:', e.message);
      } finally {
        setCarregandoAdmin(false);
      }
    }
    carregarAdmin();
  }, [isGestorOuAdmin, empresaId]);

  const toggleCampanha = (id) => {
    setHabilitadasPendentes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setTemAlteracoes(true);
  };

  const salvarHabilitadas = async () => {
    if (!integracaoId) return;
    setSalvandoAdmin(true);
    try {
      const integracoes = await api.entities.Integracao.filter({ id: integracaoId });
      const cfgAtual = integracoes[0]?.configuracao || {};
      await atualizarIntegracao(integracaoId, {
        configuracao: { ...cfgAtual, campanhas_habilitadas: Array.from(habilitadasPendentes) },
      });
      // Sincronizar salvas com pendentes — grupos atualizam após salvar
      setHabilitadasSalvas(new Set(habilitadasPendentes));
      setTemAlteracoes(false);
      setBuscaAdmin("");
      toast.success(`${habilitadasPendentes.size} campanha(s) habilitada(s) salvas`);
    } catch {
      toast.error('Erro ao salvar campanhas');
    } finally {
      setSalvandoAdmin(false);
    }
  };

  // ── Admin: lógica de agrupamento ─────────────────────────────
  const filtradas = campanhasAdmin.filter(c => !buscaAdmin || c.nome.toLowerCase().includes(buscaAdmin.toLowerCase()));
  // Grupos baseados em habilitadasSALVAS — só mudam após clicar Salvar
  const habListaAdmin = filtradas.filter(c => habilitadasSalvas.has(c.id));
  const desListaAdmin = filtradas.filter(c => !habilitadasSalvas.has(c.id));
  const gruposAdmin = agrupar
    ? [
        { label: `Habilitadas (${habListaAdmin.length})`, cor: "text-emerald-400", items: habListaAdmin },
        { label: `Desabilitadas (${desListaAdmin.length})`, cor: "text-slate-500", items: desListaAdmin },
      ]
    : [{ label: null, items: filtradas }];

  if (isGestorOuAdmin) {
    return (
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <Settings2 className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Gestão de Campanhas</p>
              <p className="text-[11px] text-slate-500">Habilite quais campanhas ficam visíveis para os SDRs</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {temAlteracoes && (
              <button
                onClick={() => { setHabilitadasPendentes(new Set(habilitadasSalvas)); setTemAlteracoes(false); }}
                className="text-[11px] text-slate-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
            )}
            <button
              onClick={salvarHabilitadas}
              disabled={salvandoAdmin || !temAlteracoes}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold transition-all disabled:opacity-40"
            >
              {salvandoAdmin && <Loader2 className="w-3 h-3 animate-spin" />}
              {temAlteracoes ? "Salvar alterações" : "Salvo"}
            </button>
          </div>
        </div>

        {/* Badge resumo + Busca */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
          <span className="text-xs text-slate-400 whitespace-nowrap">
            <span className="text-white font-semibold">{habilitadasPendentes.size}</span>/<span className="text-white font-semibold">{campanhasAdmin.length}</span>
          </span>
          <button onClick={() => { setHabilitadasPendentes(new Set(campanhasAdmin.map(c => c.id))); setTemAlteracoes(true); }} className="text-[10px] text-sky-400 hover:text-sky-300 whitespace-nowrap">Habilitar todas</button>
          <button onClick={() => { setHabilitadasPendentes(new Set()); setTemAlteracoes(true); }} className="text-[10px] text-rose-400 hover:text-rose-300 whitespace-nowrap">Desabilitar</button>
          <div className="relative ml-auto" style={{ width: 150 }}>
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={buscaAdmin}
              onChange={e => setBuscaAdmin(e.target.value)}
              placeholder="Buscar campanha"
              className="w-full pl-7 pr-2 py-1 rounded-md bg-slate-700/60 border border-slate-600/50 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-sky-500/50"
            />
          </div>

        </div>

        {/* Permissões por equipe e SDR */}
        {campanhasAdmin.length > 0 && (
          <AtribuirCampanhasEquipe
            campanhas={campanhasAdmin}
            habilitadas={habilitadasSalvas}
            empresaId={empresaId}
          />
        )}

        {/* Lista */}
        {carregandoAdmin ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
          </div>
        ) : campanhasAdmin.length === 0 ? (
          <div className="text-center py-10">
            <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-40" />
            <p className="text-sm text-slate-500">Nenhuma campanha encontrada</p>
            <p className="text-[11px] text-slate-600 mt-1">Verifique o token_gestor na configuração da integração</p>
          </div>
        ) : (
          <div className="space-y-4">
            {gruposAdmin.map((grupo, i) => (
              <div key={i} className="space-y-2">
                {grupo.label && (
                  <p className={cn("text-[10px] font-semibold uppercase tracking-wider px-1", grupo.cor)}>{grupo.label}</p>
                )}
                {grupo.items.map(campanha => {
                  const isHabilitada = habilitadasPendentes.has(campanha.id);
                  return (
                    <button
                      key={campanha.id}
                      onClick={() => toggleCampanha(campanha.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left",
                        isHabilitada
                          ? "bg-emerald-500/8 border-emerald-500/25 hover:border-emerald-500/40"
                          : "bg-slate-800/40 border-slate-700/40 hover:border-slate-600/60 opacity-60"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all",
                        isHabilitada ? "bg-emerald-500 border-emerald-500" : "border-slate-600 bg-transparent"
                      )}>
                        {isHabilitada && (
                          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                            <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm font-medium truncate", isHabilitada ? "text-slate-200" : "text-slate-500")}>
                          {campanha.nome}
                        </p>
                        <p className="text-[10px] text-slate-600 mt-0.5">
                          {campanha.tipo === 'preditivo' ? '🤖 Preditivo' : '📞 Manual'} · ID {campanha.id}
                        </p>
                      </div>
                      <div className={cn(
                        "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0",
                        isHabilitada ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700/50 text-slate-500"
                      )}>
                        {isHabilitada ? <><Eye className="w-2.5 h-2.5" /> Visível</> : <><EyeOff className="w-2.5 h-2.5" /> Oculta</>}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    );
  }

  if (!agenteHabilitado) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 px-6">
        <AlertCircle className="w-8 h-8 text-amber-400 opacity-60" />
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-300">Token 3C Plus não configurado</p>
          <p className="text-xs text-slate-500 mt-1">Configure seu token para usar o softphone</p>
        </div>
        <a
          href="/Perfil"
          className="px-4 py-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs font-semibold text-sky-400 hover:bg-sky-500/20 transition-all"
        >
          Configurar agora
        </a>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {campanhaAtivaCtx ? (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <p className="text-sm font-semibold text-emerald-300">Campanha ativa</p>
              <p className="text-xs text-emerald-400/70">{campanhaAtivaCtx.nome}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={sairCampanha}
            disabled={saindo}
            className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
          >
            {saindo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
            <span className="ml-1.5 text-xs">Sair</span>
          </Button>
        </div>
      ) : (
        loginPending ? (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-sky-500/10 border border-sky-500/20">
            <Loader2 className="w-4 h-4 text-sky-400 animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm text-sky-300 font-medium">Aguardando 3C Plus...</p>
              <p className="text-xs text-sky-400/70 mt-0.5">Aguardando confirmação do socket</p>
            </div>
          </div>
        ) : reconectando ? (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-sky-500/10 border border-sky-500/20">
            <Loader2 className="w-4 h-4 text-sky-400 animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm text-sky-300 font-medium">Reconectando à campanha...</p>
              <p className="text-xs text-sky-400/70 mt-0.5">Restaurando sua sessão anterior</p>
            </div>
          </div>
        ) : (
          <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-sm text-amber-300 font-medium">Você não está em nenhuma campanha</p>
            <p className="text-xs text-amber-400/70 mt-0.5">Selecione uma campanha abaixo para começar a ligar</p>
          </div>
        )
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Campanhas disponíveis</p>
          <button
            onClick={() => window.location.reload()}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {campanhas.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">Nenhuma campanha disponível</p>
        ) : (
          <div className="space-y-2">
            {campanhas.map(campanha => {
              const ativa = campanhaAtivaCtx?.id === campanha.id;
              const bloqueada = !!campanhaAtivaCtx && !ativa;
              const fezTentativa = tentativaBloqueada === campanha.id;

              return (
                <div key={campanha.id}>
                  <button
                    onClick={() => {
                      if (bloqueada) {
                        setTentativaBloqueada(campanha.id);
                        setTimeout(() => setTentativaBloqueada(null), 4000);
                        return;
                      }
                      if (!ativa) entrarCampanha(campanha);
                    }}
                    disabled={entrando || loginPending || ativa}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200 text-left",
                      ativa
                        ? "bg-emerald-500/10 border-emerald-500/30 cursor-default"
                        : fezTentativa
                        ? "bg-rose-500/8 border-rose-500/40 scale-[0.99]"
                        : bloqueada
                        ? "bg-slate-800/30 border-slate-700/30 opacity-40 cursor-not-allowed"
                        : "bg-slate-800/60 border-slate-700/50 hover:border-sky-500/40 hover:bg-slate-700/60 active:scale-[0.99]"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0 transition-colors",
                        ativa ? "bg-emerald-400 animate-pulse" : fezTentativa ? "bg-rose-400" : "bg-slate-600"
                      )} />
                      <div>
                        <p className={cn(
                          "text-sm font-medium",
                          ativa ? "text-emerald-300" : fezTentativa ? "text-rose-300" : bloqueada ? "text-slate-600" : "text-slate-200"
                        )}>
                          {campanha.nome}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {campanha.tipo === "preditivo" ? "🤖 Preditivo" : "📞 Manual"} · ID {campanha.id}
                        </p>
                      </div>
                    </div>

                    {ativa ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : fezTentativa ? (
                      <span className="text-[10px] text-rose-400 font-medium flex-shrink-0">Saia primeiro ↑</span>
                    ) : bloqueada ? (
                      <span className="text-[10px] text-slate-600 flex-shrink-0">Bloqueado</span>
                    ) : (entrando || loginPending) ? (
                      <Loader2 className="w-4 h-4 text-slate-400 animate-spin flex-shrink-0" />
                    ) : (
                      <span className="text-[10px] text-slate-500 flex-shrink-0">Entrar</span>
                    )}
                  </button>

                  {/* Banner inline — aparece somente quando SDR tentou entrar nesta campanha */}
                  {fezTentativa && (
                    <div className={cn(
                      "flex items-start gap-2.5 px-3 py-2.5 rounded-b-xl -mt-1 pt-3",
                      "bg-rose-500/10 border border-t-0 border-rose-500/30"
                    )}>
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs text-rose-300 font-medium leading-tight">
                          Você já está em "{campanhaAtivaCtx?.nome}"
                        </p>
                        <p className="text-[10px] text-rose-400/70 mt-0.5 leading-tight">
                          Para trocar, clique em <span className="font-semibold text-rose-300">Sair</span> ao lado da campanha ativa acima.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}