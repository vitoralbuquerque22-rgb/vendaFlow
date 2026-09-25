import { useState, useEffect } from "react";
import { api } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, X, Link as LinkIcon, Image as ImageIcon, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export default function ScriptModal({ open, onClose, script, onSave }) {
  const [formData, setFormData] = useState({
    nome: "",
    tipo: "ligacao",
    conteudo: "",
    ordem: 1,
    produto_id: "",
    imagens: [],
    arquivos: [],
    links: [],
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingArquivo, setUploadingArquivo] = useState(false);
  const [novoLink, setNovoLink] = useState("");

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos"],
    queryFn: () => api.entities.Produto.filter({ ativo: true }),
  });

  useEffect(() => {
    if (script) {
      setFormData({
        nome: script.nome || "",
        tipo: script.tipo || "ligacao",
        conteudo: script.conteudo || "",
        ordem: script.ordem || 1,
        produto_id: script.produto_id || "",
        imagens: script.imagens || [],
        arquivos: script.arquivos || [],
        links: script.links || [],
      });
    } else {
      setFormData({
        nome: "",
        tipo: "ligacao",
        conteudo: "",
        ordem: 1,
        produto_id: "",
        imagens: [],
        arquivos: [],
        links: [],
      });
    }
    setNovoLink("");
  }, [script, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const produto = produtos.find((p) => p.id === formData.produto_id);
    await onSave({
      ...formData,
      produto_nome: produto?.nome || "",
    });
    setSaving(false);
    onClose();
  };

  const handleUploadImagem = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      setFormData({
        ...formData,
        imagens: [...(formData.imagens || []), file_url],
      });
      toast.success("Imagem enviada!");
    } catch (error) {
      toast.error("Erro ao enviar imagem");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoverImagem = (index) => {
    setFormData({
      ...formData,
      imagens: formData.imagens.filter((_, i) => i !== index),
    });
  };

  const handleAdicionarLink = () => {
    if (!novoLink.trim()) return;
    setFormData({
      ...formData,
      links: [...(formData.links || []), novoLink.trim()],
    });
    setNovoLink("");
  };

  const handleRemoverLink = (index) => {
    setFormData({
      ...formData,
      links: formData.links.filter((_, i) => i !== index),
    });
  };

  const handleUploadArquivo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingArquivo(true);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      setFormData({
        ...formData,
        arquivos: [...(formData.arquivos || []), {
          url: file_url,
          nome: file.name,
          tipo: file.type
        }],
      });
      toast.success("Arquivo enviado!");
    } catch (error) {
      toast.error("Erro ao enviar arquivo");
    } finally {
      setUploadingArquivo(false);
    }
  };

  const handleRemoverArquivo = (index) => {
    setFormData({
      ...formData,
      arquivos: formData.arquivos.filter((_, i) => i !== index),
    });
  };

  const mostrarAnexos = formData.tipo === "whatsapp" || formData.tipo === "email" || formData.tipo === "recebimento" || formData.tipo === "enviar_contrato";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">
            {script ? "Editar Script" : "Novo Script"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {script ? "Editar script de vendas" : "Criar novo script de vendas"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Nome do Script *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Ex: Ligação 1 - Apresentação"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Tipo *</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value) => setFormData({ ...formData, tipo: value })}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="ligacao">Ligação</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="enviar_contrato">Enviar Contrato</SelectItem>
                  <SelectItem value="recebimento">Recebimento</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Produto Associado</Label>
              <Select
                value={formData.produto_id}
                onValueChange={(value) => setFormData({ ...formData, produto_id: value })}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value={null}>Nenhum produto</SelectItem>
                  {produtos.map((produto) => (
                    <SelectItem key={produto.id} value={produto.id}>
                      {produto.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Ordem de exibição</Label>
              <Input
                type="number"
                min="1"
                value={formData.ordem}
                onChange={(e) => setFormData({ ...formData, ordem: parseInt(e.target.value) })}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Conteúdo do Script *</Label>
            <Textarea
              value={formData.conteudo}
              onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white min-h-[200px]"
              placeholder={
                formData.tipo === "ligacao"
                  ? "Olá, [NOME]! Aqui é o [SEU NOME] da [EMPRESA]..."
                  : formData.tipo === "whatsapp"
                  ? "Olá! Tudo bem? Vi que você demonstrou interesse em..."
                  : "Assunto: [ASSUNTO]\n\nOlá [NOME],\n\n..."
              }
              required
            />
            <p className="text-xs text-slate-500">
              Dica: Use [NOME], [EMPRESA], [CARGO] como variáveis para personalização.
            </p>
          </div>

          {mostrarAnexos && (
            <>
              {/* Imagens */}
              <div className="space-y-2">
                <Label className="text-slate-300 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Imagens Anexadas
                </Label>
                <div className="space-y-2">
                  {formData.imagens?.map((img, index) => (
                    <Card key={index} className="bg-slate-800 border-slate-700 p-3">
                      <div className="flex items-center gap-3">
                        <img src={img} alt="Preview" className="w-16 h-16 object-cover rounded" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-400 truncate">{img}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoverImagem(index)}
                          className="text-rose-400 hover:text-rose-300"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadImagem}
                      className="hidden"
                      id="upload-imagem"
                    />
                    <label htmlFor="upload-imagem">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={uploading}
                        className="w-full border-slate-600 text-slate-300"
                        onClick={(e) => {
                          e.preventDefault();
                          document.getElementById('upload-imagem').click();
                        }}
                      >
                        {uploading ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4 mr-2" />
                        )}
                        Adicionar Imagem
                      </Button>
                    </label>
                  </div>
                </div>
              </div>

              {/* Arquivos (PDFs, etc) */}
              <div className="space-y-2">
                <Label className="text-slate-300 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Arquivos (PDF, Apresentações)
                </Label>
                <div className="space-y-2">
                  {formData.arquivos?.map((arquivo, index) => (
                    <Card key={index} className="bg-slate-800 border-slate-700 p-3">
                      <div className="flex items-center gap-3">
                        <FileText className="w-8 h-8 text-red-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium truncate">{arquivo.nome}</p>
                          <p className="text-xs text-slate-500 truncate">{arquivo.url}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoverArquivo(index)}
                          className="text-rose-400 hover:text-rose-300"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                  <div>
                    <input
                      type="file"
                      accept=".pdf,.ppt,.pptx,.doc,.docx"
                      onChange={handleUploadArquivo}
                      className="hidden"
                      id="upload-arquivo"
                    />
                    <label htmlFor="upload-arquivo">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={uploadingArquivo}
                        className="w-full border-slate-600 text-slate-300"
                        onClick={(e) => {
                          e.preventDefault();
                          document.getElementById('upload-arquivo').click();
                        }}
                      >
                        {uploadingArquivo ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4 mr-2" />
                        )}
                        Adicionar PDF/Documento
                      </Button>
                    </label>
                  </div>
                </div>
              </div>

              {/* Links */}
              <div className="space-y-2">
                <Label className="text-slate-300 flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" />
                  Links para Enviar
                </Label>
                <div className="space-y-2">
                  {formData.links?.map((link, index) => (
                    <Card key={index} className="bg-slate-800 border-slate-700 p-3">
                      <div className="flex items-center gap-3">
                        <LinkIcon className="w-4 h-4 text-blue-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{link}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoverLink(index)}
                          className="text-rose-400 hover:text-rose-300"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      value={novoLink}
                      onChange={(e) => setNovoLink(e.target.value)}
                      placeholder="https://exemplo.com"
                      className="bg-slate-800 border-slate-700 text-white"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAdicionarLink();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAdicionarLink}
                      className="border-slate-600 text-slate-300"
                    >
                      <LinkIcon className="w-4 h-4 mr-2" />
                      Adicionar
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={onClose} className="text-slate-400">
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {script ? "Salvar Alterações" : "Criar Script"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}