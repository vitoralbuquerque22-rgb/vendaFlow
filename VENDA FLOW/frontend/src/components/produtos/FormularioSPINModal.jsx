import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Copy, MessageCircle, Phone, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function FormularioSPINModal({ open, onClose, produto, lead, onSalvar }) {
  const [tipoAtivo, setTipoAtivo] = useState("situacao");
  const [respostas, setRespostas] = useState({
    situacao: {},
    problema: {},
    implicacao: {},
    necessidade: {},
  });
  const [origem, setOrigem] = useState("ligacao");
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);

  const perguntas = produto?.manual?.perguntas_spin || {};

  const copiarPerguntas = (tipo) => {
    const perguntasTipo = perguntas[tipo] || [];
    const texto = perguntasTipo.map((p, i) => `${i + 1}. ${p}`).join("\n\n");
    navigator.clipboard.writeText(texto);
    toast.success("Perguntas copiadas!");
  };

  const copiarPerguntasWhatsApp = (tipo) => {
    const perguntasTipo = perguntas[tipo] || [];
    const texto = `*Perguntas de ${tipo.toUpperCase()}*\n\n` + perguntasTipo.map((p, i) => `${i + 1}. ${p}`).join("\n\n");
    navigator.clipboard.writeText(texto);
    toast.success("Perguntas formatadas para WhatsApp copiadas!");
  };

  const handleResposta = (tipo, index, valor) => {
    setRespostas({
      ...respostas,
      [tipo]: {
        ...respostas[tipo],
        [index]: valor,
      },
    });
  };

  const handleSalvar = async () => {
    setSaving(true);

    const respostasArray = Object.entries(respostas[tipoAtivo])
      .filter(([_, resposta]) => resposta?.trim())
      .map(([index, resposta]) => ({
        pergunta: perguntas[tipoAtivo][parseInt(index)],
        resposta,
      }));

    await onSalvar({
      tipo_formulario: tipoAtivo,
      respostas: respostasArray,
      origem,
      observacoes,
    });

    setSaving(false);
    toast.success("Formulário salvo com sucesso!");
    onClose();
  };

  const tipos = [
    { value: "situacao", label: "Situação", color: "bg-blue-500/20 text-blue-400" },
    { value: "problema", label: "Problema", color: "bg-amber-500/20 text-amber-400" },
    { value: "implicacao", label: "Implicação", color: "bg-rose-500/20 text-rose-400" },
    { value: "necessidade", label: "Necessidade", color: "bg-emerald-500/20 text-emerald-400" },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-white">
            Formulário SPIN - {produto?.nome}
          </DialogTitle>
          <p className="text-slate-400 text-sm">Lead: {lead?.nome}</p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Origem */}
          <div className="flex gap-2">
            <Button
              variant={origem === "ligacao" ? "default" : "outline"}
              size="sm"
              onClick={() => setOrigem("ligacao")}
              className={origem === "ligacao" ? "bg-blue-600" : "border-slate-700"}
            >
              <Phone className="w-4 h-4 mr-2" />
              Ligação
            </Button>
            <Button
              variant={origem === "whatsapp" ? "default" : "outline"}
              size="sm"
              onClick={() => setOrigem("whatsapp")}
              className={origem === "whatsapp" ? "bg-emerald-600" : "border-slate-700"}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              WhatsApp
            </Button>
            <Button
              variant={origem === "reuniao" ? "default" : "outline"}
              size="sm"
              onClick={() => setOrigem("reuniao")}
              className={origem === "reuniao" ? "bg-purple-600" : "border-slate-700"}
            >
              Reunião
            </Button>
          </div>

          {/* Tabs SPIN */}
          <Tabs value={tipoAtivo} onValueChange={setTipoAtivo}>
            <TabsList className="bg-slate-800 w-full">
              {tipos.map((tipo) => (
                <TabsTrigger key={tipo.value} value={tipo.value} className="flex-1">
                  {tipo.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {tipos.map((tipo) => (
              <TabsContent key={tipo.value} value={tipo.value} className="space-y-4 mt-4">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copiarPerguntas(tipo.value)}
                    className="border-slate-700 text-slate-300"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar Perguntas
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copiarPerguntasWhatsApp(tipo.value)}
                    className="border-slate-700 text-emerald-400"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Copiar para WhatsApp
                  </Button>
                </div>

                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                  {(perguntas[tipo.value] || []).map((pergunta, index) => (
                    <Card key={index} className="bg-slate-800 border-slate-700 p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <Badge className={cn("text-xs", tipo.color)}>{index + 1}</Badge>
                        <p className="text-slate-300 text-sm flex-1">{pergunta}</p>
                      </div>
                      <Textarea
                        value={respostas[tipo.value][index] || ""}
                        onChange={(e) => handleResposta(tipo.value, index, e.target.value)}
                        placeholder="Digite a resposta do cliente..."
                        className="bg-slate-700 border-slate-600 text-white min-h-[80px]"
                      />
                    </Card>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>

          {/* Observações */}
          <div className="space-y-2">
            <label className="text-slate-300 text-sm font-medium">Observações Adicionais</label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Anote insights importantes da conversa..."
              className="bg-slate-800 border-slate-700 text-white min-h-[100px]"
            />
          </div>

          {/* Ações */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <Button variant="ghost" onClick={onClose} className="text-slate-400">
              Cancelar
            </Button>
            <Button onClick={handleSalvar} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Salvar Respostas
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}