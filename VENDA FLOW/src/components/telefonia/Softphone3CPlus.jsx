import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { cn } from "@/lib/utils";
import { Pause, Play, WifiOff, Headphones, PhoneCall, Loader2, Hash, Delete, Minus, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useExtensaoChrome } from "@/hooks/useExtensaoChrome";
import { usePermissions } from "@/components/hooks/usePermissions";
import { ExtensaoBadge, ExtensaoAvisoInstalacao } from "./ExtensaoStatus";
import { useTelefoniaActions } from '@/contexts/telefonia/useTelefoniaActions';
import { obterTokenAgenteDecriptado } from '@/lib/telefoniaToken';

const STATUS_CONFIG = {
  livre:       { label: "Disponível",    dot: "bg-emerald-400",              badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  em_campanha: { label: "Em campanha",   dot: "bg-emerald-400",              badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  em_ligacao:  { label: "Em ligação",    dot: "bg-sky-400 animate-[pulse_3s_ease-in-out_infinite]",    badge: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  em_pausa:    { label: "Em pausa",      dot: "bg-amber-400",                badge: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  erro:        { label: "Sem conexão",   dot: "bg-rose-400",                 badge: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
};

export default function Softphone3CPlus({ telefonia, onCampanhaAtiva }) {
  const { empresaId } = useEmpresaAtual();
  const [tokenAgente, setTokenAgente]         = useState(null);
  const [dominioApp, setDominioApp]           = useState(null);
  const [carregandoConfig, setCarregandoConfig] = useState(true);
  const [entrando, setEntrando]               = useState(false);
  const [campanhaAtiva, setCampanhaAtiva]     = useState(false);
  const [erroCampanha, setErroCampanha]       = useState(null);
  const [tecladoAberto, setTecladoAberto]     = useState(false);
  const [emModoManual, setEmModoManual]       = useState(false);
  const [tempoManual, setTempoManual]         = useState(0);   // segundos
  const tempoManualRef                        = useRef(0);
  const intervalManualRef                     = useRef(null);
  const inicioModoManualRef                   = useRef(null);
  const [numeroDigitado, setNumeroDigitado]   = useState("");
  const [discandoManual, setDiscandoManual]   = useState(false);
  const [hangupProcessando, setHangupProcessando] = useState(false);
  const [minimizado, setMinimizado]           = useState(false);
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const { data: userProfile } = useQuery({
    queryKey: ["userProfile", user?.email], // mesma queryKey do TelefoniaContext — cache compartilhado
    queryFn: async () => {
      if (!user?.email) return null;
      // Busca direto pela entidade (o usuário só vê o próprio perfil)
      try {
        const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
        const profile = profiles[0] || null;
        return profile;
      } catch (e) {
        console.warn('[Softphone] Erro ao buscar UserProfile:', e.message);
        return null;
      }
    },
    enabled: !!user?.email,
    staleTime: 30000,
    refetchOnMount: true,
    // Polling só quando token está vazio — para quando encontrar
    refetchInterval: (query) => {
      if (query.state.data?.token_3cplus) return false;
      return 30000;
    },
  });

  const { nivel } = usePermissions();
  const isGestorOuAdmin = nivel >= 4;
  const loginPending = telefonia?.loginPending;

  const { loginCampanha, sairDaCampanha: sairViaActions } = useTelefoniaActions({
    empresaId,
    marcarLoginPending: telefonia?.marcarLoginPending,
    socketRef: telefonia?.socketRef,
  });

  // Admin/gestor não usa softphone — não instanciar hook de extensão para evitar PING flood
  const { instalada: extensaoInstalada } = useExtensaoChrome();

  const {
    agentStatus,
    callSession,
    manualCallSession,
    manualCallStatus,
    leadCallStatus,
    cronometroFormatado,
    aguardandoAtendimento,
    emLigacao,
    executarComando,
    hangupManualCall,
    nomeCampanhaAtiva,
    setNomeCampanhaAtiva,
    estadoCampanha,
    tempoEstado,
    pararCronometroEstado,
    current3CSession,
    verificarAntesDeEntrar,
  } = telefonia;

  // ── Carregar config da integração ─────────────────────────
  // Aguarda userProfile carregar (undefined = ainda carregando, null = não existe)
  // A dependência userProfile?.token_3cplus re-executa quando token é salvo
  useEffect(() => {
    if (!empresaId || !user?.email) return;
    if (userProfile === undefined) return; // ainda carregando — aguardar
    if (isGestorOuAdmin) return; // gestor/admin não tem token de agente — não processar
    async function carregarConfig() {
      try {
        const integracoes = await base44.entities.Integracao.filter({
          empresaId, tipo: "telefonia", ativa: true,
        });
        const integracao = integracoes.find(i => i.configuracao?.fornecedor === "3cplus");
        if (!integracao) return;
        const cfg = integracao.configuracao;
        setDominioApp(cfg.dominio);

        // Usar token do userProfile já carregado via useQuery (evita fetch duplicado)
        const tokenDoProfile = userProfile?.token_3cplus || null;
        // Fallback mapeamento legado
        const mapeamento = cfg.mapeamento_agentes || {};
        const emailNorm  = (user.email || '').toLowerCase();
        const tokenLegado = mapeamento[emailNorm] || mapeamento[user.email] || cfg.token_agente || null;

        const token = tokenDoProfile || tokenLegado || null;
        // CRÍTICO: token do UserProfile é criptografado (enc:) — decriptar
        // antes de enviar à extensão, senão o WebRTC nunca registra.
        const tokenDecriptado = await obterTokenAgenteDecriptado(empresaId, token);
        setTokenAgente(tokenDecriptado || token);
      } catch (e) {
        console.warn("[Softphone3CPlus] Erro config:", e.message);
      } finally {
        setCarregandoConfig(false);
      }
    }
    carregarConfig();
  }, [empresaId, user?.email, userProfile?.token_3cplus]);

  // ── Registrar ramal na extensão ANTES de qualquer login ────
  // Doc oficial 3C: ordem obrigatória é (1) registrar ramal, (2) socket,
  // (3) POST /agent/login. Enviar config à extensão assim que disponível
  // garante que o ramal esteja registrado quando o login acontecer
  // (seja pelo Softphone ou pelo SeletorCampanha).
  useEffect(() => {
    if (!extensaoInstalada || !tokenAgente || !dominioApp) return;
    // Nunca enviar token criptografado — o 3C não autenticaria o ramal
    if (tokenAgente.startsWith('enc:')) {
      console.warn('[Softphone] SET_AGENT bloqueado — token ainda criptografado');
      return;
    }
    window.postMessage({
      type: 'VENDAFLOW_SET_AGENT',
      config: { token: tokenAgente, dominio: dominioApp },
    }, '*');
  }, [extensaoInstalada, tokenAgente, dominioApp]);

  // ── Escutar evento do SeletorCampanha para sincronizar estado ──
  useEffect(() => {
    const handleCampanhaAlterada = (event) => {
      const { ativa, nome } = event.detail || {};
      setCampanhaAtiva(!!ativa);
      onCampanhaAtiva?.(!!ativa);
      if (nome !== undefined) {
        setNomeCampanhaAtiva?.(nome || null);
        telefonia?.setNomeCampanhaAtiva?.(nome || null);
      }
      telefonia?.setAgenteCampanhaAtiva?.(!!ativa);
    };
    window.addEventListener('vendaflow:campanha-alterada', handleCampanhaAlterada);
    return () => window.removeEventListener('vendaflow:campanha-alterada', handleCampanhaAlterada);
  }, [onCampanhaAtiva, telefonia]);

  // ── Sincronizar campanhaAtiva com current3CSession (fonte da verdade = 3C+) ──
  // Isso garante que após F5/reload o estado visual seja restaurado automaticamente.
  useEffect(() => {
    const deveEstarAtiva = !!(current3CSession?.connected);
    if (deveEstarAtiva !== campanhaAtiva) {
      setCampanhaAtiva(deveEstarAtiva);
      onCampanhaAtiva?.(deveEstarAtiva);
    }
  }, [current3CSession?.connected]);

  // ── Notificar pai sobre campanha ──────────────────────────
  useEffect(() => {
    onCampanhaAtiva?.(campanhaAtiva);
  }, [campanhaAtiva]);

  // ── Sincronizar teclado com 3C ao entrar em campanha ────────
  // Se teclado já estava aberto quando campanhaAtiva virou true
  // → chamar manual_call/enter para o 3C saber que está em modo manual
  useEffect(() => {
    if (!campanhaAtiva || !tokenAgente) return;
    if (!tecladoAberto) return;
    // Teclado aberto + campanha ativa → garantir que 3C está pausado
    base44.functions.invoke('executarComando3CPlus', {
      empresaId,
      comando: 'manual-call-enter',
    }).catch(e => console.warn('[Softphone] manual_call/enter (auto) falhou:', e.message));
  }, [campanhaAtiva, tokenAgente]);

  // ── Fechar teclado automaticamente ao encerrar ligação ─────────────
  // Após ligação encerrar, fechar teclado para voltar ao estado limpo.
  // ATENÇÃO: disparar manual_call/exit apenas quando NÃO há ligação manual ativa —
  // ligações manuais saem do modo manual via hangupManualCall (que já chama acw/exit).
  const prevEmLigacaoRef = useRef(false);
  useEffect(() => {
    if (prevEmLigacaoRef.current && !emLigacao && tecladoAberto) {
      // Só fechar se NÃO há ligação manual ativa (evita fechar teclado no meio de discagem manual)
      const temLigacaoManualAtiva = manualCallSession && manualCallStatus !== "encerrado";
      if (temLigacaoManualAtiva) {
        prevEmLigacaoRef.current = emLigacao;
        return;
      }
      setTecladoAberto(false);
      if (campanhaAtiva) {
        setEmModoManual(false);
        // Chamar manual_call/exit apenas se a ligação era de campanha (não manual)
        // Ligações manuais já chamam acw/exit dentro de hangupManualCall
        if (empresaId) {
          base44.functions.invoke('executarComando3CPlus', {
            empresaId,
            comando: 'manual-call-exit',
          }).catch(() => {});
        }
      }
    }
    prevEmLigacaoRef.current = emLigacao;
  }, [emLigacao, tecladoAberto, campanhaAtiva, tokenAgente, manualCallSession, manualCallStatus]);

  // ── Cronômetro de modo manual ───────────────────────────────
  useEffect(() => {
    if (emModoManual) {
      inicioModoManualRef.current = new Date();
      tempoManualRef.current = 0;
      setTempoManual(0);
      intervalManualRef.current = setInterval(() => {
        tempoManualRef.current += 1;
        setTempoManual(t => t + 1);
      }, 1000);
    } else {
      if (intervalManualRef.current) {
        clearInterval(intervalManualRef.current);
        intervalManualRef.current = null;
      }
      // Registrar tempo de modo manual para auditoria
      if (tempoManualRef.current > 0 && empresaId) {
        const segundos = tempoManualRef.current;
        base44.entities.Atividade.create({
          empresaId,
          sdr_email: user?.email,
          tipo: 'modo_manual',
          resultado: 'modo_manual_encerrado',
          observacao: `Modo manual: ${Math.floor(segundos/60)}m ${segundos%60}s`,
          duracao_segundos: segundos,
          tma_segundos: segundos,
        }).catch(() => {}); // silencioso
        tempoManualRef.current = 0;
        setTempoManual(0);
      }
    }
    return () => {
      if (intervalManualRef.current) clearInterval(intervalManualRef.current);
    };
  }, [emModoManual, empresaId, user?.email]);

  // ── Manual Mode: entra/sai ao abrir/fechar teclado ─────────
  // T3: durante ligação → teclado é DTMF, abre imediatamente sem chamar API
  // T4: sem campanha → abre/fecha normalmente sem chamar API
  // M5: Em campanha: AGUARDAR confirmação do 3C antes de abrir
  // manual_call/enter pausa a campanha — só abrir teclado após confirmação
  // Caso contrário, campanha continua discando enquanto SDR abre o teclado
  const toggleTeclado = async () => {
    const novoEstado = !tecladoAberto;

    // T3: durante ligação → teclado é DTMF, abre imediatamente sem chamar API
    if (emLigacao) {
      setTecladoAberto(novoEstado);
      return;
    }

    // T4: sem campanha → abre/fecha normalmente sem chamar API
    if (!campanhaAtiva || !tokenAgente) {
      setTecladoAberto(novoEstado);
      return;
    }

    // Em campanha: AGUARDAR confirmação do 3C antes de abrir
    const endpointPath = novoEstado ? 'manual_call/enter' : 'manual_call/exit';
    try {
      if (!dominioApp) {
        setErroCampanha("Domínio 3C Plus não configurado. Configure em Integrações → Telefonia.");
        setEntrando(false);
        return;
      }
      const comando = novoEstado ? 'manual-call-enter' : 'manual-call-exit';
      const resp = await base44.functions.invoke('executarComando3CPlus', {
        empresaId,
        comando,
      });


      // Só abrir teclado após 3C confirmar pausa ou já estar em manual
      const confirmado = resp?.data?.success || resp?.data?.async || !novoEstado;
      if (confirmado) {
        // Fechar sempre funciona; abrir só quando confirmado
        setTecladoAberto(novoEstado);
        if (campanhaAtiva) setEmModoManual(novoEstado);
      } else {
      }
    } catch (e) {
      // 422 no manual_call/enter = o agente já está em modo manual (ou o estado do
      // 3C não permite re-entrar). O objetivo (estar em manual) já foi atingido —
      // então abrimos o teclado normalmente em vez de tratar como erro ruidoso.
      const status = e?.response?.status || e?.status;
      if (novoEstado && status === 422) {
        setTecladoAberto(true);
        if (campanhaAtiva) setEmModoManual(true);
        return;
      }
      // Se falhar ao fechar → fechar mesmo assim
      if (!novoEstado) {
        setTecladoAberto(false);
        setEmModoManual(false);
      }
      console.warn(`[Softphone] ${endpointPath} falhou:`, e.message);
    }
  };

  // ── Discagem manual via teclado ──────────────────────────────
  const discarManual = async () => {
    const telefone = numeroDigitado.replace(/\D/g, "");
    if (telefone.length < 8) return;

    // Supervisor/gestor atuando como closer: usa click2call com token_gestor + ramal.
    // O endpoint ligarAgoraLead3CPlus exige lead_id; quando há lead vinculado à
    // sessão manual, usamos esse fluxo. Sempre exigimos ramal registrado.
    const leadIdAtual = manualCallSession?.lead_id || "";
    if (isGestorOuAdmin) {
      const ramal = userProfile?.ramal_3cplus;
      if (!ramal) {
        const { toast } = await import("sonner");
        toast.error("Registre seu ramal na extensão Chrome antes de ligar");
        return;
      }
      if (leadIdAtual) {
        setDiscandoManual(true);
        try {
          const resp = await base44.functions.invoke("ligarAgoraLead3CPlus", {
            empresaId,
            lead_id: leadIdAtual,
            forcar_metodo: "click2call",
          });
          const { toast } = await import("sonner");
          if (resp?.data?.success) {
            setTecladoAberto(false);
            setNumeroDigitado("");
            toast.success(`Discando para ${telefone}...`);
          } else {
            toast.error("Erro ao discar", { description: resp?.data?.error || "Erro desconhecido" });
          }
        } catch (e) {
          const { toast } = await import("sonner");
          toast.error("Erro ao discar", { description: e.message });
        } finally {
          setDiscandoManual(false);
        }
        return;
      }
    }

    setDiscandoManual(true);
    try {
      const res = await telefonia.iniciarLigacaoManual?.({
        telefone_manual: telefone,
        lead_nome: telefone,
        lead_id: '',
      });

      // Hook retorna { sucesso, call_session_id } — checar "sucesso", não "success"
      if (res?.sucesso) {
        setTecladoAberto(false);
        setNumeroDigitado("");
        const { toast } = await import("sonner");
        toast.success(`Discando para ${telefone}...`);
      } else {
        const { toast } = await import("sonner");
        toast.error("Erro ao discar", { description: res?.erro || res?.error || "Erro desconhecido" });
      }
    } catch (e) {
      console.error("[Softphone] Erro discagem manual:", e.message);
      const { toast } = await import("sonner");
      toast.error("Erro ao discar", { description: e.message });
    } finally {
      setDiscandoManual(false);
    }
  };

  const fmtTempo = (s) =>
    `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  const teclas = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["*", "0", "#"],
  ];

  // ── Entrar na campanha ────────────────────────────────────
  const entrarNaCampanha = async () => {
    if (!dominioApp || !tokenAgente) return;
    const ramal = userProfile?.ramal_3cplus;
    if (!ramal) {
      setErroCampanha("Ramal 3C Plus não configurado. Acesse Perfil → Dados Pessoais e preencha o campo Ramal 3C Plus.");
      return;
    }
    setEntrando(true);
    setErroCampanha(null);

    try {
      const integracoes = await base44.entities.Integracao.filter({ empresaId, tipo: "telefonia", ativa: true });
      const integracao = integracoes.find(i => i.configuracao?.fornecedor === "3cplus");
      const campanhaId = integracao?.configuracao?.campanha_id_padrao;

      if (!campanhaId) {
        setErroCampanha("Nenhuma campanha padrão configurada. Configure em Integrações → Telefonia.");
        setEntrando(false);
        return;
      }

      // Delegar para a máquina de estados centralizada
      try {
        await loginCampanha(campanhaId, { token: tokenAgente, dominio: dominioApp });
        const nomeCampanha = 'Campanha ' + campanhaId;
        setNomeCampanhaAtiva?.(nomeCampanha);
        setCampanhaAtiva(true);
        onCampanhaAtiva?.(true);
        window.dispatchEvent(new CustomEvent('vendaflow:campanha-alterada', {
          detail: { ativa: true, nome: nomeCampanha, id: campanhaId },
        }));
      } catch (e) {
        setErroCampanha(e.message || 'Erro ao entrar na campanha');
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
      setErroCampanha(e.message);
    } finally {
      setEntrando(false);
    }
  };

  // ── Sair da campanha ──────────────────────────────────────
  const sairDaCampanha = async () => {
    if (!tokenAgente) return;
    try {
      await sairViaActions();
    } catch (e) {
      console.warn("[Softphone] logout falhou:", e.message);
    }
    setCampanhaAtiva(false);
    setNomeCampanhaAtiva?.(null);
    onCampanhaAtiva?.(false);
    telefonia?.setNomeCampanhaAtiva?.(null);
    telefonia?.setAgenteCampanhaAtiva?.(false);
    window.dispatchEvent(new CustomEvent('vendaflow:campanha-alterada', { detail: { ativa: false, nome: null } }));
  };

  const handlePausa = () => {
    if (agentStatus.status === "em_pausa") executarComando("agent-resume");
    else executarComando("agent-pause", { intervalo_id: "1" });
  };

  const statusVisual = emLigacao ? "em_ligacao"
    : campanhaAtiva ? "em_campanha"
    : agentStatus.status === "em_pausa" ? "em_pausa"
    : tokenAgente ? "livre"
    : "erro";

  const statusVis = STATUS_CONFIG[statusVisual] || STATUS_CONFIG.livre;

  // ── Barra minimizada ──────────────────────────────────────
  if (minimizado) {
    return (
      <button
        onClick={() => setMinimizado(false)}
        className={cn(
          "ml-auto flex items-center gap-2.5 rounded-full border transition-all duration-300 px-3 py-2 pointer-events-auto",
          "bg-slate-900/90 backdrop-blur-sm hover:bg-slate-800/90 shadow-lg",
          emLigacao ? "border-sky-500/30" : campanhaAtiva ? "border-emerald-500/25" : "border-slate-700/60",
        )}
        title="Expandir softphone"
      >
        <span className={cn("w-2 h-2 rounded-full flex-shrink-0", statusVis.dot)} />
        <span className="text-xs font-semibold text-slate-200">3C Plus</span>
        <span className="text-[10px] text-slate-500">{aguardandoAtendimento ? "Discando..." : statusVis.label}</span>
        {emLigacao && callSession?.status === "answered" && (
          <span className="text-[10px] font-mono text-sky-400">{cronometroFormatado}</span>
        )}
        <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
      </button>
    );
  }

  return (
    <div className={cn(
      "rounded-2xl border transition-all duration-300 pointer-events-auto",
      "bg-slate-900/80 backdrop-blur-sm",
      emLigacao        && "border-sky-500/30 shadow-lg shadow-sky-500/10",
      campanhaAtiva && !emLigacao && "border-emerald-500/20",
      !campanhaAtiva && tokenAgente && !emLigacao && "border-amber-500/20",
      !tokenAgente     && "border-slate-800/60",
    )}>
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-xl transition-all",
            emLigacao ? "bg-sky-500/10 shadow-sm shadow-sky-500/20"
            : campanhaAtiva ? "bg-emerald-500/10"
            : "bg-slate-800/80",
          )}>
            <Headphones className={cn(
              "w-4 h-4",
              emLigacao ? "text-sky-400"
              : campanhaAtiva ? "text-emerald-400"
              : "text-slate-400"
            )} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-200">3C Plus</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={cn("w-1.5 h-1.5 rounded-full", statusVis.dot)} />
              <span className="text-[10px] text-slate-500">{statusVis.label}</span>
            </div>
            {campanhaAtiva && nomeCampanhaAtiva && (
              <p className="text-[10px] text-emerald-400/80 mt-0.5 max-w-[140px] truncate" title={nomeCampanhaAtiva}>
                {nomeCampanhaAtiva}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Cronômetro */}
          {emLigacao && callSession?.status === "answered" && (
            <span className="text-xs font-mono text-sky-400 bg-sky-500/10 border border-sky-500/20 rounded-lg px-2 py-1">
              {cronometroFormatado}
            </span>
          )}

          {/* Badge */}
          <Badge className={cn("text-[10px] font-medium border px-2 py-0.5", statusVis.badge)}>
            {aguardandoAtendimento ? "Discando..." : statusVis.label}
          </Badge>

          {/* Botão pausa */}
          {!emLigacao && !carregandoConfig && tokenAgente && !isGestorOuAdmin && campanhaAtiva && (
            <Button
              size="sm" variant="ghost"
              onClick={handlePausa}
              className={cn(
                "h-7 w-7 p-0 rounded-lg transition-all",
                agentStatus.status === "em_pausa"
                  ? "text-amber-400 hover:bg-amber-500/10"
                  : "text-slate-500 hover:text-white hover:bg-slate-800",
              )}
            >
              {agentStatus.status === "em_pausa"
                ? <Play className="w-3.5 h-3.5" />
                : <Pause className="w-3.5 h-3.5" />
              }
            </Button>
          )}

          {/* Botão minimizar */}
          <button
            onClick={() => setMinimizado(true)}
            className="h-7 w-7 p-0 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
            title="Minimizar softphone"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Controles da campanha ativa (teclado + sair) ── */}
      {!isGestorOuAdmin && tokenAgente && !emLigacao && !carregandoConfig && campanhaAtiva && (
        <div className="flex items-center justify-end gap-2 px-4 -mt-1 mb-2">
          <ExtensaoBadge instalada={extensaoInstalada} />
          <button
            onClick={toggleTeclado}
            className={cn(
              "p-1.5 rounded-lg transition-all",
              tecladoAberto
                ? "bg-sky-500/20 text-sky-400"
                : "text-slate-500 hover:text-sky-400 hover:bg-sky-500/10"
            )}
            title="Abrir teclado"
          >
            <Hash className="w-3.5 h-3.5" />
          </button>
          <button onClick={sairDaCampanha} className="text-[10px] text-slate-500 hover:text-rose-400 transition-colors">
            Sair
          </button>
        </div>
      )}

      {/* ── Botão entrar/sair da campanha ───────────────── */}
      {!isGestorOuAdmin && tokenAgente && !emLigacao && !carregandoConfig && (
        <div className="mx-3 mb-3 space-y-1.5">
          {!campanhaAtiva ? (
            <>
              <button
                onClick={() => { window.location.href = '/Leads#campanhas'; }}
                disabled={entrando || loginPending}
                className={cn(
                  "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl",
                  "text-sm font-semibold transition-all duration-200 text-white",
                  "bg-gradient-to-r from-sky-500 to-violet-500",
                  "hover:from-sky-400 hover:to-violet-400",
                  "shadow-md shadow-sky-500/20 active:scale-[0.98]",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                )}
              >
                {loginPending || entrando
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Aguardando 3C Plus...</>
                  : <><PhoneCall className="w-4 h-4" /> Entrar em campanha</>
                }
              </button>
              {erroCampanha && (
                <p className="text-[10px] text-rose-400 px-1">{erroCampanha}</p>
              )}
            </>
          ) : (
            <div className="space-y-2">
              {/* ── Aviso: extensão não detectada ── */}
              {!extensaoInstalada && <ExtensaoAvisoInstalacao />}

              {/* ── Banner: Falando (campanha automática) ── */}
              {estadoCampanha === 'falando' && emLigacao && callSession && (
                <div className="mx-3 mb-1 rounded-xl bg-sky-500/10 border border-sky-500/25 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-sky-500/15">
                    <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse flex-shrink-0" />
                    <span className="text-xs font-bold text-sky-300 flex-1">Falando</span>
                    <span className="font-mono text-sm font-bold text-sky-400 tabular-nums">
                      {fmtTempo(tempoEstado)}
                    </span>
                  </div>
                  <div className="px-3 py-2 space-y-0.5">
                    <p className="text-sm font-semibold text-white truncate">
                      {callSession.lead_nome || callSession.lead_telefone || 'Lead não identificado'}
                    </p>
                    {callSession.lead_telefone && (
                      <p className="text-[11px] text-slate-400">{callSession.lead_telefone}</p>
                    )}
                    {callSession.campanha_id_3cplus && (
                      <p className="text-[10px] text-sky-400/60">Campanha #{callSession.campanha_id_3cplus}</p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Banner: Aguardando ligação ── */}
              {estadoCampanha === 'aguardando' && !emLigacao && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-emerald-300">Aguardando ligação</p>
                    <p className="text-[10px] text-emerald-400/60">Campanha discando automaticamente</p>
                  </div>
                  <span className="font-mono text-sm font-bold text-emerald-400 tabular-nums">
                    {/* Usar elapsed do current3CSession quando disponível (sobrevive ao F5) */}
                    {fmtTempo(current3CSession?.connected && current3CSession?.elapsedSeconds > tempoEstado
                      ? current3CSession.elapsedSeconds
                      : tempoEstado)}
                  </span>
                </div>
              )}

              {/* ── Banner: TPA — Pós Atendimento ── */}
              {estadoCampanha === 'tpa' && !emLigacao && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-amber-300">Pós atendimento</p>
                    <p className="text-[10px] text-amber-400/60">Registre o resultado no modal</p>
                  </div>
                  <span className="font-mono text-sm font-bold text-amber-400 tabular-nums">
                    {fmtTempo(tempoEstado)}
                  </span>
                </div>
              )}

              {/* ── Banner modo manual ── */}
              {emModoManual && !emLigacao && (
                <div className="mx-3 mb-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-500/15 border border-orange-500/30">
                  <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse flex-shrink-0" />
                  <span className="text-xs font-semibold text-orange-300">Modo manual</span>
                  <span className="ml-auto font-mono text-sm font-bold text-orange-400 tabular-nums">
                    {fmtTempo(tempoManual)}
                  </span>
                </div>
              )}

              {/* ── Teclado numérico ── */}
              {tecladoAberto && (
                <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3 space-y-2">
                  {/* Display — input real para digitação e colagem */}
                  <div className="flex items-center gap-2 bg-slate-900/60 rounded-lg px-3 py-2 border border-slate-700/40">
                    <input
                      type="tel"
                      inputMode="tel"
                      value={numeroDigitado}
                      onChange={(e) => setNumeroDigitado(e.target.value.replace(/[^\d*#()+\-\s]/g, ""))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && numeroDigitado.replace(/\D/g, "").length >= 8 && !discandoManual && !manualCallSession && !telefonia?.callSession) {
                          discarManual();
                        }
                      }}
                      placeholder="Digite o número"
                      className="flex-1 bg-transparent text-sm font-mono text-white placeholder-slate-600 outline-none border-none focus:outline-none focus:ring-0"
                      autoFocus
                    />
                    {numeroDigitado && (
                      <button
                        onClick={() => setNumeroDigitado("")}
                        className="text-slate-500 hover:text-white transition-colors flex-shrink-0"
                      >
                        <Delete className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Teclas */}
                  <div className="space-y-1.5">
                    {teclas.map((linha, i) => (
                      <div key={i} className="grid grid-cols-3 gap-1.5">
                        {linha.map(tecla => (
                          <button
                            key={tecla}
                            onClick={() => setNumeroDigitado(v => v + tecla)}
                            className={cn(
                              "py-2.5 rounded-xl text-sm font-semibold transition-all",
                              "bg-slate-700/60 hover:bg-slate-600/60 text-white",
                              "active:scale-95 active:bg-slate-500/60",
                            )}
                          >
                            {tecla}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Botão ligar */}
                  <button
                    onClick={discarManual}
                    disabled={
                      discandoManual ||
                      numeroDigitado.length < 8 ||
                      !!manualCallSession ||
                      !!telefonia?.callSession
                    }
                    className={cn(
                      "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl",
                      "text-sm font-semibold transition-all text-white",
                      "bg-gradient-to-r from-emerald-500 to-teal-400",
                      "hover:from-emerald-400 hover:to-teal-300",
                      "shadow-md shadow-emerald-500/20",
                      "disabled:opacity-40 disabled:cursor-not-allowed",
                    )}
                  >
                    {discandoManual
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Discando...</>
                      : <><PhoneCall className="w-4 h-4" /> Ligar</>
                    }
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Status da ligação manual ── */}
      {manualCallSession && (
        <div className="mx-4 mb-3">
          <div className={cn(
            "px-3 py-2.5 rounded-xl border transition-all duration-300",
            manualCallStatus === "encerrado"
              ? "bg-slate-800/60 border-slate-700/40"
              : "bg-sky-500/10 border-sky-500/20"
          )}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0 transition-all duration-300",
                  manualCallStatus === "encerrado"  ? "bg-slate-500" :
                  manualCallStatus === "em_ligacao" ? "bg-sky-400 animate-[pulse_3s_ease-in-out_infinite]" :
                  manualCallStatus === "chamando"   ? "bg-amber-400 animate-[pulse_3s_ease-in-out_infinite]" :
                  "bg-sky-400 animate-[pulse_3s_ease-in-out_infinite]"
                )} />
                <span className={cn(
                  "text-xs font-semibold truncate transition-all duration-300",
                  manualCallStatus === "encerrado"  ? "text-slate-400 animate-[pulse_3s_ease-in-out_infinite]" :
                  manualCallStatus === "em_ligacao" ? "text-sky-300" :
                  manualCallStatus === "chamando"   ? "text-amber-300" :
                  "text-sky-300"
                )}>
                  {manualCallStatus === "encerrado"  && "Encerrado"}
                  {manualCallStatus === "em_ligacao" && `Em ligação · ${manualCallSession.lead_telefone || "—"}`}
                  {manualCallStatus === "chamando"   && `Chamando · ${manualCallSession.lead_telefone || "—"}`}
                  {!manualCallStatus                 && `Discando para ${manualCallSession.lead_telefone || "—"}`}
                </span>
              </div>
              {manualCallStatus !== "encerrado" && (
                <button
                  onClick={() => hangupManualCall?.()}
                  className="flex items-center gap-1 text-[11px] font-semibold text-white bg-rose-500 hover:bg-rose-400 rounded-lg px-2.5 py-1.5 transition-all active:scale-95 flex-shrink-0"
                >
                  <PhoneCall className="w-3 h-3 rotate-[135deg]" />
                  Hang up
                </button>
              )}
            </div>
            {/* Escape: limpar sessão manual travada em "Encerrado" */}
            {manualCallStatus === "encerrado" && (
              <div className="pt-1 pl-4">
                <button
                  onClick={() => telefonia?.limparSessaoManual?.()}
                  className="text-[10px] text-slate-500 hover:text-slate-300 underline transition-colors"
                >
                  Descartar sessão travada
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Em ligação manual atendida ── */}
      {/* (removido — unificado no bloco acima) */}

      {/* ── Status da ligação de lead ── (ocultar quando é ligação manual) */}
      {(callSession || leadCallStatus === "encerrado") && !manualCallSession && (
        <div className="mx-4 mb-3">
          <div className={cn(
            "px-3 py-2.5 rounded-xl border transition-all duration-300",
            leadCallStatus === "encerrado"
              ? "bg-slate-800/60 border-slate-700/40"
              : "bg-sky-500/10 border-sky-500/20"
          )}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0 transition-all duration-300",
                  leadCallStatus === "encerrado"  ? "bg-slate-500" :
                  leadCallStatus === "em_ligacao" ? "bg-sky-400 animate-[pulse_2s_ease-in-out_infinite]" :
                  leadCallStatus === "chamando"   ? "bg-amber-400 animate-[pulse_2s_ease-in-out_infinite]" :
                  "bg-sky-400 animate-[pulse_2s_ease-in-out_infinite]"
                )} />
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className={cn(
                    "text-xs font-semibold truncate transition-all duration-300",
                    leadCallStatus === "encerrado"  ? "text-slate-400 animate-[pulse_2s_ease-in-out_infinite]" :
                    leadCallStatus === "em_ligacao" ? "text-sky-300" :
                    leadCallStatus === "chamando"   ? "text-amber-300" :
                    "text-sky-300"
                  )}>
                    {leadCallStatus === "encerrado"  && "Encerrado"}
                    {leadCallStatus === "em_ligacao" && `Em ligação · ${callSession?.lead_nome || callSession?.lead_telefone || "—"}`}
                    {leadCallStatus === "chamando"   && `Chamando · ${callSession?.lead_nome || callSession?.lead_telefone || "—"}`}
                    {(leadCallStatus === "discando" || !leadCallStatus) && `Discando · ${callSession?.lead_nome || callSession?.lead_telefone || "—"}`}
                  </span>
                  {leadCallStatus === "em_ligacao" && (
                    <span className="text-xs font-mono text-sky-400 bg-sky-500/10 border border-sky-500/20 rounded px-1.5 py-0.5 flex-shrink-0">
                      {cronometroFormatado}
                    </span>
                  )}
                </div>
              </div>
              {leadCallStatus !== "encerrado" && (
                <button
                  disabled={hangupProcessando}
                  onClick={async () => {
                    if (hangupProcessando) return;
                    setHangupProcessando(true);
                    try {
                      const resultado = leadCallStatus === "em_ligacao"
                        ? await telefonia.finalizarLigacao?.("nao_atendeu", null, "Encerrado pelo agente via softphone")
                        : await telefonia.finalizarLigacao?.("nao_atendeu", null, "Chamada cancelada antes do atendimento");
                      if (!resultado?.sucesso) {
                        setHangupProcessando(false);
                      }
                    } catch (e) {
                      console.error("[Softphone] hangup erro:", e.message);
                      setHangupProcessando(false);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-1 text-[11px] font-semibold text-white rounded-lg px-2.5 py-1.5 transition-all active:scale-95 flex-shrink-0",
                    hangupProcessando
                      ? "bg-rose-500/40 cursor-not-allowed"
                      : "bg-rose-500 hover:bg-rose-400"
                  )}
                >
                  <PhoneCall className="w-3 h-3 rotate-[135deg]" />
                  {hangupProcessando ? "Encerrando..." : "Hang up"}
                </button>
              )}
            </div>
            {leadCallStatus !== "encerrado" && callSession?.lead_telefone && callSession?.lead_nome && (
              <p className="text-[10px] text-slate-500 pl-4 mt-1">{callSession.lead_telefone}</p>
            )}
            {/* Botão de escape — visível apenas quando encerrado e sessão ainda presente */}
            {leadCallStatus === "encerrado" && callSession && (
              <div className="pt-1 pl-4">
                <button
                  onClick={() => {
                    // Force-clear local: limpa o estado sem chamar o backend
                    // Usado quando finalizarLigacao3CPlus falhou (ex: 500) e o softphone travou
                    telefonia?.forceClearCallState?.();
                  }}
                  className="text-[10px] text-slate-500 hover:text-slate-300 underline transition-colors"
                >
                  Descartar sessão travada
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modo monitoramento para gestores ────────────── */}
      {isGestorOuAdmin && !tokenAgente && !carregandoConfig && (
        <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-violet-400" />
          <span className="text-xs text-violet-300 font-medium">Modo monitoramento</span>
        </div>
      )}

      {/* ── Sem token ────────────────────────────────────── */}
      {!carregandoConfig && !tokenAgente && !isGestorOuAdmin && (
        <div className="px-4 pb-4 space-y-3">
          <div className="rounded-xl bg-rose-500/8 border border-rose-500/20 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-500/12 border-b border-rose-500/15">
              <WifiOff className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
              <span className="text-xs font-semibold text-rose-300">Token 3C Plus não configurado</span>
            </div>
            <div className="px-3 py-3 space-y-3">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Para usar a telefonia, siga os passos abaixo:
              </p>
              {/* Passo 1 */}
              <div className="flex gap-2.5">
                <div className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-sky-400">1</span>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-300">Obtenha seu token no 3C Plus</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                    Acesse <span className="text-sky-400">Configurações → API</span> no painel do 3C Plus e copie seu token de agente.
                  </p>
                </div>
              </div>
              {/* Passo 2 */}
              <div className="flex gap-2.5">
                <div className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-sky-400">2</span>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-300">Cole o token no seu perfil</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                    Vá em <span className="text-sky-400">Perfil → Configuração 3C Plus</span> e salve seu token de acesso.
                  </p>
                  <a
                    href="/Perfil"
                    className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold text-sky-400 hover:text-sky-300 bg-sky-500/10 border border-sky-500/20 rounded-lg px-2 py-1 transition-colors"
                  >
                    Ir para o Perfil →
                  </a>
                </div>
              </div>
              {/* Passo 3 */}
              <div className="flex gap-2.5">
                <div className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-sky-400">3</span>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-300">Instale a extensão do CRM</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                    A extensão é necessária para capturar as ligações automaticamente.
                  </p>
                  <a
                    href="/ExtensaoVendaFlow"
                    className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold text-violet-400 hover:text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded-lg px-2 py-1 transition-colors"
                  >
                    Ver instruções da extensão →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}