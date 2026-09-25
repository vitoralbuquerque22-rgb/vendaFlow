import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Mail, List, Search, AlertTriangle, Crown, TrendingUp } from "lucide-react";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { cn } from "@/lib/utils";
import TemplateManager from "@/components/email-marketing/TemplateManager";
import CampanhaManager from "@/components/email-marketing/CampanhaManager";
import SequenciaManager from "@/components/email-marketing/SequenciaManager";

const LIMITE_GRATUITO = 100;

export default function EmailMarketing() {
  const [abaPrincipal, setAbaPrincipal] = useState("templates");
  const [modalCampanha, setModalCampanha] = useState(false);
  const [busca, setBusca] = useState("");
  const { empresaId } = useEmpresaAtual();

  const { data: user } = useQuery({ queryKey: ["me"], queryFn: () => api.auth.me() });

  const { data: templates = [] } = useQuery({
    queryKey: ["email-templates", empresaId],
    queryFn: () => api.entities.EmailTemplate.filter({ empresaId }),
    enabled: !!empresaId,
  });

  const { data: envios = [] } = useQuery({
    queryKey: ["email-envios", empresaId],
    queryFn: async () => {
      const hoje = new Date();
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const lista = await api.entities.EmailEnvio.filter({ empresaId }, "-created_date");
      return lista.filter(e => new Date(e.created_date) >= inicioMes);
    },
    enabled: !!empresaId,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads", empresaId],
    queryFn: () => api.entities.Lead.filter({ empresaId }),
    enabled: !!empresaId,
  });

  const { data: campanhasAgendadas = [] } = useQuery({
    queryKey: ["campanhas-agendadas", empresaId],
    queryFn: () => api.entities.CampanhaAgendada.filter({ empresaId }, "-created_date"),
    enabled: !!empresaId,
  });

  const enviosRestantes = LIMITE_GRATUITO - envios.length;
  const porcentagemUsada = (envios.length / LIMITE_GRATUITO) * 100;
  const taxaAberturas = envios.length > 0 ? Math.round((envios.filter(e => e.abriu).length / envios.length) * 100) : 0;
  const taxaCliques  = envios.length > 0 ? Math.round((envios.filter(e => e.clicou).length / envios.length) * 100) : 0;
  const campanhasEnviadas  = campanhasAgendadas.filter(c => c.status === "enviado");
  const campanhasPendentes = campanhasAgendadas.filter(c => c.status === "pendente");
  const totalDisparosRealizados = campanhasEnviadas.reduce((sum, c) => sum + (c.total_enviados || 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">E-mail Marketing</h1>
          <p className="text-slate-400 mt-1">Gerencie templates e envie campanhas automatizadas</p>
        </div>
      </div>

      {/* Alerta de Limite */}
      {porcentagemUsada >= 80 && (
        <Card className={cn("border-2", porcentagemUsada >= 100 ? "bg-rose-500/10 border-rose-500" : "bg-amber-500/10 border-amber-500")}>
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className={cn("w-5 h-5 mt-0.5", porcentagemUsada >= 100 ? "text-rose-400" : "text-amber-400")} />
              <div className="flex-1">
                <h3 className={cn("font-semibold", porcentagemUsada >= 100 ? "text-rose-400" : "text-amber-400")}>
                  {porcentagemUsada >= 100 ? "Limite Atingido!" : "Atenção: Limite Próximo"}
                </h3>
                <p className="text-slate-300 text-sm mt-1">
                  Você usou <strong>{envios.length}</strong> de <strong>{LIMITE_GRATUITO}</strong> envios gratuitos este mês.
                  {porcentagemUsada >= 100 && " Para continuar enviando, faça upgrade para um plano pago."}
                </p>
                <Button size="sm" className="mt-3 bg-purple-600 hover:bg-purple-700"><Crown className="w-4 h-4 mr-2" />Fazer Upgrade</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Disparos Realizados", value: totalDisparosRealizados, sub: `${campanhasEnviadas.length} campanhas`, color: "emerald" },
          { label: "Disparos Pendentes", value: campanhasPendentes.length, sub: "Agendados", color: "amber" },
          { label: "Taxa de Abertura", value: `${taxaAberturas}%`, sub: `${envios.filter(e => e.abriu).length} de ${envios.length}`, color: "purple" },
          { label: "Taxa de Cliques", value: `${taxaCliques}%`, sub: `${envios.filter(e => e.clicou).length} clicaram`, color: "rose" },
        ].map(({ label, value, sub, color }) => (
          <Card key={label} className={`bg-${color}-500/10 border-${color}-500/30`}>
            <CardContent className="py-4">
              <p className={`text-${color}-300 text-xs mb-1`}>{label}</p>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-slate-400 mt-1">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Abas */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="py-3">
          <div className="flex gap-2">
            <Button onClick={() => setAbaPrincipal("templates")} variant={abaPrincipal === "templates" ? "default" : "ghost"} className={cn("flex-1", abaPrincipal === "templates" && "bg-blue-600 hover:bg-blue-700")}>
              <Mail className="w-4 h-4 mr-2" />Templates<Badge className="ml-2 bg-slate-700">{templates.length}</Badge>
            </Button>
            <Button onClick={() => setAbaPrincipal("sequencias")} variant={abaPrincipal === "sequencias" ? "default" : "ghost"} className={cn("flex-1", abaPrincipal === "sequencias" && "bg-purple-600 hover:bg-purple-700")}>
              <List className="w-4 h-4 mr-2" />Sequências
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Busca compartilhada */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={abaPrincipal === "templates" ? "Buscar templates..." : "Buscar sequências..."} className="pl-10 bg-slate-700 border-slate-600 text-white" />
          </div>
        </CardContent>
      </Card>

      {/* Conteúdo das abas */}
      {abaPrincipal === "templates" && (
        <TemplateManager templates={templates} empresaId={empresaId} user={user} busca={busca} setBusca={setBusca} onEnviarCampanha={() => setModalCampanha(true)} enviosRestantes={enviosRestantes} />
      )}

      {abaPrincipal === "sequencias" && (
        <SequenciaManager campanhasAgendadas={campanhasAgendadas} templates={templates} leads={leads} empresaId={empresaId} user={user} busca={busca} />
      )}

      {/* Modal Campanha */}
      <CampanhaManager open={modalCampanha} onClose={() => setModalCampanha(false)} templates={templates} leads={leads} envios={envios} empresaId={empresaId} user={user} />
    </div>
  );
}