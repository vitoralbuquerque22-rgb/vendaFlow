import React, { useState } from "react";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import CopiarLinkConvite from "@/components/empresa/CopiarLinkConvite";

export default function ConviteUsuarioModal({ open, onOpenChange, empresaId, onConviteSuccess }) {
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState("sdr");
  const [loading, setLoading] = useState(false);
  const [codigoGerado, setCodigoGerado] = useState(null);

  const handleConvidar = async () => {
    if (!email.trim()) {
      toast.error("Digite um email válido");
      return;
    }

    setLoading(true);
    try {
      // Verificar se já é membro ativo
      const vinculosExistentes = await api.entities.VinculoEmpresa.filter({ empresaId, userEmail: email.trim() });
      const jaAtivo = vinculosExistentes.find(v => v.status === "ativo");
      if (jaAtivo) {
        toast.error("Este usuário já é membro ativo da empresa");
        setLoading(false);
        return;
      }

      // Verificar se já tem convite pendente
      const convitesPendentes = await api.entities.ConviteEmpresa.filter({ empresaId, email: email.trim(), status: "pendente" });
      if (convitesPendentes.length > 0) {
        toast.error("Já existe um convite pendente para este email");
        setLoading(false);
        return;
      }

      // Gerar código único
      const codigo = Math.random().toString(36).substring(2, 12).toUpperCase();
      
      // Criar convite
      await api.entities.ConviteEmpresa.create({
        empresaId,
        email,
        papel,
        codigo,
        expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 dias
      });

      // Enviar email com o link
      const link = `${window.location.origin}/AceitarConvite?codigo=${codigo}`;
      const papelLabel = {
        admin: "Administrador", gestor_empresa: "Gestor da Empresa", gerente_empresa: "Gerente",
        gerente_filial: "Gerente de Filial", supervisor: "Supervisor", marketing: "Marketing",
        gestor: "Gestor", sdr: "SDR", closer: "Closer", cs: "Customer Success", social_seller: "Social Seller",
      }[papel] || papel;

      try {
        await api.integrations.Core.SendEmail({
          to: email.trim(),
          subject: "Você foi convidado para o VendaFLOW",
          body: `<div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;background:#0d1420;color:#e2e8f0;border-radius:16px;padding:32px;border:1px solid rgba(255,255,255,0.08)">
  <h2 style="margin:0 0 8px;font-size:22px;color:#fff">Você foi convidado! 🎉</h2>
  <p style="margin:0 0 24px;color:#94a3b8;font-size:14px">Você recebeu um convite para entrar na plataforma <strong style="color:#fff">VendaFLOW</strong> como <strong style="color:#60a5fa">${papelLabel}</strong>.</p>
  <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:700;font-size:15px">Aceitar Convite</a>
  <p style="margin:24px 0 0;color:#475569;font-size:12px">O link expira em 7 dias. Se não solicitou este convite, ignore este email.</p>
</div>`,
        });
      } catch (_) {
        // falha no email não bloqueia — link ainda aparece na tela
      }

      setCodigoGerado(codigo);
      toast.success("Convite criado e email enviado!");
      onConviteSuccess?.();
    } catch (error) {
      toast.error("Erro ao criar convite: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-white">Convidar Colaborador</DialogTitle>
        </DialogHeader>

        {codigoGerado ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-900/30 border border-green-700 rounded-lg">
              <div className="flex gap-3">
                <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-300">Convite Criado!</p>
                  <p className="text-xs text-green-200 mt-1">Email enviado para <strong>{email}</strong>. O link também está disponível abaixo:</p>
                </div>
              </div>
            </div>
            <CopiarLinkConvite codigo={codigoGerado} />
            <div className="p-2.5 bg-slate-800/60 rounded-lg border border-slate-700/60 flex items-center justify-center gap-2">
              <span className="text-[11px] text-slate-500">Código:</span>
              <span className="text-sm font-mono font-bold text-slate-300">{codigoGerado}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-300 mb-2 block">Email</label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@empresa.com"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div>
              <label className="text-sm text-slate-300 mb-2 block">Papel</label>
              <Select value={papel} onValueChange={setPapel}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="gestor_empresa">Gestor da Empresa</SelectItem>
                  <SelectItem value="gerente_empresa">Gerente</SelectItem>
                  <SelectItem value="gerente_filial">Gerente de Filial</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="gestor">Gestor (legado)</SelectItem>
                  <SelectItem value="sdr">SDR</SelectItem>
                  <SelectItem value="closer">Closer</SelectItem>
                  <SelectItem value="cs">Customer Success</SelectItem>
                  <SelectItem value="social_seller">Social Seller</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-blue-900/30 border border-blue-700 rounded-lg flex gap-2">
              <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-200">Um email com o link de acesso será enviado automaticamente. Ao abri-lo, o colaborador entra direto na sua empresa.</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => { setEmail(""); setPapel("sdr"); setCodigoGerado(null); onOpenChange(false); }}
            className="border-slate-700"
          >
            {codigoGerado ? "Fechar" : "Cancelar"}
          </Button>
          {!codigoGerado && (
            <Button
              onClick={handleConvidar}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                "Gerar Código"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}