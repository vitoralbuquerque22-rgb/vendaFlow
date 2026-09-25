import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Plus, Save, Trash2, Power, Settings, Copy } from "lucide-react";
import { toast } from "sonner";

export default function FormulariosConfig({ integracoes }) {
  const [novaIntegracao, setNovaIntegracao] = useState(false);
  const [tipoNova, setTipoNova] = useState("typeform");
  const [editandoMapeamento, setEditandoMapeamento] = useState(null);
  const [formData, setFormData] = useState({
    nome: "",
    form_id: "",
    webhook_secret: "",
  });

  const queryClient = useQueryClient();

  const criarIntegracaoMutation = useMutation({
    mutationFn: (data) => base44.entities.Integracao.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integracoes"] });
      toast.success("Integração criada com sucesso!");
      setNovaIntegracao(false);
      setFormData({ nome: "", form_id: "", webhook_secret: "" });
    },
  });

  const atualizarIntegracaoMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Integracao.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integracoes"] });
      toast.success("Integração atualizada!");
      setEditandoMapeamento(null);
    },
  });

  const deletarIntegracaoMutation = useMutation({
    mutationFn: (id) => base44.entities.Integracao.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integracoes"] });
      toast.success("Integração removida!");
    },
  });

  const handleCriar = () => {
    const webhookUrl = `${window.location.origin}/api/webhook/${tipoNova}/${Date.now()}`;
    
    criarIntegracaoMutation.mutate({
      nome: formData.nome,
      tipo: tipoNova,
      ativa: false,
      status_conexao: "inativa",
      configuracao: {
        form_id: formData.form_id,
        webhook_secret: formData.webhook_secret,
      },
      webhook_url: webhookUrl,
      mapeamento_campos: {
        nome: "question_1",
        telefone: "question_2",
        email: "question_3",
      },
    });
  };

  const toggleAtiva = (integracao) => {
    atualizarIntegracaoMutation.mutate({
      id: integracao.id,
      data: { ativa: !integracao.ativa, status_conexao: !integracao.ativa ? "ativa" : "inativa" },
    });
  };

  const copiarWebhook = (url) => {
    navigator.clipboard.writeText(url);
    toast.success("URL do webhook copiada!");
  };

  return (
    <div className="space-y-6">
      {/* Info */}
      <Card className="bg-emerald-500/10 border-emerald-500/30">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-emerald-400 mt-0.5" />
            <div>
              <p className="text-emerald-300 font-medium">Formulários Longos - Zero Perda de Dados</p>
              <p className="text-emerald-200/70 text-sm mt-1">
                Configure Typeform e WordPress para enviar leads automaticamente. Suporta formulários com 15-20+ perguntas.
                Todas as respostas não mapeadas são armazenadas em "respostas_formulario".
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Integrações */}
      <div className="space-y-4">
        {integracoes.map((integracao) => (
          <Card key={integracao.id} className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-emerald-400" />
                  <div>
                    <CardTitle className="text-white text-lg">{integracao.nome}</CardTitle>
                    <p className="text-slate-400 text-sm capitalize">{integracao.tipo}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={integracao.ativa ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-600 text-slate-300"}>
                    {integracao.ativa ? "Ativa" : "Inativa"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditandoMapeamento(editandoMapeamento === integracao.id ? null : integracao.id)}
                    className="text-slate-400 hover:text-white"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleAtiva(integracao)}
                    className="text-slate-400 hover:text-white"
                  >
                    <Power className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deletarIntegracaoMutation.mutate(integracao.id)}
                    className="text-rose-400 hover:text-rose-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-slate-500 text-sm mb-1">Webhook URL</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-slate-900 text-slate-300 px-3 py-2 rounded text-xs">
                    {integracao.webhook_url}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copiarWebhook(integracao.webhook_url)}
                    className="text-slate-400 hover:text-white"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {editandoMapeamento === integracao.id && (
                <div className="border-t border-slate-700 pt-4 space-y-4">
                  <h4 className="text-white font-medium">Mapeamento de Campos</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300 text-xs">Campo: Nome</Label>
                      <Input
                        placeholder="Ex: question_1 ou nome"
                        defaultValue={integracao.mapeamento_campos?.nome}
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300 text-xs">Campo: Telefone</Label>
                      <Input
                        placeholder="Ex: question_2 ou telefone"
                        defaultValue={integracao.mapeamento_campos?.telefone}
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300 text-xs">Campo: Email</Label>
                      <Input
                        placeholder="Ex: question_3 ou email"
                        defaultValue={integracao.mapeamento_campos?.email}
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300 text-xs">Campo: Empresa</Label>
                      <Input
                        placeholder="Ex: question_4 ou empresa"
                        defaultValue={integracao.mapeamento_campos?.empresa}
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    💡 Respostas não mapeadas serão salvas em "respostas_formulario" (zero perda de dados)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Nova Integração */}
      {novaIntegracao ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Nova Integração de Formulário</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Plataforma</Label>
              <div className="flex gap-2">
                <Button
                  variant={tipoNova === "typeform" ? "default" : "outline"}
                  onClick={() => setTipoNova("typeform")}
                  className={tipoNova === "typeform" ? "bg-emerald-600" : "border-slate-700 text-slate-300"}
                >
                  Typeform
                </Button>
                <Button
                  variant={tipoNova === "wordpress" ? "default" : "outline"}
                  onClick={() => setTipoNova("wordpress")}
                  className={tipoNova === "wordpress" ? "bg-emerald-600" : "border-slate-700 text-slate-300"}
                >
                  WordPress
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Nome da Integração</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Formulário de Contato"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Form ID / Identificador</Label>
              <Input
                value={formData.form_id}
                onChange={(e) => setFormData({ ...formData, form_id: e.target.value })}
                placeholder="ID do formulário"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Webhook Secret (opcional)</Label>
              <Input
                value={formData.webhook_secret}
                onChange={(e) => setFormData({ ...formData, webhook_secret: e.target.value })}
                placeholder="Para validação de autenticidade"
                className="bg-slate-700 border-slate-600 text-white"
                type="password"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={() => setNovaIntegracao(false)} variant="outline" className="flex-1 border-slate-700 text-slate-300">
                Cancelar
              </Button>
              <Button onClick={handleCriar} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                <Save className="w-4 h-4 mr-2" />
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setNovaIntegracao(true)} className="w-full bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Integração de Formulário
        </Button>
      )}
    </div>
  );
}