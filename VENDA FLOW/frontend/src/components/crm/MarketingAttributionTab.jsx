import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, MapPin, Clock, Hash, Link2, Loader2 } from "lucide-react";

function getValue(value) {
  return value && String(value).trim() !== "" ? String(value) : "-";
}

function formatDate(value) {
  if (!value) return "-";
  try {
    return format(new Date(value), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return value;
  }
}

function getLandingPage(value) {
  if (!value) return "Oficina Estruturada";
  if (value.includes("sessao-estrategica.base44.app")) return "Oficina Estruturada";
  return value;
}

function getSourceBadge(source) {
  const value = source?.toLowerCase() || "";
  if (value.includes("meta")) return "🟦 Meta Ads";
  if (value.includes("google")) return "🟩 Google Ads";
  if (value.includes("manychat")) return "🟪 ManyChat";
  if (value.includes("whatsapp")) return "🟨 WhatsApp";
  if (value.includes("instagram")) return "🟧 Instagram";
  if (value.includes("3c")) return "⚫ 3C";
  if (value.includes("indicação")) return "🔵 Indicação";
  return "⚪ Organic / Direto";
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-slate-700/50 last:border-0">
      <span className="text-slate-400 text-sm shrink-0">{label}</span>
      <span className="text-white text-sm text-right break-all">{getValue(value)}</span>
    </div>
  );
}

function Card({ icon: Icon, title, iconColor, children }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <h4 className="text-sm font-semibold text-white">{title}</h4>
      </div>
      {children}
    </div>
  );
}

export default function MarketingAttributionTab({ leadId }) {
  const { data, isLoading } = useQuery({
    queryKey: ["marketing-attribution", leadId],
    queryFn: async () => {
      const results = await api.entities.MarketingAttribution.filter({ lead_id: leadId });
      if (!results?.length) return null;
      return results.sort((a, b) => new Date(b.captured_at) - new Date(a.captured_at))[0];
    },
    enabled: !!leadId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4">
          <TrendingUp className="w-7 h-7 text-slate-500" />
        </div>
        <p className="text-white font-medium mb-2">Sem dados de atribuição</p>
        <p className="text-slate-400 text-sm max-w-sm">
          Este lead ainda não possui dados de atribuição de marketing. Os dados serão preenchidos automaticamente quando o lead for capturado através de canais rastreáveis.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-2">
      <Card icon={MapPin} title="📌 Aquisição" iconColor="text-orange-400">
        <InfoRow label="Origem" value={getSourceBadge(data.source)} />
        <InfoRow label="Canal" value={data.channel} />
        <InfoRow label="Campanha" value={data.campaign} />
        <InfoRow label="Criativo" value={data.content} />
        <InfoRow label="Público" value={data.audience} />
        <InfoRow label="Posicionamento" value={data.placement} />
        <InfoRow label="Página de Conversão" value={getLandingPage(data.landing_page)} />
      </Card>

      <Card icon={Clock} title="🧭 Jornada" iconColor="text-blue-400">
        <InfoRow label="Primeiro contato" value={formatDate(data.first_touch)} />
        <InfoRow label="Última interação" value={formatDate(data.last_touch)} />
        <InfoRow label="Capturado em" value={formatDate(data.captured_at)} />
      </Card>

      <Card icon={Hash} title="🆔 Identificadores" iconColor="text-purple-400">
        <InfoRow label="Campaign ID" value={data.campaign_id} />
        <InfoRow label="Adset ID" value={data.adset_id} />
        <InfoRow label="Ad ID" value={data.ad_id} />
        <InfoRow label="GCLID" value={data.gclid} />
      </Card>

      <Card icon={Link2} title="🔗 UTMs" iconColor="text-green-400">
        <InfoRow label="UTM Source" value={data.utm_source} />
        <InfoRow label="UTM Medium" value={data.utm_medium} />
        <InfoRow label="UTM Campaign" value={data.utm_campaign} />
        <InfoRow label="UTM Content" value={data.utm_content} />
        <InfoRow label="UTM Term" value={data.utm_term} />
      </Card>
    </div>
  );
}