import { useState } from "react";
import { api } from "@/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Plus, Edit, Trash2, Power, X, Sparkles, Eye, Copy, Filter, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { usePermissions } from "@/components/hooks/usePermissions";

// ── Design tokens ──────────────────────────────────────────────
const BG       = "hsl(222 47% 6%)";
const SURFACE  = "hsl(222 47% 8%)";
const ELEVATED = "hsl(222 40% 11%)";
const BORDER   = "hsl(217 33% 17%)";
const MUTED    = "hsl(215 20% 55%)";
const BTN_GRAD = "linear-gradient(135deg, hsl(217 91% 60%) 0%, hsl(262 83% 65%) 100%)";
const BTN_SHADOW = "0 8px 24px -6px hsl(217 91% 60% / 0.5)";

const tipoConfig = {
  sdr:    { label: "SDR — Qualificação",        color: "bg-sky-500/15 text-sky-300 border-sky-500/25" },
  closer: { label: "Closer — Fechamento",        color: "bg-violet-500/15 text-violet-300 border-violet-500/25" },
};

const tipoResposta = {
  texto_curto:     "Texto Curto",
  texto_longo:     "Texto Longo",
  multipla_escolha:"Múltipla Escolha",
  checkbox:        "Checkbox",
  numero:          "Número",
  data:            "Data",
};

// ── Botão primário sky→violet ──────────────────────────────────
function BtnPrimary({ children, disabled, onClick, className = "" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn("inline-flex items-center gap-2 h-9 px-5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed", className)}
      style={{ background: BTN_GRAD, boxShadow: BTN_SHADOW }}
    >
      {children}
    </button>
  );
}

// ── Botão ghost ────────────────────────────────────────────────
function BtnGhost({ children, onClick, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={cn("inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium transition-all border", className)}
      style={{ color: MUTED, borderColor: BORDER, background: "transparent" }}
      onMouseEnter={(e) => { e.currentTarget.style.color = "white"; e.currentTarget.style.background = ELEVATED; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = MUTED; e.currentTarget.style.background = "transparent"; }}
    >
      {children}
    </button>
  );
}

// ── Tab pill ───────────────────────────────────────────────────
function TabPill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200"
      style={active ? {
        background: "linear-gradient(135deg, hsl(217 91% 60% / 0.25) 0%, hsl(262 83% 65% / 0.2) 100%)",
        color: "white",
        border: "1px solid hsl(217 91% 60% / 0.4)",
        boxShadow: "0 0 16px -4px hsl(217 91% 60% / 0.5)",
      } : {
        background: "transparent",
        color: MUTED,
        border: "1px solid transparent",
      }}
    >
      {children}
    </button>
  );
}

// ── Select dark wrapper ────────────────────────────────────────
const darkSelectContent = {
  background: "hsl(222 47% 8%)",
  border: `1px solid ${BORDER}`,
  borderRadius: "12px",
  boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
};

export default function Formularios() {
  const [modalAberto, setModalAberto] = useState(false);
  const [modalIAAberto, setModalIAAberto] = useState(false);
  const [modalVisualizacao, setModalVisualizacao] = useState(false);
  const [formularioEditando, setFormularioEditando] = useState(null);
  const [formularioVisualizando, setFormularioVisualizando] = useState(null);
  const [gerandoIA, setGerandoIA] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [formData, setFormData] = useState({ nome: "", descricao: "", tipo: "sdr", produtos_vinculados: [], perguntas: [], ativo: true });
  const [formDataIA, setFormDataIA] = useState({ produto_id: "", tipo: "sdr", contexto_adicional: "" });

  const queryClient = useQueryClient();
  const { empresaId } = useEmpresaAtual();

  const { data: user } = useQuery({ queryKey: ["me"], queryFn: () => api.auth.me() });

  const { data: vinculoAtual } = useQuery({
    queryKey: ["vinculo-atual", empresaId, user?.email],
    queryFn: async () => {
      if (!empresaId || !user?.email) return null;
      const vinculos = await api.entities.VinculoEmpresa.filter({ empresaId, userEmail: user.email });
      return vinculos?.[0] || null;
    },
    enabled: !!empresaId && !!user?.email,
  });

  const { data: formularios = [], isLoading } = useQuery({
    queryKey: ["formularios", empresaId],
    queryFn: () => api.entities.Formulario.filter({ empresaId }),
    enabled: !!empresaId,
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos", empresaId],
    queryFn: () => api.entities.Produto.filter({ empresaId, ativo: true }),
    enabled: !!empresaId,
  });

  const { data: analisesIA = [] } = useQuery({
    queryKey: ["analises-ia", empresaId],
    queryFn: async () => {
      const atividades = await api.entities.Atividade.filter({ empresaId, tipo: "anotacao" }, "-created_date", 100);
      return atividades.filter(a => a.observacao?.includes("🤖 ANÁLISE IA") || a.observacao?.includes("ANÁLISE IA"));
    },
    enabled: !!empresaId,
  });

  const { canPerformAction } = usePermissions();
  const podeGerenciar = canPerformAction("Formularios", "create");

  const invalidarFormularios = () => queryClient.invalidateQueries({ queryKey: ["formularios", empresaId] });

  const criarFormularioMutation = useMutation({
    mutationFn: (data) => { const p = { ...data }; if (!p.empresaId) p.empresaId = empresaId; return api.entities.Formulario.create(p); },
    onSuccess: () => { invalidarFormularios(); toast.success("Formulário criado!"); fecharModal(); },
    onError: (err) => toast.error("Erro ao criar: " + (err?.message || "tente novamente")),
  });

  const atualizarFormularioMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Formulario.update(id, data),
    onSuccess: () => { invalidarFormularios(); toast.success("Formulário atualizado!"); fecharModal(); },
    onError: (err) => toast.error("Erro ao atualizar: " + (err?.message || "tente novamente")),
  });

  const deletarFormularioMutation = useMutation({
    mutationFn: (id) => api.entities.Formulario.delete(id),
    onSuccess: () => { invalidarFormularios(); toast.success("Formulário removido!"); },
    onError: (err) => toast.error("Erro ao remover: " + (err?.message || "tente novamente")),
  });

  const abrirModal = (formulario = null) => {
    if (!podeGerenciar) { toast.error("Sem permissão"); return; }
    if (formulario) {
      setFormularioEditando(formulario);
      setFormData({ nome: formulario.nome, descricao: formulario.descricao || "", tipo: formulario.tipo, produtos_vinculados: formulario.produtos_vinculados || [], perguntas: formulario.perguntas || [], ativo: formulario.ativo });
    } else {
      setFormularioEditando(null);
      setFormData({ nome: "", descricao: "", tipo: "sdr", produtos_vinculados: [], perguntas: [], ativo: true });
    }
    setModalAberto(true);
  };

  const fecharModal = () => { setModalAberto(false); setFormularioEditando(null); setFormData({ nome: "", descricao: "", tipo: "sdr", produtos_vinculados: [], perguntas: [], ativo: true }); };
  const abrirModalIA = () => { if (!podeGerenciar) { toast.error("Sem permissão"); return; } setFormDataIA({ produto_id: "", tipo: "sdr", contexto_adicional: "" }); setModalIAAberto(true); };
  const fecharModalIA = () => { setModalIAAberto(false); setFormDataIA({ produto_id: "", tipo: "sdr", contexto_adicional: "" }); };

  const gerarFormularioComIA = async () => {
    if (!formDataIA.produto_id) { toast.error("Selecione um produto"); return; }
    setGerandoIA(true);
    toast.info("Gerando formulário com IA...");
    try {
      const produto = produtos.find(p => p.id === formDataIA.produto_id);
      const analisesRelacionadas = analisesIA.filter(a => a.produto_id === formDataIA.produto_id || a.produto_nome === produto.nome).slice(0, 20);
      const prompt = `Você é um especialista em vendas e qualificação de leads usando metodologia SPIN Selling.\n\nCrie um formulário de qualificação inteligente para o seguinte produto:\n\n**Produto:** ${produto.nome}\n**Categoria:** ${produto.categoria || "Não informada"}\n**Descrição:** ${produto.descricao || "Não informada"}\n**ICP:** ${produto.icp || "Não informado"}\n**Tipo de Formulário:** ${tipoConfig[formDataIA.tipo]?.label}\n\n${produto.manual?.conteudo ? `**Manual do Produto:**\n${produto.manual.conteudo}\n` : ""}\n${analisesRelacionadas.length > 0 ? `**Análises de Conversas Recentes:**\n${analisesRelacionadas.map(a => a.observacao).join("\n\n---\n\n")}\n` : ""}\n${formDataIA.contexto_adicional ? `**Contexto Adicional:**\n${formDataIA.contexto_adicional}\n` : ""}\n\nCrie um formulário com 8-12 perguntas estratégicas. Retorne JSON:\n{"nome":"...","descricao":"...","perguntas":[{"pergunta":"...","tipo_resposta":"texto_curto|texto_longo|multipla_escolha|checkbox|numero|data","opcoes":[],"obrigatoria":true}]}`;
      const response = await api.integrations.Core.InvokeLLM({ prompt, response_json_schema: { type: "object", properties: { nome: { type: "string" }, descricao: { type: "string" }, perguntas: { type: "array", items: { type: "object", properties: { pergunta: { type: "string" }, tipo_resposta: { type: "string" }, opcoes: { type: "array", items: { type: "string" } }, obrigatoria: { type: "boolean" } } } } } } });
      await criarFormularioMutation.mutateAsync({ empresaId, nome: response.nome, descricao: response.descricao, tipo: formDataIA.tipo, produtos_vinculados: [formDataIA.produto_id], perguntas: response.perguntas, ativo: true });
      fecharModalIA();
      toast.success("Formulário criado com IA!");
    } catch (error) { toast.error("Erro ao gerar formulário com IA"); }
    finally { setGerandoIA(false); }
  };

  const adicionarPergunta = () => setFormData({ ...formData, perguntas: [...formData.perguntas, { pergunta: "", tipo_resposta: "texto_curto", opcoes: [], obrigatoria: false }] });
  const removerPergunta = (i) => setFormData({ ...formData, perguntas: formData.perguntas.filter((_, idx) => idx !== i) });
  const atualizarPergunta = (i, campo, valor) => { const p = [...formData.perguntas]; p[i][campo] = valor; setFormData({ ...formData, perguntas: p }); };
  const adicionarOpcao = (pi) => { const p = [...formData.perguntas]; if (!p[pi].opcoes) p[pi].opcoes = []; p[pi].opcoes.push(""); setFormData({ ...formData, perguntas: p }); };
  const removerOpcao = (pi, oi) => { const p = [...formData.perguntas]; p[pi].opcoes = p[pi].opcoes.filter((_, i) => i !== oi); setFormData({ ...formData, perguntas: p }); };
  const atualizarOpcao = (pi, oi, val) => { const p = [...formData.perguntas]; p[pi].opcoes[oi] = val; setFormData({ ...formData, perguntas: p }); };

  const handleSalvar = () => {
    if (!formData.nome?.trim()) { toast.error("Informe o nome"); return; }
    if (!formData.tipo) { toast.error("Selecione o tipo"); return; }
    if (formData.perguntas.length === 0) { toast.error("Adicione pelo menos uma pergunta"); return; }
    const vazia = formData.perguntas.findIndex(p => !p.pergunta?.trim());
    if (vazia !== -1) { toast.error(`Pergunta #${vazia + 1} está vazia`); return; }
    if (formularioEditando) atualizarFormularioMutation.mutate({ id: formularioEditando.id, data: { ...formData, empresaId } });
    else criarFormularioMutation.mutate({ ...formData, empresaId });
  };

  const toggleAtivo = (f) => { if (!podeGerenciar) { toast.error("Sem permissão"); return; } atualizarFormularioMutation.mutate({ id: f.id, data: { ...f, ativo: !f.ativo } }); };
  const visualizarFormulario = (f) => { setFormularioVisualizando(f); setModalVisualizacao(true); };
  const duplicarFormulario = (f) => {
    if (!podeGerenciar) { toast.error("Sem permissão"); return; }
    const novo = { ...f, nome: `${f.nome} (Cópia)` };
    delete novo.id; delete novo.created_date; delete novo.updated_date;
    criarFormularioMutation.mutate(novo);
    toast.success("Formulário duplicado!");
  };

  const formulariosAtivos = formularios.filter(f => f.ativo).length;
  const formulariosFiltrados = formularios.filter(f => filtroTipo === "todos" || f.tipo === filtroTipo);

  return (
    <div
      className="min-h-screen p-6 space-y-6"
      style={{ background: `radial-gradient(ellipse 900px 500px at 20% -10%, hsl(217 91% 60% / 0.08), transparent 60%), radial-gradient(ellipse 700px 400px at 85% 5%, hsl(262 83% 65% / 0.07), transparent 55%), ${BG}` }}
    >
      {/* ── Header ── */}
      <div
        className="relative rounded-2xl p-6 overflow-hidden"
        style={{ background: `linear-gradient(135deg, hsl(222 40% 10%) 0%, hsl(222 47% 7%) 100%)`, border: `1px solid ${BORDER}` }}
      >
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full pointer-events-none" style={{ background: "hsl(217 91% 60% / 0.10)", filter: "blur(40px)" }} />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, hsl(217 91% 60% / 0.2) 0%, hsl(262 83% 65% / 0.2) 100%)", border: "1px solid hsl(217 91% 60% / 0.35)", boxShadow: "0 0 20px -4px hsl(217 91% 60% / 0.4)" }}>
              <FileText className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Formulários</h1>
              <p className="text-sm mt-0.5" style={{ color: MUTED }}>
                {formularios.length} formulários · {formulariosAtivos} ativos
              </p>
            </div>
          </div>
          {podeGerenciar && (
            <div className="flex gap-2.5">
              <button
                onClick={abrirModalIA}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold border transition-all hover:brightness-110"
                style={{ border: "1px solid hsl(262 83% 65% / 0.4)", background: "hsl(262 83% 65% / 0.12)", color: "hsl(262 83% 85%)", boxShadow: "0 0 16px -6px hsl(262 83% 65% / 0.4)" }}
              >
                <Sparkles className="w-4 h-4" /> Criar com IA
              </button>
              <BtnPrimary onClick={() => abrirModal()}>
                <Plus className="w-4 h-4" /> Criar Manual
              </BtnPrimary>
            </div>
          )}
        </div>
      </div>

      {/* ── Filtros (tabs pill) ── */}
      <div className="flex items-center gap-2 p-1" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "14px", width: "fit-content" }}>
        <Filter className="w-4 h-4 ml-2 flex-shrink-0" style={{ color: MUTED }} />
        <TabPill active={filtroTipo === "todos"} onClick={() => setFiltroTipo("todos")}>
          Todos ({formularios.length})
        </TabPill>
        <TabPill active={filtroTipo === "sdr"} onClick={() => setFiltroTipo("sdr")}>
          SDR ({formularios.filter(f => f.tipo === "sdr").length})
        </TabPill>
        <TabPill active={filtroTipo === "closer"} onClick={() => setFiltroTipo("closer")}>
          Closer ({formularios.filter(f => f.tipo === "closer").length})
        </TabPill>
      </div>

      {/* ── Tabela ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: "hsl(222 47% 6%)", borderBottom: `1px solid ${BORDER}` }}>
              {["Nome", "Tipo", "Perguntas", "Produtos", "Status", "Ações"].map((h, i) => (
                <th key={h} className={cn("px-6 py-4 text-xs font-bold uppercase tracking-widest", i === 5 ? "text-right" : "text-left")} style={{ color: MUTED }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {formulariosFiltrados.map((f, idx) => (
              <tr key={f.id} className="transition-colors" style={{ borderTop: idx > 0 ? `1px solid ${BORDER}` : "none" }}
                onMouseEnter={(e) => e.currentTarget.style.background = ELEVATED}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <td className="px-6 py-4">
                  <p className="text-white font-semibold text-sm">{f.nome}</p>
                  {f.descricao && <p className="text-xs mt-0.5 line-clamp-1" style={{ color: MUTED }}>{f.descricao}</p>}
                </td>
                <td className="px-6 py-4">
                  <span className={cn("inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold border", tipoConfig[f.tipo]?.color)}>
                    {tipoConfig[f.tipo]?.label}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-semibold text-white">{f.perguntas?.length || 0}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-semibold text-white">{f.produtos_vinculados?.length || 0}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={cn("inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold border", f.ativo ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" : "bg-slate-500/15 text-slate-400 border-slate-500/20")}>
                    {f.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-1">
                    {[
                      { icon: Eye, onClick: () => visualizarFormulario(f), cls: "", always: true },
                      { icon: Copy, onClick: () => duplicarFormulario(f), cls: "" },
                      { icon: Edit, onClick: () => abrirModal(f), cls: "" },
                      { icon: Power, onClick: () => toggleAtivo(f), cls: f.ativo ? "text-emerald-400" : "" },
                      { icon: Trash2, onClick: () => { if (confirm("Remover formulário?")) deletarFormularioMutation.mutate(f.id); }, cls: "text-rose-400 hover:!text-rose-300" },
                    ].filter(b => b.always || podeGerenciar).map(({ icon: Icon, onClick, cls }, i) => (
                      <button key={i} onClick={onClick} className={cn("h-8 w-8 rounded-lg flex items-center justify-center transition-all", cls)} style={{ color: cls ? undefined : MUTED }}
                        onMouseEnter={(e) => { if (!cls) e.currentTarget.style.color = "white"; e.currentTarget.style.background = ELEVATED; }}
                        onMouseLeave={(e) => { if (!cls) e.currentTarget.style.color = MUTED; e.currentTarget.style.background = "transparent"; }}
                      >
                        <Icon className="w-4 h-4" />
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {formulariosFiltrados.length === 0 && !isLoading && (
          <div className="py-16 text-center">
            <div className="h-14 w-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "hsl(217 91% 60% / 0.08)", border: `1px solid ${BORDER}` }}>
              <FileText className="w-7 h-7" style={{ color: MUTED }} />
            </div>
            <p className="text-white font-semibold">{formularios.length === 0 ? "Nenhum formulário" : "Nenhum resultado"}</p>
            <p className="text-sm mt-1" style={{ color: MUTED }}>{formularios.length === 0 ? "Crie seu primeiro formulário." : "Tente ajustar os filtros."}</p>
            {podeGerenciar && formularios.length === 0 && (
              <div className="mt-5 flex justify-center">
                <BtnPrimary onClick={() => abrirModal()}><Plus className="w-4 h-4" /> Criar Formulário</BtnPrimary>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal Criar/Editar ── */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent
          className="max-w-2xl max-h-[92vh] overflow-hidden p-0 gap-0"
          style={{ background: `linear-gradient(180deg, hsl(222 47% 8%) 0%, hsl(222 47% 6%) 100%)`, borderColor: BORDER, boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px hsl(0 0% 100% / 0.05) inset" }}
          aria-describedby={undefined}
        >
          {/* Header */}
          <div className="relative px-7 pt-7 pb-5 overflow-hidden flex-shrink-0" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <div className="absolute -top-10 -right-10 h-36 w-36 rounded-full pointer-events-none" style={{ background: "hsl(217 91% 60% / 0.10)", filter: "blur(32px)" }} />
            <div className="relative flex items-center gap-4">
              <div className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, hsl(217 91% 60% / 0.2) 0%, hsl(262 83% 65% / 0.2) 100%)", border: "1px solid hsl(217 91% 60% / 0.35)", boxShadow: "0 0 20px -4px hsl(217 91% 60% / 0.4)" }}>
                <FileText className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">{formularioEditando ? "Editar Formulário" : "Novo Formulário"}</h2>
                <p className="text-xs mt-0.5" style={{ color: MUTED }}>{formularioEditando ? "Atualize as informações" : "Configure o formulário de qualificação"}</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto px-7 py-6 space-y-5" style={{ maxHeight: "calc(92vh - 160px)" }}>

            {/* Informações básicas */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "hsl(217 91% 70%)" }}>Informações Básicas</span>
                <div className="flex-1 h-px" style={{ background: "hsl(217 91% 60% / 0.2)" }} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: MUTED }}>Nome <span className="text-sky-400">*</span></label>
                <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} placeholder="Ex: Qualificação de Leads SDR" className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: MUTED }}>Descrição</label>
                <Textarea value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} placeholder="Descreva o objetivo..." className="rounded-xl min-h-[70px] resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: MUTED }}>Tipo <span className="text-sky-400">*</span></label>
                  <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                    <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent style={darkSelectContent}>
                      {Object.entries(tipoConfig).map(([value, config]) => <SelectItem key={value} value={value}>{config.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: MUTED }}>Vincular Produto</label>
                  <Select value="" onValueChange={(v) => { if (!formData.produtos_vinculados.includes(v)) setFormData({ ...formData, produtos_vinculados: [...formData.produtos_vinculados, v] }); }}>
                    <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent style={darkSelectContent}>
                      {produtos.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {formData.produtos_vinculados.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.produtos_vinculados.map(pid => {
                    const prod = produtos.find(p => p.id === pid);
                    return (
                      <span key={pid} className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-xs font-semibold border bg-sky-500/15 text-sky-300 border-sky-500/25">
                        {prod?.nome}
                        <button onClick={() => setFormData({ ...formData, produtos_vinculados: formData.produtos_vinculados.filter(id => id !== pid) })} className="hover:text-white transition-colors"><X className="w-3 h-3" /></button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Perguntas */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "hsl(160 84% 55%)" }}>Perguntas</span>
                  <div className="w-24 h-px" style={{ background: "hsl(160 84% 55% / 0.2)" }} />
                </div>
                <button
                  onClick={adicionarPergunta}
                  className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-semibold border transition-all"
                  style={{ border: "1px solid hsl(160 84% 55% / 0.35)", background: "hsl(160 84% 55% / 0.10)", color: "hsl(160 84% 70%)" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "hsl(160 84% 55% / 0.18)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "hsl(160 84% 55% / 0.10)"}
                >
                  <Plus className="w-3 h-3" /> Adicionar Pergunta
                </button>
              </div>

              {formData.perguntas.length === 0 && (
                <div className="py-8 text-center rounded-xl border border-dashed" style={{ borderColor: BORDER }}>
                  <CheckSquare className="w-8 h-8 mx-auto mb-2" style={{ color: MUTED }} />
                  <p className="text-sm" style={{ color: MUTED }}>Nenhuma pergunta. Clique em "Adicionar Pergunta".</p>
                </div>
              )}

              {formData.perguntas.map((pergunta, pi) => (
                <div key={pi} className="rounded-xl p-4 space-y-3" style={{ background: ELEVATED, border: `1px solid ${BORDER}` }}>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center h-5 px-2 rounded-md text-[10px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/20">#{pi + 1}</span>
                    <button onClick={() => removerPergunta(pi)} className="h-6 w-6 rounded-lg flex items-center justify-center text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <Input value={pergunta.pergunta} onChange={(e) => atualizarPergunta(pi, "pergunta", e.target.value)} placeholder="Digite a pergunta..." className="h-9 rounded-xl" />
                  <div className="grid grid-cols-2 gap-3">
                    <Select value={pergunta.tipo_resposta} onValueChange={(v) => atualizarPergunta(pi, "tipo_resposta", v)}>
                      <SelectTrigger className="h-9 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent style={darkSelectContent}>
                        {Object.entries(tipoResposta).map(([val, lbl]) => <SelectItem key={val} value={val}>{lbl}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div
                      className="flex items-center justify-between px-3 rounded-xl cursor-pointer"
                      style={{ border: `1px solid ${BORDER}`, background: "transparent" }}
                      onClick={() => atualizarPergunta(pi, "obrigatoria", !pergunta.obrigatoria)}
                    >
                      <span className="text-xs font-medium" style={{ color: MUTED }}>Obrigatória</span>
                      <div className="relative h-5 w-9 rounded-full transition-all" style={{ background: pergunta.obrigatoria ? "linear-gradient(135deg, hsl(217 91% 60%) 0%, hsl(160 84% 55%) 100%)" : "hsl(222 33% 16%)" }}>
                        <div className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all" style={{ left: pergunta.obrigatoria ? "calc(100% - 18px)" : "2px" }} />
                      </div>
                    </div>
                  </div>
                  {(pergunta.tipo_resposta === "multipla_escolha" || pergunta.tipo_resposta === "checkbox") && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>Opções</span>
                        <button onClick={() => adicionarOpcao(pi)} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"><Plus className="w-3 h-3" /> Adicionar</button>
                      </div>
                      {pergunta.opcoes?.map((opcao, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0" />
                          <Input value={opcao} onChange={(e) => atualizarOpcao(pi, oi, e.target.value)} placeholder={`Opção ${oi + 1}`} className="h-8 rounded-lg text-sm flex-1" />
                          <button onClick={() => removerOpcao(pi, oi)} className="h-7 w-7 rounded-lg flex items-center justify-center text-rose-400 hover:bg-rose-500/10 transition-colors flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Status toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl border cursor-pointer" style={{ borderColor: BORDER, background: ELEVATED }} onClick={() => setFormData({ ...formData, ativo: !formData.ativo })}>
              <div>
                <p className="text-sm font-semibold text-white">Formulário ativo</p>
                <p className="text-xs mt-0.5" style={{ color: MUTED }}>Disponível para uso em cadências</p>
              </div>
              <div className="relative h-6 w-11 rounded-full transition-all duration-200" style={{ background: formData.ativo ? BTN_GRAD : "hsl(222 33% 16%)", boxShadow: formData.ativo ? "0 0 12px hsl(217 91% 60% / 0.4)" : "none" }}>
                <div className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200" style={{ left: formData.ativo ? "calc(100% - 22px)" : "2px" }} />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 px-7 py-5 flex-shrink-0" style={{ borderTop: `1px solid ${BORDER}`, background: "hsl(222 47% 6%)" }}>
            <BtnGhost onClick={fecharModal}>Cancelar</BtnGhost>
            <BtnPrimary onClick={handleSalvar} disabled={criarFormularioMutation.isPending || atualizarFormularioMutation.isPending}>
              {(criarFormularioMutation.isPending || atualizarFormularioMutation.isPending) ? "Salvando..." : formularioEditando ? "Atualizar" : "Criar Formulário"}
            </BtnPrimary>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal IA ── */}
      <Dialog open={modalIAAberto} onOpenChange={setModalIAAberto}>
        <DialogContent
          className="max-w-md p-0 gap-0 overflow-hidden"
          style={{ background: `linear-gradient(180deg, hsl(222 47% 8%) 0%, hsl(222 47% 6%) 100%)`, borderColor: BORDER, boxShadow: "0 32px 80px rgba(0,0,0,0.7)" }}
          aria-describedby={undefined}
        >
          <div className="relative px-7 pt-7 pb-5 overflow-hidden" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full pointer-events-none" style={{ background: "hsl(262 83% 65% / 0.12)", filter: "blur(28px)" }} />
            <div className="relative flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(262 83% 65% / 0.2) 0%, hsl(217 91% 60% / 0.2) 100%)", border: "1px solid hsl(262 83% 65% / 0.35)", boxShadow: "0 0 16px -4px hsl(262 83% 65% / 0.4)" }}>
                <Sparkles className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Criar Formulário com IA</h2>
                <p className="text-xs mt-0.5" style={{ color: MUTED }}>Gerado automaticamente com base no produto</p>
              </div>
            </div>
          </div>

          <div className="px-7 py-6 space-y-4">
            <div className="p-3 rounded-xl border" style={{ background: "hsl(262 83% 65% / 0.08)", borderColor: "hsl(262 83% 65% / 0.25)" }}>
              <p className="text-sm" style={{ color: "hsl(262 83% 85%)" }}>A IA analisa o manual do produto, conversas anteriores e cria perguntas SPIN estratégicas.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={{ color: MUTED }}>Produto <span className="text-sky-400">*</span></label>
              <Select value={formDataIA.produto_id} onValueChange={(v) => setFormDataIA({ ...formDataIA, produto_id: v })}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                <SelectContent style={darkSelectContent}>{produtos.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={{ color: MUTED }}>Tipo <span className="text-sky-400">*</span></label>
              <Select value={formDataIA.tipo} onValueChange={(v) => setFormDataIA({ ...formDataIA, tipo: v })}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent style={darkSelectContent}>{Object.entries(tipoConfig).map(([val, cfg]) => <SelectItem key={val} value={val}>{cfg.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={{ color: MUTED }}>Contexto Adicional</label>
              <Textarea value={formDataIA.contexto_adicional} onChange={(e) => setFormDataIA({ ...formDataIA, contexto_adicional: e.target.value })} placeholder="Ex: Foco em empresas B2B, perguntas sobre orçamento..." className="rounded-xl min-h-[90px] resize-none" />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 px-7 pb-6 flex-shrink-0">
            <BtnGhost onClick={fecharModalIA}>Cancelar</BtnGhost>
            <BtnPrimary onClick={gerarFormularioComIA} disabled={gerandoIA || !formDataIA.produto_id}>
              {gerandoIA ? <><Sparkles className="w-4 h-4 animate-pulse" /> Gerando...</> : <><Sparkles className="w-4 h-4" /> Gerar Formulário</>}
            </BtnPrimary>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal Visualização ── */}
      <Dialog open={modalVisualizacao} onOpenChange={setModalVisualizacao}>
        <DialogContent
          className="max-w-3xl max-h-[92vh] overflow-hidden p-0 gap-0"
          style={{ background: `linear-gradient(180deg, hsl(222 47% 8%) 0%, hsl(222 47% 6%) 100%)`, borderColor: BORDER, boxShadow: "0 32px 80px rgba(0,0,0,0.7)" }}
          aria-describedby={undefined}
        >
          <div className="relative px-7 pt-7 pb-5 overflow-hidden flex-shrink-0" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <div className="absolute -top-10 -right-10 h-36 w-36 rounded-full pointer-events-none" style={{ background: "hsl(217 91% 60% / 0.10)", filter: "blur(32px)" }} />
            <div className="relative flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(217 91% 60% / 0.2) 0%, hsl(262 83% 65% / 0.2) 100%)", border: "1px solid hsl(217 91% 60% / 0.35)", boxShadow: "0 0 20px -4px hsl(217 91% 60% / 0.4)" }}>
                <Eye className="w-5 h-5 text-sky-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-white truncate">{formularioVisualizando?.nome}</h2>
                <div className="flex items-center gap-2 mt-1">
                  {formularioVisualizando && (
                    <span className={cn("inline-flex items-center h-5 px-2 rounded-full text-[10px] font-bold border", tipoConfig[formularioVisualizando.tipo]?.color)}>
                      {tipoConfig[formularioVisualizando.tipo]?.label}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {formularioVisualizando && (
            <>
              <div className="overflow-y-auto px-7 py-6 space-y-5" style={{ maxHeight: "calc(92vh - 180px)" }}>
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Perguntas", value: formularioVisualizando.perguntas?.length || 0, color: "hsl(217 91% 60%)" },
                    { label: "Produtos", value: formularioVisualizando.produtos_vinculados?.length || 0, color: "hsl(262 83% 70%)" },
                    { label: "Status", value: formularioVisualizando.ativo ? "Ativo" : "Inativo", color: formularioVisualizando.ativo ? "hsl(160 84% 55%)" : MUTED },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl p-4 text-center" style={{ background: ELEVATED, border: `1px solid ${BORDER}` }}>
                      <p className="text-xs font-semibold mb-1" style={{ color: MUTED }}>{label}</p>
                      <p className="text-xl font-bold" style={{ color }}>{value}</p>
                    </div>
                  ))}
                </div>

                {formularioVisualizando.descricao && (
                  <div className="p-3 rounded-xl border" style={{ background: "hsl(217 91% 60% / 0.08)", borderColor: "hsl(217 91% 60% / 0.2)" }}>
                    <p className="text-sm" style={{ color: "hsl(217 91% 80%)" }}>{formularioVisualizando.descricao}</p>
                  </div>
                )}

                {formularioVisualizando.produtos_vinculados?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: MUTED }}>Produtos Vinculados</p>
                    <div className="flex flex-wrap gap-2">
                      {formularioVisualizando.produtos_vinculados.map(pid => {
                        const prod = produtos.find(p => p.id === pid);
                        return <span key={pid} className="inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold border bg-sky-500/15 text-sky-300 border-sky-500/25">{prod?.nome || pid}</span>;
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>Perguntas</p>
                  {formularioVisualizando.perguntas?.map((pergunta, i) => (
                    <div key={i} className="rounded-xl p-4" style={{ background: ELEVATED, border: `1px solid ${BORDER}` }}>
                      <div className="flex items-start gap-3">
                        <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold" style={{ background: "hsl(217 91% 60% / 0.15)", color: "hsl(217 91% 70%)" }}>{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-white font-semibold text-sm leading-snug">{pergunta.pergunta}</p>
                            {pergunta.obrigatoria && <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/25 flex-shrink-0">Obrigatória</span>}
                          </div>
                          <span className="inline-flex items-center h-5 px-2 mt-1 rounded-md text-[10px] font-semibold border" style={{ background: SURFACE, borderColor: BORDER, color: MUTED }}>{tipoResposta[pergunta.tipo_resposta]}</span>
                          {(pergunta.tipo_resposta === "multipla_escolha" || pergunta.tipo_resposta === "checkbox") && pergunta.opcoes?.length > 0 && (
                            <div className="mt-2 grid grid-cols-2 gap-1">
                              {pergunta.opcoes.map((op, oi) => (
                                <div key={oi} className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                                  <div className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0" />
                                  {op}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 px-7 py-5 flex-shrink-0" style={{ borderTop: `1px solid ${BORDER}`, background: "hsl(222 47% 6%)" }}>
                {podeGerenciar && (
                  <>
                    <BtnGhost onClick={() => { duplicarFormulario(formularioVisualizando); setModalVisualizacao(false); }}>
                      <Copy className="w-4 h-4" /> Duplicar
                    </BtnGhost>
                    <BtnPrimary onClick={() => { abrirModal(formularioVisualizando); setModalVisualizacao(false); }}>
                      <Edit className="w-4 h-4" /> Editar
                    </BtnPrimary>
                  </>
                )}
                <BtnGhost onClick={() => setModalVisualizacao(false)}>Fechar</BtnGhost>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}