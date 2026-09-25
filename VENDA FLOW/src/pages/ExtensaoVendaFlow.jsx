import { useState } from "react";
import { Chrome, Download, CheckCircle2, ExternalLink, Zap, Mic, Phone, Shield, AlertTriangle, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useExtensaoChrome } from "@/hooks/useExtensaoChrome";
import { cn } from "@/lib/utils";

const CHROME_STORE_URL = "https://chromewebstore.google.com/detail/vendaflow/nndlffemnmnhlbjkldipfcbbhadifngj";
const ZIP_URL = "https://base44.app/api/apps/69e11c2813fb5764089835e3/files/mp/public/69e11c2813fb5764089835e3/8bb6c6318_vendaflow-extension-12.zip";

const STEPS = [
  {
    num: 1,
    title: "Baixe a extensão",
    desc: "Clique no botão abaixo para baixar o arquivo da extensão VendaFLOW.",
    icon: Download,
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/20",
  },
  {
    num: 2,
    title: "Descompacte o arquivo ZIP",
    desc: 'Extraia o conteúdo do arquivo .zip em uma pasta de fácil acesso (ex: "Documentos/VendaFLOW Extension").',
    icon: Zap,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
  },
  {
    num: 3,
    title: 'Abra "Extensões" no Chrome',
    desc: 'No Chrome, acesse chrome://extensions ou clique no menu (⋮) → Mais ferramentas → Extensões.',
    icon: Chrome,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    code: "chrome://extensions",
  },
  {
    num: 4,
    title: 'Ative o "Modo do desenvolvedor"',
    desc: 'No canto superior direito da página de extensões, ative a chave "Modo do desenvolvedor".',
    icon: Shield,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  {
    num: 5,
    title: 'Clique em "Carregar sem compactação"',
    desc: "Clique no botão que aparece após ativar o modo desenvolvedor e selecione a pasta que você extraiu no passo 2.",
    icon: CheckCircle2,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
  },
  {
    num: 6,
    title: "Pronto! Recarregue o VendaFLOW",
    desc: "Após instalar, recarregue esta página. O softphone detectará automaticamente a extensão.",
    icon: CheckCircle2,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
];

const FEATURES = [
  { icon: Mic, title: "Áudio WebRTC", desc: "Habilita microfone e áudio para ligações automáticas via campanha 3C Plus." },
  { icon: Phone, title: "Discagem automática", desc: "Permite que o discador automático conecte chamadas diretamente no seu navegador." },
  { icon: Zap, title: "Modo manual", desc: "Discagem manual com teclado numérico sem depender de softphone externo." },
  { icon: Shield, title: "Segurança local", desc: "A extensão roda localmente no seu navegador. Nenhum dado é enviado a terceiros." },
];

function CodeSnippet({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center gap-2 mt-2 bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2">
      <code className="text-xs text-sky-300 font-mono flex-1">{text}</code>
      <button onClick={copy} className="text-slate-500 hover:text-white transition-colors flex-shrink-0">
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

export default function ExtensaoVendaFlow() {
  const { instalada } = useExtensaoChrome();

  return (
    <div className="min-h-screen bg-[#070b12] text-white">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-10">

        {/* ── Hero ────────────────────────────────────────────── */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500/20 to-violet-500/20 border border-sky-500/30 mb-2">
            <Chrome className="w-8 h-8 text-sky-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Extensão Chrome
            <span className="ml-2 bg-gradient-to-r from-sky-400 to-violet-400 bg-clip-text text-transparent">VendaFLOW</span>
          </h1>
          <p className="text-slate-400 text-base max-w-xl mx-auto leading-relaxed">
            Necessária para habilitar ligações com áudio via campanha automática do 3C Plus diretamente no seu navegador.
          </p>

          {/* Status badge */}
          <div className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold",
            instalada
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-amber-500/10 border-amber-500/30 text-amber-400"
          )}>
            <div className={cn("w-2 h-2 rounded-full", instalada ? "bg-emerald-400" : "bg-amber-400 animate-pulse")} />
            {instalada ? "✓ Extensão detectada e ativa" : "⚠ Extensão não detectada"}
          </div>
        </div>

        {/* ── Download CTA ─────────────────────────────────────── */}
        {!instalada && (
          <div className="rounded-2xl bg-gradient-to-br from-sky-500/10 to-violet-500/10 border border-sky-500/20 p-6 flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 text-center sm:text-left">
              <p className="font-semibold text-white">Instale agora a extensão VendaFLOW</p>
              <p className="text-sm text-slate-400 mt-1">Arquivo ZIP — instalação manual em segundos</p>
            </div>
            <a href={ZIP_URL} download="Extension VendaFlow 1.2.zip">
              <Button className="bg-gradient-to-r from-sky-500 to-violet-500 hover:from-sky-400 hover:to-violet-400 text-white font-semibold px-6 gap-2 rounded-xl shadow-lg shadow-sky-500/20">
                <Download className="w-4 h-4" />
                Baixar Extensão (.zip)
              </Button>
            </a>
          </div>
        )}

        {instalada && (
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/25 p-6 flex items-center gap-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-emerald-300">Extensão instalada e funcionando!</p>
              <p className="text-sm text-emerald-400/70 mt-0.5">Você pode usar ligações automáticas normalmente.</p>
            </div>
          </div>
        )}

        {/* ── Por que precisa? ──────────────────────────────────── */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Por que a extensão é necessária?</h2>
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-300/90 leading-relaxed">
              O VendaFLOW roda dentro de um <strong>iframe com CSP restritivo</strong> que bloqueia conexões WebSocket e WebRTC diretas.
              A extensão contorna isso ao registrar o ramal e gerenciar o áudio fora do contexto do iframe, diretamente no contexto privilegiado do Chrome.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3 p-4 rounded-xl bg-slate-800/40 border border-slate-700/40">
                <div className="w-8 h-8 rounded-lg bg-slate-700/60 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-sky-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-snug">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Passo a passo ─────────────────────────────────────── */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Como instalar — passo a passo</h2>
          <div className="space-y-3">
            {STEPS.map(({ num, title, desc, icon: Icon, color, bg, border, code }) => (
              <div key={num} className={cn("flex items-start gap-4 p-4 rounded-xl border", bg, border)}>
                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0", bg, border, "border")}>
                  <span className={color}>{num}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
                  {code && <CodeSnippet text={code} />}
                </div>
                <Icon className={cn("w-4 h-4 flex-shrink-0 mt-0.5", color)} />
              </div>
            ))}
          </div>
        </div>

        {/* ── Troubleshooting ───────────────────────────────────── */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Problemas comuns</h2>
          {[
            { q: "A extensão foi instalada mas não é detectada", a: 'Recarregue a página do VendaFLOW (F5). Se persistir, vá em chrome://extensions e confirme que a extensão está ativada (toggle azul).' },
            { q: "Botão 'Carregar sem compactação' não aparece", a: 'Certifique-se de que o "Modo do desenvolvedor" está ativado no canto superior direito da página chrome://extensions.' },
            { q: "Erro ao selecionar a pasta", a: 'Selecione a pasta raiz extraída do ZIP (onde está o arquivo manifest.json), não o arquivo ZIP em si.' },
            { q: "Áudio não funciona mesmo com extensão ativa", a: 'Verifique se o Chrome tem permissão de microfone para o VendaFLOW em Configurações → Privacidade e segurança → Configurações do site → Microfone.' },
          ].map(({ q, a }) => (
            <div key={q} className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/40 space-y-1">
              <p className="text-sm font-semibold text-white">❓ {q}</p>
              <p className="text-xs text-slate-400 leading-relaxed">💡 {a}</p>
            </div>
          ))}
        </div>

        {/* ── Footer ───────────────────────────────────────────── */}
        <div className="text-center pt-4 border-t border-slate-800">
          <p className="text-xs text-slate-600">
            VendaFLOW Extension · Versão compatível com Chrome 100+ · Suporte:{" "}
            <a href="mailto:suporte@vendaflow.com.br" className="text-sky-400 hover:underline">suporte@vendaflow.com.br</a>
          </p>
        </div>
      </div>
    </div>
  );
}