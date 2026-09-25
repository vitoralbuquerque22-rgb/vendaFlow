import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { UserPlus, Loader2 } from "lucide-react";
import { criarLead } from "@/lib/services/leadService";

/**
 * Modal de criação rápida de lead — usado quando uma ligação de campanha
 * cai e o telefone não bate com nenhum lead da base. Cadastra o essencial
 * e devolve o lead criado para vincular à CallSession ativa.
 */
export default function CriarLeadRapidoModal({ open, onClose, empresaId, sdrEmail, telefone, onLeadCriado }) {
  const [form, setForm] = useState({ nome: "", telefone: "", empresa: "", cidade: "" });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (open) {
      setForm({ nome: "", telefone: telefone || "", empresa: "", cidade: "" });
      setErro("");
    }
  }, [open, telefone]);

  const handleCriar = async () => {
    if (!form.nome.trim()) { setErro("Informe o nome do lead."); return; }
    if (!form.telefone.trim()) { setErro("Informe o telefone."); return; }
    setSalvando(true);
    setErro("");
    try {
      const lead = await criarLead({
        empresaId,
        nome: form.nome.trim(),
        telefone: form.telefone.trim(),
        empresa: form.empresa.trim() || undefined,
        cidade: form.cidade.trim() || undefined,
        origem: "campanha_whats",
        status: "respondeu",
        sdr_responsavel: sdrEmail || undefined,
      });
      onLeadCriado?.(lead);
      onClose();
    } catch (e) {
      setErro(e.message || "Erro ao criar lead.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !salvando) onClose(); }}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
        <DialogHeader>
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mb-2">
            <UserPlus className="w-6 h-6 text-blue-400" />
          </div>
          <DialogTitle className="text-white">Criar lead rápido</DialogTitle>
          <DialogDescription className="text-slate-400">
            Este telefone não está na base. Cadastre o lead agora para registrar o atendimento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input
              autoFocus
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Nome do contato"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone *</Label>
            <Input
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              placeholder="(00) 00000-0000"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <Input
                value={form.empresa}
                onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input
                value={form.cidade}
                onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                placeholder="Opcional"
              />
            </div>
          </div>
          {erro && <p className="text-sm text-rose-400">{erro}</p>}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={salvando} className="text-slate-400 hover:text-white hover:bg-slate-800">
            Cancelar
          </Button>
          <Button onClick={handleCriar} disabled={salvando} className="bg-blue-600 hover:bg-blue-500 text-white gap-2">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Criar e vincular
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}