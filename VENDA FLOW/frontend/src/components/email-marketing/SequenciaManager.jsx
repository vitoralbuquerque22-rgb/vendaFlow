import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { List, Plus, Eye, Trash2, Edit, Loader2, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import EmailPreview from "./EmailPreview";

const STATUS_OPTS = [
  { value: "novo", label: "Novo" }, { value: "em_cadencia", label: "Em Cadência" },
  { value: "respondeu", label: "Respondeu" }, { value: "reuniao_agendada", label: "Reunião Agendada" },
  { value: "reuniao_realizada", label: "Reunião Realizada" }, { value: "qualificado", label: "Qualificado" },
  { value: "desqualificado", label: "Desqualificado" }, { value: "sem_interesse", label: "Sem Interesse" },
];

const ORIGEM_OPTS = [
  { value: "trafego_pago", label: "Tráfego Pago" }, { value: "meta_ads", label: "Meta Ads" },
  { value: "google_ads", label: "Google Ads" }, { value: "typeform", label: "Typeform" },
  { value: "wordpress", label: "WordPress" }, { value: "indicacao", label: "Indicação" },
  { value: "organico", label: "Orgânico" }, { value: "evento", label: "Evento" },
  { value: "lista_fria", label: "Lista Fria" }, { value: "outro", label: "Outro" },
];

export default function SequenciaManager({ campanhasAgendadas = [], templates = [], leads = [], empresaId, user, busca }) {
  const queryClient = useQueryClient();
  const [modalSequencia, setModalSequencia] = useState(false);
  const [modalDetalhes, setModalDetalhes] = useState(false);
  const [sequenciaVisualizando, setSequenciaVisualizando] = useState(null);
  const [form, setForm] = useState({ nome: "", emails: [{ template_id: "", dias_apos_anterior: 0 }], filtro_status: [], filtro_origem: [], editando_sequencia_id: null });

  const agendarMutation = useMutation({
    mutationFn: (data) => api.entities.CampanhaAgendada.create({ ...data, empresaId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campanhas-agendadas", empresaId] }),
  });

  const cancelarMutation = useMutation({
    mutationFn: (id) => api.entities.CampanhaAgendada.update(id, { status: "cancelado" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campanhas-agendadas", empresaId] }),
  });

  // Agrupar sequências
  const seqMap = campanhasAgendadas.filter(c => c.sequencia_id).reduce((acc, c) => {
    if (!acc[c.sequencia_id]) acc[c.sequencia_id] = [];
    acc[c.sequencia_id].push(c);
    return acc;
  }, {});

  const sequencias = Object.entries(seqMap).map(([id, campanhas]) => ({
    id, nome: campanhas[0].nome.split(' - Email')[0],
    campanhas: campanhas.sort((a, b) => (a.ordem_sequencia || 0) - (b.ordem_sequencia || 0)),
    status: campanhas[0].status, filtro_status: campanhas[0].filtro_status,
    filtro_origem: campanhas[0].filtro_origem, data_primeiro_envio: campanhas[0].data_envio,
  })).filter(s => s.nome.toLowerCase().includes(busca.toLowerCase()));

  const resetForm = () => setForm({ nome: "", emails: [{ template_id: "", dias_apos_anterior: 0 }], filtro_status: [], filtro_origem: [], editando_sequencia_id: null });

  const handleAgendar = async () => {
    if (!form.nome) { toast.error("Informe o nome da sequência"); return; }
    if (form.emails.some(e => !e.template_id)) { toast.error("Selecione todos os templates da sequência"); return; }

    if (form.editando_sequencia_id) {
      const antigas = campanhasAgendadas.filter(c => c.sequencia_id === form.editando_sequencia_id);
      for (const c of antigas) await cancelarMutation.mutateAsync(c.id);
    }

    const sequenciaId = form.editando_sequencia_id || crypto.randomUUID();
    let dataEnvio = new Date();
    for (let i = 0; i < form.emails.length; i++) {
      const email = form.emails[i];
      const template = templates.find(t => t.id === email.template_id);
      if (i > 0) dataEnvio = new Date(dataEnvio.getTime() + email.dias_apos_anterior * 24 * 60 * 60 * 1000);
      await agendarMutation.mutateAsync({
        nome: `${form.nome} - Email ${i + 1}`, template_id: email.template_id, template_nome: template.nome,
        filtro_status: form.filtro_status.length > 0 ? form.filtro_status.join(',') : "todos",
        filtro_origem: form.filtro_origem.length > 0 ? form.filtro_origem.join(',') : "todas",
        data_envio: dataEnvio.toISOString(), enviado_por: user?.email, sequencia_id: sequenciaId,
        ordem_sequencia: i + 1, dias_apos_anterior: email.dias_apos_anterior,
      });
    }

    toast.success(form.editando_sequencia_id ? "Sequência atualizada!" : "Sequência agendada!");
    setModalSequencia(false); resetForm();
  };

  const MultiSelect = ({ options, selected, onChange, label }) => (
    <div className="space-y-2">
      <Label className="text-slate-300">{label}</Label>
      <Select value={selected.length > 0 ? selected[0] : "placeholder"} onValueChange={() => {}}>
        <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
          <SelectValue>{selected.length === 0 ? `Todos` : `${selected.length} selecionado(s)`}</SelectValue>
        </SelectTrigger>
        <div>{/* não há conteúdo nativo — checkbox manual abaixo */}</div>
      </Select>
      <div className="max-h-40 overflow-y-auto space-y-1 bg-slate-800/50 rounded-lg border border-slate-700 p-2">
        {options.map(opt => (
          <label key={opt.value} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-700 cursor-pointer rounded">
            <input type="checkbox" checked={selected.includes(opt.value)} onChange={(e) => { if (e.target.checked) onChange([...selected, opt.value]); else onChange(selected.filter(s => s !== opt.value)); }} className="rounded border-slate-600" />
            <span className="text-slate-300 text-sm">{opt.label}</span>
          </label>
        ))}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">{selected.map(s => <Badge key={s} className="bg-blue-500/20 text-blue-300 text-xs">{s.replace(/_/g, ' ')}</Badge>)}</div>
      )}
    </div>
  );

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-slate-400">{sequencias.length} sequência(s)</p>
        <Button onClick={() => setModalSequencia(true)} className="bg-purple-600 hover:bg-purple-700"><Plus className="w-4 h-4 mr-2" />Nova Sequência</Button>
      </div>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader><CardTitle className="text-white">Sequências de Email</CardTitle></CardHeader>
        <CardContent>
          {sequencias.length === 0 ? (
            <div className="text-center py-12">
              <List className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Nenhuma sequência criada</h3>
              <p className="text-slate-400 mb-4">Crie sua primeira sequência de emails automatizada</p>
              <Button onClick={() => setModalSequencia(true)} className="bg-purple-600 hover:bg-purple-700"><Plus className="w-4 h-4 mr-2" />Criar Sequência</Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {sequencias.map(seq => (
                <div key={seq.id} className="p-5 bg-purple-500/10 rounded-lg border border-purple-500/30 hover:border-purple-500/50 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-white text-lg">{seq.nome}</h4>
                      <p className="text-sm text-purple-300 mt-1">{seq.campanhas.length} emails · Inicia em {format(new Date(seq.data_primeiro_envio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={seq.status === "pendente" ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"}>{seq.status === "pendente" ? "Agendada" : seq.status}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setSequenciaVisualizando(seq); setModalDetalhes(true); }} className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10"><Eye className="w-4 h-4 mr-2" />Ver Detalhes</Button>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("Deseja cancelar toda esta sequência?")) seq.campanhas.forEach(c => cancelarMutation.mutate(c.id)); }} className="text-rose-400 hover:text-rose-300"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                    {seq.campanhas.slice(0, 3).map((c, idx) => (
                      <div key={c.id} className="flex-shrink-0 px-3 py-2 bg-slate-800/50 rounded-md border border-slate-700 text-xs">
                        <span className="text-purple-300 font-medium">#{idx + 1}</span><span className="text-slate-400 ml-2">{c.template_nome}</span>
                      </div>
                    ))}
                    {seq.campanhas.length > 3 && <div className="flex-shrink-0 px-3 py-2 bg-slate-800/50 rounded-md border border-slate-700 text-xs text-slate-400">+{seq.campanhas.length - 3} mais</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Detalhes */}
      <Dialog open={modalDetalhes} onOpenChange={setModalDetalhes}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-[95vw] max-h-[95vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-white text-2xl flex items-center gap-3"><List className="w-7 h-7 text-purple-400" />{sequenciaVisualizando?.nome}</DialogTitle></DialogHeader>
          {sequenciaVisualizando && (
            <div className="space-y-6 mt-6">
              <div className="space-y-4">
                {sequenciaVisualizando.campanhas.map((campanha, idx) => {
                  const template = templates.find(t => t.id === campanha.template_id);
                  return (
                    <div key={campanha.id} className="p-5 bg-slate-700/30 rounded-lg border border-slate-600">
                      <div className="flex items-start gap-4">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-500/20 text-purple-300 font-bold text-lg flex-shrink-0">{idx + 1}</div>
                        <div className="flex-1 space-y-2">
                          <h4 className="text-white font-semibold">{campanha.template_nome}</h4>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="flex items-center gap-1 text-slate-400"><Clock className="w-4 h-4" />{format(new Date(campanha.data_envio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                            {idx > 0 && campanha.dias_apos_anterior && <Badge variant="outline" className="border-purple-500/30 text-purple-300">+{campanha.dias_apos_anterior} dias após anterior</Badge>}
                          </div>
                          {template && (
                            <details className="mt-3">
                              <summary className="cursor-pointer text-purple-400 hover:text-purple-300 text-sm font-medium">Ver prévia do email</summary>
                              <div className="mt-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700 max-h-60 overflow-y-auto">
                                <EmailPreview html={template.corpo} maxLength={500} />
                              </div>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between gap-3 pt-4 border-t border-slate-700">
                <Button variant="ghost" onClick={() => { setModalDetalhes(false); setSequenciaVisualizando(null); }} className="text-slate-400">Fechar</Button>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => {
                    setForm({ nome: sequenciaVisualizando.nome, emails: sequenciaVisualizando.campanhas.map(c => ({ template_id: c.template_id, dias_apos_anterior: c.dias_apos_anterior || 0 })), filtro_status: sequenciaVisualizando.filtro_status?.includes(',') ? sequenciaVisualizando.filtro_status.split(',') : (sequenciaVisualizando.filtro_status === "todos" ? [] : [sequenciaVisualizando.filtro_status]), filtro_origem: sequenciaVisualizando.filtro_origem?.includes(',') ? sequenciaVisualizando.filtro_origem.split(',') : (sequenciaVisualizando.filtro_origem === "todas" ? [] : [sequenciaVisualizando.filtro_origem]), editando_sequencia_id: sequenciaVisualizando.id });
                    setModalDetalhes(false); setModalSequencia(true);
                  }} className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10"><Edit className="w-4 h-4 mr-2" />Editar</Button>
                  <Button variant="destructive" onClick={() => { if (confirm("Deseja realmente cancelar toda esta sequência?")) { sequenciaVisualizando.campanhas.forEach(c => cancelarMutation.mutate(c.id)); setModalDetalhes(false); setSequenciaVisualizando(null); } }} className="bg-rose-600 hover:bg-rose-700"><Trash2 className="w-4 h-4 mr-2" />Cancelar Sequência</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Criar/Editar Sequência */}
      <Dialog open={modalSequencia} onOpenChange={setModalSequencia}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2"><List className="w-5 h-5" />{form.editando_sequencia_id ? "Editar Sequência" : "Criar Sequência de Emails"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Nome da Sequência *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="bg-slate-800 border-slate-700 text-white" placeholder="Ex: Nutrição de Leads - Q1 2025" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <MultiSelect options={STATUS_OPTS} selected={form.filtro_status} onChange={(v) => setForm({ ...form, filtro_status: v })} label="Filtrar por Status" />
              <MultiSelect options={ORIGEM_OPTS} selected={form.filtro_origem} onChange={(v) => setForm({ ...form, filtro_origem: v })} label="Filtrar por Origem" />
            </div>

            <div className="space-y-3">
              <Label className="text-slate-300">Emails da Sequência</Label>
              {form.emails.map((email, index) => (
                <Card key={index} className="bg-slate-800/50 border-slate-700 p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-white font-medium">Email {index + 1}</h4>
                      {form.emails.length > 1 && <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, emails: form.emails.filter((_, i) => i !== index) })} className="text-rose-400 hover:text-rose-300"><Trash2 className="w-4 h-4" /></Button>}
                    </div>
                    <select value={email.template_id} onChange={(e) => { const emails = [...form.emails]; emails[index].template_id = e.target.value; setForm({ ...form, emails }); }} className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm">
                      <option value="">Selecione um template</option>
                      {templates.map(t => <option key={t.id} value={t.id}>{t.nome} - {t.assunto}</option>)}
                    </select>
                    {index > 0 && (
                      <div className="space-y-2">
                        <Label className="text-slate-400 text-sm">Enviar quantos dias após o email anterior?</Label>
                        <Input type="number" min="0" value={email.dias_apos_anterior} onChange={(e) => { const emails = [...form.emails]; emails[index].dias_apos_anterior = parseInt(e.target.value) || 0; setForm({ ...form, emails }); }} className="bg-slate-700 border-slate-600 text-white" placeholder="Ex: 3" />
                      </div>
                    )}
                  </div>
                </Card>
              ))}
              <Button type="button" variant="outline" onClick={() => setForm({ ...form, emails: [...form.emails, { template_id: "", dias_apos_anterior: 3 }] })} className="w-full border-slate-600 text-slate-300"><Plus className="w-4 h-4 mr-2" />Adicionar Email à Sequência</Button>
            </div>

            <Card className="bg-purple-500/10 border-purple-500/30">
              <CardContent className="py-3">
                <p className="text-purple-300 text-sm">📬 Sequência com <strong>{form.emails.length}</strong> email(s)</p>
                <p className="text-blue-300 text-sm mt-2">📧 Leads elegíveis: <strong>{leads.filter(l => l.email && (form.filtro_status.length === 0 || form.filtro_status.includes(l.status)) && (form.filtro_origem.length === 0 || form.filtro_origem.includes(l.origem))).length}</strong> lead(s)</p>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
              <Button type="button" variant="ghost" onClick={() => { setModalSequencia(false); resetForm(); }} className="text-slate-400">Cancelar</Button>
              <Button onClick={handleAgendar} disabled={!form.nome || form.emails.some(e => !e.template_id)} className="bg-purple-600 hover:bg-purple-700">
                {form.editando_sequencia_id ? <Edit className="w-4 h-4 mr-2" /> : <List className="w-4 h-4 mr-2" />}
                {form.editando_sequencia_id ? "Atualizar Sequência" : "Criar Sequência"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}