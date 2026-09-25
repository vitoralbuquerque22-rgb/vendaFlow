import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DollarSign, Plus, Clock, User, Globe } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import InputMoeda from "@/components/ui/InputMoeda";

export default function FaturamentoSection({ leadId, currentUserEmail }) {
  const { empresaId } = useEmpresaAtual();
  const queryClient = useQueryClient();
  const [valor, setValor] = useState(undefined);
  const [obs, setObs] = useState("");
  const [adding, setAdding] = useState(false);

  const { data: historico = [], isLoading } = useQuery({
    queryKey: ["faturamento-lead", leadId],
    queryFn: () => base44.entities.FaturamentoLead.filter({ lead_id: leadId }, "-created_date", 50),
    enabled: !!leadId,
  });

  const salvarMutation = useMutation({
    mutationFn: async () => {
      const amount = valor || 0;
      if (amount <= 0) throw new Error("Valor inválido");
      return base44.entities.FaturamentoLead.create({
        lead_id: leadId,
        empresaId,
        revenue_amount: amount,
        observacao: obs.trim() || null,
        created_by: currentUserEmail,
        source: "manual",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faturamento-lead", leadId] });
      setValor(undefined);
      setObs("");
      setAdding(false);
    },
  });

  const faturamentoAtual = historico[0];

  const sourceLabel = (s) => {
    if (s === "landing_page") return "Landing Page";
    if (s === "api") return "API";
    if (s === "form") return "Formulário";
    return "Manual";
  };

  return (
    <div className="space-y-3 pt-4 border-t border-slate-700/60">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-emerald-400" />
          Faturamento Mensal
        </p>
        {!adding && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAdding(true)}
            className="h-7 px-2 border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs gap-1"
          >
            <Plus className="w-3 h-3" />
            Registrar
          </Button>
        )}
      </div>

      {/* Faturamento atual */}
      {faturamentoAtual && (
        <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-4 py-3">
          <p className="text-xs text-emerald-400 font-medium mb-1">Faturamento atual</p>
          <p className="text-2xl font-bold text-emerald-300">
            R$ {Number(faturamentoAtual.revenue_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {format(new Date(faturamentoAtual.created_date), "dd/MM/yyyy HH:mm")}
            </span>
            {faturamentoAtual.created_by ? (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {faturamentoAtual.created_by.split("@")[0]}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {sourceLabel(faturamentoAtual.source)}
              </span>
            )}
          </div>
          {faturamentoAtual.observacao && (
            <p className="text-xs text-slate-400 mt-1 italic">"{faturamentoAtual.observacao}"</p>
          )}
        </div>
      )}

      {/* Formulário de novo registro */}
      {adding && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 space-y-2">
          <div className="space-y-1">
            <Label className="text-slate-400 text-xs">Valor (R$) *</Label>
                <InputMoeda
                  value={valor}
                  onChange={setValor}
                  placeholder="R$ 0,00"
                  className="bg-slate-900 border-slate-600 text-white h-8 text-sm"
                />
          </div>
          <div className="space-y-1">
            <Label className="text-slate-400 text-xs">Observação (opcional)</Label>
            <Textarea
              value={obs}
              onChange={e => setObs(e.target.value)}
              placeholder="Ex: Informado pelo proprietário na ligação"
              className="bg-slate-900 border-slate-600 text-white text-sm min-h-[60px]"
            />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(false); setValor(""); setObs(""); }} className="text-slate-400 h-7 text-xs">
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => salvarMutation.mutate()}
              disabled={!valor || valor <= 0 || salvarMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs"
            >
              {salvarMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      )}

      {/* Histórico */}
      {historico.length > 1 && (
        <div className="space-y-1.5">
          <p className="text-xs text-slate-500 font-medium">Histórico ({historico.length} registros)</p>
          <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
            {historico.slice(1).map((item) => (
              <div key={item.id} className="flex items-center justify-between text-xs bg-slate-800/40 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 text-slate-400">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  {format(new Date(item.created_date), "dd/MM/yyyy", { locale: ptBR })}
                  {item.created_by
                    ? <span>· {item.created_by.split("@")[0]}</span>
                    : <span>· {sourceLabel(item.source)}</span>
                  }
                </div>
                <span className="text-slate-300 font-medium">
                  R$ {Number(item.revenue_amount).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && historico.length === 0 && !adding && (
        <p className="text-xs text-slate-600 italic">Nenhum faturamento registrado ainda.</p>
      )}
    </div>
  );
}