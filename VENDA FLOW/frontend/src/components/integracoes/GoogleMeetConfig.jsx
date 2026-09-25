import { useState } from "react";
import { api } from "@/api/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, Plus, Trash2, Power, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function GoogleMeetConfig({ integracoes }) {
  const queryClient = useQueryClient();

  const atualizarIntegracaoMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Integracao.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integracoes"] });
      toast.success("Integração atualizada!");
    },
  });

  const deletarIntegracaoMutation = useMutation({
    mutationFn: (id) => api.entities.Integracao.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integracoes"] });
      toast.success("Integração removida!");
    },
  });

  const handleConectar = async () => {
    try {
      // Criar integração no banco
      await api.entities.Integracao.create({
        nome: "Google Meet",
        tipo: "google_meet",
        ativa: true,
        status_conexao: "ativa",
        configuracao: {
          oauth: true,
          capture_transcriptions: true,
          capture_recordings: true,
        },
      });
      
      queryClient.invalidateQueries({ queryKey: ["integracoes"] });
      toast.success("Conectado com Google Meet!");
    } catch (error) {
      toast.error("Erro ao conectar: " + error.message);
    }
  };

  const toggleAtiva = (integracao) => {
    atualizarIntegracaoMutation.mutate({
      id: integracao.id,
      data: { ativa: !integracao.ativa, status_conexao: !integracao.ativa ? "ativa" : "inativa" },
    });
  };

  const integracaoAtiva = integracoes[0];

  return (
    <div className="space-y-6">
      {/* Info */}
      <Card className="bg-indigo-500/10 border-indigo-500/30">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Video className="w-5 h-5 text-indigo-400 mt-0.5" />
            <div>
              <p className="text-indigo-300 font-medium">Integração com Google Meet</p>
              <p className="text-indigo-200/70 text-sm mt-1">
                Gere links do Google Meet automaticamente e capture transcrições e gravações das reuniões.
                O Assistente IA analisa as calls e fornece feedback aos Closers.
              </p>
              <div className="mt-3 space-y-2 text-sm text-indigo-200/70">
                <p>✓ Geração automática de links do Meet</p>
                <p>✓ Captura de transcrições das reuniões</p>
                <p>✓ Gravações armazenadas e organizadas</p>
                <p>✓ Análise automática pelo Assistente IA</p>
                <p>✓ Rastreamento de calls realizadas/não realizadas</p>
                <p>✓ Métricas de produtividade das reuniões</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Integrações */}
      {integracaoAtiva ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Video className="w-5 h-5 text-indigo-400" />
                <div>
                  <CardTitle className="text-white text-lg">{integracaoAtiva.nome}</CardTitle>
                  <p className="text-slate-400 text-sm">Google Meet</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={integracaoAtiva.ativa ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-600 text-slate-300"}>
                  {integracaoAtiva.ativa ? "Ativa" : "Inativa"}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleAtiva(integracaoAtiva)}
                  className="text-slate-400 hover:text-white"
                >
                  <Power className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deletarIntegracaoMutation.mutate(integracaoAtiva.id)}
                  className="text-rose-400 hover:text-rose-300"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Conectado via OAuth</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm pt-2 border-t border-slate-700">
                <div>
                  <p className="text-slate-500">Transcrições</p>
                  <p className="text-slate-300">
                    {integracaoAtiva.configuracao?.capture_transcriptions ? "Ativada" : "Desativada"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Gravações</p>
                  <p className="text-slate-300">
                    {integracaoAtiva.configuracao?.capture_recordings ? "Ativada" : "Desativada"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-8 text-center space-y-4">
            <Video className="w-12 h-12 text-slate-600 mx-auto" />
            <div>
              <h3 className="text-lg font-medium text-white mb-2">Conectar Google Meet</h3>
              <p className="text-slate-400 text-sm mb-4">
                Conecte sua conta Google para gerar links do Meet e capturar transcrições
              </p>
              <Button onClick={handleConectar} className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-2" />
                Conectar com Google
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}