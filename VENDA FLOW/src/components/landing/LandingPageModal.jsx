import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
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
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function LandingPageModal({ open, onClose, landing }) {
  const [formData, setFormData] = useState({
    titulo: "",
    slug: "",
    tipo: "diagnostico",
    descricao: "",
    imagem_destaque: "",
    cor_tema: "#3b82f6",
    formulario: {
      campos_basicos: ["nome", "email", "telefone"],
      perguntas_diagnostico: []
    },
    material_entrega: {
      tipo: "email",
      mensagem_agradecimento: "Obrigado! Você receberá o material em seu e-mail."
    },
    ativa: true
  });
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (landing) {
      setFormData({
        titulo: landing.titulo || "",
        slug: landing.slug || "",
        tipo: landing.tipo || "diagnostico",
        descricao: landing.descricao || "",
        imagem_destaque: landing.imagem_destaque || "",
        cor_tema: landing.cor_tema || "#3b82f6",
        formulario: landing.formulario || {
          campos_basicos: ["nome", "email", "telefone"],
          perguntas_diagnostico: []
        },
        material_entrega: landing.material_entrega || {
          tipo: "email",
          mensagem_agradecimento: "Obrigado! Você receberá o material em seu e-mail."
        },
        ativa: landing.ativa ?? true
      });
    }
  }, [landing, open]);

  const criarMutation = useMutation({
    mutationFn: (data) => base44.entities.LandingPage.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-pages"] });
      toast.success("Landing page criada!");
      onClose();
    },
  });

  const atualizarMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.LandingPage.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-pages"] });
      toast.success("Landing page atualizada!");
      onClose();
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    // Gerar slug automaticamente se vazio
    if (!formData.slug) {
      formData.slug = formData.titulo
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }

    if (landing) {
      await atualizarMutation.mutateAsync({ id: landing.id, data: formData });
    } else {
      await criarMutation.mutateAsync(formData);
    }
    setSaving(false);
  };

  const adicionarPergunta = () => {
    setFormData({
      ...formData,
      formulario: {
        ...formData.formulario,
        perguntas_diagnostico: [
          ...(formData.formulario.perguntas_diagnostico || []),
          { pergunta: "", tipo: "multipla_escolha", opcoes: [""], peso_score: 5 }
        ]
      }
    });
  };

  const removerPergunta = (index) => {
    const novasPerguntas = [...formData.formulario.perguntas_diagnostico];
    novasPerguntas.splice(index, 1);
    setFormData({
      ...formData,
      formulario: { ...formData.formulario, perguntas_diagnostico: novasPerguntas }
    });
  };

  const atualizarPergunta = (index, campo, valor) => {
    const novasPerguntas = [...formData.formulario.perguntas_diagnostico];
    novasPerguntas[index] = { ...novasPerguntas[index], [campo]: valor };
    setFormData({
      ...formData,
      formulario: { ...formData.formulario, perguntas_diagnostico: novasPerguntas }
    });
  };

  const adicionarOpcao = (perguntaIndex) => {
    const novasPerguntas = [...formData.formulario.perguntas_diagnostico];
    novasPerguntas[perguntaIndex].opcoes = [...(novasPerguntas[perguntaIndex].opcoes || []), ""];
    setFormData({
      ...formData,
      formulario: { ...formData.formulario, perguntas_diagnostico: novasPerguntas }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">
            {landing ? "Editar Landing Page" : "Nova Landing Page"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Dados Básicos */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Dados Básicos</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Título *</Label>
                <Input
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="Ex: Diagnóstico de Marketing Digital"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">URL (slug)</Label>
                <Input
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="diagnostico-marketing"
                />
                <p className="text-xs text-slate-500">Deixe vazio para gerar automaticamente</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                    <SelectItem value="ebook">E-book</SelectItem>
                    <SelectItem value="diagnostico">Diagnóstico</SelectItem>
                    <SelectItem value="webinar">Webinar</SelectItem>
                    <SelectItem value="consultoria">Consultoria Gratuita</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Cor do Tema</Label>
                <Input
                  type="color"
                  value={formData.cor_tema}
                  onChange={(e) => setFormData({ ...formData, cor_tema: e.target.value })}
                  className="bg-slate-800 border-slate-700 h-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Descrição</Label>
              <Textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white min-h-[100px]"
                placeholder="Descreva a oferta e benefícios..."
              />
            </div>
          </div>

          {/* Perguntas do Diagnóstico */}
          {formData.tipo === "diagnostico" && (
            <div className="space-y-4 border-t border-slate-700 pt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Perguntas do Diagnóstico</h3>
                <Button type="button" size="sm" onClick={adicionarPergunta} className="bg-blue-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Pergunta
                </Button>
              </div>

              {formData.formulario.perguntas_diagnostico?.map((pergunta, index) => (
                <div key={index} className="bg-slate-800/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <span className="text-sm font-medium text-slate-300">Pergunta {index + 1}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removerPergunta(index)}
                      className="text-rose-400 hover:text-rose-300 -mt-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <Input
                    value={pergunta.pergunta}
                    onChange={(e) => atualizarPergunta(index, "pergunta", e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white"
                    placeholder="Digite a pergunta..."
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      value={pergunta.tipo}
                      onValueChange={(value) => atualizarPergunta(index, "tipo", value)}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="multipla_escolha">Múltipla Escolha</SelectItem>
                        <SelectItem value="texto">Texto Livre</SelectItem>
                        <SelectItem value="escala">Escala 1-10</SelectItem>
                      </SelectContent>
                    </Select>

                    <Input
                      type="number"
                      min="0"
                      max="10"
                      value={pergunta.peso_score}
                      onChange={(e) => atualizarPergunta(index, "peso_score", parseInt(e.target.value) || 0)}
                      className="bg-slate-700 border-slate-600 text-white"
                      placeholder="Peso (0-10)"
                    />
                  </div>

                  {pergunta.tipo === "multipla_escolha" && (
                    <div className="space-y-2">
                      <Label className="text-slate-400 text-sm">Opções</Label>
                      {pergunta.opcoes?.map((opcao, opcaoIndex) => (
                        <Input
                          key={opcaoIndex}
                          value={opcao}
                          onChange={(e) => {
                            const novasOpcoes = [...pergunta.opcoes];
                            novasOpcoes[opcaoIndex] = e.target.value;
                            atualizarPergunta(index, "opcoes", novasOpcoes);
                          }}
                          className="bg-slate-700 border-slate-600 text-white"
                          placeholder={`Opção ${opcaoIndex + 1}`}
                        />
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => adicionarOpcao(index)}
                        className="border-slate-600 text-slate-300"
                      >
                        + Adicionar Opção
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Entrega */}
          <div className="space-y-4 border-t border-slate-700 pt-6">
            <h3 className="text-lg font-semibold text-white">Material de Entrega</h3>
            
            <div className="space-y-2">
              <Label className="text-slate-300">Mensagem de Agradecimento</Label>
              <Textarea
                value={formData.material_entrega.mensagem_agradecimento}
                onChange={(e) => setFormData({
                  ...formData,
                  material_entrega: { ...formData.material_entrega, mensagem_agradecimento: e.target.value }
                })}
                className="bg-slate-800 border-slate-700 text-white min-h-[80px]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <Button type="button" variant="ghost" onClick={onClose} className="text-slate-400">
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {landing ? "Atualizar" : "Criar"} Landing Page
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}