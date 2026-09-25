import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Users, Phone, Wifi, Activity, MousePointer,
  RefreshCw, ChevronDown, ChevronUp, Search, Download
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const TIPO_LABEL = {
  login: { label: "Login", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  logout: { label: "Logout", color: "bg-slate-500/15 text-slate-400 border-slate-500/20" },
  pagina_visitada: { label: "Página", color: "bg-sky-500/15 text-sky-400 border-sky-500/20" },
  campanha_conectada: { label: "Campanha", color: "bg-violet-500/15 text-violet-400 border-violet-500/20" },
  campanha_desconectada: { label: "Saiu Campanha", color: "bg-orange-500/15 text-orange-400 border-orange-500/20" },
  ligacao_iniciada: { label: "Ligação", color: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  ligacao_finalizada: { label: "Fim Ligação", color: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20" },
};

function fmtDuracao(seg) {
  if (!seg) return "—";
  if (seg < 60) return `${seg}s`;
  if (seg < 3600) return `${Math.floor(seg / 60)}m ${seg % 60}s`;
  return `${Math.floor(seg / 3600)}h ${Math.floor((seg % 3600) / 60)}m`;
}

export default function UserAnalyticsPanel() {
  const { empresaId } = useEmpresaAtual();
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("all");
  const [expandedUser, setExpandedUser] = useState(null);

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["logs-acesso", empresaId],
    queryFn: () => base44.entities.LogAcesso.filter({ empresaId }, "-registrado_em", 500),
    enabled: !!empresaId,
    staleTime: 30000,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["todos-usuarios-analytics", empresaId],
    queryFn: () => base44.entities.VinculoEmpresa.filter({ empresaId, status: "ativo" }).then(
      vinculos => vinculos.map(v => ({ id: v.userEmail, email: v.userEmail, full_name: v.userName || v.userEmail }))
    ),
    enabled: !!empresaId,
  });

  // Agrupa logs por usuário
  const userMap = {};
  logs.forEach(log => {
    if (!userMap[log.user_email]) {
      userMap[log.user_email] = {
        email: log.user_email,
        nome: log.user_nome || log.user_email,
        logs: [],
        totalSessao: 0,
        totalLigacao: 0,
        campanhas: new Set(),
        paginas: new Set(),
        ultimoAcesso: null,
        logins: 0,
      };
    }
    const u = userMap[log.user_email];
    u.logs.push(log);
    if (log.tipo_evento === "login") u.logins++;
    if (log.tipo_evento === "logout" && log.duracao_segundos) u.totalSessao += log.duracao_segundos;
    if (log.tipo_evento === "pagina_visitada" && log.duracao_segundos) u.totalSessao += log.duracao_segundos;
    if ((log.tipo_evento === "ligacao_finalizada") && log.duracao_segundos) u.totalLigacao += log.duracao_segundos;
    if (log.campanha_nome) u.campanhas.add(log.campanha_nome);
    if (log.pagina) u.paginas.add(log.pagina);
    if (!u.ultimoAcesso || log.registrado_em > u.ultimoAcesso) u.ultimoAcesso = log.registrado_em;
  });

  const usuarios = Object.values(userMap).sort((a, b) =>
    (b.ultimoAcesso || "").localeCompare(a.ultimoAcesso || "")
  );

  const filteredUsers = usuarios.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.nome.toLowerCase().includes(search.toLowerCase())
  );

  // Stats globais
  const totalLogins = logs.filter(l => l.tipo_evento === "login").length;
  const totalLigacoes = logs.filter(l => l.tipo_evento === "ligacao_finalizada").length;
  const totalTempoSessao = Object.values(userMap).reduce((a, u) => a + u.totalSessao, 0);
  const totalTempoLigacao = Object.values(userMap).reduce((a, u) => a + u.totalLigacao, 0);

  const logsDoUsuario = expandedUser
    ? (filtroTipo === "all"
        ? userMap[expandedUser]?.logs
        : userMap[expandedUser]?.logs.filter(l => l.tipo_evento === filtroTipo))
    : [];

  function exportarCSV() {
    const cabecalho = ["email", "nome", "tipo_evento", "pagina", "campanha_nome", "duracao_segundos", "session_id", "registrado_em"];
    const linhas = logs.map(l => [
      l.user_email || "",
      l.user_nome || "",
      l.tipo_evento || "",
      l.pagina || "",
      l.campanha_nome || "",
      l.duracao_segundos ?? "",
      l.session_id || "",
      l.registrado_em || "",
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [cabecalho.join(","), ...linhas].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs_acesso_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Log de Acessos & Atividade</h3>
          <p className="text-xs text-slate-500 mt-0.5">Logs dos últimos 7 dias • sessões, ligações e campanhas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={exportarCSV} disabled={logs.length === 0}
            className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 h-8 text-xs gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </Button>
          <Button size="sm" onClick={() => refetch()} disabled={isFetching}
            className="bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 h-8 text-xs gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Stats globais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Usuários com Log", value: usuarios.length, icon: Users, color: "text-sky-400" },
          { label: "Total de Logins", value: totalLogins, icon: Activity, color: "text-emerald-400" },
          { label: "Ligações Finalizadas", value: totalLigacoes, icon: Phone, color: "text-blue-400" },
          { label: "Tempo Online Total", value: fmtDuracao(totalTempoSessao), icon: Wifi, color: "text-violet-400" },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <p className="text-[10px] text-slate-500">{s.label}</p>
            </div>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
        <input
          type="text"
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-300 placeholder-slate-500 focus:outline-none focus:border-sky-500/40"
        />
      </div>

      {/* Lista de usuários */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-slate-700 border-t-sky-500 rounded-full animate-spin" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-10 text-slate-500 text-sm">
          <MousePointer className="w-8 h-8 mx-auto mb-2 opacity-30" />
          {logs.length === 0 ? "Nenhum log registrado ainda. Os logs aparecem conforme os usuários usam o sistema." : "Nenhum usuário encontrado."}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredUsers.map(u => {
            const isOpen = expandedUser === u.email;
            return (
              <div key={u.email} className="rounded-xl border border-white/[0.06] overflow-hidden">
                {/* Row */}
                <button
                  onClick={() => { setExpandedUser(isOpen ? null : u.email); setFiltroTipo("all"); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left"
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-sky-300">{u.nome.charAt(0).toUpperCase()}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{u.nome}</p>
                    <p className="text-[11px] text-slate-500 truncate">{u.email}</p>
                  </div>

                  {/* Métricas rápidas */}
                  <div className="hidden sm:flex items-center gap-4 text-right shrink-0">
                    <div>
                      <p className="text-[10px] text-slate-500">Sessão</p>
                      <p className="text-xs font-semibold text-violet-400">{fmtDuracao(u.totalSessao)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">Ligações</p>
                      <p className="text-xs font-semibold text-blue-400">{fmtDuracao(u.totalLigacao)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">Campanhas</p>
                      <p className="text-xs font-semibold text-emerald-400">{u.campanhas.size}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">Último acesso</p>
                      <p className="text-xs text-slate-400">
                        {u.ultimoAcesso ? formatDistanceToNow(new Date(u.ultimoAcesso), { locale: ptBR, addSuffix: true }) : "—"}
                      </p>
                    </div>
                  </div>

                  {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
                </button>

                {/* Detalhe expandido */}
                {isOpen && (
                  <div className="border-t border-white/[0.05] p-4 space-y-4">
                    {/* Campanhas */}
                    {u.campanhas.size > 0 && (
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Campanhas acessadas</p>
                        <div className="flex flex-wrap gap-2">
                          {[...u.campanhas].map(c => (
                            <Badge key={c} className="text-xs bg-violet-500/10 text-violet-300 border-violet-500/20">{c}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Filtro tipo */}
                    <div className="flex flex-wrap gap-1.5">
                      <button onClick={() => setFiltroTipo("all")}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${filtroTipo === "all" ? "bg-sky-500/20 text-sky-300 border-sky-500/30" : "text-slate-500 border-white/[0.06] hover:text-slate-300"}`}>
                        Todos
                      </button>
                      {Object.keys(TIPO_LABEL).map(t => (
                        <button key={t} onClick={() => setFiltroTipo(t)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${filtroTipo === t ? "bg-sky-500/20 text-sky-300 border-sky-500/30" : "text-slate-500 border-white/[0.06] hover:text-slate-300"}`}>
                          {TIPO_LABEL[t].label}
                        </button>
                      ))}
                    </div>

                    {/* Log detalhado */}
                    <div className="rounded-xl border border-white/[0.06] overflow-hidden max-h-72 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-[#0d1420]">
                          <tr className="border-b border-white/[0.05]">
                            <th className="text-left text-slate-500 font-medium px-3 py-2">Evento</th>
                            <th className="text-left text-slate-500 font-medium px-3 py-2">Detalhe</th>
                            <th className="text-right text-slate-500 font-medium px-3 py-2">Duração</th>
                            <th className="text-right text-slate-500 font-medium px-3 py-2">Data/Hora</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(logsDoUsuario || []).map((log, i) => {
                            const tipo = TIPO_LABEL[log.tipo_evento] || { label: log.tipo_evento, color: "bg-slate-500/15 text-slate-400 border-slate-500/20" };
                            return (
                              <tr key={log.id || i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                                <td className="px-3 py-2">
                                  <Badge className={`text-[10px] ${tipo.color}`}>{tipo.label}</Badge>
                                </td>
                                <td className="px-3 py-2 text-slate-400 truncate max-w-[180px]">
                                  {log.campanha_nome || log.pagina || "—"}
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-slate-400">
                                  {fmtDuracao(log.duracao_segundos)}
                                </td>
                                <td className="px-3 py-2 text-right text-slate-500 whitespace-nowrap">
                                  {log.registrado_em ? format(new Date(log.registrado_em), "dd/MM HH:mm:ss") : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}