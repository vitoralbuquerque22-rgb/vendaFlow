import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Send, Eye, Loader2, Calendar, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const LIMITE_GRATUITO = 100;

const STATUS_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "novo", label: "Novo" },
  { value: "em_cadencia", label: "Em Cadência" },
  { value: "respondeu", label: "Respondeu" },
  { value: "reuniao_agendada", label: "Reunião Agendada" },
  { value: "reuniao_realizada", label: "Reunião Realizada" },
  { value: "qualificado", label: "Qualificado" },
  { value: "desqualificado", label: "Desqualificado" },
  { value: "sem_interesse", label: "Sem Interesse" },
];

const ORIGEM_OPTIONS = [
  { value: "todas", label: "Todas" },
  { value: "trafego_pago", label: "Tráfego Pago" },
  { value: "meta_ads", label: "Meta Ads" },
  { value: "google_ads", label: "Google Ads" },
  { value: "typeform", label: "Typeform" },
  { value: "wordpress", label: "WordPress" },
  { value: "indicacao", label: "Indicação" },
  { value: "organico", label: "Orgânico" },
  { value: "evento", label: "Evento" },
  { value: "lista_fria", label: "Lista Fria" },
  { value: "outro", label: "Outro" },
];

export default function CampanhaManager({ open, onClose, templates, leads, envios, empresaId, user }) {
  const queryClient = useQueryClient();
  const [abaAtiva, setAbaAtiva] = useState("imediato");
  const [enviando, setEnviando] = useState(false);
  const [form, setForm] = useState({ template_id: "", filtro_status: "todos", filtro_origem: "todas", teste_email: "", nome_campanha: "", data_envio: "", hora_envio: "" });

  const enviosRestantes = LIMITE_GRATUITO - envios.length;

  const agendarCampanhaMutation = useMutation({
    mutationFn: (data) => base44.entities.CampanhaAgendada.create({ ...data, empresaId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["campanhas-agendadas", empresaId] }); toast.success("Campanha agendada com sucesso!"); },
  });

  const leadsElegiveis = leads.filter(lead => {
    if (!lead.email) return false;
    const statusOk = form.filtro_status === "todos" || lead.status === form.filtro_status;
    const origemOk = form.filtro_origem === "todas" || lead.origem === form.filtro_origem;
    return statusOk && origemOk;
  }).length;

  const resetForm = () => setForm({ template_id: "", filtro_status: "todos", filtro_origem: "todas", teste_email: "", nome_campanha: "", data_envio: "", hora_envio: "" });

  const handleEnviar = async (teste = false) => {
    if (!form.template_id) { toast.error("Selecione um template"); return; }
    const template = templates.find(t => t.id === form.template_id);
    if (!template) return;

    let destinatarios = [];
    if (teste) {
      if (!form.teste_email) { toast.error("Informe um e-mail para teste"); return; }
      destinatarios = [{ email: form.teste_email, nome: "Teste" }];
    } else {
      const leadsParaEnviar = leads.filter(lead => {
        if (!lead.email) return false;
        return (form.filtro_status === "todos" || lead.status === form.filtro_status) &&
               (form.filtro_origem === "todas" || lead.origem === form.filtro_origem);
      });
      if (leadsParaEnviar.length + envios.length > LIMITE_GRATUITO) {
        toast.error(`Limite excedido! Você tem apenas ${enviosRestantes} envios restantes este mês.`); return;
      }
      destinatarios = leadsParaEnviar.map(l => ({ email: l.email, nome: l.nome, lead_id: l.id, empresa: l.empresa || '', respostas_formulario: l.respostas_formulario || '' }));
    }
    if (destinatarios.length === 0) { toast.error("Nenhum destinatário encontrado"); return; }

    setEnviando(true);
    try {
      let sucessos = 0, falhas = 0;
      for (const dest of destinatarios) {
        try {
          let envioId = null;
          if (!teste) {
            const envio = await base44.entities.EmailEnvio.create({ empresaId, template_id: template.id, template_nome: template.nome, destinatario_email: dest.email, destinatario_nome: dest.nome, lead_id: dest.lead_id, assunto: template.assunto, status: "enviado", enviado_por: user?.email });
            envioId = envio.id;
          }
          let corpoPersonalizado = template.corpo.replace(/\{nome\}/g, dest.nome || '').replace(/\{empresa\}/g, dest.empresa || '').replace(/\{dores_mapeadas\}/g, dest.respostas_formulario || '');
          if (envioId && dest.lead_id) {
            const baseUrl = window.location.origin;
            corpoPersonalizado += `<img src="${baseUrl}/trackEmailOpen?envio_id=${envioId}&lead_id=${dest.lead_id}" width="1" height="1" style="display:none;" alt="" />`;
            corpoPersonalizado = corpoPersonalizado.replace(/URL_DESTINO=([^\s<]+)/g, (_, url) => `${baseUrl}/EmailRedirect?envio_id=${envioId}&lead_id=${dest.lead_id}&destino=${encodeURIComponent(url)}`);
            corpoPersonalizado = corpoPersonalizado.replace(/<a\s+([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi, (match, before, url, after) => {
              if (url.includes('/EmailRedirect')) return match;
              return `<a ${before}href="${baseUrl}/EmailRedirect?envio_id=${envioId}&lead_id=${dest.lead_id}&destino=${encodeURIComponent(url)}"${after}>`;
            });
          }
          await base44.integrations.Core.SendEmail({ to: dest.email, subject: template.assunto, body: corpoPersonalizado, from_name: user?.full_name || "CRM" });
          sucessos++;
        } catch { falhas++; }
      }
      queryClient.invalidateQueries({ queryKey: ["email-envios"] });
      if (teste) { toast.success("E-mail de teste enviado!"); }
      else { toast.success(`Campanha enviada! ${sucessos} sucesso(s), ${falhas} falha(s)`); onClose(); resetForm(); }
    } catch { toast.error("Erro ao enviar campanha"); }
    finally { setEnviando(false); }
  };

  const handleAgendar = async () => {
    if (!form.template_id) { toast.error("Selecione um template"); return; }
    if (!form.nome_campanha) { toast.error("Informe o nome da campanha"); return; }
    if (!form.data_envio || !form.hora_envio) { toast.error("Informe data e hora do envio"); return; }
    const template = templates.find(t => t.id === form.template_id);
    if (!template) return;
    const dataHoraEnvio = new Date(`${form.data_envio}T${form.hora_envio}:00`);
    await agendarCampanhaMutation.mutateAsync({ nome: form.nome_campanha, template_id: form.template_id, template_nome: template.nome, filtro_status: form.filtro_status, filtro_origem: form.filtro_origem, data_envio: dataHoraEnvio.toISOString(), enviado_por: user?.email });
    onClose(); resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-white">Enviar Campanha</DialogTitle></DialogHeader>

        <div className="flex gap-2 border-b border-slate-700 mt-4">
          {["imediato", "agendar"].map(aba => (
            <button key={aba} onClick={() => setAbaAtiva(aba)} className={cn("px-4 py-2 text-sm font-medium transition-colors relative", abaAtiva === aba ? "text-white" : "text-slate-400 hover:text-white")}>
              {aba === "imediato" ? "Envio Imediato" : "Agendar Envio"}
              {abaAtiva === aba && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
            </button>
          ))}
        </div>

        <div className="space-y-4 mt-4">
          {/* Template */}
          <div className="space-y-2">
            <Label className="text-slate-300">Selecione o Template *</Label>
            <Select value={form.template_id} onValueChange={(v) => setForm({ ...form, template_id: v })}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue placeholder="Escolha um template" /></SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">{templates.map(t => <SelectItem key={t.id} value={t.id}>{t.nome} - {t.assunto}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {abaAtiva === "agendar" && (
            <div className="space-y-2">
              <Label className="text-slate-300">Nome da Campanha *</Label>
              <Input value={form.nome_campanha} onChange={(e) => setForm({ ...form, nome_campanha: e.target.value })} className="bg-slate-800 border-slate-700 text-white" placeholder="Ex: Follow-up Janeiro 2025" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Filtrar por Status</Label>
              <Select value={form.filtro_status} onValueChange={(v) => setForm({ ...form, filtro_status: v })}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Filtrar por Origem</Label>
              <Select value={form.filtro_origem} onValueChange={(v) => setForm({ ...form, filtro_origem: v })}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">{ORIGEM_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {abaAtiva === "agendar" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300 flex items-center gap-2"><Calendar className="w-4 h-4" />Data do Envio *</Label>
                <Input type="date" value={form.data_envio} onChange={(e) => setForm({ ...form, data_envio: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300 flex items-center gap-2"><Clock className="w-4 h-4" />Horário *</Label>
                <Input type="time" value={form.hora_envio} onChange={(e) => setForm({ ...form, hora_envio: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
              </div>
            </div>
          )}

          <Card className="bg-blue-500/10 border-blue-500/30">
            <CardContent className="py-3">
              <p className="text-blue-300 text-sm">📧 <strong>{leadsElegiveis}</strong> lead(s) elegível(is) para envio</p>
              <p className="text-xs text-slate-400 mt-1">{abaAtiva === "imediato" ? `Envios restantes este mês: ${enviosRestantes}` : "A campanha será enviada automaticamente na data/hora agendada"}</p>
            </CardContent>
          </Card>

          {abaAtiva === "imediato" && (
            <div className="space-y-2">
              <Label className="text-slate-300">E-mail para Teste (opcional)</Label>
              <Input type="email" value={form.teste_email} onChange={(e) => setForm({ ...form, teste_email: e.target.value })} className="bg-slate-800 border-slate-700 text-white" placeholder="seu@email.com" />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <Button variant="ghost" onClick={onClose} className="text-slate-400">Cancelar</Button>
            {abaAtiva === "imediato" ? (
              <>
                <Button variant="outline" onClick={() => handleEnviar(true)} disabled={enviando || !form.template_id || !form.teste_email} className="border-slate-600 text-slate-300">
                  {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}Enviar Teste
                </Button>
                <Button onClick={() => handleEnviar(false)} disabled={enviando || !form.template_id || leadsElegiveis === 0 || leadsElegiveis > enviosRestantes} className="bg-emerald-600 hover:bg-emerald-700">
                  {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}Enviar Agora
                </Button>
              </>
            ) : (
              <Button onClick={handleAgendar} disabled={!form.template_id || !form.nome_campanha || !form.data_envio || !form.hora_envio} className="bg-blue-600 hover:bg-blue-700">
                <Calendar className="w-4 h-4 mr-2" />Agendar Campanha
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}