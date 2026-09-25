import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Plus, Save, Trash2, Power, Copy } from "lucide-react";
import { toast } from "sonner";

export default function AsaasConfig({ integracoes }) {
  const [novaIntegracao, setNovaIntegracao] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    api_key: "",
    ambiente: "producao",
  });

  const queryClient = useQueryClient();

  const criarIntegracaoMutation = useMutation({
    mutationFn: (data) => base44.entities.Integracao.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integracoes"] });
      toast.success("Integração criada com sucesso!");
      setNovaIntegracao(false);
      setFormData({ nome: "", api_key: "", ambiente: "producao" });
    },
  });

  const atualizarIntegracaoMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Integracao.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integracoes"] });
      toast.success("Integração atualizada!");
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
    criarIntegracaoMutation.mutate({
      nome: formData.nome,
      tipo: "asaas",
      ativa: false,
      status_conexao: "inativa",
      configuracao: {
        api_key: formData.api_key,
        ambiente: formData.ambiente,
      },
    });
  };

  const toggleAtiva = (integracao) => {
    atualizarIntegracaoMutation.mutate({
      id: integracao.id,
      data: { ativa: !integracao.ativa, status_conexao: !integracao.ativa ? "ativa" : "inativa" },
    });
  };

  const copiarWebhook = () => {
    const webhookUrl = `${window.location.origin}/api/webhook/asaas`;
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL do webhook copiada!");
  };

  return (
    <div className="space-y-6">
      {/* Info */}
      <Card className="bg-blue-500/10 border-blue-500/30">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <DollarSign className="w-5 h-5 text-blue-400 mt-0.5" />
            <div>
              <p className="text-blue-300 font-medium">Integração com Asaas</p>
              <p className="text-blue-200/70 text-sm mt-1">
                Conecte sua conta Asaas para gerar cobranças, links de pagamento e gerenciar recebimentos.
                Os vendedores poderão gerar links de pagamento diretamente dos produtos.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={copiarWebhook}
                className="mt-3 border-blue-500/50 text-blue-300 hover:bg-blue-500/10"
              >
                <Copy className="w-3 h-3 mr-2" />
                Copiar URL do Webhook
              </Button>
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
                  <DollarSign className="w-5 h-5 text-blue-400" />
                  <div>
                    <CardTitle className="text-white text-lg">{integracao.nome}</CardTitle>
                    <p className="text-slate-400 text-sm capitalize">
                      Asaas - {integracao.configuracao?.ambiente || "Produção"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={integracao.ativa ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-600 text-slate-300"}>
                    {integracao.ativa ? "Ativa" : "Inativa"}
                  </Badge>
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
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">API Key</p>
                  <p className="text-slate-300 font-mono">
                    {integracao.configuracao?.api_key ? "••••••••" : "Não configurado"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Ambiente</p>
                  <p className="text-slate-300 capitalize">
                    {integracao.configuracao?.ambiente || "Produção"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Nova Integração */}
      {novaIntegracao ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Nova Integração Asaas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Nome da Integração</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Asaas - Conta Principal"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">API Key</Label>
              <Input
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                placeholder="Sua API Key do Asaas"
                className="bg-slate-700 border-slate-600 text-white"
                type="password"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Ambiente</Label>
              <div className="flex gap-2">
                <Button
                  variant={formData.ambiente === "sandbox" ? "default" : "outline"}
                  onClick={() => setFormData({ ...formData, ambiente: "sandbox" })}
                  className={formData.ambiente === "sandbox" ? "bg-blue-600" : "border-slate-700 text-slate-300"}
                >
                  Sandbox (Testes)
                </Button>
                <Button
                  variant={formData.ambiente === "producao" ? "default" : "outline"}
                  onClick={() => setFormData({ ...formData, ambiente: "producao" })}
                  className={formData.ambiente === "producao" ? "bg-blue-600" : "border-slate-700 text-slate-300"}
                >
                  Produção
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => setNovaIntegracao(false)} variant="outline" className="flex-1 border-slate-700 text-slate-300">
                Cancelar
              </Button>
              <Button onClick={handleCriar} className="flex-1 bg-blue-600 hover:bg-blue-700">
                <Save className="w-4 h-4 mr-2" />
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setNovaIntegracao(true)} className="w-full bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Integração Asaas
        </Button>
      )}
    </div>
  );
}