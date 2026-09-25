import { useState, useEffect, useRef, useMemo } from "react";
import { api } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  PhoneCall, Pause, Wifi, WifiOff,
  Clock, Users, RefreshCw, Headphones,
  Play, LogOut, ChevronDown, Loader2, X,
  Eye, Mic, ExternalLink, User,
} from "lucide-react";
import { toast } from "sonner";
import PainelSpyMonitoramento from "@/components/telefonia/PainelSpyMonitoramento";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMonitoramentoRealTime } from '@/hooks/useMonitoramentoRealTime';
import { listarAtividades } from '@/lib/services/atividadeService';

const POLLING_MS = 60000; // 60s — fallback, socket gestor é primário



// ── Card de agente individual ─────────────────────────────────
function AgenteCard({ agente, onAcao, acaoProcessando, intervalos, seletorPausa, setSeletorPausa, seletorPos, infoCliente, spyAtivo, setSpyAtivo, confirmDeslogar, setConfirmDeslogar }) {
  const COR_DOT = {
    emerald: "bg-emerald-400",
    sky:     "bg-sky-400 animate-pulse",
    amber:   "bg-amber-400",
    orange:  "bg-orange-400",
    violet:  "bg-violet-400",
    slate:   "bg-slate-600",
  };
  const COR_BADGE = {
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    sky:     "bg-sky-500/10 text-sky-400 border-sky-500/20",
    amber:   "bg-amber-500/10 text-amber-400 border-amber-500/20",
    orange:  "bg-orange-500/10 text-orange-400 border-orange-500/20",
    violet:  "bg-violet-500/10 text-violet-400 border-violet-500/20",
    slate:   "bg-slate-700/60 text-slate-500 border-slate-700/40",
  };
  const cor  = agente.status_cor || "slate";
  const dot  = COR_DOT[cor]  || COR_DOT.slate;
  const badge = COR_BADGE[cor] || COR_BADGE.slate;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-2xl border transition-all duration-300 p-4",
        "bg-slate-900/60 backdrop-blur-sm",
        agente.em_ligacao  && "border-sky-500/30 shadow-lg shadow-sky-500/10",
        agente.disponivel  && "border-emerald-500/20",
        agente.em_pausa    && "border-orange-500/20",
        agente.status === 0 && "border-slate-800/40 opacity-60",
        !agente.em_ligacao && !agente.disponivel && !agente.em_pausa && agente.status !== 0 && "border-slate-800/60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white",
              agente.em_ligacao ? "bg-gradient-to-br from-sky-500 to-violet-500"   :
              agente.disponivel ? "bg-gradient-to-br from-emerald-500 to-teal-400" :
              agente.em_pausa   ? "bg-gradient-to-br from-orange-500 to-amber-400" :
              "bg-slate-700"
            )}>
              {(agente.nome || "?")[0].toUpperCase()}
            </div>
            <span className={cn("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900", dot)} />
          </div>

          <div>
            <p className="text-sm font-semibold text-white">{agente.nome}</p>
            <p className="text-[10px] text-slate-500">{agente.campanha_nome || "Sem campanha"}</p>
            {agente.ramal && <p className="text-[10px] text-slate-600">Ramal {agente.ramal}</p>}
          </div>
        </div>

        <Badge className={cn("text-[10px] border px-2 py-0.5 flex items-center gap-1 flex-shrink-0", badge)}>
          <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", dot)} />
          <span>{agente.status_icone} {agente.status_label}</span>
        </Badge>
      </div>

      {/* Status + duração */}
      <div className="mt-3 flex items-center gap-1.5">
        <span className="text-sm">{agente.status_icone}</span>
        <span className="text-xs text-slate-400">{agente.status_label}</span>
        {agente.duracao > 60 && (
          <span className={cn("text-[10px] font-mono ml-1", agente.em_ligacao ? "text-sky-400" : "text-slate-500")}>
            {Math.floor(agente.duracao / 60)}:{String(agente.duracao % 60).padStart(2, '0')}
          </span>
        )}
      </div>

      {/* Ações do gestor */}
      <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center gap-2 flex-wrap">

        {/* Pausar — só se disponível */}
        {agente.disponivel && (
          <div className="relative">
            <button
              onClick={(e) => { setSeletorPausa(seletorPausa === agente.id ? null : agente.id, e); }}
              disabled={!!acaoProcessando[`${agente.id}_pausar`]}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] font-semibold text-amber-400 hover:bg-amber-500/20 transition-all disabled:opacity-40"
            >
              {acaoProcessando[`${agente.id}_pausar`] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pause className="w-3 h-3" />}
              Pausar
              <ChevronDown className={cn("w-3 h-3 transition-transform", seletorPausa === agente.id && "rotate-180")} />
            </button>
            {seletorPausa === agente.id && (
              <div
                className="fixed z-[300] min-w-[160px] rounded-xl bg-zinc-900 border border-white/10 shadow-2xl overflow-hidden"
                style={{ top: `${seletorPos.top}px`, left: `${seletorPos.left}px` }}
              >
                {intervalos.length === 0 ? (
                  <div className="px-4 py-3 text-[11px] text-slate-500">Nenhum intervalo disponível</div>
                ) : (
                  intervalos.map(i => (
                    <button
                      key={i.id}
                      onClick={() => onAcao(agente, 'pausar', { work_break_id: i.id })}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] text-white hover:bg-white/[0.06] transition-all text-left"
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: i.cor || '#64748b' }} />
                      {i.nome}
                      {i.minutos > 0 && <span className="text-slate-500 ml-auto">{i.minutos}min</span>}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Retomar — só se em pausa */}
        {agente.em_pausa && (
          <button
            onClick={() => onAcao(agente, 'retomar')}
            disabled={!!acaoProcessando[`${agente.id}_retomar`]}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-40"
          >
            {acaoProcessando[`${agente.id}_retomar`] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            Retomar
          </button>
        )}

        {/* Spy / Whisper — só quando em ligação */}
        {agente.em_ligacao && agente.call_id && (
          <>
            <button
              onClick={() => { onAcao(agente, 'spy', { call_id: agente.call_id }); setSpyAtivo({ agente, modo: 'spy' }); }}
              disabled={!!acaoProcessando[`${agente.id}_spy`]}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-700/60 border border-slate-600/40 text-[11px] font-semibold text-slate-300 hover:text-white hover:bg-slate-700 transition-all disabled:opacity-40"
            >
              {acaoProcessando[`${agente.id}_spy`] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
              Escutar
            </button>
            <button
              onClick={() => { onAcao(agente, 'whisper', { call_id: agente.call_id }); setSpyAtivo({ agente, modo: 'whisper' }); }}
              disabled={!!acaoProcessando[`${agente.id}_whisper`]}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-[11px] font-semibold text-violet-400 hover:bg-violet-500/20 transition-all disabled:opacity-40"
            >
              {acaoProcessando[`${agente.id}_whisper`] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mic className="w-3 h-3" />}
              Sussurrar
            </button>
          </>
        )}

        {/* Deslogar — sempre disponível exceto offline */}
        {agente.status !== 0 && (
          <button
            onClick={() => setConfirmDeslogar(agente)}
            disabled={!!acaoProcessando[`${agente.id}_deslogar`]}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] font-semibold text-rose-400 hover:bg-rose-500/20 transition-all disabled:opacity-40 ml-auto"
          >
            {acaoProcessando[`${agente.id}_deslogar`] ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
            Deslogar
          </button>
        )}

        {/* Spy/Whisper — só se em ligação */}
        {agente.em_ligacao && (
          <>
            <button
              onClick={() => { onAcao(agente, 'spy', {}); setSpyAtivo({ agente, modo: 'spy' }); }}
              disabled={!!acaoProcessando[`${agente.id}_spy`]}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] font-semibold text-indigo-400 hover:bg-indigo-500/20 transition-all disabled:opacity-40"
            >
              {acaoProcessando[`${agente.id}_spy`] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Headphones className="w-3 h-3" />}
              Escuta
            </button>
          </>
        )}

        {/* Modo Spy — botão unificado quando em ligação */}
        {agente.em_ligacao && (
          <button
            onClick={() => {
              onAcao(agente, 'spy', {});
              setSpyAtivo({ agente, modo: 'spy' });
            }}
            disabled={!!acaoProcessando[`${agente.id}_spy`]}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all border disabled:opacity-40",
              spyAtivo?.agente?.id === agente.id
                ? "bg-violet-500/20 border-violet-500/30 text-violet-300"
                : "bg-slate-700/60 border-slate-600/40 text-slate-300 hover:text-white hover:bg-slate-700"
            )}
          >
            {acaoProcessando[`${agente.id}_spy`]
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <Eye className="w-3 h-3" />
            }
            {spyAtivo?.agente?.id === agente.id ? 'Spy ativo' : 'Modo Spy'}
          </button>
        )}
      </div>

      {/* Info cliente — Sprint 6 */}
      {agente.em_ligacao && infoCliente[agente.id] && (
        <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-1">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Cliente em linha</p>
          {infoCliente[agente.id]?.lead ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-sky-500 to-violet-500 flex items-center justify-center flex-shrink-0">
                  <User className="w-3 h-3 text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">{infoCliente[agente.id].lead.nome}</p>
                  <p className="text-[10px] font-mono text-slate-500">{infoCliente[agente.id].sessao?.lead_telefone}</p>
                </div>
              </div>
              <a
                href={`/Leads?id=${infoCliente[agente.id].lead.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors"
              >
                Abrir <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                <User className="w-3 h-3 text-slate-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Número externo</p>
                <p className="text-[10px] font-mono text-slate-500">{infoCliente[agente.id].sessao?.lead_telefone || '—'}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ── Stat card ─────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon: Icon }) {
  return (
    <div className={cn(
      "rounded-2xl border p-4 bg-slate-900/60",
      color === "sky"     && "border-sky-500/20",
      color === "emerald" && "border-emerald-500/20",
      color === "violet"  && "border-violet-500/20",
      color === "amber"   && "border-amber-500/20",
      !color              && "border-slate-800/60",
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 mb-1">{label}</p>
          <p className={cn(
            "text-2xl font-bold",
            color === "sky"     && "text-sky-400",
            color === "emerald" && "text-emerald-400",
            color === "violet"  && "text-violet-400",
            color === "amber"   && "text-amber-400",
            !color              && "text-white",
          )}>{value ?? "—"}</p>
          {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
        </div>
        <div className={cn(
          "p-2 rounded-xl",
          color === "sky"     && "bg-sky-500/10",
          color === "emerald" && "bg-emerald-500/10",
          color === "violet"  && "bg-violet-500/10",
          color === "amber"   && "bg-amber-500/10",
          !color              && "bg-slate-800",
        )}>
          <Icon className={cn(
            "w-4 h-4",
            color === "sky"     && "text-sky-400",
            color === "emerald" && "text-emerald-400",
            color === "violet"  && "text-violet-400",
            color === "amber"   && "text-amber-400",
            !color              && "text-slate-400",
          )} />
        </div>
      </div>
    </div>
  );
}

export default function MonitoramentoAoVivo() {
  const { empresaId } = useEmpresaAtual();
  const { user } = useAuth();

  // Buscar token gestor da integração
  const { data: integracoes } = useQuery({
    queryKey: ['integracoes-telefonia', empresaId],
    queryFn: () => api.entities.Integracao.filter({ empresaId, tipo: 'telefonia', ativa: true }),
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
  });
  // O token vem mascarado do servidor: só indica que o monitoramento está configurado
  const monitoramentoConfigurado = !!integracoes?.[0]?.configuracao?.token_gestor;

  // Socket gestor como fonte primária
  const {
    agentes: agentesSocket,
    metricas: metricasSocket,
    campanhas: campanhasSocket,
    conectadoSocket,
    ultimaAtt: ultimaAttSocket,
    recarregar: recarregarSocket,
  } = useMonitoramentoRealTime({ empresaId, habilitado: monitoramentoConfigurado });
  const [ultimaAtt, setUltimaAtt]       = useState(null);
  const [conectado, setConectado]       = useState(false);
  const [agentes, setAgentes]           = useState([]);
  const [metricas, setMetricas]         = useState({});
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [atualizando, setAtualizando]   = useState(false);
  const [campanhas, setCampanhas]       = useState([]);
  const [filtroCampanha, setFiltroCampanha] = useState('todas');
  const [intervalos, setIntervalos]       = useState([]);
  const [acaoProcessando, setAcaoProcessando] = useState({});
  const [agenteAcao, setAgenteAcao]       = useState(null); // agente com drawer aberto
  const [seletorPausa, setSeletorPausa]   = useState(null);
  const [seletorPos, setSeletorPos]       = useState({ top: 0, left: 0 });
  const [confirmDeslogar, setConfirmDeslogar] = useState(null);
  const [spyAtivo, setSpyAtivo]           = useState(null);
  const [infoCliente, setInfoCliente]     = useState({});
  const pollingRef                        = useRef(null);

  // Dashboard de saúde — contar atividades por origem nas últimas 24h
  const { data: atividadesRecentes = [] } = useQuery({
    queryKey: ['atividades-saude', empresaId],
    queryFn: () => listarAtividades(empresaId, { limit: 500 }),
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const saudeIntegracao = useMemo(() => {
    const agora = Date.now();
    const h24 = 24 * 60 * 60 * 1000;
    const recentes = atividadesRecentes.filter(a =>
      a.tipo === 'ligacao' &&
      a.origem_sincronizacao &&
      (agora - new Date(a.created_date).getTime()) < h24
    );
    const realtime = recentes.filter(a => a.origem_sincronizacao === '3cplus_realtime').length;
    const cron = recentes.filter(a => a.origem_sincronizacao === '3cplus').length;
    const total = realtime + cron;
    const pctRealtime = total > 0 ? Math.round((realtime / total) * 100) : 0;
    return { realtime, cron, total, pctRealtime };
  }, [atividadesRecentes]);

  const buscarDados = async () => {
    if (!empresaId) return;
    try {
      const res = await api.functions.invoke('monitoramento3CPlus', { empresaId });
      const dados = res?.data || res;
      if (!dados?.agentes) { setConectado(false); return; }
      setConectado(true);
      setAgentes(prev => {
        // Limpar infoCliente de agentes que saíram de ligação
        const novosEmLigacao = (dados.agentes || []).filter(a => a.em_ligacao).map(a => a.id);
        setInfoCliente(old => {
          const novo = { ...old };
          Object.keys(novo).forEach(id => { if (!novosEmLigacao.includes(Number(id))) delete novo[id]; });
          return novo;
        });
        return dados.agentes;
      });
      setMetricas(dados.metricas || {});
      setCampanhas(dados.campanhas || []);
      setUltimaAtt(new Date());
      // Buscar info cliente para agentes em ligação
      (dados.agentes || []).filter(a => a.em_ligacao && a.email).forEach(a => buscarInfoCliente(a));
    } catch {
      setConectado(false);
    }
  };

  const carregarIntervalos = async () => {
    if (intervalos.length > 0) return;
    try {
      const res = await api.functions.invoke('acaoAgente3CPlus', { empresaId, acao: 'listar_intervalos' });
      setIntervalos(res?.intervalos || res?.data?.intervalos || []);
    } catch (e) {

    }
  };

  const buscarInfoCliente = async (agente) => {
    if (!agente.em_ligacao || infoCliente[agente.id]) return;
    try {
      // Cruzar CallSession ativa pelo email do agente
      const sessoes = await api.entities.CallSession.filter({
        empresaId,
        sdr_email: agente.email,
        status: 'answered',
      });
      if (!sessoes?.length) return;
      const sessao = sessoes[0];
      let lead = null;
      if (sessao.lead_id) {
        const leads = await api.entities.Lead.filter({ id: sessao.lead_id });
        lead = leads?.[0] || null;
      }
      setInfoCliente(prev => ({ ...prev, [agente.id]: { sessao, lead } }));
    } catch (e) {
      console.warn('[buscarInfoCliente]', e.message);
    }
  };

  const executarAcao = async (agente, acao, params = {}) => {
    const key = `${agente.id}_${acao}`;
    setAcaoProcessando(prev => ({ ...prev, [key]: true }));
    try {
      const res = await api.functions.invoke('acaoAgente3CPlus', {
        empresaId, acao, agent_id: agente.id, ...params,
      });
      const ok = res?.success || res?.data?.success;
      if (ok) {
        toast.success(
          acao === 'pausar'   ? `${agente.nome} pausado` :
          acao === 'retomar'  ? `${agente.nome} retomado` :
          acao === 'deslogar' ? `${agente.nome} deslogado` :
          acao === 'spy'      ? `Escutando ${agente.nome}` :
          acao === 'whisper'  ? `Sussurrando com ${agente.nome}` :
          acao === 'stop_spy' ? 'Spy encerrado' : 'Ação realizada'
        );
        // Log de auditoria
        api.entities.MonitoramentoLog.create({
          empresaId,
          gestor_email: user?.email || 'desconhecido',
          agente_id: agente.id,
          agente_nome: agente.nome,
          acao,
          campanha_nome: agente.campanha_nome || '',
          work_break_nome: params?.work_break_id ? (intervalos.find(i => i.id === params.work_break_id)?.nome || '') : '',
          sucesso: true,
          executado_em: new Date().toISOString(),
        }).catch(e => console.warn('[MonitoramentoLog] erro ao salvar log:', e.message));
        setSeletorPausa(null);
        setConfirmDeslogar(null);
        setAgenteAcao(null);
        setTimeout(atualizarAgora, 1500);
      } else {
        const erroMsg = res?.error || res?.data?.error || 'Erro desconhecido';
        toast.error('Erro ao executar ação', { description: erroMsg });
        api.entities.MonitoramentoLog.create({
          empresaId,
          gestor_email: user?.email || 'desconhecido',
          agente_id: agente.id,
          agente_nome: agente.nome,
          acao,
          campanha_nome: agente.campanha_nome || '',
          sucesso: false,
          erro_mensagem: erroMsg,
          executado_em: new Date().toISOString(),
        }).catch(() => {});
      }
    } catch (e) {
      toast.error('Erro ao executar ação', { description: e.message });
    } finally {
      setAcaoProcessando(prev => ({ ...prev, [key]: false }));
    }
  };

  const atualizarAgora = async () => {
    setAtualizando(true);
    await buscarDados();
    recarregarSocket();
    setAtualizando(false);
  };

  // Socket gestor como fonte primária — atualizar state quando chegar dados
  useEffect(() => {
    if (conectadoSocket && agentesSocket.length > 0) {
      setAgentes(agentesSocket);
      setMetricas(metricasSocket);
      setCampanhas(campanhasSocket);
      setConectado(true);
      setUltimaAtt(ultimaAttSocket);
    }
  }, [conectadoSocket, agentesSocket, metricasSocket, campanhasSocket, ultimaAttSocket]);

  useEffect(() => {
    // Polling como fallback — roda a cada 60s para sincronizar estado completo
    buscarDados();
    pollingRef.current = setInterval(buscarDados, POLLING_MS);
    return () => clearInterval(pollingRef.current);
  }, [empresaId]);

  // Filtrar agentes
  const agentesFiltrados = agentes.filter(a => {
    const passaStatus =
      filtroStatus === 'todos'      ? true :
      filtroStatus === 'em_ligacao' ? a.em_ligacao :
      filtroStatus === 'disponivel' ? a.disponivel :
      filtroStatus === 'em_pausa'   ? a.em_pausa :
      filtroStatus === 'offline'    ? a.status === 0 : true;
    const passaCampanha = filtroCampanha === 'todas' ? true : String(a.campanha_id) === String(filtroCampanha);
    return passaStatus && passaCampanha;
  });

  const contadores = {
    total:       agentes.length,
    em_ligacao:  agentes.filter(a => a.em_ligacao).length,
    disponiveis: agentes.filter(a => a.disponivel).length,
    em_pausa:    agentes.filter(a => a.em_pausa).length,
    offline:     agentes.filter(a => a.status === 0).length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-1 h-6 bg-gradient-to-b from-sky-400 to-violet-500 rounded-full" />
            <h1 className="text-2xl font-bold text-white">Monitoramento ao Vivo</h1>
          </div>
          <p className="text-slate-500 text-sm ml-3">
            {conectadoSocket ? 'Tempo real via socket' : 'Atualiza a cada 60s'} · {ultimaAtt ? `Última att: ${format(ultimaAtt, "HH:mm:ss")}` : 'Conectando...'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Status conexão */}
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium",
            conectado
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/20 text-rose-400"
          )}>
            {conectado ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {conectado ? "3C Plus conectado" : "Sem conexão"}
          </div>

          <button
            onClick={atualizarAgora}
            disabled={atualizando}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", atualizando && "animate-spin")} />
            {atualizando ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </div>

      {/* ── Métricas do dia ────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Em ligação agora" value={contadores.em_ligacao}  color="sky"     icon={PhoneCall}  />
        <StatCard label="Disponíveis"      value={contadores.disponiveis} color="emerald" icon={Headphones} />
        <StatCard label="Em pausa"         value={contadores.em_pausa}    color="amber"   icon={Pause}      />
        <StatCard label="Total agentes"    value={contadores.total}       color="violet"  icon={Users}      />
      </div>

      {/* ── Saúde da integração ────────────────────── */}
      {saudeIntegracao.total > 0 && (
        <div className="flex items-center gap-4 px-4 py-2.5 rounded-xl border border-slate-800/60 bg-slate-900/40">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              saudeIntegracao.pctRealtime >= 80 ? "bg-emerald-400" :
              saudeIntegracao.pctRealtime >= 50 ? "bg-amber-400" : "bg-rose-400"
            )} />
            <span className="text-xs font-medium text-slate-300">Saúde 24h</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>⚡ <strong className="text-emerald-400">{saudeIntegracao.realtime}</strong> real-time</span>
            <span>🔄 <strong className="text-amber-400">{saudeIntegracao.cron}</strong> cron</span>
            <span>📊 <strong className="text-slate-300">{saudeIntegracao.total}</strong> total</span>
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-semibold border",
              saudeIntegracao.pctRealtime >= 80 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
              saudeIntegracao.pctRealtime >= 50 ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
              "bg-rose-500/10 border-rose-500/20 text-rose-400"
            )}>
              {saudeIntegracao.pctRealtime}% real-time
            </span>
          </div>
        </div>
      )}

      {/* ── Filtros de status ──────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { value: "todos",      label: `Todos (${contadores.total})` },
          { value: "em_ligacao", label: `Em ligação (${contadores.em_ligacao})`,   active: "bg-gradient-to-r from-sky-500 to-sky-400 text-white shadow shadow-sky-500/25" },
          { value: "disponivel", label: `Disponíveis (${contadores.disponiveis})`, active: "bg-gradient-to-r from-emerald-500 to-emerald-400 text-white shadow shadow-emerald-500/25" },
          { value: "em_pausa",   label: `Em pausa (${contadores.em_pausa})`,       active: "bg-gradient-to-r from-amber-500 to-amber-400 text-white shadow shadow-amber-500/25" },
          { value: "offline",    label: `Offline (${contadores.offline})`,         active: "bg-slate-600 text-white" },
        ].map(({ value, label, active }) => (
          <button
            key={value}
            onClick={() => setFiltroStatus(value)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200",
              filtroStatus === value
                ? (active || "bg-slate-700 text-white") + " border-transparent"
                : "border-slate-700/60 bg-slate-800/60 text-slate-400 hover:text-slate-200"
            )}
          >
            {label}
          </button>
        ))}
        {campanhas.length > 1 && (
          <select
            value={filtroCampanha}
            onChange={e => setFiltroCampanha(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700/60 bg-slate-800/60 text-slate-400 hover:text-slate-200 focus:outline-none focus:border-sky-500/50 transition-all"
          >
            <option value="todas">Todas as campanhas</option>
            {campanhas.map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── Grid de agentes ────────────────────────────── */}
      {!conectado ? (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 py-20 text-center">
          <WifiOff className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 font-medium">Sem conexão com o 3C Plus</p>
          <p className="text-slate-600 text-sm mt-1">Verifique se a integração está configurada e ativa</p>
          <Button onClick={buscarDados} className="mt-4 bg-sky-600 hover:bg-sky-500 text-white">
            Tentar novamente
          </Button>
        </div>
      ) : agentesFiltrados.length === 0 ? (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 py-16 text-center">
          <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Nenhum agente neste status</p>
        </div>
      ) : (
        <AnimatePresence>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {agentesFiltrados
              .sort((a, b) => {
                // Ordenar: em_ligacao → disponivel → pausa → outros → offline
                const ordem = (ag) => ag.em_ligacao ? 0 : ag.disponivel ? 1 : ag.em_pausa ? 2 : ag.status === 0 ? 9 : 3;
                return ordem(a) - ordem(b);
              })
              .map(agente => (
                <AgenteCard
                  key={agente.id || agente.email}
                  agente={agente}
                  onAcao={executarAcao}
                  acaoProcessando={acaoProcessando}
                  intervalos={intervalos}
                  seletorPausa={seletorPausa}
                  setSeletorPausa={(id, event) => {
                    if (id && event) {
                      const rect = event.currentTarget.getBoundingClientRect();
                      setSeletorPos({ top: rect.bottom + 6, left: rect.left });
                    }
                    setSeletorPausa(id);
                    if (id) carregarIntervalos();
                  }}
                  seletorPos={seletorPos}
                  infoCliente={infoCliente}
                  spyAtivo={spyAtivo}
                  setSpyAtivo={setSpyAtivo}
                  confirmDeslogar={confirmDeslogar}
                  setConfirmDeslogar={setConfirmDeslogar}
                  />
              ))}
          </div>
        </AnimatePresence>
        )}

      {/* Painel Spy — componente externo */}
      <PainelSpyMonitoramento
        spyAtivo={spyAtivo}
        setSpyAtivo={setSpyAtivo}
        infoCliente={infoCliente}
        onAcao={executarAcao}
        acaoProcessando={acaoProcessando}
      />

      {/* Dialog confirmação deslogar */}
        {confirmDeslogar && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDeslogar(null)} />
            <div className="relative z-10 w-full max-w-sm p-6 rounded-2xl bg-zinc-950 border border-rose-500/20 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
                  <LogOut className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Deslogar agente</p>
                  <p className="text-xs text-slate-400 mt-0.5">Esta ação não pode ser desfeita</p>
                </div>
              </div>
              <p className="text-sm text-slate-300">
                Deseja deslogar <strong className="text-white">{confirmDeslogar.nome}</strong> da campanha <strong className="text-white">{confirmDeslogar.campanha_nome}</strong>?
              </p>
              <div className="flex items-center gap-3 pt-2">
                <button onClick={() => setConfirmDeslogar(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white text-sm font-semibold transition-all">
                  Cancelar
                </button>
                <button
                  onClick={() => executarAcao(confirmDeslogar, 'deslogar')}
                  disabled={!!acaoProcessando[`${confirmDeslogar.id}_deslogar`]}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-sm font-semibold transition-all disabled:opacity-40"
                >
                  {acaoProcessando[`${confirmDeslogar.id}_deslogar`] ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                  Deslogar
                </button>
              </div>
            </div>
          </div>
        )}

        </div>
        );
        }