import { useState } from "react";
import { api } from "@/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Zap, Plus, Edit, Trash2, Save, Play, History } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Automacoes() {
  const queryClient = useQueryClient();
  const [modalAberto, setModalAberto] = useState(false);
  const [automacaoEditando, setAutomacaoEditando] = useState(null);
  const [abaLogs, setAbaLogs] = useState(false);

  const [formData, setFormData] = useState({
    nome: "",
    tipo: "criar_tarefa",
    trigger: "mudanca_status_lead",
    condicoes: {
      status_lead: [],
      origem_lead: [],
      dias_sem_atividade: 3,
      horas_antes_reuniao: 24,
      dias_atraso: 1,
    },
    acoes: {
      criar_tarefa: {
        tipo_tarefa: "ligacao",
        periodo: "manha",
        dias_futuro: 1,
      },
      enviar_email: false,
      notificar_app: true,
      destinatarios: [],
      mensagem: "",
      escalar_para: "",
    },
    ativa: true,
    prioridade: 1,
  });

  const { empresaId } = useEmpresaAtual();

  const { data: automacoes = [] } = useQuery({
    queryKey: ["automacoes", empresaId],
    queryFn: () => api.entities.AutomacaoRegra.filter({ empresaId }),
    enabled: !!empresaId,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["logs-automacao", empresaId],
    queryFn: () => api.entities.LogAutomacao.filter({ empresaId }, "-created_date", 100),
    enabled: !!empresaId,
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.entities.User.list(),
  });

  const salvarMutation = useMutation({
    mutationFn: async (data) => {
      if (automacaoEditando) {
        return api.entities.AutomacaoRegra.update(automacaoEditando.id, data);
      }
      return api.entities.AutomacaoRegra.create({ ...data, empresaId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automacoes", empresaId] });
      toast.success(automacaoEditando ? "Automação atualizada!" : "Automação criada!");
      fecharModal();
    },
  });

  const deletarMutation = useMutation({
    mutationFn: (id) => api.entities.AutomacaoRegra.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automacoes", empresaId] });
      toast.success("Automação excluída!");
    },
  });

  const executarAgoraMutation = useMutation({
    mutationFn: () => api.functions.invoke("processarAutomacoes", {}),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["logs-automacao"] });
      toast.success(`${response.data.automacoes_executadas} automação(ões) executada(s)!`);
    },
  });

  const toggleAtivoMutation = useMutation({
    mutationFn: ({ id, ativa }) => api.entities.AutomacaoRegra.update(id, { ativa }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automacoes", empresaId] });
    },
  });

  const handleSalvar = () => {
    if (!formData.nome) {
      toast.error("Preencha o nome da automação");
      return;
    }
    salvarMutation.mutate(formData);
  };

  const handleEditar = (automacao) => {
    setAutomacaoEditando(automacao);
    setFormData(automacao);
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setAutomacaoEditando(null);
    setFormData({
      nome: "",
      tipo: "criar_tarefa",
      trigger: "mudanca_status_lead",
      condicoes: {
        status_lead: [],
        origem_lead: [],
        dias_sem_atividade: 3,
        horas_antes_reuniao: 24,
        dias_atraso: 1,
      },
      acoes: {
        criar_tarefa: {
          tipo_tarefa: "ligacao",
          periodo: "manha",
          dias_futuro: 1,
        },
        enviar_email: false,
        notificar_app: true,
        destinatarios: [],
        mensagem: "",
        escalar_para: "",
      },
      ativa: true,
      prioridade: 1,
    });
  };

  const toggleStatus = (statusArray, status) => {
    const current = formData.condicoes[statusArray] || [];
    if (current.includes(status)) {
      setFormData({
        ...formData,
        condicoes: {
          ...formData.condicoes,
          [statusArray]: current.filter(s => s !== status),
        },
      });
    } else {
      setFormData({
        ...formData,
        condicoes: {
          ...formData.condicoes,
          [statusArray]: [...current, status],
        },
      });
    }
  };

  const toggleDestinatario = (email) => {
    const current = formData.acoes.destinatarios || [];
    if (current.includes(email)) {
      setFormData({
        ...formData,
        acoes: {
          ...formData.acoes,
          destinatarios: current.filter(d => d !== email),
        },
      });
    } else {
      setFormData({
        ...formData,
        acoes: {
          ...formData.acoes,
          destinatarios: [...current, email],
        },
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Automações</h1>
          <p className="text-slate-400 mt-1">Configure automações para tarefas, lembretes e notificações</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => setAbaLogs(!abaLogs)}
            variant="outline"
            className="border-slate-700"
          >
            <History className="w-4 h-4 mr-2" />
            {abaLogs ? "Ver Automações" : "Ver Logs"}
          </Button>
          <Button
            onClick={() => executarAgoraMutation.mutate()}
            variant="outline"
            className="border-slate-700"
          >
            <Play className="w-4 h-4 mr-2" />
            Executar Agora
          </Button>
          <Button onClick={() => setModalAberto(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Nova Automação
          </Button>
        </div>
      </div>

      {!abaLogs ? (
        /* Automações */
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Regras de Automação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {automacoes.map((automacao) => (
                <motion.div
                  key={automacao.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-between p-4 rounded-lg bg-slate-900/50 border border-slate-700"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Zap className="w-5 h-5 text-[#ff6b35]" />
                      <h3 className="text-white font-medium">{automacao.nome}</h3>
                      <Badge className={automacao.ativa ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-500/20 text-slate-400"}>
                        {automacao.ativa ? "Ativa" : "Inativa"}
                      </Badge>
                      <Badge variant="outline" className="border-slate-600 text-slate-300">
                        {automacao.tipo}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-400">
                      Trigger: {automacao.trigger} • Prioridade: {automacao.prioridade}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={automacao.ativa}
                      onCheckedChange={(checked) => toggleAtivoMutation.mutate({ id: automacao.id, ativa: checked })}
                    />
                    <Button size="sm" variant="ghost" onClick={() => handleEditar(automacao)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deletarMutation.mutate(automacao.id)}>
                      <Trash2 className="w-4 h-4 text-rose-400" />
                    </Button>
                  </div>
                </motion.div>
              ))}

              {automacoes.length === 0 && (
                <div className="text-center py-12">
                  <Zap className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">Nenhuma automação configurada</p>
                  <Button onClick={() => setModalAberto(true)} className="mt-4 bg-blue-600">
                    Criar Primeira Automação
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Logs */
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Histórico de Execuções</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={log.status === "sucesso" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}>
                        {log.status}
                      </Badge>
                      <span className="text-white font-medium">{log.automacao_nome}</span>
                    </div>
                    <p className="text-sm text-slate-400">{log.acao_executada}</p>
                    {log.lead_nome && (
                      <p className="text-xs text-slate-500 mt-1">Lead: {log.lead_nome}</p>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">
                    {format(new Date(log.created_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                </div>
              ))}

              {logs.length === 0 && (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">Nenhuma execução registrada</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de Configuração */}
      <Dialog open={modalAberto} onOpenChange={fecharModal}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {automacaoEditando ? "Editar Automação" : "Nova Automação"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Nome *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Ex: Criar tarefa para leads sem resposta"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Tipo *</Label>
                <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="criar_tarefa">Criar Tarefa</SelectItem>
                    <SelectItem value="enviar_lembrete">Enviar Lembrete</SelectItem>
                    <SelectItem value="escalar_lead">Escalar Lead</SelectItem>
                    <SelectItem value="notificar_reuniao">Notificar Reunião</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Trigger *</Label>
                <Select value={formData.trigger} onValueChange={(v) => setFormData({ ...formData, trigger: v })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="mudanca_status_lead">Mudança de Status</SelectItem>
                    <SelectItem value="sem_atividade">Sem Atividade</SelectItem>
                    <SelectItem value="tarefa_atrasada">Tarefa Atrasada</SelectItem>
                    <SelectItem value="reuniao_proxima">Reunião Próxima</SelectItem>
                    <SelectItem value="novo_lead">Novo Lead</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Condições */}
            <div className="space-y-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <h3 className="text-sm font-medium text-white">Condições</h3>

              {formData.trigger === "mudanca_status_lead" && (
                <div className="space-y-2">
                  <Label className="text-slate-300 text-sm">Status do Lead</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {["novo", "em_cadencia", "respondeu", "reuniao_agendada", "reuniao_realizada", "qualificado"].map((status) => (
                      <label key={status} className="flex items-center gap-2 p-2 rounded hover:bg-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.condicoes.status_lead?.includes(status)}
                          onChange={() => toggleStatus("status_lead", status)}
                          className="rounded border-slate-600"
                        />
                        <span className="text-slate-300 text-sm capitalize">{status.replace(/_/g, " ")}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {formData.trigger === "sem_atividade" && (
                <div className="space-y-2">
                  <Label className="text-slate-300 text-sm">Dias sem atividade</Label>
                  <Input
                    type="number"
                    value={formData.condicoes.dias_sem_atividade}
                    onChange={(e) => setFormData({
                      ...formData,
                      condicoes: { ...formData.condicoes, dias_sem_atividade: parseInt(e.target.value) }
                    })}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              )}

              {formData.trigger === "reuniao_proxima" && (
                <div className="space-y-2">
                  <Label className="text-slate-300 text-sm">Horas antes da reunião</Label>
                  <Input
                    type="number"
                    value={formData.condicoes.horas_antes_reuniao}
                    onChange={(e) => setFormData({
                      ...formData,
                      condicoes: { ...formData.condicoes, horas_antes_reuniao: parseInt(e.target.value) }
                    })}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              )}
            </div>

            {/* Ações */}
            <div className="space-y-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <h3 className="text-sm font-medium text-white">Ações</h3>

              {formData.tipo === "criar_tarefa" && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm">Tipo de Tarefa</Label>
                    <Select
                      value={formData.acoes.criar_tarefa?.tipo_tarefa}
                      onValueChange={(v) => setFormData({
                        ...formData,
                        acoes: {
                          ...formData.acoes,
                          criar_tarefa: { ...formData.acoes.criar_tarefa, tipo_tarefa: v }
                        }
                      })}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="ligacao">Ligação</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="email">E-mail</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm">Período</Label>
                    <Select
                      value={formData.acoes.criar_tarefa?.periodo}
                      onValueChange={(v) => setFormData({
                        ...formData,
                        acoes: {
                          ...formData.acoes,
                          criar_tarefa: { ...formData.acoes.criar_tarefa, periodo: v }
                        }
                      })}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="manha">Manhã</SelectItem>
                        <SelectItem value="tarde">Tarde</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm">Dias no Futuro</Label>
                    <Input
                      type="number"
                      value={formData.acoes.criar_tarefa?.dias_futuro}
                      onChange={(e) => setFormData({
                        ...formData,
                        acoes: {
                          ...formData.acoes,
                          criar_tarefa: { ...formData.acoes.criar_tarefa, dias_futuro: parseInt(e.target.value) }
                        }
                      })}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                </div>
              )}

              {(formData.tipo === "enviar_lembrete" || formData.tipo === "notificar_reuniao") && (
                <>
                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm">Mensagem</Label>
                    <Textarea
                      value={formData.acoes.mensagem}
                      onChange={(e) => setFormData({
                        ...formData,
                        acoes: { ...formData.acoes, mensagem: e.target.value }
                      })}
                      className="bg-slate-800 border-slate-700 text-white"
                      placeholder="Mensagem do lembrete"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm">Destinatários</Label>
                    <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 bg-slate-800 rounded border border-slate-700">
                      {usuarios.map((u) => (
                        <label key={u.id} className="flex items-center gap-2 p-1 rounded hover:bg-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.acoes.destinatarios?.includes(u.email)}
                            onChange={() => toggleDestinatario(u.email)}
                            className="rounded border-slate-600"
                          />
                          <span className="text-slate-300 text-xs">{u.full_name || u.email}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300">Notificar no App</Label>
                    <Switch
                      checked={formData.acoes.notificar_app}
                      onCheckedChange={(v) => setFormData({
                        ...formData,
                        acoes: { ...formData.acoes, notificar_app: v }
                      })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300">Enviar E-mail</Label>
                    <Switch
                      checked={formData.acoes.enviar_email}
                      onCheckedChange={(v) => setFormData({
                        ...formData,
                        acoes: { ...formData.acoes, enviar_email: v }
                      })}
                    />
                  </div>
                </>
              )}

              {formData.tipo === "escalar_lead" && (
                <div className="space-y-2">
                  <Label className="text-slate-300 text-sm">Escalar Para</Label>
                  <Select
                    value={formData.acoes.escalar_para}
                    onValueChange={(v) => setFormData({
                      ...formData,
                      acoes: { ...formData.acoes, escalar_para: v }
                    })}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue placeholder="Selecione o responsável" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {usuarios.map((u) => (
                        <SelectItem key={u.id} value={u.email}>
                          {u.full_name || u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Prioridade</Label>
              <Input
                type="number"
                value={formData.prioridade}
                onChange={(e) => setFormData({ ...formData, prioridade: parseInt(e.target.value) })}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="1 = maior prioridade"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
              <Button variant="ghost" onClick={fecharModal}>
                Cancelar
              </Button>
              <Button onClick={handleSalvar} className="bg-blue-600 hover:bg-blue-700">
                <Save className="w-4 h-4 mr-2" />
                Salvar Automação
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}