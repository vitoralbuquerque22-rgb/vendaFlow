import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listarCadenciasCloser } from "@/lib/services/cadenciaService";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Calendar, CheckCircle2 } from "lucide-react";

export default function IniciarCadenciaModal({ open, onClose, tarefa, onIniciar }) {
  const [cadenciaSelecionada, setCadenciaSelecionada] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: cadencias = [] } = useQuery({
    queryKey: ["cadencias-closer"],
    queryFn: listarCadenciasCloser,
    enabled: open,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onIniciar(cadenciaSelecionada);
    setSaving(false);
    setCadenciaSelecionada("");
    onClose();
  };

  const cadenciaInfo = cadencias.find(c => c.id === cadenciaSelecionada);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            Iniciar Cadência de Closer
          </DialogTitle>
          <DialogDescription className="sr-only">
            Selecione uma cadência de Closer para iniciar com o lead {tarefa?.lead_nome}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-sm text-blue-300">
              <strong>Lead:</strong> {tarefa?.lead_nome}
            </p>
            <p className="text-xs text-blue-200/80 mt-1">
              Escolha qual cadência de Closer deve ser iniciada para este lead
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Cadência de Closer *</Label>
            <Select
              value={cadenciaSelecionada}
              onValueChange={setCadenciaSelecionada}
              required
            >
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Selecione a cadência" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {cadencias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} ({c.duracao_dias} dias)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {cadenciaInfo && (
            <Card className="bg-emerald-500/10 border-emerald-500/30">
              <CardContent className="py-3">
                <div className="flex items-center gap-2 text-sm text-emerald-300">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    <strong>{cadenciaInfo.etapas?.length || 0}</strong> etapas serão criadas
                  </span>
                </div>
                {cadenciaInfo.descricao && (
                  <p className="text-xs text-emerald-200/80 mt-2">
                    {cadenciaInfo.descricao}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={onClose} className="text-slate-400">
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !cadenciaSelecionada} className="bg-blue-600 hover:bg-blue-700">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Iniciar Cadência
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}