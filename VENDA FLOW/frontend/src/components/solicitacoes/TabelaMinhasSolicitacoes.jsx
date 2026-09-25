import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileCheck, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp, Ban } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TIPO_LABEL = {
  role_change: "Mudança de Role",
  page_access: "Acesso a Página",
  feature_access: "Acesso a Funcionalidade",
};

const TARGET_LABEL = {
  supervisores: "Supervisores",
  admin: "Admin",
  gestores: "Gestores",
};

function StatusBadge({ status }) {
  if (status === "pending") return <Badge className="bg-yellow-500/20 text-yellow-400"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
  if (status === "approved") return <Badge className="bg-emerald-500/20 text-emerald-400"><CheckCircle2 className="w-3 h-3 mr-1" />Aprovado</Badge>;
  if (status === "rejected") return <Badge className="bg-rose-500/20 text-rose-400"><XCircle className="w-3 h-3 mr-1" />Rejeitado</Badge>;
  if (status === "cancelled") return <Badge className="bg-slate-500/20 text-slate-400"><Ban className="w-3 h-3 mr-1" />Cancelado</Badge>;
  return null;
}

function calcularPrazoRestante(prazo) {
  if (!prazo) return "—";
  const diff = new Date(prazo).getTime() - Date.now();
  if (diff <= 0) return "Vencido";
  const horas = Math.floor(diff / 3600_000);
  const mins = Math.floor((diff % 3600_000) / 60_000);
  return horas > 0 ? `${horas}h ${mins}m` : `${mins}m`;
}

export default function TabelaMinhasSolicitacoes({ solicitacoes, onCancelar }) {
  const [expandido, setExpandido] = useState(null);

  return (
    <Card className="bg-slate-900/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white">Minhas Solicitações</CardTitle>
      </CardHeader>
      <CardContent>
        {solicitacoes.length === 0 ? (
          <div className="text-center py-8">
            <FileCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">Nenhuma solicitação ainda</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-700/50">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/60 text-slate-400">
                <tr>
                  <th className="text-left font-medium px-3 py-2.5 whitespace-nowrap">Nome</th>
                  <th className="text-left font-medium px-3 py-2.5 whitespace-nowrap">Para quem</th>
                  <th className="text-left font-medium px-3 py-2.5 whitespace-nowrap">O que foi</th>
                  <th className="text-left font-medium px-3 py-2.5 whitespace-nowrap">Data</th>
                  <th className="text-left font-medium px-3 py-2.5 whitespace-nowrap">Hora</th>
                  <th className="text-left font-medium px-3 py-2.5 whitespace-nowrap">Observação</th>
                  <th className="text-left font-medium px-3 py-2.5 whitespace-nowrap">Prazo</th>
                  <th className="text-left font-medium px-3 py-2.5 whitespace-nowrap">Status</th>
                  <th className="text-center font-medium px-3 py-2.5 whitespace-nowrap">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {solicitacoes.map((s) => {
                  const data = new Date(s.created_date);
                  const isExp = expandido === s.id;
                  return (
                    <tr key={s.id} className="hover:bg-slate-800/30">
                      <td className="px-3 py-2.5 text-white whitespace-nowrap">
                        {s.requester_name || s.requester_email}
                      </td>
                      <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap">
                        {TARGET_LABEL[s.target_role] || s.target_role || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap">
                        {TIPO_LABEL[s.request_type] || s.request_type}
                      </td>
                      <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">
                        {format(data, "dd/MM/yyyy")}
                      </td>
                      <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">
                        {format(data, "HH:mm")}
                      </td>
                      <td className="px-3 py-2.5 max-w-[200px]">
                        {s.justification ? (
                          <button
                            onClick={() => setExpandido(isExp ? null : s.id)}
                            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-left"
                          >
                            <span className="truncate">{s.justification}</span>
                            {isExp ? <ChevronUp className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />}
                          </button>
                        ) : "—"}
                        {isExp && s.justification && (
                          <div className="mt-2 p-2 bg-slate-800/60 rounded-md text-slate-300 text-xs whitespace-normal">
                            {s.justification}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={calcularPrazoRestante(s.prazo_atendimento) === "Vencido" ? "text-rose-400" : "text-slate-300"}>
                          {calcularPrazoRestante(s.prazo_atendimento)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {s.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onCancelar(s.id)}
                            className="border-slate-600 text-slate-300 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/50"
                          >
                            <Ban className="w-3.5 h-3.5 mr-1" />
                            Cancelar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}