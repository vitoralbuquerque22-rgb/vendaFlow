import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mail, Plus, Search, Eye, Trash2, User, Building, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

const modules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'align': [] }],
    ['link'],
    ['clean']
  ],
};

export default function TemplateManager({ templates = [], empresaId, user, busca, setBusca, onEnviarCampanha, enviosRestantes }) {
  const queryClient = useQueryClient();
  const quillRef = useRef(null);
  const [modalTemplate, setModalTemplate] = useState(false);
  const [templateEditando, setTemplateEditando] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formTemplate, setFormTemplate] = useState({ nome: "", assunto: "", corpo: "", tipo: "follow_up" });

  const criarTemplateMutation = useMutation({
    mutationFn: (data) => api.entities.EmailTemplate.create({ ...data, empresaId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["email-templates", empresaId] }); toast.success("Template criado!"); fechar(); },
  });

  const atualizarTemplateMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.EmailTemplate.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["email-templates", empresaId] }); toast.success("Template atualizado!"); fechar(); },
  });

  const deletarTemplateMutation = useMutation({
    mutationFn: (id) => api.entities.EmailTemplate.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["email-templates", empresaId] }); toast.success("Template excluído!"); },
  });

  const fechar = () => {
    setModalTemplate(false); setTemplateEditando(null);
    setFormTemplate({ nome: "", assunto: "", corpo: "", tipo: "follow_up" });
  };

  const abrir = (template = null) => {
    if (template) {
      setTemplateEditando(template);
      setFormTemplate({ nome: template.nome, assunto: template.assunto, corpo: template.corpo, tipo: template.tipo });
    } else {
      setTemplateEditando(null);
      setFormTemplate({ nome: "", assunto: "", corpo: "", tipo: "follow_up" });
    }
    setModalTemplate(true);
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (templateEditando) {
      await atualizarTemplateMutation.mutateAsync({ id: templateEditando.id, data: { ...formTemplate, usuario_email: user?.email } });
    } else {
      await criarTemplateMutation.mutateAsync({ ...formTemplate, usuario_email: user?.email });
    }
  };

  const handleUploadImage = async (file) => {
    if (!file) return;
    setUploadingImage(true);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      const quill = quillRef.current?.getEditor();
      if (quill) { const range = quill.getSelection(); quill.insertEmbed(range?.index || 0, 'image', file_url); }
      toast.success("Imagem inserida!");
    } catch { toast.error("Erro ao fazer upload da imagem"); }
    finally { setUploadingImage(false); }
  };

  const insertPlaceholder = (placeholder) => {
    const quill = quillRef.current?.getEditor();
    if (quill) { const range = quill.getSelection(); quill.insertText(range?.index || 0, placeholder); }
  };

  const templatesFiltrados = templates.filter(t =>
    t.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    t.assunto?.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <>
      {/* Filtros */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar templates..." className="pl-10 bg-slate-700 border-slate-600 text-white" />
            </div>
            <Button onClick={onEnviarCampanha} className="bg-emerald-600 hover:bg-emerald-700" disabled={templates.length === 0 || enviosRestantes <= 0}>
              Enviar Campanha
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">Templates de E-mail</CardTitle>
            <Button onClick={() => abrir()} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" />Novo Template</Button>
          </div>
        </CardHeader>
        <CardContent>
          {templatesFiltrados.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">{templates.length === 0 ? "Nenhum template criado" : "Nenhum template encontrado"}</h3>
              <p className="text-slate-400 mb-4">{templates.length === 0 ? "Crie seu primeiro template de e-mail" : "Tente ajustar sua busca"}</p>
              {templates.length === 0 && <Button onClick={() => abrir()} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" />Criar Template</Button>}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700">
                  <TableHead className="text-slate-300">Nome</TableHead>
                  <TableHead className="text-slate-300">Assunto</TableHead>
                  <TableHead className="text-slate-300">Tipo</TableHead>
                  <TableHead className="text-slate-300">Criado em</TableHead>
                  <TableHead className="text-slate-300 w-32">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templatesFiltrados.map((template) => (
                  <TableRow key={template.id} className="border-slate-700">
                    <TableCell className="text-white font-medium">{template.nome}</TableCell>
                    <TableCell className="text-slate-300">{template.assunto}</TableCell>
                    <TableCell><Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">{template.tipo?.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="text-slate-400 text-sm">{template.created_date ? format(new Date(template.created_date), "dd/MM/yyyy", { locale: ptBR }) : "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => abrir(template)} className="text-slate-400 hover:text-white"><Eye className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm("Deseja excluir este template?")) deletarTemplateMutation.mutate(template.id); }} className="text-rose-400 hover:text-rose-300"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal Template */}
      <Dialog open={modalTemplate} onOpenChange={setModalTemplate}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-[95vw] max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white text-xl">{templateEditando ? "Editar Template" : "Novo Template"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSalvar} className="space-y-6 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Nome do Template *</Label>
                <Input value={formTemplate.nome} onChange={(e) => setFormTemplate({ ...formTemplate, nome: e.target.value })} className="bg-slate-800 border-slate-700 text-white" placeholder="Ex: Follow-up Dia 3" required />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Tipo</Label>
                <Select value={formTemplate.tipo} onValueChange={(value) => setFormTemplate({ ...formTemplate, tipo: value })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="follow_up">Follow-up</SelectItem>
                    <SelectItem value="apresentacao">Apresentação</SelectItem>
                    <SelectItem value="lembrete">Lembrete</SelectItem>
                    <SelectItem value="agradecimento">Agradecimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Assunto do E-mail *</Label>
              <Input value={formTemplate.assunto} onChange={(e) => setFormTemplate({ ...formTemplate, assunto: e.target.value })} className="bg-slate-800 border-slate-700 text-white" placeholder="Ex: Oi {nome}, tudo bem?" required />
            </div>
            <div className="space-y-3">
              <Label className="text-slate-300 text-lg">Corpo do E-mail *</Label>
              <div className="flex flex-wrap gap-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <span className="text-slate-400 text-sm font-medium mr-2">Inserir campo:</span>
                <Button type="button" size="sm" variant="outline" onClick={() => insertPlaceholder('{nome}')} className="border-slate-600 text-slate-300 hover:bg-slate-700 h-8 text-xs"><User className="w-3 h-3 mr-1" />{"{nome}"}</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => insertPlaceholder('{empresa}')} className="border-slate-600 text-slate-300 hover:bg-slate-700 h-8 text-xs"><Building className="w-3 h-3 mr-1" />{"{empresa}"}</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => insertPlaceholder('{dores_mapeadas}')} className="border-slate-600 text-slate-300 hover:bg-slate-700 h-8 text-xs"><FileText className="w-3 h-3 mr-1" />{"{dores_mapeadas}"}</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => insertPlaceholder('URL_DESTINO=https://seusite.com/pagina')} className="border-blue-600 text-blue-400 hover:bg-blue-900/20 h-8 text-xs">🔗 Link Rastreável</Button>
                <div className="ml-auto">
                  <input type="file" accept="image/*" onChange={(e) => handleUploadImage(e.target.files?.[0])} className="hidden" id="upload-image" />
                  <Button type="button" size="sm" variant="outline" onClick={() => document.getElementById('upload-image')?.click()} disabled={uploadingImage} className="border-emerald-600 text-emerald-400 hover:bg-emerald-900/20 h-8 text-xs">
                    {uploadingImage ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <ImageIcon className="w-3 h-3 mr-1" />}Inserir Imagem
                  </Button>
                </div>
              </div>
              <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                <style>{`.ql-toolbar{background:#1e293b!important;border:none!important;border-bottom:1px solid #334155!important}.ql-container{background:#0f172a!important;border:none!important;min-height:400px;font-size:14px}.ql-editor{color:white!important;min-height:400px}.ql-editor.ql-blank::before{color:#64748b!important;font-style:normal}.ql-snow .ql-stroke{stroke:#94a3b8!important}.ql-snow .ql-fill{fill:#94a3b8!important}.ql-snow .ql-picker-label{color:#94a3b8!important}.ql-snow .ql-picker-options{background:#1e293b!important;border:1px solid #334155!important}.ql-snow .ql-picker-item{color:#94a3b8!important}`}</style>
                <ReactQuill ref={quillRef} theme="snow" value={formTemplate.corpo} onChange={(value) => setFormTemplate({ ...formTemplate, corpo: value })} modules={modules} placeholder="Olá {nome}, escreva seu e-mail aqui..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-6 border-t border-slate-700">
              <Button type="button" variant="ghost" onClick={fechar} className="text-slate-400">Cancelar</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 px-8">{templateEditando ? "Atualizar" : "Criar"} Template</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}