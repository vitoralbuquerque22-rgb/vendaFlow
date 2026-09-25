import { useState, useRef } from "react";
import { api } from "@/api/client";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { useAuth } from "@/lib/AuthContext";
import { usePermissions } from "@/components/hooks/usePermissions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Mic, Play, Pause, ChevronDown, ChevronUp,
  RefreshCw, BookOpen, Star,
  Loader2, AlertCircle, Send,
} from "lucide-react";
import { toast } from "sonner";

// ── Fake Waveform ─────────────────────────────────────────────────────────
function gerarBarras(n = 40) {
  return Array.from({ length: n }, () => 20 + Math.random() * 60);
}

function AudioPlayerFakeWaveform({ gravacao, empresaId }) {
  const audioRef = useRef(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [tocando, setTocando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [duracaoReal, setDuracaoReal] = useState(gravacao.duracao_segundos || 0);
  const [velocidade, setVelocidade] = useState(1);
  const [erro, setErro] = useState(null);
  const barras = useRef(gerarBarras(40));

  const carregarAudio = async () => {
    if (blobUrl || carregando) return;
    setCarregando(true);
    setErro(null);
    try {
      const res = await api.functions.invoke("obterUrlGravacao3CPlus", {
        empresaId,
        gravacao_id: gravacao.id,
        call_id_3cplus: gravacao.call_id_3cplus,
      });
      const data = res?.data || res;
      if (!data?.audio_base64) throw new Error("Áudio não disponível");
      const byteChars = atob(data.audio_base64);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArr], { type: data.content_type || "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  };

  const togglePlay = async () => {
    if (!blobUrl) { await carregarAudio(); return; }
    if (!audioRef.current) return;
    if (tocando) { audioRef.current.pause(); setTocando(false); }
    else { audioRef.current.play(); setTocando(true); }
  };

  const handleSeek = (e) => {
    if (!audioRef.current || !duracaoReal) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * duracaoReal;
    setProgresso(pct * 100);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current || !duracaoReal) return;
    setProgresso((audioRef.current.currentTime / duracaoReal) * 100);
  };

  const mudarVelocidade = () => {
    const ops = [1, 1.5, 2, 0.5];
    const prox = ops[(ops.indexOf(velocidade) + 1) % ops.length];
    setVelocidade(prox);
    if (audioRef.current) audioRef.current.playbackRate = prox;
  };

  const fmtTempo = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const tempoAtual = audioRef.current ? audioRef.current.currentTime : 0;

  return (
    <div className="space-y-3">
      {erro && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {erro === "Áudio não disponível" ? "Gravação expirada no 3C Plus" : erro}
        </div>
      )}
      <audio
        ref={audioRef}
        src={blobUrl || ""}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => { if (audioRef.current) setDuracaoReal(audioRef.current.duration); }}
        onEnded={() => setTocando(false)}
        style={{ display: "none" }}
      />
      <div className="flex items-center gap-0.5 h-12 cursor-pointer group" onClick={handleSeek}>
        {barras.current.map((altura, i) => {
          const pct = (i / barras.current.length) * 100;
          const passado = pct <= progresso;
          return (
            <div
              key={i}
              className={cn(
                "flex-1 rounded-full transition-all duration-75",
                passado ? "bg-sky-400" : "bg-slate-700 group-hover:bg-slate-600",
                tocando && passado && "animate-pulse"
              )}
              style={{ height: `${passado ? altura : altura * 0.7}%` }}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          disabled={carregando}
          className="w-9 h-9 rounded-full bg-sky-500 hover:bg-sky-400 flex items-center justify-center transition-all flex-shrink-0 disabled:opacity-40"
        >
          {carregando
            ? <Loader2 className="w-4 h-4 text-white animate-spin" />
            : tocando
            ? <Pause className="w-4 h-4 text-white" />
            : <Play className="w-4 h-4 text-white ml-0.5" />
          }
        </button>
        <div className="flex-1 flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-500 w-10 text-right">{fmtTempo(tempoAtual)}</span>
          <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden cursor-pointer" onClick={handleSeek}>
            <div className="h-full bg-sky-500 rounded-full transition-all" style={{ width: `${progresso}%` }} />
          </div>
          <span className="text-[10px] font-mono text-slate-500 w-10">{fmtTempo(duracaoReal)}</span>
        </div>
        <button
          onClick={mudarVelocidade}
          className="text-[10px] font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded-lg transition-all"
        >
          {velocidade}x
        </button>
      </div>
    </div>
  );
}

// ── Seção de Comentários ──────────────────────────────────────────────────
function SecaoComentarios({ gravacaoId, empresaId, userEmail, userName }) {
  const queryClient = useQueryClient();
  const [novoComentario, setNovoComentario] = useState("");
  const [salvando, setSalvando] = useState(false);

  const { data: comentarios = [], isLoading } = useQuery({
    queryKey: ["comentarios", gravacaoId],
    queryFn: () => api.entities.ComentarioGravacao.filter({ gravacao_id: gravacaoId, empresaId }),
    enabled: !!gravacaoId,
  });

  const salvarComentario = async () => {
    if (!novoComentario.trim() || salvando) return;
    setSalvando(true);
    try {
      await api.entities.ComentarioGravacao.create({
        empresaId,
        gravacao_id: gravacaoId,
        autor_email: userEmail,
        autor_nome: userName || userEmail,
        comentario: novoComentario.trim(),
        tipo: "comentario",
        editado: false,
      });
      setNovoComentario("");
      queryClient.invalidateQueries({ queryKey: ["comentarios", gravacaoId] });
      toast.success("Comentário salvo");
    } catch (e) {
      toast.error("Erro ao salvar comentário", { description: e.message });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Comentários</p>
      {isLoading && <div className="text-xs text-slate-600">Carregando...</div>}
      {comentarios.length === 0 && !isLoading && (
        <p className="text-xs text-slate-600 italic">Nenhum comentário ainda.</p>
      )}
      {comentarios.map((c) => (
        <div key={c.id} className="flex gap-2.5">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-sky-500 to-violet-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-[9px] font-bold text-white">{(c.autor_nome || c.autor_email || "?")[0].toUpperCase()}</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[11px] font-semibold text-slate-300">{c.autor_nome || c.autor_email}</span>
              {c.created_date && (
                <span className="text-[10px] text-slate-600">
                  {format(new Date(c.created_date), "dd/MM HH:mm", { locale: ptBR })}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{c.comentario}</p>
          </div>
        </div>
      ))}
      <div className="flex gap-2 pt-2">
        <textarea
          value={novoComentario}
          onChange={(e) => setNovoComentario(e.target.value)}
          placeholder="Adicionar comentário..."
          rows={2}
          className="flex-1 px-3 py-2 text-xs bg-white/[0.03] border border-white/[0.08] rounded-xl text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500/40 resize-none"
          onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) salvarComentario(); }}
        />
        <button
          onClick={salvarComentario}
          disabled={!novoComentario.trim() || salvando}
          className="px-3 py-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 transition-all disabled:opacity-40 flex-shrink-0 self-end"
        >
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// ── Card de Gravação expandível ───────────────────────────────────────────
function CardGravacao({ gravacao, empresaId, user, userProfile, onMarcarTreinamento }) {
  const [expandido, setExpandido] = useState(false);
  const [marcandoTreinamento, setMarcandoTreinamento] = useState(false);

  const fmtDuracao = (s) => {
    if (!s) return "—";
    const m = Math.floor(s / 60), seg = s % 60;
    return `${m}m ${String(seg).padStart(2, "0")}s`;
  };

  const badgeResultado = (res) => {
    const mapa = {
      atendeu: { cor: "emerald", label: "Atendeu" },
      nao_atendeu: { cor: "slate", label: "Não atendeu" },
      ocupado: { cor: "amber", label: "Ocupado" },
      caixa_postal: { cor: "violet", label: "Caixa postal" },
      numero_invalido: { cor: "rose", label: "Nº inválido" },
    };
    const r = mapa[res] || { cor: "slate", label: res || "—" };
    const colorMap = {
      emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
      slate: "bg-slate-500/10 border-slate-500/20 text-slate-400",
      amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
      violet: "bg-violet-500/10 border-violet-500/20 text-violet-400",
      rose: "bg-rose-500/10 border-rose-500/20 text-rose-400",
    };
    return (
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${colorMap[r.cor] || colorMap.slate}`}>
        {r.label}
      </span>
    );
  };

  const toggleTreinamento = async (e) => {
    e.stopPropagation();
    setMarcandoTreinamento(true);
    try {
      await api.entities.GravacaoLigacao.update(gravacao.id, {
        usar_treinamento: !gravacao.usar_treinamento,
        retention_policy: !gravacao.usar_treinamento ? "permanent" : "standard",
      });
      onMarcarTreinamento?.();
      toast.success(!gravacao.usar_treinamento ? "Marcada para treinamento" : "Removida do treinamento");
    } catch (e) {
      toast.error("Erro ao atualizar", { description: e.message });
    } finally {
      setMarcandoTreinamento(false);
    }
  };

  const isGestorAdmin = userProfile?.role === "admin" || userProfile?.role === "gestor";

  return (
    <motion.div
      layout
      className={cn(
        "border rounded-2xl overflow-hidden transition-all duration-200",
        expandido ? "border-sky-500/30 bg-sky-500/[0.03]" : "border-white/[0.06] bg-white/[0.02] hover:border-white/10"
      )}
    >
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer"
        onClick={() => setExpandido(!expandido)}
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-sky-300">{(gravacao.sdr_nome || gravacao.sdr_email || "?")[0].toUpperCase()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate">{gravacao.sdr_nome || gravacao.sdr_email}</span>
            {badgeResultado(gravacao.resultado)}
            {gravacao.usar_treinamento && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400">
                📚 Treinamento
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-xs text-slate-500 truncate">{gravacao.lead_nome || "Lead não identificado"}</span>
            {gravacao.campanha_nome && (
              <span className="text-[10px] text-slate-600 truncate">· {gravacao.campanha_nome}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-mono text-slate-400">{fmtDuracao(gravacao.duracao_segundos)}</p>
            <p className="text-[10px] text-slate-600">
              {gravacao.data_gravacao
                ? format(new Date(gravacao.data_gravacao), "dd/MM HH:mm", { locale: ptBR })
                : "—"}
            </p>
          </div>
          <div className="text-slate-600">
            {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expandido && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-white/[0.06]"
          >
            <div className="px-5 py-4 space-y-5">
              <AudioPlayerFakeWaveform gravacao={gravacao} empresaId={empresaId} />
              {isGestorAdmin && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={toggleTreinamento}
                    disabled={marcandoTreinamento}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
                      gravacao.usar_treinamento
                        ? "bg-violet-500/20 border-violet-500/30 text-violet-300 hover:bg-violet-500/30"
                        : "bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.06]"
                    )}
                  >
                    {marcandoTreinamento
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <BookOpen className="w-3 h-3" />
                    }
                    {gravacao.usar_treinamento ? "Em treinamento" : "Usar como treinamento"}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); toast.info("Modal de feedback em breve (Sprint 3)"); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-white/[0.08] bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all"
                  >
                    <Star className="w-3 h-3" /> Feedback
                  </button>
                </div>
              )}
              <SecaoComentarios
                gravacaoId={gravacao.id}
                empresaId={empresaId}
                userEmail={user?.email}
                userName={userProfile?.user_name}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────
export default function Gravacoes() {
  const { empresaId } = useEmpresaAtual();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [filtroSdr, setFiltroSdr] = useState("todos");
  const [filtroPeriodo, setFiltroPeriodo] = useState("7d");
  const [filtroResultado, setFiltroResultado] = useState("todos");
  const [sincronizando, setSincronizando] = useState(false);

  const { userProfile, isAdmin, isGestor } = usePermissions();
  const isGestorAdmin = isAdmin || isGestor;

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-gravacoes", empresaId],
    queryFn: () => api.entities.UserProfile.filter({ empresaId }),
    enabled: !!empresaId && isGestorAdmin,
  });

  const dataInicio = (() => {
    const agora = new Date();
    const dias = filtroPeriodo === "hoje" ? 1 : filtroPeriodo === "ontem" ? 2 : 7;
    return new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000).toISOString();
  })();

  const { data: gravacoes = [], isLoading } = useQuery({
    queryKey: ["gravacoes", empresaId, filtroSdr, filtroPeriodo, filtroResultado],
    queryFn: async () => {
      if (!empresaId) return [];
      // Busca todas da empresa — filtro por SDR acontece client-side
      // Isso evita dependência de sdr_email preenchido no banco (repair progressivo)
      const todas = await api.entities.GravacaoLigacao.filter({ empresaId });
      return todas
        .filter(g => !g.deleted_at)
        .filter(g => g.is_duplicate !== true)
        // Filtro por SDR: gestor filtra pelo select; SDR só vê as próprias
        .filter(g => {
          if (isGestorAdmin) {
            if (filtroSdr === "todos") return true;
            return g.sdr_email === filtroSdr;
          }
          // SDR: mostrar próprias (sdr_email === user.email) OU vazias enquanto repair roda
          if (!g.sdr_email || g.sdr_email.trim() === '') return true;
          return g.sdr_email === user?.email;
        })
        .filter(g => {
          if (!g.data_gravacao) return true;
          return new Date(g.data_gravacao) >= new Date(dataInicio);
        })
        .filter(g => filtroResultado === "todos" || g.resultado === filtroResultado)
        .sort((a, b) => new Date(b.data_gravacao || 0) - new Date(a.data_gravacao || 0));
    },
    enabled: !!empresaId,
  });

  const sincronizar = async () => {
    setSincronizando(true);
    try {
      const res = await api.functions.invoke("buscarGravacoes3CPlus", { empresaId, dias: 7 });
      const data = res?.data || res;
      toast.success(`Sincronizado — ${data.novas} novas gravações`);
      queryClient.invalidateQueries({ queryKey: ["gravacoes"] });
    } catch (e) {
      toast.error("Erro ao sincronizar", { description: e.message });
    } finally {
      setSincronizando(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Gravações</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {gravacoes.length} gravação{gravacoes.length !== 1 ? "ões" : ""} encontrada{gravacoes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={sincronizar}
          disabled={sincronizando}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 transition-all text-sm font-semibold disabled:opacity-40"
        >
          {sincronizando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Sincronizar
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {[
          { value: "hoje", label: "Hoje" },
          { value: "ontem", label: "Ontem" },
          { value: "7d", label: "7 dias" },
        ].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFiltroPeriodo(value)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
              filtroPeriodo === value
                ? "bg-sky-500/20 border-sky-500/30 text-sky-300"
                : "border-slate-700/60 bg-slate-800/60 text-slate-400 hover:text-slate-200"
            )}
          >
            {label}
          </button>
        ))}

        <select
          value={filtroResultado}
          onChange={(e) => setFiltroResultado(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-700/60 bg-slate-800/60 text-slate-400 focus:outline-none focus:border-sky-500/50 transition-all"
        >
          <option value="todos">Todos os resultados</option>
          <option value="atendeu">Atendeu</option>
          <option value="nao_atendeu">Não atendeu</option>
          <option value="ocupado">Ocupado</option>
          <option value="caixa_postal">Caixa postal</option>
        </select>

        {isGestorAdmin && profiles.length > 0 && (
          <select
            value={filtroSdr}
            onChange={(e) => setFiltroSdr(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-700/60 bg-slate-800/60 text-slate-400 focus:outline-none focus:border-sky-500/50 transition-all"
          >
            <option value="todos">Todos os SDRs</option>
            {profiles.map(p => (
              <option key={p.user_email} value={p.user_email}>
                {p.user_name || p.user_email}
              </option>
            ))}
          </select>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-slate-600 animate-spin" />
        </div>
      ) : gravacoes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Mic className="w-10 h-10 text-slate-700" />
          <p className="text-slate-500 text-sm">Nenhuma gravação encontrada</p>
          <button onClick={sincronizar} className="text-xs text-sky-400 hover:text-sky-300 transition-colors">
            Sincronizar agora
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {gravacoes.map((g) => (
            <CardGravacao
              key={g.id}
              gravacao={g}
              empresaId={empresaId}
              user={user}
              userProfile={userProfile}
              onMarcarTreinamento={() => queryClient.invalidateQueries({ queryKey: ["gravacoes"] })}
            />
          ))}
        </div>
      )}
    </div>
  );
}