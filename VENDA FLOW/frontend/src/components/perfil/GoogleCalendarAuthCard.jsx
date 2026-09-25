import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import {
  isConnected, startOAuthFlow, clearToken,
  setClientId, setCalendarEmail as setCalendarEmailStorage,
} from "@/lib/services/googleCalendarService";
import { Calendar, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import GlassCard from "./GlassCard";

export default function GoogleCalendarAuthCard() {
  const { empresaId } = useEmpresaAtual();
  const [conectado, setConectado] = useState(isConnected());
  const [conectando, setConectando] = useState(false);

  // Carrega a configuração do banco para sincronizar o clientId no localStorage
  const { data: integracao } = useQuery({
    queryKey: ["integracao-gcal", empresaId],
    queryFn: async () => {
      const list = await api.entities.Integracao.filter({ empresaId, tipo: "google_calendar" });
      return list[0] || null;
    },
    enabled: !!empresaId,
  });

  // Quando a config chega do banco, sincroniza no localStorage para o serviço usar
  useEffect(() => {
    if (integracao?.configuracao?.client_id) {
      setClientId(integracao.configuracao.client_id);
    }
    if (integracao?.configuracao?.calendar_email) {
      setCalendarEmailStorage(integracao.configuracao.calendar_email);
    }
  }, [integracao]);

  const isConfigured = !!integracao?.configuracao?.client_id;

  const handleConectar = async () => {
    setConectando(true);
    try {
      await startOAuthFlow();
      setConectado(true);
      toast.success("Conta Google conectada com sucesso!");
    } catch (err) {
      toast.error(err.message || "Erro ao conectar com Google");
    } finally {
      setConectando(false);
    }
  };

  const handleDesconectar = () => {
    clearToken();
    setConectado(false);
    toast.success("Conta Google desconectada");
  };

  // Não exibe o card se a empresa não configurou o Google Calendar ainda
  if (!isConfigured && !integracao) return null;

  return (
    <GlassCard glow="sky">
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Calendar className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-xs font-bold tracking-widest uppercase text-slate-500">Google Calendar</span>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl border"
          style={{
            background: conectado ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.03)",
            borderColor: conectado ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.08)",
          }}>
          {conectado
            ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            : <XCircle className="w-4 h-4 text-slate-500 flex-shrink-0" />}
          <p className="text-sm font-medium text-white flex-1">
            {conectado ? "Conta Google autorizada" : "Não autorizado"}
          </p>
        </div>

        <p className="text-xs text-slate-500">
          {conectado
            ? "Você pode agendar reuniões com Google Meet diretamente pelo sistema."
            : "Autorize sua conta Google para agendar reuniões com Meet."}
        </p>

        {conectado ? (
          <Button size="sm" variant="ghost" onClick={handleDesconectar}
            className="w-full text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs h-8">
            Desconectar conta Google
          </Button>
        ) : (
          <Button size="sm" onClick={handleConectar} disabled={!isConfigured || conectando}
            className="w-full bg-sky-600 hover:bg-sky-500 text-white text-xs h-8">
            <Calendar className="w-3.5 h-3.5 mr-1.5" />
            {conectando ? "Aguardando autorização..." : "Autorizar minha conta Google"}
          </Button>
        )}

        {!isConfigured && (
          <p className="text-xs text-amber-500/80 text-center">⚠ Admin precisa configurar a integração primeiro</p>
        )}
      </div>
    </GlassCard>
  );
}