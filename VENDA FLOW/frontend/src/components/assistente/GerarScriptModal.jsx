import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { criarScript } from "@/lib/services/scriptService";
import { api } from "@/api/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bot, Sparkles, Save, Edit } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

export default function GerarScriptModal({ open, onClose, lead }) {
  const [gerando, setGerando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [scriptGerado, setScriptGerado] = useState(null);
  const [scriptEditado, setScriptEditado] = useState("");
  const [tipoScript, setTipoScript] = useState("ligacao");
  const [produtoId, setProdutoId] = useState(lead?.produto_interesse || "");

  const queryClient = useQueryClient();

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos"],
    queryFn: () => api.entities.Produto.filter({ ativo: true }),
  });

  const salvarScriptMutation = useMutation({
    mutationFn: (data) => criarScript(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scripts"] });
      toast.success("✅ Script salvo com sucesso!");
      onClose();
    },
  });

  const gerarScript = async () => {
    if (!produtoId) {
      toast.error("Selecione um produto");
      return;
    }

    setGerando(true);
    try {
      const produto = produtos.find(p => p.id === produtoId);
      
      const prompt = `
Crie um script ${tipoScript === "ligacao" ? "de ligação" : tipoScript === "whatsapp" ? "de WhatsApp" : "de e-mail"} personalizado usando SPIN Selling.

**CONTEXTO DO LEAD:**
- Nome: ${lead.nome}
- Empresa: ${lead.empresa || "Não informado"}
- Cargo: ${lead.cargo || "Não informado"}
- Origem: ${lead.origem}

**PRODUTO:**
- Nome: ${produto.nome}
- Descrição: ${produto.descricao}
${produto.icp ? `- ICP (Cliente Ideal): ${produto.icp}` : ""}
${produto.anti_perfil ? `- Anti-perfil: ${produto.anti_perfil}` : ""}

**INSTRUÇÕES:**
1. Adapte o script ao perfil do lead e características do produto
2. Use a metodologia SPIN (Situação, Problema, Implicação, Necessidade)
3. Seja natural, profissional e direto
4. Inclua perguntas abertas de qualificação
5. Antecipe objeções comuns do segmento
6. Conecte as dores do lead aos benefícios do produto

Retorne APENAS o texto do script, sem formatação adicional.
      `;

      const response = await api.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: false,
      });

      setScriptGerado(response);
      setScriptEditado(response);
      toast.success("Script gerado!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao gerar script");
    } finally {
      setGerando(false);
    }
  };

  const salvarScript = async () => {
    const produto = produtos.find(p => p.id === produtoId);
    
    await salvarScriptMutation.mutateAsync({
      nome: `${tipoScript === "ligacao" ? "Ligação" : tipoScript === "whatsapp" ? "WhatsApp" : "E-mail"} - ${lead.nome}`,
      tipo: tipoScript,
      conteudo: scriptEditado,
      produto_id: produtoId,
      produto_nome: produto?.nome || "",
      ordem: 1,
      ativo: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-xl flex items-center gap-2">
            <Bot className="w-6 h-6 text-blue-400" />
            Gerar Script Personalizado
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Informações do Lead */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h3 className="text-white font-medium mb-2">Lead</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-slate-400">Nome:</span>
                <span className="text-white ml-2">{lead.nome}</span>
              </div>
              <div>
                <span className="text-slate-400">Empresa:</span>
                <span className="text-white ml-2">{lead.empresa || "-"}</span>
              </div>
              <div>
                <span className="text-slate-400">Cargo:</span>
                <span className="text-white ml-2">{lead.cargo || "-"}</span>
              </div>
              <div>
                <span className="text-slate-400">Origem:</span>
                <Badge variant="outline" className="ml-2">{lead.origem}</Badge>
              </div>
            </div>
          </div>

          {/* Configurações */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Tipo de Script</Label>
              <Select value={tipoScript} onValueChange={setTipoScript}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="ligacao">Ligação</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Produto *</Label>
              <Select value={produtoId} onValueChange={setProdutoId}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {produtos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Botão Gerar */}
          {!scriptGerado && (
            <Button
              onClick={gerarScript}
              disabled={gerando || !produtoId}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {gerando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando script personalizado...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Gerar Script com IA
                </>
              )}
            </Button>
          )}

          {/* Script Gerado */}
          {scriptGerado && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-slate-300">Script Gerado</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditando(!editando)}
                  className="border-slate-700 text-slate-300"
                >
                  <Edit className="w-3 h-3 mr-1" />
                  {editando ? "Visualizar" : "Editar"}
                </Button>
              </div>

              {editando ? (
                <Textarea
                  value={scriptEditado}
                  onChange={(e) => setScriptEditado(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white min-h-[300px] font-mono text-sm"
                />
              ) : (
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 max-h-[400px] overflow-y-auto">
                  <div className="prose prose-invert prose-sm max-w-none whitespace-pre-line">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="text-white mb-2">{children}</p>,
                        strong: ({ children }) => <strong className="text-white font-bold">{children}</strong>,
                        em: ({ children }) => <em className="text-blue-300">{children}</em>,
                      }}
                    >
                      {scriptEditado}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setScriptGerado(null);
                    setScriptEditado("");
                  }}
                  className="border-slate-700 text-slate-300"
                >
                  Gerar Novamente
                </Button>
                <Button
                  onClick={salvarScript}
                  disabled={salvarScriptMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {salvarScriptMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Salvar Script
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}