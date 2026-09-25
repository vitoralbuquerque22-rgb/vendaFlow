import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarIcon, CheckCircle2, XCircle, ExternalLink, Copy, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import {
  isConnected, startOAuthFlow, clearToken,
  setClientId, setCalendarEmail as setCalendarEmailStorage,
  setTokenPersistence,
} from "@/lib/services/googleCalendarService";

export default function GoogleCalendarConfig() {
  const { empresaId } = useEmpresaAtual();
  const queryClient = useQueryClient();
  const [conectado, setConectado] = useState(isConnected());
  const [conectando, setConectando] = useState(false);
  const [clientIdInput, setClientIdInput] = useState("");
  const [calendarEmail, setCalendarEmail] = useState("");

  const origin = window.location.origin;
  const redirectUri = origin + "/google-oauth-callback";

  const { data: integracao } = useQuery({
    queryKey: ["integracao-gcal", empresaId],
    queryFn: async () => {
      const list = await base44.entities.Integracao.filter({ empresaId, tipo: "google_calendar" });
      return list[0] || null;
    },
    enabled: !!empresaId,
    onSuccess: (data) => {
      if (data?.configuracao?.client_id) {
        setClientId(data.configuracao.client_id);
        setClientIdInput(data.configuracao.client_id);
      }
      if (data?.configuracao?.calendar_email) {
        setCalendarEmailStorage(data.configuracao.calendar_email);
        setCalendarEmail(data.configuracao.calendar_email);
      }
      const dbToken = data?.configuracao?.token;
      if (dbToken?.access_token && dbToken.expires_at && Date.now() < dbToken.expires_at) {
        localStorage.setItem("vendaflow_google_token", JSON.stringify(dbToken));
        setConectado(true);
      }
    },
  });

  useEffect(() => {
    if (!integracao?.id || !empresaId) return;
    setTokenPersistence({
      onTokenSaved: async (token) => {
        const config = { ...(integracao.configuracao || {}), token };
        await base44.entities.Integracao.update(integracao.id, { configuracao: config });
        queryClient.invalidateQueries({ queryKey: ["integracao-gcal", empresaId] });
      },
      getTokenFromDB: async () => {
        const list = await base44.entities.Integracao.filter({ empresaId, tipo: "google_calendar" });
        return list[0]?.configuracao?.token || null;
      },
    });
  }, [integracao?.id, empresaId]);

  const salvarMutation = useMutation({
    mutationFn: async () => {
      if (!clientIdInput.trim()) throw new Error("Digite um Client ID válido");
      if (!calendarEmail.trim()) throw new Error("Digite o e-mail do Google Calendar de destino");
      const config = {
        empresaId,
        nome: "Google Calendar",
        tipo: "google_calendar",
        ativa: true,
        status_conexao: "ativa",
        configuracao: {
          ...(integracao?.configuracao || {}),
          client_id: clientIdInput.trim(),
          calendar_email: calendarEmail.trim(),
        },
      };
      if (integracao?.id) {
        return base44.entities.Integracao.update(integracao.id, config);
      }
      return base44.entities.Integracao.create(config);
    },
    onSuccess: () => {
      setClientId(clientIdInput.trim());
      setCalendarEmailStorage(calendarEmail.trim());
      queryClient.invalidateQueries({ queryKey: ["integracao-gcal", empresaId] });
      queryClient.invalidateQueries({ queryKey: ["integracoes"] });
      toast.success("Configuração salva com sucesso!");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleConectar = async () => {
    const cid = integracao?.configuracao?.client_id || clientIdInput.trim();
    if (!cid) { toast.error("Salve o Client ID primeiro"); return; }
    setClientId(cid);
    setConectando(true);
    try {
      await startOAuthFlow();
      setConectado(true);
      toast.success("Conta Google conectada! Token salvo para toda a empresa.");
    } catch (err) {
      toast.error(err.message || "Erro ao conectar com Google");
    } finally {
      setConectando(false);
    }
  };

  const handleDesconectar = async () => {
    clearToken();
    if (integracao?.id) {
      const config = { ...(integracao.configuracao || {}) };
      delete config.token;
      await base44.entities.Integracao.update(integracao.id, { configuracao: config });
      queryClient.invalidateQueries({ queryKey: ["integracao-gcal", empresaId] });
    }
    setConectado(false);
    toast.success("Conta Google desconectada");
  };

  const copiar = (text) => { navigator.clipboard.writeText(text); toast.success("Copiado!"); };

  const isConfigured = !!integracao?.configuracao?.client_id;
  const tokenSalvoNoBanco = !!integracao?.configuracao?.token?.access_token;

  return (
    <div className="space-y-6">

      <div className={`flex items-center gap-3 p-4 rounded-xl border ${conectado ? "bg-emerald-500/8 border-emerald-500/30" : "bg-white/3 border-white/8"}`}>
        {conectado
          ? <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          : <XCircle className="w-5 h-5 text-slate-500 flex-shrink-0" />}
        <div className="flex-1">
          <p className="font-medium text-white text-sm">
            {conectado ? "Conta Google conectada" : "Não conectado"}
          </p>
          <p className="text-xs text-slate-400">
            {conectado
              ? `Calendário: ${integracao?.configuracao?.calendar_email || "—"}`
              : "Configure o Client ID, o e-mail do calendário e autorize a conta"}
          </p>
        </div>
        {conectado && (
          <Button size="sm" variant="ghost" onClick={handleDesconectar} className="text-rose-400 hover:text-rose-300 text-xs">
            Desconectar
          </Button>
        )}
      </div>

      {tokenSalvoNoBanco && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
          Token compartilhado salvo no banco — todos os SDRs e closers criam eventos automaticamente sem precisar autorizar novamente.
        </div>
      )}

      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
            <p className="font-semibold text-white text-sm">Criar credenciais no Google Cloud Console</p>
          </div>
          <p className="text-slate-400 text-xs ml-8">
            Acesse o Google Cloud Console, crie um projeto, ative a <strong className="text-white">Google Calendar API</strong> e crie credenciais OAuth 2.0 do tipo <strong className="text-white">Aplicativo da Web</strong>.
          </p>
          <div className="ml-8 space-y-2">
            <div>
              <Label className="text-xs text-slate-500 mb-1">Origens JavaScript autorizadas</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-slate-900 text-emerald-300 px-3 py-2 rounded-lg border border-slate-700 font-mono truncate">{origin}</code>
                <Button size="sm" variant="ghost" onClick={() => copiar(origin)} className="text-slate-400 hover:text-white p-1.5"><Copy className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-500 mb-1">URI de redirecionamento autorizado</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-slate-900 text-emerald-300 px-3 py-2 rounded-lg border border-slate-700 font-mono truncate">{redirectUri}</code>
                <Button size="sm" variant="ghost" onClick={() => copiar(redirectUri)} className="text-slate-400 hover:text-white p-1.5"><Copy className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          </div>
          <div className="ml-8">
            <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
              Abrir Google Cloud Console <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
            <p className="font-semibold text-white text-sm">Configurar Client ID e calendário de destino</p>
          </div>
          <div className="ml-8 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Client ID OAuth 2.0</Label>
              <Input
                value={clientIdInput}
                onChange={(e) => setClientIdInput(e.target.value)}
                placeholder="xxxxxxxxxx.apps.googleusercontent.com"
                className="bg-slate-900 border-slate-700 text-white font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400 flex items-center gap-1">
                <Mail className="w-3 h-3" /> E-mail do Google Calendar de destino
              </Label>
              <Input
                value={calendarEmail}
                onChange={(e) => setCalendarEmail(e.target.value)}
                placeholder="agendamento@suaempresa.com"
                className="bg-slate-900 border-slate-700 text-white text-sm"
              />
              <p className="text-xs text-slate-500">Todos os eventos serão criados neste calendário</p>
            </div>
            <Button onClick={() => salvarMutation.mutate()} disabled={salvarMutation.isPending} className="bg-blue-600 hover:bg-blue-500">
              {salvarMutation.isPending ? <><RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />Salvando...</> : "Salvar configuração"}
            </Button>
            {isConfigured && (
              <p className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Configuração salva no banco de dados da empresa
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
            <p className="font-semibold text-white text-sm">Autorizar a conta Google centralizada</p>
          </div>
          <p className="text-slate-400 text-xs ml-8">
            Autorize <strong className="text-white">uma única vez</strong> com a conta <strong className="text-white">{integracao?.configuracao?.calendar_email || "do calendário"}</strong>. O token é salvo no banco e compartilhado com todos os usuários da empresa. Quando expirar, o sistema renova automaticamente.
          </p>
          <div className="ml-8">
            {conectado ? (
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" /> Autorizado — pronto para criar eventos com Meet
              </div>
            ) : (
              <Button onClick={handleConectar} disabled={!isConfigured || conectando} className="bg-red-600 hover:bg-red-500">
                <CalendarIcon className="w-4 h-4 mr-2" />
                {conectando ? "Aguardando autorização..." : "Autorizar conta Google"}
              </Button>
            )}
            {!isConfigured && <p className="text-xs text-slate-500 mt-2">⚠ Salve a configuração primeiro (Passo 2)</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}