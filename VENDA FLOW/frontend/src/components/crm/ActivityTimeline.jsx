import { useState, useMemo } from "react";
import { resolveDisplayNameFromUser } from '@/lib/resolveDisplayName';
import {
  Phone, MessageCircle, Mail, Search, Calendar, FileText,
  Play, Pause, ChevronDown, ChevronUp, Mic, Bot,
  Clock, CheckCircle2, Circle, AlertCircle, User, Users,
  ArrowRight, Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isPast, isToday, isFuture } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

// ── Configs de tipo ──────────────────────────────────────────
const tipoConfig = {
  ligacao:           { icon: Phone,          color: "bg-sky-500",      label: "Ligação" },
  whatsapp:          { icon: MessageCircle,  color: "bg-emerald-500",  label: "WhatsApp" },
  email:             { icon: Mail,           color: "bg-blue-500",     label: "E-mail" },
  pesquisa:          { icon: Search,         color: "bg-purple-500",   label: "Pesquisa" },
  reuniao_agendada:  { icon: Calendar,       color: "bg-orange-500",   label: "Reunião Agendada" },
  reuniao_realizada: { icon: Calendar,       color: "bg-teal-500",     label: "Reunião Realizada" },
  anotacao:          { icon: FileText,       color: "bg-slate-500",    label: "Anotação" },
  // tarefas
  tarefa_ligacao:    { icon: Phone,          color: "bg-sky-600",      label: "Tarefa · Ligação" },
  tarefa_whatsapp:   { icon: MessageCircle,  color: "bg-emerald-600",  label: "Tarefa · WhatsApp" },
  tarefa_email:      { icon: Mail,           color: "bg-blue-600",     label: "Tarefa · E-mail" },
  tarefa_reuniao:    { icon: Calendar,       color: "bg-orange-600",   label: "Tarefa · Reunião" },
  tarefa:            { icon: CheckCircle2,   color: "bg-violet-500",   label: "Tarefa" },
};

const resultadoConfig = {
  atendeu:           { label: "Atendeu",           color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  nao_atendeu:       { label: "Não atendeu",        color: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  ocupado:           { label: "Ocupado",            color: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  caixa_postal:      { label: "Caixa postal",       color: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  numero_invalido:   { label: "Número inválido",    color: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  respondeu:         { label: "Respondeu",          color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  visualizou:        { label: "Visualizou",         color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  nao_respondeu:     { label: "Não respondeu",      color: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  reuniao_agendada:  { label: "Reunião agendada",   color: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  qualificado:       { label: "Qualificado",        color: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  sem_interesse:     { label: "Sem interesse",      color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  desqualificado:    { label: "Desqualificado",     color: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  outro:             { label: "Outro",              color: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
};

// ── Helpers ──────────────────────────────────────────────────
function formatDuracao(s) {
  if (!s) return null;
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${s % 60 > 0 ? ` ${s % 60}s` : ""}`;
}

function formatNome(email, nome) {
  if (!email && !nome) return null;
  return resolveDisplayNameFromUser({ email, full_name: nome });
}

// ── Player de áudio ──────────────────────────────────────────
function AudioPlayer({ url }) {
  const [tocando, setTocando]       = useState(false);
  const [audio]                     = useState(() => new Audio(url));
  const [progresso, setProgresso]   = useState(0);
  const [duracao, setDuracao]       = useState(0);

  audio.onloadedmetadata = () => setDuracao(audio.duration);
  audio.ontimeupdate     = () => setProgresso((audio.currentTime / audio.duration) * 100 || 0);
  audio.onended          = () => { setTocando(false); setProgresso(0); };

  const togglePlay = () => { if (tocando) audio.pause(); else audio.play(); setTocando(!tocando); };
  const fmt = (s) => !s || isNaN(s) ? "0:00" : `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/40">
      <button onClick={togglePlay} className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 hover:bg-sky-500/20 transition-all flex-shrink-0">
        {tocando ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
      </button>
      <div className="flex-1 h-1 rounded-full bg-slate-700 cursor-pointer" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration; }}>
        <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-violet-500 transition-all" style={{ width: `${progresso}%` }} />
      </div>
      <span className="text-[10px] text-slate-500 flex-shrink-0 tabular-nums">{fmt(audio.currentTime)} / {fmt(duracao)}</span>
    </div>
  );
}

// ── Análise IA ───────────────────────────────────────────────
function AnaliseIA({ analise }) {
  if (!analise || Object.keys(analise).length === 0) return null;
  const sentimentoCor = { positivo: "text-emerald-400", neutro: "text-amber-400", negativo: "text-rose-400" }[analise.sentimento] || "text-slate-400";

  return (
    <div className="mt-2 p-3 rounded-xl bg-violet-500/5 border border-violet-500/15 space-y-2">
      <div className="flex items-center gap-1.5 mb-2">
        <Bot className="w-3.5 h-3.5 text-violet-400" />
        <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider">Análise IA</span>
        {analise.score_qualificacao !== undefined && (
          <span className="ml-auto text-[10px] font-bold text-white bg-violet-500/20 border border-violet-500/30 rounded-md px-1.5 py-0.5">Score {analise.score_qualificacao}/10</span>
        )}
      </div>
      {analise.resumo && <p className="text-xs text-slate-300 leading-relaxed">{analise.resumo}</p>}
      <div className="flex items-center gap-3 flex-wrap">
        {analise.sentimento && <span className={cn("text-[10px] font-medium capitalize", sentimentoCor)}>{analise.sentimento === "positivo" ? "😊" : analise.sentimento === "negativo" ? "😔" : "😐"} {analise.sentimento}</span>}
        {analise.lead_engajado !== undefined && <span className={cn("text-[10px]", analise.lead_engajado ? "text-emerald-400" : "text-slate-500")}>{analise.lead_engajado ? "✓ Engajado" : "✗ Baixo engajamento"}</span>}
      </div>
      {analise.objecoes?.length > 0 && (
        <div><p className="text-[10px] text-slate-500 mb-1">Objeções</p>
          <div className="flex flex-wrap gap-1">{analise.objecoes.map((o, i) => <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400">{o}</span>)}</div>
        </div>
      )}
      {analise.proximos_passos && <div><p className="text-[10px] text-slate-500 mb-0.5">Próximo passo sugerido</p><p className="text-xs text-slate-300">{analise.proximos_passos}</p></div>}
    </div>
  );
}

// ── Item de ATIVIDADE ────────────────────────────────────────
function AtividadeItem({ item, isLast }) {
  const [expandido, setExpandido] = useState(false);
  const config      = tipoConfig[item.tipo] || tipoConfig.anotacao;
  const Icon        = config.icon;
  const resCfg      = resultadoConfig[item.resultado];
  const temGravacao = !!item.gravacao_url;
  const temAnaliseIA = item.analise_ia && Object.keys(item.analise_ia).length > 0;
  const temExtras   = temGravacao || temAnaliseIA;

  return (
    <div className="flex gap-3">
      {/* Dot + linha */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0", config.color)}>
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
        {!isLast && <div className="w-px flex-1 bg-slate-800 mt-1" />}
      </div>

      {/* Conteúdo */}
      <div className={cn("flex-1 min-w-0", !isLast && "pb-5")}>
        <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3 hover:border-slate-600/60 transition-colors">
          {/* Linha 1: tipo + resultado + duração + data */}
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-white">{config.label}</span>
              {item.origem_sincronizacao === "3cplus" && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-400 font-medium">3C Plus</span>
              )}
              {resCfg && (
                <span className={cn("text-[10px] px-2 py-0.5 rounded border font-medium", resCfg.color)}>{resCfg.label}</span>
              )}
              {formatDuracao(item.duracao_segundos) && (
                <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
                  <Clock className="w-2.5 h-2.5" /> {formatDuracao(item.duracao_segundos)}
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-500 flex-shrink-0 tabular-nums">
              {format(new Date(item._date), "dd/MM 'às' HH:mm", { locale: ptBR })}
            </span>
          </div>

          {/* Responsável */}
          {(item.sdr_email || item.closer_email) && (
            <div className="flex items-center gap-3 mt-1.5">
              {item.sdr_email && (
                <span className="flex items-center gap-1 text-[10px] text-slate-500">
                  <User className="w-2.5 h-2.5" />
                  <span className="capitalize">{formatNome(item.sdr_email, item.sdr_nome || item.sdr_name)}</span>
                  <span className="text-slate-700">· SDR</span>
                </span>
              )}
              {item.closer_email && (
                <span className="flex items-center gap-1 text-[10px] text-slate-500">
                  <Users className="w-2.5 h-2.5" />
                  <span className="capitalize">{formatNome(item.closer_email, item.closer_nome)}</span>
                  <span className="text-slate-700">· Closer</span>
                </span>
              )}
            </div>
          )}

          {/* Observação — exibida como texto puro (sem HTML) */}
          {item.observacao && !item.observacao.includes("🤖 ANÁLISE IA") && (
            <p className="text-xs text-slate-400 mt-2 leading-relaxed italic">"{String(item.observacao)}"</p>
          )}

          {/* Extras */}
          {temExtras && (
            <button onClick={() => setExpandido(v => !v)} className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-500 hover:text-sky-400 transition-colors">
              {temGravacao && <Mic className="w-3 h-3" />}
              {temAnaliseIA && <Bot className="w-3 h-3" />}
              {[temGravacao && "gravação", temAnaliseIA && "análise IA"].filter(Boolean).join(" · ")}
              {expandido ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}

          {expandido && (
            <div className="mt-2 space-y-3">
              {temGravacao && <AudioPlayer url={item.gravacao_url} />}
              {temAnaliseIA && <AnaliseIA analise={item.analise_ia} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Item de TAREFA ───────────────────────────────────────────
function TarefaItem({ item, isLast }) {
  const tipoKey = `tarefa_${item.tipo_tarefa || ""}`;
  const config  = tipoConfig[tipoKey] || tipoConfig.tarefa;
  const Icon    = config.icon;

  const statusConfig = {
    pendente:   { label: "Pendente",   color: "bg-amber-500/10 text-amber-400 border-amber-500/20",   dot: "bg-amber-400" },
    concluida:  { label: "Concluída",  color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-400" },
    cancelada:  { label: "Cancelada",  color: "bg-slate-500/10 text-slate-400 border-slate-500/20",   dot: "bg-slate-500" },
    atrasada:   { label: "Atrasada",   color: "bg-rose-500/10 text-rose-400 border-rose-500/20",      dot: "bg-rose-400" },
    encerrada_automaticamente: { label: "Encerrada", color: "bg-slate-500/10 text-slate-400 border-slate-500/20", dot: "bg-slate-500" },
  };

  const hoje = isToday(new Date(item._date));
  const passado = isPast(new Date(item._date));
  const futuro = isFuture(new Date(item._date));

  const statusFinal = item.status === "concluida" ? "concluida"
    : item.status === "cancelada" ? "cancelada"
    : (item.status === "pendente" && passado && !hoje) ? "atrasada"
    : item.status || "pendente";

  const sCfg = statusConfig[statusFinal] || statusConfig.pendente;
  const isRetorno = futuro && item.status === "pendente";

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2",
          item.status === "concluida" ? "bg-emerald-500/20 border-emerald-500/40" :
          statusFinal === "atrasada"  ? "bg-rose-500/20 border-rose-500/40" :
          isRetorno                   ? "bg-violet-500/20 border-violet-500/40 border-dashed" :
          "bg-slate-700/60 border-slate-600/40"
        )}>
          <Icon className={cn("w-3.5 h-3.5", item.status === "concluida" ? "text-emerald-400" : statusFinal === "atrasada" ? "text-rose-400" : isRetorno ? "text-violet-400" : "text-slate-400")} />
        </div>
        {!isLast && <div className="w-px flex-1 bg-slate-800 mt-1" />}
      </div>

      <div className={cn("flex-1 min-w-0", !isLast && "pb-5")}>
        <div className={cn(
          "border rounded-xl p-3 transition-colors",
          isRetorno ? "bg-violet-500/5 border-violet-500/20" :
          item.status === "concluida" ? "bg-emerald-500/5 border-emerald-500/15" :
          statusFinal === "atrasada" ? "bg-rose-500/5 border-rose-500/15" :
          "bg-slate-800/40 border-slate-700/40"
        )}>
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {isRetorno && (
                <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-violet-500/15 border border-violet-500/25 text-violet-400 font-semibold uppercase tracking-wide">
                  <ArrowRight className="w-2.5 h-2.5" /> Retorno agendado
                </span>
              )}
              <span className={cn("text-sm font-semibold", isRetorno ? "text-violet-200" : item.status === "concluida" ? "text-emerald-200" : "text-white")}>
                {item.titulo || config.label}
              </span>
              <span className={cn("text-[10px] px-2 py-0.5 rounded border font-medium", sCfg.color)}>{sCfg.label}</span>
            </div>
            <span className="text-[10px] text-slate-500 flex-shrink-0 tabular-nums">
              {hoje ? "Hoje" : format(new Date(item._date), "dd/MM", { locale: ptBR })}
              {" "}{format(new Date(item._date), "HH:mm")}
            </span>
          </div>

          {/* Responsável */}
          {item.responsavel_email && (
            <span className="flex items-center gap-1 text-[10px] text-slate-500 mt-1">
              <User className="w-2.5 h-2.5" />
              <span className="capitalize">{formatNome(item.responsavel_email, item.responsavel_nome)}</span>
            </span>
          )}

          {/* Descrição — texto puro */}
          {item.descricao && (
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{String(item.descricao)}</p>
          )}

          {/* Concluída por */}
          {item.status === "concluida" && item.concluida_por && (
            <p className="text-[10px] text-emerald-500/70 mt-1">
              Concluída por {formatNome(item.concluida_por, null)}
              {item.concluida_em && ` em ${format(new Date(item.concluida_em), "dd/MM HH:mm")}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const ITENS_POR_PAGINA = 10;

// ── Componente principal ──────────────────────────────────────
export default function ActivityTimeline({ atividades = [], tarefas = [] }) {
  const [pagina, setPagina] = useState(1);

  // Mesclar atividades e tarefas em uma linha do tempo unificada
  const items = useMemo(() => {
    const atividadesNorm = (atividades || [])
      .filter(a => a.tipo !== "anotacao" || !a.observacao?.includes("🤖 ANÁLISE IA"))
      .map(a => ({
        ...a,
        _kind: "atividade",
        _date: a.created_date,
      }));

    const tarefasNorm = (tarefas || []).map(t => ({
      ...t,
      _kind: "tarefa",
      _date: t.data_vencimento || t.created_date,
    }));

    // Agrupar tarefas encerradas automaticamente pelo mesmo motivo no mesmo dia
    const tarefasEncerradas = tarefasNorm.filter(t => t.status === "encerrada_automaticamente");
    const tarefasNormais = tarefasNorm.filter(t => t.status !== "encerrada_automaticamente");

    const gruposEncerradas = {};
    for (const t of tarefasEncerradas) {
      const dia = t._date ? t._date.split("T")[0] : "sem_data";
      const chave = `${t.motivo_encerramento || "auto"}__${dia}`;
      if (!gruposEncerradas[chave]) {
        gruposEncerradas[chave] = { _kind: "tarefa_grupo_encerrada", motivo_encerramento: t.motivo_encerramento, _date: t._date, _count: 0 };
      }
      gruposEncerradas[chave]._count++;
    }

    const gruposArray = Object.values(gruposEncerradas);

    return [...atividadesNorm, ...tarefasNormais, ...gruposArray].sort((a, b) => new Date(b._date) - new Date(a._date));
  }, [atividades, tarefas]);

  if (!items.length) {
    return (
      <div className="text-center py-12 text-slate-500">
        <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Nenhuma atividade registrada</p>
        <p className="text-xs text-slate-600 mt-1">Ligações, tarefas e registros aparecem aqui</p>
      </div>
    );
  }

  // Separar retornos futuros pendentes para destacar no topo
  // Deduplicar por (cadencia_id + dia_cadencia): mantém apenas uma tarefa por etapa da cadência
  const retornosFuturosRaw = items.filter(i =>
    i._kind === "tarefa" &&
    isFuture(new Date(i._date)) &&
    i.status === "pendente"
  );

  const retornosFuturos = retornosFuturosRaw.reduce((acc, item) => {
    const key = item.cadencia_id && item.dia_cadencia != null
      ? `${item.cadencia_id}__${item.dia_cadencia}`
      : item.id;
    if (!acc.seen.has(key)) {
      acc.seen.add(key);
      acc.list.push(item);
    }
    return acc;
  }, { seen: new Set(), list: [] }).list;

  const idsRetornosRaw = new Set(retornosFuturosRaw.map(i => i.id));
  const historico = items.filter(i => !idsRetornosRaw.has(i.id));

  const totalPaginas = Math.ceil(historico.length / ITENS_POR_PAGINA);
  const historicoPaginado = historico.slice((pagina - 1) * ITENS_POR_PAGINA, pagina * ITENS_POR_PAGINA);
  const inicio = (pagina - 1) * ITENS_POR_PAGINA + 1;
  const fim = Math.min(pagina * ITENS_POR_PAGINA, historico.length);

  return (
    <div className="space-y-0">
      {/* ── Próximas atividades de retorno ── */}
      {retornosFuturos.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-violet-500/20" />
            <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider px-2">Próximos retornos</span>
            <div className="h-px flex-1 bg-violet-500/20" />
          </div>
          <div className="space-y-0">
            {retornosFuturos.map((item, idx) => (
              <TarefaItem key={item.id} item={item} isLast={idx === retornosFuturos.length - 1} />
            ))}
          </div>
        </div>
      )}

      {/* ── Separador histórico ── */}
      {retornosFuturos.length > 0 && historico.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <div className="h-px flex-1 bg-slate-800" />
          <span className="text-[10px] font-medium text-slate-600 px-2">Histórico</span>
          <div className="h-px flex-1 bg-slate-800" />
        </div>
      )}

      {/* ── Timeline principal (paginada) ── */}
      {historicoPaginado.map((item, idx) => {
        const isLast = idx === historicoPaginado.length - 1;
        if (item._kind === "tarefa_grupo_encerrada") {
          const motivos = {
            reuniao_agendada: "Reunião agendada",
            followup_agendado: "Follow-up agendado",
            conversao: "Conversão",
          };
          return (
            <div key={`grupo-${item._date}-${item.motivo_encerramento}`} className="flex gap-3">
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 bg-slate-700/40 border-slate-600/30">
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                </div>
                {!isLast && <div className="w-px flex-1 bg-slate-800 mt-1" />}
              </div>
              <div className={cn("flex-1 min-w-0", !isLast && "pb-5")}>
                <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
                  <Badge className="text-[10px] bg-slate-500/10 text-slate-400 border-slate-500/20">
                    {item._count} tarefa(s) encerrada(s)
                  </Badge>
                  <span className="text-xs text-slate-500">
                    {motivos[item.motivo_encerramento] || item.motivo_encerramento || "Encerramento automático"}
                  </span>
                  <span className="text-xs text-slate-600 ml-auto">
                    {format(new Date(item._date), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
              </div>
            </div>
          );
        }
        if (item._kind === "tarefa") {
          return <TarefaItem key={`tarefa-${item.id}`} item={item} isLast={isLast} />;
        }
        return <AtividadeItem key={`atv-${item.id}`} item={item} isLast={isLast} />;
      })}

      {/* ── Paginação ── */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-800 mt-2">
          <span className="text-[10px] text-slate-500">{inicio}–{fim} de {historico.length}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagina(p => Math.max(1, p - 1))}
              disabled={pagina === 1}
              className="px-3 py-1 text-xs rounded-lg bg-slate-800 text-slate-300 disabled:opacity-30 hover:bg-slate-700 transition-colors border border-slate-700"
            >
              ← Anterior
            </button>
            <span className="text-[10px] text-slate-500">{pagina} / {totalPaginas}</span>
            <button
              onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
              disabled={pagina === totalPaginas}
              className="px-3 py-1 text-xs rounded-lg bg-slate-800 text-slate-300 disabled:opacity-30 hover:bg-slate-700 transition-colors border border-slate-700"
            >
              Próxima →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}