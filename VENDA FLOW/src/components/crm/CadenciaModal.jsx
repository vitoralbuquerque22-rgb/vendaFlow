import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, Plus, Trash2, Phone, MessageCircle, Mail, Search, Video, FileText, DollarSign, Award, Instagram, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { listarCadencias } from "@/lib/services/cadenciaService";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";

const tipoConfig = {
  ligacao: { icon: Phone, color: "bg-green-500/20 text-green-400", label: "Ligação" },
  whatsapp: { icon: MessageCircle, color: "bg-emerald-500/20 text-emerald-400", label: "WhatsApp" },
  email: { icon: Mail, color: "bg-blue-500/20 text-blue-400", label: "E-mail" },
  pesquisa: { icon: Search, color: "bg-purple-500/20 text-purple-400", label: "Pesquisa" },
  realizar_reuniao: { icon: Video, color: "bg-indigo-500/20 text-indigo-400", label: "Realizar Reunião" },
  enviar_contrato: { icon: FileText, color: "bg-amber-500/20 text-amber-400", label: "Enviar Contrato" },
  recebimento: { icon: DollarSign, color: "bg-emerald-500/20 text-emerald-400", label: "Recebimento" },
  case_sucesso: { icon: Award, color: "bg-yellow-500/20 text-yellow-400", label: "Case de Sucesso" },
  instagram: { icon: Instagram, color: "bg-pink-500/20 text-pink-400", label: "Mensagem Instagram" },
};

export default function CadenciaModal({ open, onClose, cadencia, onSave, scripts }) {
  const { empresaId } = useEmpresaAtual();
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    tipo_cadencia: "sdr",
    cadencia_closer_id: "",
    duracao_dias: 7,
    etapas: [],
  });
  const [saving, setSaving] = useState(false);

  const { data: cadencias = [] } = useQuery({
    queryKey: ["cadencias-all"],
    queryFn: () => listarCadencias(empresaId, { apenasAtivas: false }),
    enabled: open,
  });

  useEffect(() => {
    if (cadencia) {
      setFormData({
        nome: cadencia.nome || "",
        descricao: cadencia.descricao || "",
        tipo_cadencia: cadencia.tipo_cadencia || "sdr",
        cadencia_closer_id: cadencia.cadencia_closer_id || "",
        duracao_dias: cadencia.duracao_dias || 7,
        etapas: cadencia.etapas || [],
      });
    } else {
      setFormData({
        nome: "",
        descricao: "",
        tipo_cadencia: "sdr",
        cadencia_closer_id: "",
        duracao_dias: 7,
        etapas: [],
      });
    }
  }, [cadencia, open]);

  const addEtapa = () => {
    setFormData({
      ...formData,
      etapas: [
        ...formData.etapas,
        { dia: 1, periodo: "manha", tipo: "ligacao", script_id: "", mensagem_id: "" },
      ],
    });
  };

  const updateEtapa = (index, field, value) => {
    const newEtapas = [...formData.etapas];
    newEtapas[index] = { ...newEtapas[index], [field]: value };
    setFormData({ ...formData, etapas: newEtapas });
  };

  const removeEtapa = (index) => {
    setFormData({
      ...formData,
      etapas: formData.etapas.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(formData);
    setSaving(false);
    onClose();
  };

  const diasArray = Array.from({ length: formData.duracao_dias }, (_, i) => i + 1);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">
            {cadencia ? "Editar Cadência" : "Nova Cadência"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {cadencia ? "Editar configurações da cadência" : "Criar nova cadência de prospecção ou fechamento"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Nome da Cadência *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Ex: Cadência Padrão 7 dias"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Tipo de Cadência *</Label>
              <Select
                value={formData.tipo_cadencia}
                onValueChange={(value) => setFormData({ ...formData, tipo_cadencia: value })}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="sdr">SDR (Prospecção)</SelectItem>
                  <SelectItem value="closer">Closer (Fechamento)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Duração (dias) *</Label>
              <Input
                type="number"
                min="1"
                max="30"
                value={formData.duracao_dias}
                onChange={(e) => setFormData({ ...formData, duracao_dias: parseInt(e.target.value) })}
                className="bg-slate-800 border-slate-700 text-white"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Descrição</Label>
            <Textarea
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white"
              placeholder="Descreva o objetivo desta cadência..."
            />
          </div>

          {formData.tipo_cadencia === "sdr" && (
            <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-lg space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <LinkIcon className="w-4 h-4 text-indigo-400" />
                <Label className="text-indigo-300 font-semibold">Cadência de Closer (Automação)</Label>
              </div>
              <p className="text-xs text-indigo-200/80 mb-3">
                Quando uma reunião for agendada, qual cadência de Closer deve ser iniciada automaticamente?
              </p>
              <Select
                value={formData.cadencia_closer_id}
                onValueChange={(value) => setFormData({ ...formData, cadencia_closer_id: value })}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Nenhuma (Closer escolhe manualmente)" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value={null}>Nenhuma (Closer escolhe manualmente)</SelectItem>
                  {cadencias
                    .filter(c => c.tipo_cadencia === "closer" && c.ativa)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {!formData.cadencia_closer_id && (
                <p className="text-xs text-slate-500 mt-2">
                  ℹ️ Se não definir, o Closer precisará aceitar a tarefa e escolher a cadência manualmente
                </p>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-slate-300 text-lg">Etapas da Cadência</Label>
              <Button type="button" onClick={addEtapa} variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-800">
                <Plus className="w-4 h-4 mr-1" />
                Adicionar Etapa
              </Button>
            </div>

            {formData.etapas.length === 0 ? (
              <Card className="bg-slate-800/50 border-slate-700 p-8 text-center">
                <p className="text-slate-400">Nenhuma etapa adicionada. Clique em "Adicionar Etapa" para começar.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {formData.etapas.map((etapa, index) => {
                  const config = tipoConfig[etapa.tipo];
                  const Icon = config.icon;
                  
                  return (
                    <Card key={index} className="bg-slate-800/50 border-slate-700 p-4">
                      <div className="flex items-start gap-4">
                        <div className={cn("p-2 rounded-lg", config.color)}>
                          <Icon className="w-4 h-4" />
                        </div>
                        
                        <div className="flex-1 grid grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-400">Dia</Label>
                            <Select
                              value={String(etapa.dia)}
                              onValueChange={(value) => updateEtapa(index, "dia", parseInt(value))}
                            >
                              <SelectTrigger className="bg-slate-700 border-slate-600 text-white h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-800 border-slate-700">
                                {diasArray.map((dia) => (
                                  <SelectItem key={dia} value={String(dia)}>
                                    Dia {dia}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs text-slate-400">Período</Label>
                            <Select
                              value={etapa.periodo}
                              onValueChange={(value) => updateEtapa(index, "periodo", value)}
                            >
                              <SelectTrigger className="bg-slate-700 border-slate-600 text-white h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-800 border-slate-700">
                                <SelectItem value="manha">Manhã</SelectItem>
                                <SelectItem value="tarde">Tarde</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs text-slate-400">Tipo</Label>
                            <Select
                              value={etapa.tipo}
                              onValueChange={(value) => updateEtapa(index, "tipo", value)}
                            >
                              <SelectTrigger className="bg-slate-700 border-slate-600 text-white h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-800 border-slate-700">
                                <SelectItem value="ligacao">Ligação</SelectItem>
                                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                <SelectItem value="email">E-mail</SelectItem>
                                <SelectItem value="pesquisa">Pesquisa</SelectItem>
                                <SelectItem value="instagram">Mensagem Instagram</SelectItem>
                                {formData.tipo_cadencia === "closer" && (
                                  <>
                                    <SelectItem value="reuniao">Realizar Reunião</SelectItem>
                                    <SelectItem value="enviar_contrato">Enviar Contrato</SelectItem>
                                    <SelectItem value="recebimento">Recebimento</SelectItem>
                                    <SelectItem value="case_sucesso">Case de Sucesso</SelectItem>
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs text-slate-400">Script/Mensagem</Label>
                            <Select
                              value={etapa.script_id || etapa.mensagem_id || ""}
                              onValueChange={(value) => updateEtapa(index, "script_id", value)}
                            >
                              <SelectTrigger className="bg-slate-700 border-slate-600 text-white h-9">
                                <SelectValue placeholder="Opcional" />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-800 border-slate-700">
                                {scripts?.filter(s => s.tipo === etapa.tipo).map((script) => (
                                  <SelectItem key={script.id} value={script.id}>
                                    {script.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeEtapa(index)}
                          className="text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <Button type="button" variant="ghost" onClick={onClose} className="text-slate-400">
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {cadencia ? "Salvar Alterações" : "Criar Cadência"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}