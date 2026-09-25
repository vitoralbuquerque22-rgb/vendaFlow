import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { atualizarLead } from "@/lib/services/leadService";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Globe, Search, ArrowRight, RefreshCw, Copy, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { appParams } from "@/lib/app-params";

export default function LeadsExternos({ onImportarLead }) {
  const [busca, setBusca] = useState("");
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);
  const { empresaId } = useEmpresaAtual();
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60_000,
  });

  const { data: leadsExternos = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["leads-externos", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      // Busca em lotes para pegar o total real
      let todos = [];
      let skip = 0;
      const LOTE = 500;
      while (true) {
        const lote = await base44.entities.Lead.filter({ empresaId, fonte_externa: true }, "-created_date", LOTE, skip);
        if (!lote || lote.length === 0) break;
        todos = todos.concat(lote);
        if (lote.length < LOTE) break;
        skip += LOTE;
      }
      setUltimaAtualizacao(new Date());
      return todos;
    },
    enabled: !!empresaId,
  });

  const handleRefetch = () => {
    refetch();
  };

  const importarMutation = useMutation({
    mutationFn: async ({ id, lead }) => {
      await atualizarLead(id, { fonte_externa: false, campos_personalizados: { ...lead.campos_personalizados, importado_em: new Date().toISOString() } });
      // Registrar no histórico quem importou, data e hora
      await base44.entities.Atividade.create({
        empresaId: String(empresaId).trim(),
        lead_id: id,
        lead_nome: lead.nome,
        lead_telefone: lead.telefone,
        tipo: "anotacao",
        sdr_email: user?.email,
        resultado: "outro",
        observacao: `Lead importado da fila de leads externos por ${user?.full_name || user?.email} em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}. Origem: ${lead.app_origem || "webhook_externo"}.`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads-externos", empresaId] });
      toast.success("Lead importado para a base principal!");
    },
  });

  // URL do webhook para exibir ao usuário
  const appId = appParams.appId;
  const webhookUrl = `${window.location.origin}/api/apps/${appId}/functions/webhookReceberLead?empresaId=${empresaId || "SEU_EMPRESA_ID"}`;

  const copiarUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    toast.success("URL copiada!");
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const filtrados = leadsExternos.filter((l) =>
    !busca ||
    l.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    l.empresa?.toLowerCase().includes(busca.toLowerCase()) ||
    l.telefone?.includes(busca)
  );

  return (
    <div className="space-y-4">
      {/* Card com a URL do Webhook */}
      <Card className="bg-blue-500/10 border-blue-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-400" />
            URL do Webhook para Receber Leads
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-slate-400 text-sm">
            Configure no outro app para enviar um <code className="text-blue-300 bg-slate-800 px-1 rounded">POST</code> com JSON para esta URL quando um lead for criado:
          </p>
          <div className="flex gap-2 items-center">
            <Input
              readOnly
              value={webhookUrl}
              className="bg-slate-800 border-slate-600 text-slate-300 text-xs font-mono"
            />
            <Button
              onClick={copiarUrl}
              variant="outline"
              size="sm"
              className="border-blue-500/50 text-blue-400 hover:bg-blue-500/20 whitespace-nowrap"
            >
              {copiedUrl ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 text-xs text-slate-400 font-mono">
            <p className="text-slate-300 mb-1">Exemplo de body JSON:</p>
            <pre>{`{
  "nome": "João Silva",
  "telefone": "11999999999",
  "email": "joao@email.com",
  "empresa": "Empresa XYZ",
  "campanha": "Meta Ads - Junho",
  "app_origem": "meu-outro-app"
}`}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Leads Externos */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-400" />
                Leads Recebidos via Webhook
                <Badge className="bg-blue-500/20 text-blue-400 ml-1">{leadsExternos.length}</Badge>
              </CardTitle>
              {ultimaAtualizacao && (
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Atualizado às {format(ultimaAtualizacao, "HH:mm", { locale: ptBR })} — {format(ultimaAtualizacao, "dd/MM/yyyy", { locale: ptBR })}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefetch}
              disabled={isFetching}
              className="text-slate-400 hover:text-white"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar leads externos..."
              className="pl-10 bg-slate-700 border-slate-600 text-white"
            />
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-6 h-6 text-slate-400 animate-spin mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Carregando...</p>
            </div>
          ) : filtrados.length === 0 ? (
            <div className="text-center py-10">
              <Globe className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Nenhum lead externo recebido ainda.</p>
              <p className="text-slate-500 text-xs mt-1">Configure o webhook no outro app usando a URL acima.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-300">Nome</TableHead>
                    <TableHead className="text-slate-300">Empresa</TableHead>
                    <TableHead className="text-slate-300">Telefone</TableHead>
                    <TableHead className="text-slate-300">Origem</TableHead>
                    <TableHead className="text-slate-300">Recebido em</TableHead>
                    <TableHead className="text-slate-300 w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((lead) => (
                    <TableRow key={lead.id} className="border-slate-700 hover:bg-slate-700/30">
                      <TableCell className="text-white font-medium">{lead.nome}</TableCell>
                      <TableCell className="text-slate-300">{lead.empresa || "-"}</TableCell>
                      <TableCell className="text-slate-300">{lead.telefone}</TableCell>
                      <TableCell>
                        <Badge className={
                          lead.app_origem === "csv_import" || lead.app_origem === "importacao_csv"
                            ? "bg-emerald-500/20 text-emerald-400 text-xs"
                            : "bg-blue-500/20 text-blue-400 text-xs"
                        }>
                          {lead.app_origem === "csv_import" || lead.app_origem === "importacao_csv"
                            ? "📤 Upload CSV"
                            : `🌐 ${lead.app_origem || "webhook"}`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {lead.created_date
                          ? format(new Date(lead.created_date), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => importarMutation.mutate({ id: lead.id, lead })}
                          className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                          title="Mover para base principal"
                        >
                          <ArrowRight className="w-3 h-3 mr-1" />
                          Importar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}