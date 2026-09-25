/**
 * ExtensaoStatus — badges e avisos sobre a extensão Chrome VendaFLOW
 *
 * Exporta:
 * - ExtensaoBadge       : "ext ✓" compacto quando detectada
 * - ExtensaoAvisoInstalacao : banner de aviso com link para instalação
 */
import { ExternalLink, AlertTriangle, Chrome } from "lucide-react";
import { Link } from "react-router-dom";

// Link direto para a página de documentação de instalação
const DOC_PATH = "/ExtensaoVendaFlow";
// ZIP de download direto
const ZIP_URL = "/extensao/vendaflow-extension.zip";

// O ramal agora é registrado pelo próprio CRM (RamalWebRTC, com JsSIP), que responde ao mesmo
// protocolo da extensão — por isso "instalada" fica verdadeiro sem extensão nenhuma.
export function ExtensaoBadge({ instalada }) {
  if (!instalada) return null;
  return (
    <span
      title="Ramal WebRTC registrado pelo CRM"
      className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-1.5 py-0.5 flex-shrink-0 select-none"
    >
      webrtc ✓
    </span>
  );
}

export function ExtensaoAvisoInstalacao() {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-amber-300">Extensão VendaFLOW não detectada</p>
        <p className="text-[10px] text-amber-400/70 mt-0.5 leading-snug">
          Sem ela, ligações automáticas não terão áudio.
        </p>
        <div className="flex items-center gap-2 mt-2">
          <a
            href={ZIP_URL}
            download="Extension VendaFlow 1.2.zip"
            className="flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/15 border border-amber-500/25 rounded-lg px-2 py-1 hover:bg-amber-500/25 transition-colors"
          >
            <Chrome className="w-3 h-3" />
            Baixar (.zip)
          </a>
          <Link
            to={DOC_PATH}
            className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-white transition-colors"
          >
            Ver instruções
            <ExternalLink className="w-2.5 h-2.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}