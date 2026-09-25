import { useState } from "react";
import { api } from "@/api/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Phone, Save, Trash2, Eye, EyeOff, Wifi, WifiOff, RefreshCw,
  Users, ChevronDown, ChevronUp, Loader2,
} from "lucide-react";
import { toast } from "sonner";

const MODOS = [
  { value: "manual",     label: "Manual",     desc: "SDR liga quando quiser" },
  { value: "automatico", label: "Automático",  desc: "Power dialer liga sozinho" },
  { value: "ambos",      label: "Ambos",       desc: "Admin decide por sessão" },
];

function Integracao3CPlusCard({ integracao, onAtualizar, onDeletar }) {
  const cfg = integracao.configuracao || {};
  const [editando, setEditando]             = useState(!cfg.dominio);
  const [verTokenGestor, setVerTG]          = useState(false);
  const [testando, setTestando]             = useState(false);
  const [resultadoTeste, setResultadoTeste] = useState(null);
  const [expandirAgentes, setExpandirAgentes] = useState(false);

  // Tokens nunca voltam do servidor (chegam mascarados): os campos começam vazios e,
  // se continuarem vazios ao salvar, o servidor mantém o token já cadastrado.
  const [form, setForm] = useState({
    dominio:              cfg.dominio || "",
    token_gestor:         "",
    token_servico_agente: "",
    modo_padrao:          cfg.modo_padrao || "manual",
    campanha_id_padrao:   cfg.campanha_id_padrao || "",
  });
  const [verTokenAgente, setVerTA] = useState(false);

  const salvar = () => {
    const tokenGestorNovo = form.token_gestor.trim();
    const tokenAgenteNovo = form.token_servico_agente.trim();
    const aviso = [tokenGestorNovo, tokenAgenteNovo].some((t) => t && !t.startsWith("3cs_"));
    if (aviso) toast.warning("Tokens de serviço começam com 3cs_. O token pessoal deixa de funcionar em 01/10/2026.");
    onAtualizar(integracao.id, {
      ativa: true,
      status_conexao: "ativa",
      configuracao: {
        ...cfg,
        fornecedor: "3cplus",
        dominio: form.dominio.trim().replace(/\.3c\.plus.*/, ""),
        // cfg traz os valores mascarados: mandar a máscara de volta mantém o token atual
        token_gestor: tokenGestorNovo || cfg.token_gestor,
        token_servico_agente: tokenAgenteNovo || cfg.token_servico_agente,
        modo_padrao: form.modo_padrao,
        campanha_id_padrao: form.campanha_id_padrao.trim(),
      },
    });
    setForm((f) => ({ ...f, token_gestor: "", token_servico_agente: "" }));
    setEditando(false);
  };

  const testarConexao = async () => {
    if (!cfg.dominio || !cfg.token_gestor) {
      toast.error("Configure e salve o domínio e o token do gestor antes de testar");
      return;
    }
    setTestando(true);
    setResultadoTeste(null);
    try {
      // Testa com o token salvo no servidor (o navegador não conhece o token)
      const resp = await api.functions.invoke("executarComando3CPlus", {
        empresaId: integracao.empresaId,
        comando: "get-agent-status",
      });
      if (resp.data?.success) {
        const total = resp.data?.dados?.data?.length || 0;
        setResultadoTeste({ ok: true, agentes: total });
        toast.success(`Conexão OK — ${total} agente(s) encontrado(s)`);
      } else {
        const st = resp.data?.status || resp.status || 0;
        setResultadoTeste({ ok: false, erro: `HTTP ${st}` });
        toast.error("Falha na conexão", { description: `HTTP ${st}` });
      }
    } catch (e) {
      setResultadoTeste({ ok: false, erro: e.message });
      toast.error("Erro ao testar", { description: e.message });
    } finally {
      setTestando(false);
    }
  };

  const sincronizarAgentes = async () => {
    try {
      const res = await api.functions.invoke("sincronizarAgentes3CPlus", {
        empresaId: integracao.empresaId,
      });
      toast.success(`${res.data?.agentes_vinculados || 0} agente(s) sincronizado(s)`);
    } catch (e) {
      toast.error("Erro na sincronização", { description: e.message });
    }
  };

  const mapeamentoAgentes = cfg.mapeamento_agentes || {};
  const mapeamentoIds     = cfg.mapeamento_ids_3cplus || {};
  const mapeamentoRamais  = cfg.mapeamento_ramais || {};

  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-900/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/40">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-xl", integracao.ativa ? "bg-sky-500/10" : "bg-slate-800")}>
            <Phone className={cn("w-4 h-4", integracao.ativa ? "text-sky-400" : "text-slate-500")} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{integracao.nome}</p>
            <p className="text-[10px] text-slate-500">
              {cfg.dominio ? `${cfg.dominio}.3c.plus` : "Não configurado"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {resultadoTeste && (
            <Badge className={cn(
              "text-[10px] border",
              resultadoTeste.ok
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
            )}>
              {resultadoTeste.ok
                ? <><Wifi className="w-3 h-3 mr-1" />{resultadoTeste.agentes} agentes</>
                : <><WifiOff className="w-3 h-3 mr-1" />Erro</>
              }
            </Badge>
          )}

          <Badge className={cn(
            "text-[10px] border",
            integracao.ativa
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-slate-700/60 text-slate-500 border-slate-700/40"
          )}>
            {integracao.ativa ? "Ativa" : "Inativa"}
          </Badge>

          <Button size="sm" variant="ghost" onClick={() => setEditando(!editando)}
            className="h-7 px-2 text-xs text-slate-500 hover:text-white border border-slate-700/50 hover:border-slate-600">
            {editando ? "Cancelar" : "Editar"}
          </Button>

          <Button size="sm" variant="ghost" onClick={() => onDeletar(integracao.id)}
            className="h-7 w-7 p-0 text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/10">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Formulário de edição */}
      {editando && (
        <div className="px-5 py-4 border-b border-slate-800/40 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Domínio */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">Domínio 3C Plus</label>
              <div className="flex items-center gap-2">
                <Input
                  value={form.dominio}
                  onChange={e => setForm({ ...form, dominio: e.target.value })}
                  placeholder="minhaempresa"
                  className="bg-slate-800/60 border-slate-700/50 text-white text-sm h-9"
                />
                <span className="text-xs text-slate-600 whitespace-nowrap">.3c.plus</span>
              </div>
            </div>

            {/* Modo padrão */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">Modo de discagem</label>
              <div className="flex gap-1.5">
                {MODOS.map(m => (
                  <button
                    key={m.value}
                    onClick={() => setForm({ ...form, modo_padrao: m.value })}
                    className={cn(
                      "flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium border transition-all",
                      form.modo_padrao === m.value
                        ? "bg-gradient-to-r from-sky-500 to-violet-500 text-white border-transparent"
                        : "border-slate-700/50 bg-slate-800/60 text-slate-400 hover:text-white"
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Token de serviço — gestor */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs text-slate-400 font-medium">Token de serviço — papel gestor</label>
              <div className="flex items-center gap-2">
                <Input
                  value={form.token_gestor}
                  onChange={e => setForm({ ...form, token_gestor: e.target.value })}
                  placeholder={cfg.token_gestor ? "Configurado — deixe em branco para manter" : "3cs_..."}
                  type={verTokenGestor ? "text" : "password"}
                  autoComplete="off"
                  className="bg-slate-800/60 border-slate-700/50 text-white text-sm h-9 font-mono"
                />
                <Button size="sm" variant="ghost" onClick={() => setVerTG(!verTokenGestor)}
                  className="h-9 w-9 p-0 text-slate-500 hover:text-white flex-shrink-0">
                  {verTokenGestor ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-slate-600">Usado no monitoramento, campanhas e relatórios.</p>
            </div>

            {/* Token de serviço — agente */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs text-slate-400 font-medium">Token de serviço — papel agente</label>
              <div className="flex items-center gap-2">
                <Input
                  value={form.token_servico_agente}
                  onChange={e => setForm({ ...form, token_servico_agente: e.target.value })}
                  placeholder={cfg.token_servico_agente ? "Configurado — deixe em branco para manter" : "3cs_..."}
                  type={verTokenAgente ? "text" : "password"}
                  autoComplete="off"
                  className="bg-slate-800/60 border-slate-700/50 text-white text-sm h-9 font-mono"
                />
                <Button size="sm" variant="ghost" onClick={() => setVerTA(!verTokenAgente)}
                  className="h-9 w-9 p-0 text-slate-500 hover:text-white flex-shrink-0">
                  {verTokenAgente ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-slate-600">
                Um único token para todos os SDRs: o sistema age por cada agente pelo ramal cadastrado no perfil.
                Crie os tokens no painel 3C Plus (tokens de serviço). O token pessoal deixa de funcionar em 01/10/2026.
              </p>
            </div>

            {/* Campanha padrão */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">
                ID de campanha padrão <span className="text-slate-600">(para o botão "Entrar em campanha")</span>
              </label>
              <Input
                value={form.campanha_id_padrao}
                onChange={e => setForm({ ...form, campanha_id_padrao: e.target.value })}
                placeholder="Ex: 264353"
                className="bg-slate-800/60 border-slate-700/50 text-white text-sm h-9"
              />
              <p className="text-[10px] text-slate-600">SDRs usarão este ID ao clicar "Entrar em campanha" no softphone</p>
            </div>
          </div>

          {/* Botões */}
          <div className="flex items-center gap-2">
            <button
              onClick={testarConexao}
              disabled={testando || !cfg.dominio || !cfg.token_gestor}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all",
                "border-slate-600 bg-slate-800/60 text-slate-300 hover:text-white",
                "disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              {testando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
              Testar conexão
            </button>

            <button
              onClick={salvar}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-sky-500 to-violet-500 hover:from-sky-400 hover:to-violet-400 text-white shadow-md shadow-sky-500/20 transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              Salvar
            </button>
          </div>
        </div>
      )}

      {/* Info compacta (quando não editando) */}
      {!editando && cfg.dominio && (
        <div className="px-5 py-3 border-b border-slate-800/40 grid grid-cols-4 gap-4 text-xs">
          <div>
            <p className="text-slate-600 mb-0.5">Domínio</p>
            <p className="text-slate-300 font-mono text-[11px]">{cfg.dominio}.3c.plus</p>
          </div>
          <div>
            <p className="text-slate-600 mb-0.5">Modo</p>
            <p className="text-slate-300 capitalize">{cfg.modo_padrao || "manual"}</p>
          </div>
          <div>
            <p className="text-slate-600 mb-0.5">Campanha padrão</p>
            <p className="text-slate-300 font-mono text-[11px]">{cfg.campanha_id_padrao || "—"}</p>
          </div>
          <div>
            <p className="text-slate-600 mb-0.5">Tokens de serviço</p>
            <p className="text-slate-300 text-[11px]">
              gestor {cfg.token_gestor ? "✓" : "—"} · agente {cfg.token_servico_agente ? "✓" : "—"}
            </p>
          </div>
        </div>
      )}

      {/* Ações rápidas */}
      {!editando && (
        <div className="px-5 py-3 flex items-center gap-2">
          <button
            onClick={testarConexao}
            disabled={testando}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-slate-700/50 bg-slate-800/40 text-slate-400 hover:text-white hover:border-slate-600 transition-all disabled:opacity-40"
          >
            {testando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wifi className="w-3 h-3" />}
            Testar conexão
          </button>

          <button
            onClick={sincronizarAgentes}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-slate-700/50 bg-slate-800/40 text-slate-400 hover:text-sky-400 hover:border-sky-500/30 transition-all"
          >
            <RefreshCw className="w-3 h-3" />
            Sincronizar agentes
          </button>

          {Object.keys(mapeamentoAgentes).length > 0 && (
            <button
              onClick={() => setExpandirAgentes(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-slate-700/50 bg-slate-800/40 text-slate-400 hover:text-slate-200 transition-all ml-auto"
            >
              <Users className="w-3 h-3" />
              {Object.keys(mapeamentoAgentes).length} agente(s)
              {expandirAgentes ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>
      )}

      {/* Lista de agentes mapeados */}
      {expandirAgentes && !editando && (
        <div className="px-5 pb-4 space-y-1.5">
          {Object.entries(mapeamentoAgentes).map(([email, token]) => {
            const id    = mapeamentoIds[email];
            const ramal = mapeamentoRamais[email];
            const tokenStr = typeof token === "string" ? token : (token ? JSON.stringify(token) : "");
            return (
              <div key={email} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/40 border border-slate-700/30">
                <div>
                  <p className="text-xs text-slate-300">{String(email).split("@")[0]}</p>
                  <p className="text-[10px] text-slate-600">{String(email)}</p>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  {ramal && <span className="font-mono">Ramal {String(ramal)}</span>}
                  {id    && <span className="text-slate-600">ID {String(id)}</span>}
                  <span className={cn("w-1.5 h-1.5 rounded-full", tokenStr ? "bg-emerald-400" : "bg-rose-400")} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TelefoniaConfig({ integracoes }) {
  const [criando, setCriando]   = useState(false);
  const [nomeNova, setNomeNova] = useState("3C Plus - Telefonia");
  const queryClient             = useQueryClient();

  const criarMutation = useMutation({
    mutationFn: (data) => api.entities.Integracao.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integracoes"] });
      toast.success("Integração criada!");
      setCriando(false);
    },
  });

  const atualizarMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Integracao.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integracoes"] });
      toast.success("Integração atualizada!");
    },
  });

  const deletarMutation = useMutation({
    mutationFn: (id) => api.entities.Integracao.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integracoes"] });
      toast.success("Integração removida!");
    },
  });

  const integracoes3C      = integracoes?.filter(i => i.configuracao?.fornecedor === "3cplus") || [];
  const outrasIntegracoes  = integracoes?.filter(i => i.configuracao?.fornecedor !== "3cplus") || [];

  return (
    <div className="space-y-5">
      {/* Info */}
      <div className="flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-sky-500/5 border border-sky-500/15">
        <Phone className="w-4 h-4 text-sky-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm text-sky-300 font-medium">3C Plus integrado ao CRM</p>
          <p className="text-xs text-sky-300/60 mt-0.5">
            Ligações iniciadas pelo CRM, gravações automáticas, transcrição IA e monitoramento ao vivo dos agentes.
            Configure a <strong className="text-sky-300/80">campanha padrão</strong> para que SDRs entrem com um clique.
          </p>
        </div>
      </div>

      {integracoes3C.map(integracao => (
        <Integracao3CPlusCard
          key={integracao.id}
          integracao={integracao}
          onAtualizar={(id, data) => atualizarMutation.mutate({ id, data })}
          onDeletar={(id) => deletarMutation.mutate(id)}
        />
      ))}

      {outrasIntegracoes.map(integracao => (
        <div key={integracao.id} className="rounded-2xl border border-slate-800/60 bg-slate-900/60 px-5 py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">{integracao.nome}</p>
            <div className="flex items-center gap-2">
              <Badge className="text-[10px] bg-slate-700 text-slate-400">{integracao.configuracao?.fornecedor || "outro"}</Badge>
              <Button size="sm" variant="ghost" onClick={() => deletarMutation.mutate(integracao.id)}
                className="h-7 w-7 p-0 text-rose-400/60 hover:text-rose-400">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ))}

      {criando ? (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-5 space-y-4">
          <p className="text-sm font-semibold text-white">Nova integração de telefonia</p>
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">Nome</label>
            <Input
              value={nomeNova}
              onChange={e => setNomeNova(e.target.value)}
              className="bg-slate-800/60 border-slate-700/50 text-white h-9"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCriando(false)}
              className="border border-slate-700/50 text-slate-400">
              Cancelar
            </Button>
            <button
              onClick={() => criarMutation.mutate({
                nome: nomeNova,
                tipo: "telefonia",
                ativa: false,
                status_conexao: "inativa",
                configuracao: { fornecedor: "3cplus" },
              })}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-sky-500 to-violet-500 text-white shadow-md shadow-sky-500/20"
            >
              <Save className="w-3.5 h-3.5" />
              Criar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCriando(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-slate-700/50 text-sm text-slate-500 hover:text-sky-400 hover:border-sky-500/30 transition-all"
        >
          <Phone className="w-4 h-4" />
          Adicionar integração de telefonia
        </button>
      )}
    </div>
  );
}