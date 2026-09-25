import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send } from "lucide-react";

const SLA_POR_TIPO = {
  role_change: 48,
  page_access: 24,
  feature_access: 24,
};

const TIPO_LABEL = {
  role_change: "Mudança de Role",
  page_access: "Acesso a Página",
  feature_access: "Acesso a Funcionalidade",
};

export default function FormularioSolicitacao({ user, onEnviar }) {
  const [tipo, setTipo] = useState("role_change");
  const [pedidoPara, setPedidoPara] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [enviando, setEnviando] = useState(false);

  const handleEnviar = async () => {
    if (!pedidoPara || !justificativa.trim()) return;
    setEnviando(true);
    const slaHours = SLA_POR_TIPO[tipo] || 24;
    const prazo = new Date(Date.now() + slaHours * 3600_000).toISOString();
    await onEnviar({
      requester_email: user.email,
      requester_name: user.full_name || user.email,
      request_type: tipo,
      target_role: pedidoPara,
      justification: justificativa,
      status: "pending",
      sla_hours: slaHours,
      prazo_atendimento: prazo,
    });
    setEnviando(false);
    setJustificativa("");
    setPedidoPara("");
  };

  return (
    <Card className="bg-slate-900/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white">Nova Solicitação</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-slate-300">Tipo</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {Object.entries(TIPO_LABEL).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-slate-300">Pedido para *</Label>
          <Select value={pedidoPara} onValueChange={setPedidoPara}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
              <SelectValue placeholder="Selecione o destinatário" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="supervisores">Supervisores</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="gestores">Gestores</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-slate-300">Justificativa *</Label>
          <Textarea
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            placeholder="Explique por que você precisa dessa permissão..."
            className="bg-slate-800 border-slate-700 text-white min-h-[120px]"
          />
        </div>

        <Button
          onClick={handleEnviar}
          disabled={enviando || !pedidoPara || !justificativa.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          <Send className="w-4 h-4 mr-2" />
          Enviar Solicitação
        </Button>
      </CardContent>
    </Card>
  );
}