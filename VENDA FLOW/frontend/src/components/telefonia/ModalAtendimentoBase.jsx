import { AnimatePresence, motion } from "framer-motion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import ExecutarAtividadeModal from "@/components/crm/ExecutarAtividadeModal";

/**
 * Componente base compartilhado para ModalAtendimentoLead e ModalAtendimentoManual.
 * Centraliza: barra minimizada, AlertDialog de cancelamento, wrapper display:none.
 */
export default function ModalAtendimentoBase({
  aberto,
  minimizado,
  setMinimizado,
  confirmCancelar,
  setConfirmCancelar,
  leadNome,
  leadTelefone,
  tma,
  duracaoLigacao,
  leadCallStatus,
  onClose,
  onSave,
  tarefa,
  qualificacoes3C = [],
  qualificacoesCarregando = false,
  dotColor = '#38bdf8',
  dotGlow = '0 0 10px #38bdf8',
}) {
  if (!aberto) return null;

  const fmtTma = (s) =>
    `${String(Math.floor((s || 0) / 60)).padStart(2, '0')}:${String((s || 0) % 60).padStart(2, '0')}`;

  return (
    <>
      {/* AlertDialog fora do display:none para funcionar mesmo minimizado */}
      <AlertDialog open={confirmCancelar} onOpenChange={setConfirmCancelar}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Cancelar atendimento?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Todos os dados preenchidos serão perdidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700">
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={() => { setConfirmCancelar(false); onClose(); }}
            >
              Sim, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal sempre montado — display:none ao minimizar preserva useState do formulário */}
      <div style={{ display: minimizado ? 'none' : 'contents' }}>
        <ExecutarAtividadeModal
          open={aberto}
          minimizado={minimizado}
          duracaoLigacao={duracaoLigacao || 0}
          leadCallStatus={leadCallStatus}
          tmaExterno={tma ?? 0}
          onCancelar={() => setConfirmCancelar(true)}
          onClose={onClose}
          onMinimizar={() => setMinimizado(true)}
          onSave={onSave}
          tarefa={tarefa}
          qualificacoes3C={qualificacoes3C}
          qualificacoesCarregando={qualificacoesCarregando}
          is3cCall={true}
        />
      </div>

      {/* Barra minimizada */}
      <AnimatePresence>
        {minimizado && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={() => setMinimizado(false)}
            style={{
              position: 'fixed', bottom: '24px', left: '50%',
              transform: 'translateX(-50%)', zIndex: 60, cursor: 'pointer',
              background: 'linear-gradient(135deg, #0f172a, #0c1628)',
              border: '1px solid rgba(56,189,248,0.35)', borderRadius: 999,
              padding: '10px 20px', display: 'flex', alignItems: 'center',
              gap: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(20px)', minWidth: 280,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, boxShadow: dotGlow, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {leadNome || leadTelefone || 'Em ligação'}
              </p>
              <p style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                Toque para expandir · TMA {fmtTma(tma)}
              </p>
            </div>
            <div style={{ background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 999, padding: '4px 12px', fontSize: 11, fontWeight: 600, color: '#38bdf8' }}>
              Abrir
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}