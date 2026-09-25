import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import {
  Plus, MoreVertical, Phone, MessageCircle, Mail, Trash2, Edit2,
  Copy, FileText, Package, DollarSign, Instagram, ChevronDown, Loader2, ClipboardCopy, Check,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import ScriptModal from "@/components/crm/ScriptModal";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const tipoConfig = {
  ligacao:         { icon: Phone,          label: "Ligação",          badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
  whatsapp:        { icon: MessageCircle,  label: "WhatsApp",         badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 shadow-[0_0_0_1px_hsl(160_84%_45%/0.15),0_4px_12px_-4px_hsl(160_84%_45%/0.4)]" },
  email:           { icon: Mail,           label: "E-mail",           badge: "bg-sky-500/10 text-sky-300 border-sky-500/30" },
  enviar_contrato: { icon: FileText,       label: "Contrato",         badge: "bg-violet-500/10 text-violet-300 border-violet-500/30" },
  recebimento:     { icon: DollarSign,     label: "Recebimento",      badge: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
  instagram:       { icon: Instagram,      label: "Instagram",        badge: "bg-rose-500/10 text-rose-300 border-rose-500/30" },
};

const TABS = [
  { key: "todos",          label: "Todos",      icon: null },
  { key: "ligacao",        label: "Ligação",    icon: Phone },
  { key: "whatsapp",       label: "WhatsApp",   icon: MessageCircle },
  { key: "email",          label: "E-mail",     icon: Mail },
  { key: "enviar_contrato",label: "Contrato",   icon: FileText },
  { key: "recebimento",    label: "Recebimento",icon: DollarSign },
  { key: "instagram",      label: "Instagram",  icon: Instagram },
];

export default function Scripts() {
  const [modalAberto, setModalAberto]       = useState(false);
  const [scriptEditando, setScriptEditando] = useState(null);
  const [tipoFiltro, setTipoFiltro]         = useState("todos");
  const [produtoFiltro, setProdutoFiltro]   = useState("todos");
  const [copiadoId, setCopiadoId]           = useState(null);

  const handleCopiar = (script) => {
    navigator.clipboard.writeText(script.conteudo || "");
    setCopiadoId(script.id);
    toast.success("Conteúdo copiado!", { duration: 2000 });
    setTimeout(() => setCopiadoId(null), 2000);
  };

  const queryClient = useQueryClient();
  const { empresaId } = useEmpresaAtual();

  const { data: scripts = [], isLoading } = useQuery({
    queryKey: ["scripts", empresaId],
    queryFn: () => empresaId ? base44.entities.Script.filter({ empresaId }) : [],
    enabled: !!empresaId,
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos", empresaId],
    queryFn: () => empresaId ? base44.entities.Produto.filter({ empresaId }) : [],
    enabled: !!empresaId,
  });

  const criarMutation = useMutation({
    mutationFn: (data) => base44.entities.Script.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["scripts"] }); toast.success("Script criado!"); },
  });

  const atualizarMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Script.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["scripts"] }); toast.success("Script atualizado!"); },
  });

  const deletarMutation = useMutation({
    mutationFn: (id) => base44.entities.Script.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["scripts"] }); toast.success("Script excluído!"); },
  });

  const handleSalvar = async (dados) => {
    if (scriptEditando) {
      await atualizarMutation.mutateAsync({ id: scriptEditando.id, data: dados });
    } else {
      await criarMutation.mutateAsync({ ...dados, empresaId });
    }
  };

  const handleDuplicar = async (script) => {
    await criarMutation.mutateAsync({
      empresaId,
      nome: `${script.nome} (cópia)`,
      tipo: script.tipo,
      conteudo: script.conteudo,
      ordem: (script.ordem || 0) + 1,
      ativo: true,
      produto_id: script.produto_id,
      produto_nome: script.produto_nome,
    });
  };

  const scriptsFiltrados = scripts
    .filter((s) => {
      const tipoOk = tipoFiltro === "todos" || s.tipo === tipoFiltro;
      const produtoOk = produtoFiltro === "todos" || s.produto_id === produtoFiltro;
      return tipoOk && produtoOk;
    })
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

  const count = (key) => key === "todos" ? scripts.length : scripts.filter((s) => s.tipo === key).length;

  return (
    <div
      className="min-h-screen font-sans text-white"
      style={{
        background: "radial-gradient(1200px 600px at 20% -10%, hsl(217 91% 18% / 0.35), transparent 60%), radial-gradient(900px 500px at 100% 0%, hsl(262 83% 22% / 0.25), transparent 60%), hsl(222 47% 4%)",
      }}
    >
      <div className="px-6 lg:px-10 py-8 max-w-[1400px] mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1
              className="text-3xl lg:text-4xl font-bold tracking-tight bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, hsl(210 40% 98%) 0%, hsl(217 91% 75%) 60%, hsl(262 83% 75%) 100%)" }}
            >
              Scripts & Mensagens
            </h1>
            <p className="mt-2 text-sm" style={{ color: "hsl(215 20% 65%)" }}>
              Gerencie scripts de ligação e templates de mensagens
            </p>
          </div>
          <button
            onClick={() => { setScriptEditando(null); setModalAberto(true); }}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98] flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, hsl(217 91% 60%) 0%, hsl(262 83% 60%) 100%)",
              boxShadow: "0 8px 24px -8px hsl(217 91% 60% / 0.55), 0 0 0 1px hsl(217 91% 70% / 0.25) inset",
            }}
          >
            <Plus className="w-4 h-4" />
            Novo Script
          </button>
        </div>

        {/* ── Filtros / Tabs ── */}
        <div className="flex flex-wrap items-center gap-2">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tipoFiltro === key;
            return (
              <button
                key={key}
                onClick={() => setTipoFiltro(key)}
                className={cn(
                  "inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-xs font-semibold transition-all duration-200 border",
                  active
                    ? "text-white border-transparent"
                    : "text-[hsl(215_20%_65%)] border-[hsl(217_33%_17%)] bg-[hsl(222_40%_9%/0.6)] hover:bg-[hsl(222_40%_11%)] hover:text-white hover:border-[hsl(217_91%_60%/0.4)]"
                )}
                style={active ? {
                  background: "linear-gradient(135deg, hsl(217 91% 60%) 0%, hsl(199 89% 55%) 100%)",
                  boxShadow: "0 0 0 1px hsl(217 91% 60% / 0.4), 0 8px 30px -8px hsl(217 91% 60% / 0.45)",
                } : {}}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {label}
                <span className={cn(
                  "ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold",
                  active ? "bg-white/20" : "bg-[hsl(222_40%_14%)] text-[hsl(215_16%_47%)]"
                )}>
                  {count(key)}
                </span>
              </button>
            );
          })}

          {/* Produto select */}
          <div className="ml-auto">
            <Select value={produtoFiltro} onValueChange={setProdutoFiltro}>
              <SelectTrigger
                className="h-9 px-4 rounded-xl text-xs font-semibold border text-white w-44"
                style={{
                  background: "hsl(222 40% 9% / 0.6)",
                  borderColor: "hsl(217 33% 17%)",
                }}
              >
                <SelectValue placeholder="Todos os produtos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os produtos</SelectItem>
                {produtos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Tabela ── */}
        <div
          className="rounded-2xl border overflow-hidden"
          style={{
            borderColor: "hsl(217 33% 17%)",
            background: "hsl(222 47% 7% / 0.8)",
            backdropFilter: "blur(12px)",
            boxShadow: "0 1px 0 hsl(0 0% 100% / 0.04) inset, 0 10px 30px -12px hsl(0 0% 0% / 0.6)",
          }}
        >
          {/* Table Head */}
          <div
            className="grid items-center px-6 h-12 border-b"
            style={{
              gridTemplateColumns: "1.4fr 0.8fr 0.7fr 2fr 60px",
              background: "linear-gradient(180deg, hsl(222 40% 11%) 0%, hsl(222 40% 9%) 100%)",
              borderColor: "hsl(217 33% 17%)",
            }}
          >
            {["Nome", "Tipo", "Produto", "Conteúdo", "Ações"].map((col) => (
              <span key={col} className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "hsl(215 20% 65%)" }}>
                {col}
              </span>
            ))}
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-sky-400 animate-spin" />
            </div>
          )}

          {/* Rows */}
          {!isLoading && scriptsFiltrados.map((script, idx) => {
            const config = tipoConfig[script.tipo] || tipoConfig.ligacao;
            const Icon = config.icon;
            return (
              <div
                key={script.id}
                className="group grid items-center px-6 h-16 border-b last:border-b-0 transition-colors duration-200"
                style={{
                  gridTemplateColumns: "1.4fr 0.8fr 0.7fr 2fr 60px",
                  borderColor: "hsl(217 33% 14%)",
                  animationDelay: `${idx * 40}ms`,
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "linear-gradient(90deg, hsl(217 91% 60% / 0.06) 0%, transparent 100%)"}
                onMouseLeave={(e) => e.currentTarget.style.background = ""}
              >
                <span className="text-sm font-semibold text-white truncate pr-4">{script.nome}</span>

                <div>
                  <span className={cn("inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold border", config.badge)}>
                    <Icon className="w-3 h-3" />
                    {config.label}
                  </span>
                </div>

                <div>
                  {script.produto_nome ? (
                    <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold border bg-violet-500/10 text-violet-300 border-violet-500/30">
                      <Package className="w-3 h-3" />
                      {script.produto_nome}
                    </span>
                  ) : (
                    <span className="text-sm" style={{ color: "hsl(215 16% 47%)" }}>—</span>
                  )}
                </div>

                <div className="flex items-center gap-2 pr-2 min-w-0">
                  <p className="text-sm truncate flex-1" style={{ color: "hsl(215 20% 65%)" }}>
                    {script.conteudo}
                  </p>
                  <button
                    onClick={() => handleCopiar(script)}
                    title="Copiar conteúdo"
                    className="flex-shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-[12px] transition-all duration-200 opacity-0 group-hover:opacity-100 active:scale-90"
                    style={{
                      background: copiadoId === script.id
                        ? "linear-gradient(135deg, #059669, #10b981)"
                        : "#0f0f0f",
                      boxShadow: copiadoId === script.id
                        ? "0 0 14px rgba(16,185,129,0.5)"
                        : "0 2px 10px rgba(0,0,0,0.6)",
                    }}
                  >
                    {copiadoId === script.id
                      ? <Check className="w-4 h-4 text-white" />
                      : <Copy className="w-4 h-4 text-white" />
                    }
                  </button>
                </div>

                <div className="flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg transition-colors"
                        style={{ color: "hsl(215 20% 65%)" }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "white"; e.currentTarget.style.background = "hsl(222 40% 11%)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "hsl(215 20% 65%)"; e.currentTarget.style.background = ""; }}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setScriptEditando(script); setModalAberto(true); }}>
                        <Edit2 className="w-4 h-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicar(script)}>
                        <Copy className="w-4 h-4 mr-2" /> Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => deletarMutation.mutate(script.id)}
                        className="text-rose-400 focus:text-rose-300"
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}

          {/* Empty State */}
          {!isLoading && scriptsFiltrados.length === 0 && (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <div
                className="h-16 w-16 rounded-2xl flex items-center justify-center mb-5 border"
                style={{
                  background: "hsl(222 40% 9%)",
                  borderColor: "hsl(217 33% 17%)",
                  boxShadow: "0 0 0 1px hsl(217 91% 60% / 0.2), 0 8px 30px -8px hsl(217 91% 60% / 0.3)",
                }}
              >
                <FileText className="w-7 h-7 text-sky-400" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">Nenhum script encontrado</h3>
              <p className="text-sm mb-6" style={{ color: "hsl(215 20% 65%)" }}>
                {tipoFiltro === "todos" ? "Crie seu primeiro script para começar" : `Nenhum script de ${tipoConfig[tipoFiltro]?.label} criado.`}
              </p>
              <button
                onClick={() => { setScriptEditando(null); setModalAberto(true); }}
                className="inline-flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:brightness-110"
                style={{
                  background: "linear-gradient(135deg, hsl(217 91% 60%) 0%, hsl(262 83% 60%) 100%)",
                  boxShadow: "0 8px 24px -8px hsl(217 91% 60% / 0.55)",
                }}
              >
                <Plus className="w-4 h-4" />
                Criar Script
              </button>
            </div>
          )}
        </div>
      </div>

      <ScriptModal
        open={modalAberto}
        onClose={() => { setModalAberto(false); setScriptEditando(null); }}
        script={scriptEditando}
        onSave={handleSalvar}
      />
    </div>
  );
}