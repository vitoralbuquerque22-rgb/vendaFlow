import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Mic, X, ExternalLink, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PainelSpyMonitoramento({ spyAtivo, setSpyAtivo, infoCliente, onAcao, acaoProcessando }) {
  if (!spyAtivo) return null;

  const { agente, modo } = spyAtivo;
  const info = infoCliente?.[agente.id];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20, scale: 0.97 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 20, scale: 0.97 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="fixed bottom-4 right-[340px] z-[90] w-[340px]"
      >
        <div className="rounded-2xl bg-zinc-950/95 border border-violet-500/25 shadow-[0_20px_60px_rgba(0,0,0,0.7)] backdrop-blur-2xl overflow-hidden">

          {/* Header */}
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-500/20 to-sky-500/20 border border-violet-500/20 flex items-center justify-center">
                {modo === 'spy' ? <Eye className="w-3.5 h-3.5 text-violet-400" /> : <Mic className="w-3.5 h-3.5 text-sky-400" />}
              </div>
              <div>
                <p className="text-xs font-semibold text-white">
                  {modo === 'spy' ? 'Modo Spy' : 'Modo Whisper'} — {agente.nome}
                </p>
                <p className="text-[10px] text-slate-500">
                  {modo === 'spy' ? 'Ouvindo a ligação' : 'Falando com o agente'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-mono text-emerald-400">AO VIVO</span>
            </div>
          </div>

          {/* Grid info */}
          <div className="grid grid-cols-2 gap-px bg-white/[0.04] border-b border-white/[0.06]">
            {/* Info cliente */}
            <div className="bg-zinc-950/80 px-3 py-3 space-y-2">
              <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Info Cliente</p>
              {info?.lead ? (
                <>
                  <div>
                    <p className="text-[10px] text-slate-500">Nome</p>
                    <p className="text-[11px] font-semibold text-white truncate">{info.lead.nome}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">Telefone</p>
                    <p className="text-[11px] font-mono text-sky-400">{info.sessao?.lead_telefone || '—'}</p>
                  </div>
                  <a
                    href={`/Leads?id=${info.lead.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    <ExternalLink className="w-2.5 h-2.5" /> Abrir lead
                  </a>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-[10px] text-slate-500">Telefone</p>
                    <p className="text-[11px] font-mono text-slate-400">{info?.sessao?.lead_telefone || '—'}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-600" />
                    <p className="text-[10px] text-slate-600 italic">Não cadastrado</p>
                  </div>
                </>
              )}
            </div>

            {/* Info agente */}
            <div className="bg-zinc-950/80 px-3 py-3 space-y-2">
              <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Info Agente</p>
              <div>
                <p className="text-[10px] text-slate-500">Campanha</p>
                <p className="text-[11px] text-slate-300 truncate">{agente.campanha_nome || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">Ramal</p>
                <p className="text-[11px] font-mono text-slate-400">{agente.ramal || '—'}</p>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 w-fit">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-semibold text-emerald-400">Falando</span>
                <span className="text-[10px] font-mono text-emerald-300">
                  {agente.duracao > 0
                    ? `${String(Math.floor(agente.duracao / 60)).padStart(2,'0')}:${String(agente.duracao % 60).padStart(2,'0')}`
                    : '00:00'}
                </span>
              </div>
            </div>
          </div>

          {/* Waveform */}
          <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center gap-0.5 h-10">
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded-full bg-violet-500/50"
                style={{
                  height: `${6 + Math.abs(Math.sin(i * 0.9)) * 10}px`,
                  animation: `pulse ${0.6 + (i % 5) * 0.15}s ease-in-out infinite alternate`,
                  animationDelay: `${i * 0.04}s`,
                }}
              />
            ))}
          </div>

          {/* Modo + Sair */}
          <div className="px-4 py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500">Falar com:</span>
              {[
                { key: 'spy',     label: 'Só ouvir', icon: Eye },
                { key: 'whisper', label: 'Agente',   icon: Mic },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => {
                    if (modo !== key) {
                      onAcao(agente, key, {});
                      setSpyAtivo(prev => ({ ...prev, modo: key }));
                    }
                  }}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all border',
                    modo === key
                      ? 'bg-violet-500/20 border-violet-500/30 text-violet-300'
                      : 'bg-white/[0.04] border-white/[0.06] text-slate-500 hover:text-slate-300'
                  )}
                >
                  <Icon className="w-3 h-3" />{label}
                </button>
              ))}
            </div>
            <button
              onClick={async () => {
                await onAcao(agente, 'stop_spy', {});
                setSpyAtivo(null);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[10px] font-semibold text-rose-400 hover:bg-rose-500/20 transition-all"
            >
              <X className="w-3 h-3" /> Sair
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}