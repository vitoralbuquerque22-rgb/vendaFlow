import { useState } from "react";
import { api } from "@/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Phone, Megaphone, FileText, CheckCircle2, XCircle, AlertCircle, GraduationCap, DollarSign, Zap, Calendar as CalendarIcon, Video, Mail, Lock, Globe } from "lucide-react";
import LeadsExternos from "@/components/crm/LeadsExternos";
import TelefoniaConfig from "@/components/integracoes/TelefoniaConfig";
import AnunciosConfig from "@/components/integracoes/AnunciosConfig";
import FormulariosConfig from "@/components/integracoes/FormulariosConfig";
import HotmartConfig from "@/components/integracoes/HotmartConfig";
import AsaasConfig from "@/components/integracoes/AsaasConfig";
import KiwifyConfig from "@/components/integracoes/KiwifyConfig";
import GoogleCalendarConfig from "@/components/integracoes/GoogleCalendarConfig";
import GoogleMeetConfig from "@/components/integracoes/GoogleMeetConfig";
import { toast } from "sonner";

export default function Integracoes() {
  const [abaAtiva, setAbaAtiva] = useState("telefonia");
  const queryClient = useQueryClient();

  const { data: integracoes = [] } = useQuery({
    queryKey: ["integracoes"],
    queryFn: () => api.entities.Integracao.list(),
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case "ativa":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case "erro":
        return <XCircle className="w-4 h-4 text-rose-400" />;
      default:
        return <AlertCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  const integracoesTelefonia = integracoes.filter(i => i.tipo === "telefonia");
  const integracoesAnuncios = integracoes.filter(i => i.tipo === "meta_ads" || i.tipo === "google_ads");
  const integracoesFormularios = integracoes.filter(i => i.tipo === "typeform" || i.tipo === "wordpress");
  const integracoesHotmart = integracoes.filter(i => i.tipo === "hotmart");
  const integracoesAsaas = integracoes.filter(i => i.tipo === "asaas");
  const integracoesKiwify = integracoes.filter(i => i.tipo === "kiwify");
  const integracoesGoogleCalendar = integracoes.filter(i => i.tipo === "google_calendar");
  const integracoesGoogleMeet = integracoes.filter(i => i.tipo === "google_meet");

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Integrações & APIs</h1>
        <p className="text-slate-400 mt-1">Conecte telefonia, anúncios e formulários ao CRM</p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Telefonia</p>
                <p className="text-2xl font-bold text-white">{integracoesTelefonia.length}</p>
              </div>
              <Phone className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Anúncios</p>
                <p className="text-2xl font-bold text-white">{integracoesAnuncios.length}</p>
              </div>
              <Megaphone className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Formulários</p>
                <p className="text-2xl font-bold text-white">{integracoesFormularios.length}</p>
              </div>
              <FileText className="w-8 h-8 text-emerald-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Hotmart</p>
                <p className="text-2xl font-bold text-white">{integracoesHotmart.length}</p>
              </div>
              <GraduationCap className="w-8 h-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Asaas</p>
                <p className="text-2xl font-bold text-white">{integracoesAsaas.length}</p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Kiwify</p>
                <p className="text-2xl font-bold text-white">{integracoesKiwify.length}</p>
              </div>
              <Zap className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Calendar</p>
                <p className="text-2xl font-bold text-white">{integracoesGoogleCalendar.length}</p>
              </div>
              <CalendarIcon className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Meet</p>
                <p className="text-2xl font-bold text-white">{integracoesGoogleMeet.length}</p>
              </div>
              <Video className="w-8 h-8 text-indigo-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger value="telefonia" className="data-[state=active]:bg-purple-600">
            <Phone className="w-4 h-4 mr-2" />
            Telefonia
          </TabsTrigger>
          <TabsTrigger value="anuncios" className="data-[state=active]:bg-blue-600">
            <Megaphone className="w-4 h-4 mr-2" />
            Anúncios
          </TabsTrigger>
          <TabsTrigger value="formularios" className="data-[state=active]:bg-emerald-600">
            <FileText className="w-4 h-4 mr-2" />
            Formulários
          </TabsTrigger>
          <TabsTrigger value="hotmart" className="data-[state=active]:bg-orange-600">
            <GraduationCap className="w-4 h-4 mr-2" />
            Hotmart
          </TabsTrigger>
          <TabsTrigger value="asaas" className="data-[state=active]:bg-blue-600">
            <DollarSign className="w-4 h-4 mr-2" />
            Asaas
          </TabsTrigger>
          <TabsTrigger value="kiwify" className="data-[state=active]:bg-green-600">
            <Zap className="w-4 h-4 mr-2" />
            Kiwify
          </TabsTrigger>
          <TabsTrigger value="google_calendar" className="data-[state=active]:bg-red-600">
            <CalendarIcon className="w-4 h-4 mr-2" />
            Google Calendar
          </TabsTrigger>
          <TabsTrigger value="google_meet" className="data-[state=active]:bg-indigo-600">
            <Video className="w-4 h-4 mr-2" />
            Google Meet
          </TabsTrigger>
          <TabsTrigger value="api_email" className="data-[state=active]:bg-purple-600">
            <Mail className="w-4 h-4 mr-2" />
            API E-mail Marketing
          </TabsTrigger>
          <TabsTrigger value="webhook" className="data-[state=active]:bg-blue-600">
            <Globe className="w-4 h-4 mr-2" />
            Webhook Leads
          </TabsTrigger>
        </TabsList>

        <TabsContent value="telefonia" className="mt-6">
          <TelefoniaConfig integracoes={integracoesTelefonia} />
        </TabsContent>

        <TabsContent value="anuncios" className="mt-6">
          <AnunciosConfig integracoes={integracoesAnuncios} />
        </TabsContent>

        <TabsContent value="formularios" className="mt-6">
          <FormulariosConfig integracoes={integracoesFormularios} />
        </TabsContent>

        <TabsContent value="hotmart" className="mt-6">
          <HotmartConfig integracoes={integracoesHotmart} />
        </TabsContent>

        <TabsContent value="asaas" className="mt-6">
          <AsaasConfig integracoes={integracoesAsaas} />
        </TabsContent>

        <TabsContent value="kiwify" className="mt-6">
          <KiwifyConfig integracoes={integracoesKiwify} />
        </TabsContent>

        <TabsContent value="google_calendar" className="mt-6">
          <GoogleCalendarConfig integracoes={integracoesGoogleCalendar} />
        </TabsContent>

        <TabsContent value="google_meet" className="mt-6">
          <GoogleMeetConfig integracoes={integracoesGoogleMeet} />
        </TabsContent>

        <TabsContent value="api_email" className="mt-6">
          <Card className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-purple-500/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Mail className="w-6 h-6 text-purple-400" />
                API de E-mail Marketing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-6 bg-slate-900/50 rounded-lg border border-slate-700">
                <div className="flex items-start gap-4">
                  <Lock className="w-12 h-12 text-purple-400 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Recurso Premium Disponível
                    </h3>
                    <p className="text-slate-300 mb-4">
                      Integre seu sistema de e-mail marketing externo ao CRM através de nossa API REST completa.
                    </p>
                    
                    <div className="space-y-2 mb-6">
                      <div className="flex items-center gap-2 text-slate-300 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Criar templates via API
                      </div>
                      <div className="flex items-center gap-2 text-slate-300 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Enviar campanhas e sequências automatizadas
                      </div>
                      <div className="flex items-center gap-2 text-slate-300 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Webhook para eventos de abertura e cliques
                      </div>
                      <div className="flex items-center gap-2 text-slate-300 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Métricas e relatórios via API
                      </div>
                      <div className="flex items-center gap-2 text-slate-300 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Rastreamento completo de engajamento
                      </div>
                    </div>

                    <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30 mb-4">
                      <p className="text-blue-300 text-sm">
                        💡 <strong>Casos de uso:</strong> Mailchimp, SendGrid, ActiveCampaign, RD Station e outros sistemas de automação de marketing
                      </p>
                    </div>

                    <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                      Ativar API Premium
                    </Button>
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-500 text-center">
                Entre em contato com o suporte para ativar este recurso
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="webhook" className="mt-6">
          <LeadsExternos />
        </TabsContent>
      </Tabs>
    </div>
  );
}