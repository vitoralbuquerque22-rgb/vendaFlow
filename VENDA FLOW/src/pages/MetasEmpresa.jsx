import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, Save, DollarSign, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export default function MetasEmpresa() {
  const queryClient = useQueryClient();
  const [metasEmpresa, setMetasEmpresa] = useState({});

  const { data: configEmpresa } = useQuery({
    queryKey: ["config-empresa"],
    queryFn: async () => {
      const configs = await base44.entities.ConfiguracaoMeta.list();
      return configs[0] || null;
    },
  });

  const salvarMetasEmpresaMutation = useMutation({
    mutationFn: async (data) => {
      if (configEmpresa) {
        return base44.entities.ConfiguracaoMeta.update(configEmpresa.id, data);
      }
      return base44.entities.ConfiguracaoMeta.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config-empresa"] });
      toast.success("Metas da empresa atualizadas!");
      setMetasEmpresa({});
    },
  });

  const getMetaEmpresaValue = (campo) => {
    if (metasEmpresa[campo] !== undefined) return metasEmpresa[campo];
    return configEmpresa?.[campo] || 0;
  };

  const handleMetaEmpresaChange = (campo, valor) => {
    setMetasEmpresa(prev => ({
      ...prev,
      [campo]: parseFloat(valor) || 0
    }));
  };

  const handleSalvarMetasEmpresa = async () => {
    const dados = {
      meta_leads: metasEmpresa.meta_leads ?? configEmpresa?.meta_leads ?? 100,
      meta_mql: metasEmpresa.meta_mql ?? configEmpresa?.meta_mql ?? 80,
      meta_conexoes: metasEmpresa.meta_conexoes ?? configEmpresa?.meta_conexoes ?? 60,
      meta_rm: metasEmpresa.meta_rm ?? configEmpresa?.meta_rm ?? 30,
      meta_rr: metasEmpresa.meta_rr ?? configEmpresa?.meta_rr ?? 25,
      meta_vendas: metasEmpresa.meta_vendas ?? configEmpresa?.meta_vendas ?? 15,
      meta_investimento_meta_ads: metasEmpresa.meta_investimento_meta_ads ?? configEmpresa?.meta_investimento_meta_ads ?? 0,
      meta_investimento_google_ads: metasEmpresa.meta_investimento_google_ads ?? configEmpresa?.meta_investimento_google_ads ?? 0,
      meta_investimento_total: metasEmpresa.meta_investimento_total ?? configEmpresa?.meta_investimento_total ?? 0,
      meta_faturamento_total: metasEmpresa.meta_faturamento_total ?? configEmpresa?.meta_faturamento_total ?? 500000,
      meta_ticket_medio: metasEmpresa.meta_ticket_medio ?? configEmpresa?.meta_ticket_medio ?? 25000,
      meta_quantidade_vendas: metasEmpresa.meta_quantidade_vendas ?? configEmpresa?.meta_quantidade_vendas ?? 20,
      meta_contratos_assinar: metasEmpresa.meta_contratos_assinar ?? configEmpresa?.meta_contratos_assinar ?? 30,
    };
    await salvarMetasEmpresaMutation.mutateAsync(dados);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Metas da Empresa</h1>
        <p className="text-slate-400 mt-1">Configure as metas gerais que serão exibidas nos relatórios e dashboards</p>
      </div>

      <Card className="bg-blue-500/10 border-blue-500/30">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Target className="w-5 h-5 text-blue-400 mt-0.5" />
            <div>
              <p className="text-blue-300 font-medium">Metas Gerais da Empresa</p>
              <p className="text-blue-200/70 text-sm mt-1">
                Configure as metas gerais que serão exibidas nos relatórios e dashboards. Esses valores são usados para calcular o desempenho geral da empresa.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* KPIs */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-[#ff6b35]" />
              Metas de KPIs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Meta de Leads</Label>
              <Input
                type="number"
                min="0"
                value={getMetaEmpresaValue("meta_leads")}
                onChange={(e) => handleMetaEmpresaChange("meta_leads", e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Meta de MQL (Marketing Qualified Leads)</Label>
              <Input
                type="number"
                min="0"
                value={getMetaEmpresaValue("meta_mql")}
                onChange={(e) => handleMetaEmpresaChange("meta_mql", e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Meta de Conexões</Label>
              <Input
                type="number"
                min="0"
                value={getMetaEmpresaValue("meta_conexoes")}
                onChange={(e) => handleMetaEmpresaChange("meta_conexoes", e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Meta de RM (Reuniões Marcadas)</Label>
              <Input
                type="number"
                min="0"
                value={getMetaEmpresaValue("meta_rm")}
                onChange={(e) => handleMetaEmpresaChange("meta_rm", e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Meta de RR (Reuniões Realizadas)</Label>
              <Input
                type="number"
                min="0"
                value={getMetaEmpresaValue("meta_rr")}
                onChange={(e) => handleMetaEmpresaChange("meta_rr", e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Meta de Vendas</Label>
              <Input
                type="number"
                min="0"
                value={getMetaEmpresaValue("meta_vendas")}
                onChange={(e) => handleMetaEmpresaChange("meta_vendas", e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
          </CardContent>
        </Card>

        {/* Investimentos */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-400" />
              Metas de Investimento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Meta Investimento Meta Ads (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={getMetaEmpresaValue("meta_investimento_meta_ads")}
                onChange={(e) => handleMetaEmpresaChange("meta_investimento_meta_ads", e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Meta Investimento Google Ads (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={getMetaEmpresaValue("meta_investimento_google_ads")}
                onChange={(e) => handleMetaEmpresaChange("meta_investimento_google_ads", e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Meta Investimento Total (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={getMetaEmpresaValue("meta_investimento_total")}
                onChange={(e) => handleMetaEmpresaChange("meta_investimento_total", e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="0,00"
              />
            </div>
          </CardContent>
        </Card>

        {/* Faturamento */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Metas de Faturamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Faturamento Total Mensal (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={getMetaEmpresaValue("meta_faturamento_total")}
                onChange={(e) => handleMetaEmpresaChange("meta_faturamento_total", e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="500.000,00"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Ticket Médio (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={getMetaEmpresaValue("meta_ticket_medio")}
                onChange={(e) => handleMetaEmpresaChange("meta_ticket_medio", e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="25.000,00"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Quantidade de Vendas no Mês</Label>
              <Input
                type="number"
                min="0"
                value={getMetaEmpresaValue("meta_quantidade_vendas")}
                onChange={(e) => handleMetaEmpresaChange("meta_quantidade_vendas", e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="20"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Contratos a Assinar no Mês</Label>
              <Input
                type="number"
                min="0"
                value={getMetaEmpresaValue("meta_contratos_assinar")}
                onChange={(e) => handleMetaEmpresaChange("meta_contratos_assinar", e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="30"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Botão Salvar Metas da Empresa */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="py-4">
          <Button
            onClick={handleSalvarMetasEmpresa}
            disabled={salvarMetasEmpresaMutation.isPending || Object.keys(metasEmpresa).length === 0}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            <Save className="w-4 h-4 mr-2" />
            {Object.keys(metasEmpresa).length > 0 ? "Salvar Metas da Empresa" : "Metas Salvas"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}