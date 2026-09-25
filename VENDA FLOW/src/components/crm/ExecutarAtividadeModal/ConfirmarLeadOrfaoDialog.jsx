import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CalendarClock } from "lucide-react";

/**
 * Alerta exibido quando o atendimento atual é a última tarefa pendente do lead
 * e nenhum próximo passo (contato/reunião) foi agendado — o lead ficaria órfão.
 */
export default function ConfirmarLeadOrfaoDialog({ open, leadNome, onVoltarAgendar, onConfirmarMesmoAssim }) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="bg-slate-900 border-slate-700 max-w-md">
        <AlertDialogHeader>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-2">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
          </div>
          <AlertDialogTitle className="text-white">Lead vai ficar sem cadência</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-400 leading-relaxed">
            Esta é a <strong className="text-amber-300">última tarefa pendente</strong> de{" "}
            <strong className="text-white">{leadNome || "este lead"}</strong>. Se registrar sem agendar um
            próximo contato ou reunião, ele ficará <strong className="text-amber-300">sem nenhuma tarefa futura</strong>{" "}
            e sairá do seu fluxo de trabalho — risco de perder o lead.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <Button
            onClick={onConfirmarMesmoAssim}
            variant="ghost"
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            Registrar mesmo assim
          </Button>
          <Button
            onClick={onVoltarAgendar}
            className="bg-amber-600 hover:bg-amber-500 text-white gap-2"
          >
            <CalendarClock className="w-4 h-4" />
            Voltar e agendar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}