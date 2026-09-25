import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Plus, Save, Trash2, Power, Copy } from "lucide-react";
import { toast } from "sonner";

export default function HotmartConfig({ integracoes }) {
  const [novaIntegracao, setNovaIntegracao] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    client_id: "",
    client_secret: "",
    basic_token: "",
  });

  const queryClient = useQueryClient();

  const criarIntegracaoMutation = useMutation({
    mutationFn: (data) => base44.entities.Integracao.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integracoes"] });
      toast.success("Integração criada com sucesso!");
      setNovaIntegracao(false);
      setFormData({ nome: "", client_id: "", client_secret: "", basic_token: "" });
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
      tipo: "hotmart",
      ativa: false,
      status_conexao: "inativa",
      configuracao: {
        client_id: formData.client_id,
        client_secret: formData.client_secret,
        basic_token: formData.basic_token,
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
    const webhookUrl = `${window.location.origin}/api/webhook/hotmart`;
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL do webhook copiada!");
  };

  return (
    <div className="space-y-6">
      {/* Info */}
      <Card className="bg-orange-500/10 border-orange-500/30">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <GraduationCap className="w-5 h-5 text-orange-400 mt-0.5" />
            <div>
              <p className="text-orange-300 font-medium">Integração com Hotmart</p>
              <p className="text-orange-200/70 text-sm mt-1">
                Conecte sua conta Hotmart para gerar links de pagamento automáticos e receber notificações de vendas.
                Configure webhooks para sincronizar vendas em tempo real.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={copiarWebhook}
                className="mt-3 border-orange-500/50 text-orange-300 hover:bg-orange-500/10"
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
                  <GraduationCap className="w-5 h-5 text-orange-400" />
                  <div>
                    <CardTitle className="text-white text-lg">{integracao.nome}</CardTitle>
                    <p className="text-slate-400 text-sm">Hotmart</p>
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
                  <p className="text-slate-500">Client ID</p>
                  <p className="text-slate-300 font-mono">
                    {integracao.configuracao?.client_id ? "••••••••" : "Não configurado"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Client Secret</p>
                  <p className="text-slate-300">
                    {integracao.configuracao?.client_secret ? "••••••••" : "Não configurado"}
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
            <CardTitle className="text-white">Nova Integração Hotmart</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Nome da Integração</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Hotmart - Conta Principal"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Client ID</Label>
              <Input
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                placeholder="Seu Client ID"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Client Secret</Label>
              <Input
                value={formData.client_secret}
                onChange={(e) => setFormData({ ...formData, client_secret: e.target.value })}
                placeholder="Seu Client Secret"
                className="bg-slate-700 border-slate-600 text-white"
                type="password"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Basic Token</Label>
              <Input
                value={formData.basic_token}
                onChange={(e) => setFormData({ ...formData, basic_token: e.target.value })}
                placeholder="Basic Token para webhooks"
                className="bg-slate-700 border-slate-600 text-white"
                type="password"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={() => setNovaIntegracao(false)} variant="outline" className="flex-1 border-slate-700 text-slate-300">
                Cancelar
              </Button>
              <Button onClick={handleCriar} className="flex-1 bg-orange-600 hover:bg-orange-700">
                <Save className="w-4 h-4 mr-2" />
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setNovaIntegracao(true)} className="w-full bg-orange-600 hover:bg-orange-700">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Integração Hotmart
        </Button>
      )}
    </div>
  );
}