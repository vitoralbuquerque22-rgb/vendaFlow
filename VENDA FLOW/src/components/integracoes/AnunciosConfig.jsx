import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Plus, Save, Trash2, Power } from "lucide-react";
import { toast } from "sonner";

export default function AnunciosConfig({ integracoes }) {
  const [novaIntegracao, setNovaIntegracao] = useState(false);
  const [tipoNova, setTipoNova] = useState("meta_ads");
  const [formData, setFormData] = useState({
    nome: "",
    access_token: "",
    account_id: "",
  });

  const queryClient = useQueryClient();

  const criarIntegracaoMutation = useMutation({
    mutationFn: (data) => base44.entities.Integracao.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integracoes"] });
      toast.success("Integração criada com sucesso!");
      setNovaIntegracao(false);
      setFormData({ nome: "", access_token: "", account_id: "" });
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
      tipo: tipoNova,
      ativa: false,
      status_conexao: "inativa",
      configuracao: {
        access_token: formData.access_token,
        account_id: formData.account_id,
      },
    });
  };

  const toggleAtiva = (integracao) => {
    atualizarIntegracaoMutation.mutate({
      id: integracao.id,
      data: { ativa: !integracao.ativa, status_conexao: !integracao.ativa ? "ativa" : "inativa" },
    });
  };

  return (
    <div className="space-y-6">
      {/* Info */}
      <Card className="bg-blue-500/10 border-blue-500/30">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Megaphone className="w-5 h-5 text-blue-400 mt-0.5" />
            <div>
              <p className="text-blue-300 font-medium">Entrada Automática de Leads</p>
              <p className="text-blue-200/70 text-sm mt-1">
                Conecte suas contas de Meta Ads e Google Ads para capturar leads automaticamente.
                Todos os leads entram com status "Novo Lead" e origem correta.
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
                  <Megaphone className="w-5 h-5 text-blue-400" />
                  <div>
                    <CardTitle className="text-white text-lg">{integracao.nome}</CardTitle>
                    <p className="text-slate-400 text-sm capitalize">{integracao.tipo.replace("_", " ")}</p>
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
                  <p className="text-slate-500">Access Token</p>
                  <p className="text-slate-300 font-mono">
                    {integracao.configuracao?.access_token ? "••••••••" : "Não configurado"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Account ID</p>
                  <p className="text-slate-300">{integracao.configuracao?.account_id || "N/A"}</p>
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
            <CardTitle className="text-white">Nova Integração de Anúncios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Plataforma</Label>
              <div className="flex gap-2">
                <Button
                  variant={tipoNova === "meta_ads" ? "default" : "outline"}
                  onClick={() => setTipoNova("meta_ads")}
                  className={tipoNova === "meta_ads" ? "bg-blue-600" : "border-slate-700 text-slate-300"}
                >
                  Meta Ads
                </Button>
                <Button
                  variant={tipoNova === "google_ads" ? "default" : "outline"}
                  onClick={() => setTipoNova("google_ads")}
                  className={tipoNova === "google_ads" ? "bg-blue-600" : "border-slate-700 text-slate-300"}
                >
                  Google Ads
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Nome da Integração</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Meta Ads - Campanha Principal"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Access Token</Label>
              <Input
                value={formData.access_token}
                onChange={(e) => setFormData({ ...formData, access_token: e.target.value })}
                placeholder="Seu Access Token"
                className="bg-slate-700 border-slate-600 text-white"
                type="password"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Account ID</Label>
              <Input
                value={formData.account_id}
                onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                placeholder="ID da conta"
                className="bg-slate-700 border-slate-600 text-white"
              />
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
          Adicionar Integração de Anúncios
        </Button>
      )}
    </div>
  );
}