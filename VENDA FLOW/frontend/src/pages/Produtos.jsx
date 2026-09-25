import { useState } from "react";
import { api } from "@/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Package, Plus, Edit, Power, Trash2, DollarSign, BookOpen, Sparkles,
  Loader2, Eye, Tag, Upload, X, FileText, Download, Share2, Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import ManualAprimoradoModal from "@/components/produtos/ManualAprimoradoModal";
import CategoriasModal from "@/components/produtos/CategoriasModal";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { usePermissions } from "@/components/hooks/usePermissions";
import InputMoeda from "@/components/ui/InputMoeda";

const PAGE_BG = "radial-gradient(1200px 600px at 20% -10%, hsl(217 91% 18% / 0.35), transparent 60%), radial-gradient(900px 500px at 100% 0%, hsl(262 83% 22% / 0.25), transparent 60%), hsl(222 47% 4%)";
const TITLE_GRAD = "linear-gradient(135deg, hsl(210 40% 98%) 0%, hsl(217 91% 75%) 60%, hsl(262 83% 75%) 100%)";
const BTN_GRAD   = "linear-gradient(135deg, hsl(217 91% 60%) 0%, hsl(262 83% 60%) 100%)";
const BTN_SHADOW = "0 8px 24px -8px hsl(217 91% 60% / 0.55), 0 0 0 1px hsl(217 91% 70% / 0.25) inset";
const BORDER     = "hsl(217 33% 17%)";
const SURFACE    = "hsl(222 47% 7%)";
const ELEVATED   = "hsl(222 40% 9%)";
const MUTED      = "hsl(215 20% 65%)";

export default function Produtos() {
  const [modalAberto, setModalAberto]         = useState(false);
  const [manualAberto, setManualAberto]       = useState(false);
  const [categoriasAberto, setCategoriasAberto] = useState(false);
  const [pdfAberto, setPdfAberto]             = useState(false);
  const [produtoEditando, setProdutoEditando] = useState(null);
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [produtoPDF, setProdutoPDF]           = useState(null);
  const [gerandoManual, setGerandoManual]     = useState(false);
  const [gerandoPDF, setGerandoPDF]           = useState(false);
  const [uploadingImage, setUploadingImage]   = useState(false);
  const [formData, setFormData] = useState({
    nome: "", descricao: "", valor: "", categoria: "",
    icp: "", anti_perfil: "", imagens: [], ativo: true,
  });

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

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ["produtos", empresaId],
    queryFn: () => api.entities.Produto.filter({ empresaId }),
    enabled: !!empresaId,
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias-produto"],
    queryFn: () => api.entities.CategoriaProduto.filter({ ativa: true }),
  });

  const { canPerformAction } = usePermissions();
  const podeGerenciar = canPerformAction("Produtos", "create");

  const criarMutation = useMutation({
    mutationFn: (data) => api.entities.Produto.create({ ...data, empresaId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["produtos"] }); toast.success("Produto criado!"); fecharModal(); },
  });

  const atualizarMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Produto.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["produtos"] }); toast.success("Produto atualizado!"); fecharModal(); },
  });

  const deletarMutation = useMutation({
    mutationFn: (id) => api.entities.Produto.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["produtos"] }); toast.success("Produto removido!"); },
  });

  const abrirModal = (produto = null) => {
    if (!podeGerenciar) { toast.error("Sem permissão para criar/editar produtos"); return; }
    if (produto) {
      setProdutoEditando(produto);
      setFormData({ nome: produto.nome, descricao: produto.descricao || "", valor: produto.valor || "", categoria: produto.categoria || "", icp: produto.icp || "", anti_perfil: produto.anti_perfil || "", imagens: produto.imagens || [], ativo: produto.ativo });
    } else {
      setProdutoEditando(null);
      setFormData({ nome: "", descricao: "", valor: "", categoria: "", icp: "", anti_perfil: "", imagens: [], ativo: true });
    }
    setModalAberto(true);
  };

  const fecharModal = () => { setModalAberto(false); setProdutoEditando(null); };

  const handleUploadImagem = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      setFormData((f) => ({ ...f, imagens: [...f.imagens, file_url] }));
      toast.success("Imagem adicionada!");
    } catch { toast.error("Erro ao enviar imagem"); }
    finally { setUploadingImage(false); }
  };

  const removerImagem = (index) =>
    setFormData((f) => ({ ...f, imagens: f.imagens.filter((_, i) => i !== index) }));

  const gerarManual = async (produto) => {
    setGerandoManual(true);
    toast.info("Gerando Manual com IA...");
    try {
      const prompt = `Você é um especialista em vendas B2B usando metodologia SPIN Selling.\n\nGere um Manual Comercial COMPLETO e PROFISSIONAL para o produto:\n\n**Nome:** ${produto.nome}\n**Categoria:** ${produto.categoria || "Não informada"}\n**Descrição:** ${produto.descricao || "Não informada"}\n**Valor:** ${produto.valor ? `R$ ${produto.valor}` : "Não informado"}\n**ICP:** ${produto.icp || "Não informado"}\n**Anti-perfil:** ${produto.anti_perfil || "Não informado"}\n\nEstrutura em Markdown com seções: Visão Geral, SPIN (Situação/Problema/Implicação/Necessidade), Benefícios, Diferenciais, Objeções e Respostas, Papel SDR, Papel Closer, Scripts Base, Checklist. Seja detalhado e profissional.`;
      const response = await api.integrations.Core.InvokeLLM({ prompt });
      const perguntas = await api.integrations.Core.InvokeLLM({
        prompt: `Baseado no manual abaixo, extraia APENAS as perguntas SPIN em JSON:\n${response}`,
        response_json_schema: { type: "object", properties: { situacao: { type: "array", items: { type: "string" } }, problema: { type: "array", items: { type: "string" } }, implicacao: { type: "array", items: { type: "string" } }, necessidade: { type: "array", items: { type: "string" } } } }
      });
      const quizData = await api.integrations.Core.InvokeLLM({
        prompt: `Baseado no manual, crie 10 perguntas de múltipla escolha em JSON:\n${response}`,
        response_json_schema: { type: "object", properties: { quiz: { type: "array", items: { type: "object", properties: { pergunta: { type: "string" }, opcoes: { type: "array", items: { type: "string" } }, resposta_correta: { type: "number" } } } } } }
      });
      await atualizarMutation.mutateAsync({ id: produto.id, data: { ...produto, manual: { gerado: true, data_geracao: new Date().toISOString(), conteudo: response, perguntas_spin: perguntas, quiz_avaliacao: quizData.quiz } } });
      toast.success("Manual gerado com sucesso!");
    } catch { toast.error("Erro ao gerar manual."); }
    finally { setGerandoManual(false); }
  };

  const handleSalvar = async () => {
    const dados = { ...formData, valor: formData.valor || undefined };
    if (produtoEditando) {
      atualizarMutation.mutate({ id: produtoEditando.id, data: dados });
    } else {
      const novo = await criarMutation.mutateAsync(dados);
      if (novo) gerarManual(novo);
    }
  };

  const toggleAtivo = (produto) => {
    if (!podeGerenciar) { toast.error("Sem permissão"); return; }
    atualizarMutation.mutate({ id: produto.id, data: { ...produto, ativo: !produto.ativo } });
  };

  const baixarPDF = async () => {
    if (!produtoPDF) return;
    setGerandoPDF(true);
    toast.info("Gerando PDF...");
    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;
      const elemento = document.getElementById('pdf-preview-content');
      if (!elemento) return;
      const canvas = await html2canvas(elemento, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const imgWidth = 210, pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight, position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft >= 0) { position = heightLeft - imgHeight; pdf.addPage(); pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight); heightLeft -= pageHeight; }
      pdf.save(`${produtoPDF.nome.replace(/\s+/g, '_')}_Manual.pdf`);
      toast.success("PDF baixado!");
    } catch { toast.error("Erro ao gerar PDF"); }
    finally { setGerandoPDF(false); }
  };

  const produtosAtivos   = produtos.filter((p) => p.ativo).length;
  const produtosInativos = produtos.filter((p) => !p.ativo).length;

  return (
    <div className="min-h-screen font-sans text-white" style={{ background: PAGE_BG }}>
      <div className="px-6 lg:px-10 py-8 max-w-[1400px] mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight bg-clip-text text-transparent" style={{ backgroundImage: TITLE_GRAD }}>
              Produtos
            </h1>
            <p className="mt-2 text-sm" style={{ color: MUTED }}>
              {produtos.length} produtos cadastrados ({produtosAtivos} ativos)
            </p>
          </div>
          {podeGerenciar && (
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => setCategoriasAberto(true)}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold transition-all duration-200 border"
                style={{ color: MUTED, borderColor: BORDER, background: `${ELEVATED}99` }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "white"; e.currentTarget.style.borderColor = "hsl(217 91% 60% / 0.4)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = MUTED; e.currentTarget.style.borderColor = BORDER; }}
              >
                <Tag className="w-4 h-4" /> Categorias
              </button>
              <button
                onClick={() => abrirModal()}
                className="inline-flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
                style={{ background: BTN_GRAD, boxShadow: BTN_SHADOW }}
              >
                <Plus className="w-4 h-4" /> Novo Produto
              </button>
            </div>
          )}
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: "Produtos Ativos", value: produtosAtivos, color: "emerald" },
            { label: "Produtos Inativos", value: produtosInativos, color: "slate" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl border p-5 flex items-center justify-between" style={{ borderColor: BORDER, background: `${SURFACE}cc`, boxShadow: "0 1px 0 hsl(0 0% 100% / 0.04) inset" }}>
              <div>
                <p className="text-sm" style={{ color: MUTED }}>{label}</p>
                <p className="text-3xl font-bold text-white mt-1">{value}</p>
              </div>
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${color === "emerald" ? "bg-emerald-500/15 border border-emerald-500/30" : "bg-slate-500/15 border border-slate-500/30"}`}>
                <Package className={`w-6 h-6 ${color === "emerald" ? "text-emerald-400" : "text-slate-400"}`} />
              </div>
            </div>
          ))}
        </div>

        {/* ── Info Banner ── */}
        <div className="rounded-2xl border p-4 flex items-start gap-3" style={{ borderColor: "hsl(217 91% 60% / 0.25)", background: "hsl(217 91% 60% / 0.06)" }}>
          <Info className="w-5 h-5 text-sky-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-sky-300">Manual Comercial com IA + SPIN Selling</p>
            <p className="text-sm mt-0.5" style={{ color: MUTED }}>
              Cada produto possui um manual completo gerado automaticamente com scripts, objeções e perguntas SPIN para SDR e Closer.
              {!podeGerenciar && " Você pode visualizar o manual, mas só gestores podem editar produtos."}
            </p>
          </div>
        </div>

        {/* ── Grid de Produtos ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {produtos.map((produto) => (
              <motion.div key={produto.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <div
                  className="group rounded-2xl border flex flex-col transition-all duration-300 hover:-translate-y-0.5"
                  style={{
                    borderColor: BORDER,
                    background: `${SURFACE}cc`,
                    boxShadow: "0 1px 0 hsl(0 0% 100% / 0.04) inset, 0 10px 30px -12px hsl(0 0% 0% / 0.6)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "hsl(217 91% 60% / 0.45)"; e.currentTarget.style.boxShadow = "0 1px 0 hsl(0 0% 100% / 0.06) inset, 0 20px 40px -14px hsl(0 0% 0% / 0.7)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.boxShadow = "0 1px 0 hsl(0 0% 100% / 0.04) inset, 0 10px 30px -12px hsl(0 0% 0% / 0.6)"; }}
                >
                  <div className="p-5 flex-1 space-y-4">
                    {/* Top */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center flex-shrink-0">
                          <Package className="w-5 h-5 text-sky-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate">{produto.nome}</p>
                          {produto.categoria && <p className="text-xs mt-0.5 truncate" style={{ color: MUTED }}>{produto.categoria}</p>}
                        </div>
                      </div>
                      <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-semibold border flex-shrink-0 ${produto.ativo ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-slate-500/15 text-slate-400 border-slate-500/20"}`}>
                        {produto.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </div>

                    {produto.descricao && (
                      <p className="text-sm line-clamp-2" style={{ color: MUTED }}>{produto.descricao}</p>
                    )}

                    {produto.valor && (
                      <div className="flex items-center gap-1.5" style={{ color: MUTED }}>
                        <DollarSign className="w-4 h-4" />
                        <span className="font-semibold text-white">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(produto.valor)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="px-5 pb-5 space-y-2">
                    {produto.manual?.gerado && (
                      <>
                        <button
                          onClick={() => { setProdutoSelecionado(produto); setManualAberto(true); }}
                          className="w-full h-9 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:brightness-110"
                          style={{ background: "linear-gradient(135deg, hsl(25 95% 55%) 0%, hsl(38 92% 60%) 100%)", boxShadow: "0 4px 14px -4px hsl(25 95% 55% / 0.5)" }}
                        >
                          <BookOpen className="w-4 h-4" /> Ver Manual
                        </button>
                        <button
                          onClick={() => { setProdutoPDF(produto); setPdfAberto(true); }}
                          className="w-full h-9 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:brightness-110"
                          style={{ background: BTN_GRAD, boxShadow: "0 4px 14px -4px hsl(217 91% 60% / 0.5)" }}
                        >
                          <FileText className="w-4 h-4" /> Visualizar PDF
                        </button>
                      </>
                    )}

                    {podeGerenciar && !produto.manual?.gerado && (
                      <button
                        onClick={() => gerarManual(produto)}
                        disabled={gerandoManual}
                        className="w-full h-9 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 border transition-all hover:brightness-110 disabled:opacity-50"
                        style={{ background: "hsl(262 83% 60% / 0.12)", borderColor: "hsl(262 83% 60% / 0.30)", color: "hsl(262 83% 85%)" }}
                      >
                        {gerandoManual ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</> : <><Sparkles className="w-4 h-4" /> Gerar Manual com IA</>}
                      </button>
                    )}

                    {!podeGerenciar && produto.manual?.gerado && (
                      <button onClick={() => { setProdutoSelecionado(produto); setManualAberto(true); }} className="w-full h-9 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 border transition-all" style={{ borderColor: BORDER, color: MUTED, background: `${ELEVATED}99` }}>
                        <Eye className="w-4 h-4" /> Visualizar
                      </button>
                    )}

                    {podeGerenciar && (
                      <div className="flex gap-1.5 pt-1 border-t" style={{ borderColor: BORDER }}>
                        <button onClick={() => abrirModal(produto)} className="flex-1 h-8 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1" style={{ color: MUTED }} onMouseEnter={(e) => { e.currentTarget.style.color = "white"; e.currentTarget.style.background = ELEVATED; }} onMouseLeave={(e) => { e.currentTarget.style.color = MUTED; e.currentTarget.style.background = ""; }}>
                          <Edit className="w-3.5 h-3.5" /> Editar
                        </button>
                        <button onClick={() => toggleAtivo(produto)} className="flex-1 h-8 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1" style={{ color: MUTED }} onMouseEnter={(e) => { e.currentTarget.style.color = "white"; e.currentTarget.style.background = ELEVATED; }} onMouseLeave={(e) => { e.currentTarget.style.color = MUTED; e.currentTarget.style.background = ""; }}>
                          <Power className="w-3.5 h-3.5" /> {produto.ativo ? "Desativar" : "Ativar"}
                        </button>
                        <button onClick={() => { if (confirm("Remover este produto?")) deletarMutation.mutate(produto.id); }} className="h-8 w-8 rounded-lg text-rose-400 flex items-center justify-center transition-colors hover:text-rose-300 hover:bg-rose-500/10">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Empty State */}
        {produtos.length === 0 && !isLoading && (
          <div className="rounded-2xl border py-16 flex flex-col items-center justify-center text-center" style={{ borderColor: BORDER, background: `${SURFACE}80` }}>
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center mb-5 border" style={{ background: ELEVATED, borderColor: BORDER, boxShadow: "0 0 0 1px hsl(217 91% 60% / 0.2), 0 8px 30px -8px hsl(217 91% 60% / 0.3)" }}>
              <Package className="w-7 h-7 text-sky-400" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Nenhum produto cadastrado</h3>
            <p className="text-sm mb-6" style={{ color: MUTED }}>Crie seu primeiro produto para começar.</p>
            <button onClick={() => abrirModal()} className="inline-flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-semibold text-white hover:brightness-110 transition-all" style={{ background: BTN_GRAD, boxShadow: BTN_SHADOW }}>
              <Plus className="w-4 h-4" /> Criar Produto
            </button>
          </div>
        )}
      </div>

      {/* ── Modal Criar/Editar ── */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent
          className="max-w-2xl max-h-[92vh] overflow-hidden p-0 gap-0"
          style={{
            background: "linear-gradient(180deg, hsl(222 47% 8%) 0%, hsl(222 47% 6%) 100%)",
            borderColor: BORDER,
            boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px hsl(0 0% 100% / 0.05) inset",
          }}
        >
          {/* Modal Header */}
          <div
            className="relative px-7 pt-7 pb-6 overflow-hidden flex-shrink-0"
            style={{ borderBottom: `1px solid ${BORDER}` }}
          >
            {/* Glow orb */}
            <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full pointer-events-none" style={{ background: "hsl(217 91% 60% / 0.12)", filter: "blur(32px)" }} />
            <div className="relative flex items-center gap-4">
              <div
                className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: "linear-gradient(135deg, hsl(217 91% 60% / 0.2) 0%, hsl(262 83% 60% / 0.2) 100%)",
                  border: "1px solid hsl(217 91% 60% / 0.35)",
                  boxShadow: "0 0 20px -4px hsl(217 91% 60% / 0.4)",
                }}
              >
                <Package className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {produtoEditando ? "Editar Produto" : "Novo Produto"}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                  {produtoEditando ? "Atualize as informações do produto" : "Preencha os dados para criar e gerar o manual com IA"}
                </p>
              </div>
            </div>
          </div>

          {/* Modal Body */}
          <div className="overflow-y-auto px-7 py-6 space-y-5" style={{ maxHeight: "calc(92vh - 160px)" }}>

            {/* Seção: Informações Básicas */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "hsl(217 91% 70%)" }}>Informações Básicas</span>
                <div className="flex-1 h-px" style={{ background: "hsl(217 91% 60% / 0.2)" }} />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: MUTED }}>Nome do Produto <span className="text-sky-400">*</span></label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Plano Premium"
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: MUTED }}>Descrição</label>
                <Textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Descreva o produto..."
                  className="rounded-xl min-h-[80px] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: MUTED }}>Valor (R$)</label>
                  <InputMoeda value={formData.valor} onChange={(v) => setFormData({ ...formData, valor: v })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: MUTED }}>Categoria <span className="text-sky-400">*</span></label>
                  <Select value={formData.categoria} onValueChange={(v) => setFormData({ ...formData, categoria: v })}>
                    <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent
                      style={{
                        background: "hsl(222 47% 8%)",
                        border: "1px solid hsl(217 33% 17%)",
                        borderRadius: "12px",
                        boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                      }}
                    >
                      {categorias.map((cat) => <SelectItem key={cat.id} value={cat.nome}>{cat.nome}</SelectItem>)}
                      {categorias.length === 0 && <div className="p-2 text-center text-sm" style={{ color: MUTED }}>Nenhuma categoria</div>}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Seção: Perfil Comercial */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "hsl(160 84% 55%)" }}>Perfil Comercial</span>
                <div className="flex-1 h-px" style={{ background: "hsl(160 84% 55% / 0.2)" }} />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: MUTED }}>ICP — Perfil do Cliente Ideal</label>
                <Textarea
                  value={formData.icp}
                  onChange={(e) => setFormData({ ...formData, icp: e.target.value })}
                  placeholder="Ex: Empresas B2B com 50-500 funcionários, faturamento 5-50M..."
                  className="rounded-xl min-h-[70px] resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold" style={{ color: MUTED }}>Anti-perfil</label>
                  <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold border bg-rose-500/10 text-rose-300 border-rose-500/25">Para quem NÃO é</span>
                </div>
                <Textarea
                  value={formData.anti_perfil}
                  onChange={(e) => setFormData({ ...formData, anti_perfil: e.target.value })}
                  placeholder="Ex: Empresas B2C, freelancers individuais..."
                  className="rounded-xl min-h-[70px] resize-none"
                />
              </div>
            </div>

            {/* Seção: Imagens */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "hsl(262 83% 75%)" }}>Imagens</span>
                <div className="flex-1 h-px" style={{ background: "hsl(262 83% 60% / 0.2)" }} />
              </div>

              {formData.imagens.map((img, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl border" style={{ borderColor: BORDER, background: ELEVATED }}>
                  <img src={img} alt="" className="w-10 h-10 object-cover rounded-lg flex-shrink-0" />
                  <p className="text-xs flex-1 truncate" style={{ color: MUTED }}>{img}</p>
                  <button onClick={() => removerImagem(i)} className="h-7 w-7 rounded-lg flex items-center justify-center text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <input type="file" accept="image/*" onChange={handleUploadImagem} className="hidden" id="upload-img-produto" />
              <button
                type="button"
                disabled={uploadingImage}
                onClick={() => document.getElementById('upload-img-produto').click()}
                className="w-full h-10 rounded-xl text-sm font-medium border flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{ borderColor: "hsl(262 83% 60% / 0.35)", color: "hsl(262 83% 80%)", background: "hsl(262 83% 60% / 0.08)" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "hsl(262 83% 60% / 0.14)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "hsl(262 83% 60% / 0.08)"}
              >
                {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Adicionar Imagem
              </button>
            </div>

            {/* Status toggle */}
            <div
              className="flex items-center justify-between p-4 rounded-xl border cursor-pointer"
              style={{ borderColor: BORDER, background: ELEVATED }}
              onClick={() => setFormData({ ...formData, ativo: !formData.ativo })}
            >
              <div>
                <p className="text-sm font-semibold text-white">Produto ativo</p>
                <p className="text-xs mt-0.5" style={{ color: MUTED }}>Disponível para seleção em cadências e tarefas</p>
              </div>
              <div
                className="relative h-6 w-11 rounded-full transition-all duration-200 flex-shrink-0"
                style={{
                  background: formData.ativo
                    ? "linear-gradient(135deg, hsl(217 91% 60%) 0%, hsl(160 84% 55%) 100%)"
                    : "hsl(222 33% 16%)",
                  boxShadow: formData.ativo ? "0 0 12px hsl(217 91% 60% / 0.4)" : "none",
                }}
              >
                <div
                  className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200"
                  style={{ left: formData.ativo ? "calc(100% - 22px)" : "2px" }}
                />
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div
            className="flex items-center justify-between px-7 py-5 flex-shrink-0"
            style={{ borderTop: `1px solid ${BORDER}`, background: "hsl(222 47% 6%)" }}
          >
            <div className="flex items-center gap-2">
              {!produtoEditando && (
                <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[10px] font-semibold border bg-violet-500/10 text-violet-300 border-violet-500/25">
                  <Sparkles className="w-3 h-3" /> Manual IA gerado automaticamente
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={fecharModal}
                className="h-9 px-4 rounded-xl text-sm font-medium transition-all border"
                style={{ color: MUTED, borderColor: BORDER, background: "transparent" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "white"; e.currentTarget.style.background = ELEVATED; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = MUTED; e.currentTarget.style.background = "transparent"; }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                disabled={!formData.nome || !formData.categoria}
                className="h-9 px-5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
                style={{ background: BTN_GRAD, boxShadow: BTN_SHADOW }}
              >
                {produtoEditando ? "Atualizar Produto" : "Criar e Gerar Manual"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ManualAprimoradoModal open={manualAberto} onClose={() => { setManualAberto(false); setProdutoSelecionado(null); }} produto={produtoSelecionado} />
      <CategoriasModal open={categoriasAberto} onClose={() => setCategoriasAberto(false)} />

      {/* ── Modal PDF ── */}
      <Dialog open={pdfAberto} onOpenChange={setPdfAberto}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] max-h-[95vh] p-0 overflow-hidden" style={{ background: "hsl(222 47% 7%)", borderColor: BORDER }}>
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: BORDER }}>
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-sky-400" />
                <div>
                  <h2 className="font-bold text-white">{produtoPDF?.nome}</h2>
                  <p className="text-xs" style={{ color: MUTED }}>Visualização em PDF</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={baixarPDF} disabled={gerandoPDF} className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50" style={{ background: BTN_GRAD, boxShadow: BTN_SHADOW }}>
                  {gerandoPDF ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</> : <><Download className="w-4 h-4" /> Baixar PDF</>}
                </button>
                <button onClick={() => { if (produtoPDF) { navigator.clipboard.writeText(`${produtoPDF.nome}\n${produtoPDF.descricao || ''}`); toast.success("Copiado!"); } }} className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold border transition-all" style={{ borderColor: BORDER, color: MUTED }}>
                  <Share2 className="w-4 h-4" /> Compartilhar
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-8" style={{ background: "hsl(222 47% 4%)" }}>
              <div className="max-w-4xl mx-auto">
                <div id="pdf-preview-content" className="bg-white p-12 rounded-2xl shadow-2xl">
                  {produtoPDF && (
                    <div className="space-y-8">
                      <div className="border-b-4 border-blue-600 pb-6">
                        {produtoPDF.imagens?.[0] && <img src={produtoPDF.imagens[0]} alt={produtoPDF.nome} className="w-full h-48 object-cover rounded-lg mb-6" />}
                        <h1 className="text-4xl font-bold text-gray-900 mb-2">{produtoPDF.nome}</h1>
                        {produtoPDF.categoria && <div className="inline-block px-4 py-2 bg-blue-100 text-blue-800 rounded-lg font-medium">{produtoPDF.categoria}</div>}
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="bg-blue-50 p-6 rounded-lg">
                          <h3 className="text-sm font-semibold text-blue-900 mb-2">VALOR</h3>
                          {produtoPDF.valor ? <p className="text-3xl font-bold text-blue-600">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(produtoPDF.valor)}</p> : <p className="text-lg text-gray-500">Sob consulta</p>}
                        </div>
                        <div className="bg-green-50 p-6 rounded-lg">
                          <h3 className="text-sm font-semibold text-green-900 mb-2">STATUS</h3>
                          <p className="text-2xl font-bold text-green-600">{produtoPDF.ativo ? "✓ Disponível" : "Indisponível"}</p>
                        </div>
                      </div>
                      {produtoPDF.descricao && <div className="bg-gray-50 p-6 rounded-lg"><h2 className="text-xl font-bold text-gray-900 mb-3">Descrição</h2><p className="text-gray-700 leading-relaxed">{produtoPDF.descricao}</p></div>}
                      <div className="grid grid-cols-2 gap-6">
                        {produtoPDF.icp && <div className="bg-emerald-50 p-6 rounded-lg"><h3 className="text-lg font-bold text-emerald-900 mb-3">🎯 Perfil Ideal (ICP)</h3><p className="text-gray-700">{produtoPDF.icp}</p></div>}
                        {produtoPDF.anti_perfil && <div className="bg-rose-50 p-6 rounded-lg"><h3 className="text-lg font-bold text-rose-900 mb-3">⚠️ Para Quem NÃO É</h3><p className="text-gray-700">{produtoPDF.anti_perfil}</p></div>}
                      </div>
                      {produtoPDF.manual?.conteudo && <div className="border-t-4 border-blue-600 pt-8"><h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2"><BookOpen className="w-6 h-6 text-blue-600" /> Manual Comercial</h2><div className="text-gray-700 whitespace-pre-wrap leading-relaxed">{produtoPDF.manual.conteudo}</div></div>}
                      {produtoPDF.imagens && produtoPDF.imagens.length > 1 && (
                        <div className="border-t-4 border-blue-600 pt-8">
                          <h2 className="text-2xl font-bold text-gray-900 mb-6">Galeria</h2>
                          <div className="grid grid-cols-3 gap-4">{produtoPDF.imagens.slice(1).map((img, i) => <img key={i} src={img} alt="" className="w-full h-40 object-cover rounded-lg shadow-md" />)}</div>
                        </div>
                      )}
                      <div className="border-t-2 border-gray-200 pt-6 text-center text-sm text-gray-500">
                        <p>Gerado em {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}