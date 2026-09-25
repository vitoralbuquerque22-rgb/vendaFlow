import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, Plus, Edit, Trash2, Save, AlertCircle, Archive } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import AlertasCard from "@/components/alertas/AlertasCard";

export default function ConfiguracaoAlertas() {
  const queryClient = useQueryClient();
  const [modalAberto, setModalAberto] = useState(false);
  const [alertaEditando, setAlertaEditando] = useState(null);
  const [testarAlertas, setTestarAlertas] = useState(false);

  const [formData, setFormData] = useState({
    nome: "",
    tipo: "meta_em_risco",
    metrica: "leads",
    condicao: "percentual_meta",
    valor_threshold: 70,
    periodo_avaliacao: "diario",
    destinatarios: [],
    notificar_no_app: true,
    enviar_email: false,
    ativo: true,
    escopo: "empresa",
    usuario_especifico: "",
  });

  const { empresaId } = useEmpresaAtual();

  const { data: configuracoes = [] } = useQuery({
    queryKey: ["configuracoes-alertas", empresaId],
    queryFn: () => base44.entities.ConfiguracaoAlerta.filter({ empresaId }),
    enabled: !!empresaId,
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ["usuarios"],
    queryFn: () => base44.entities.User.list(),
  });

  const salvarMutation = useMutation({
    mutationFn: async (data) => {
      if (alertaEditando) {
        return base44.entities.ConfiguracaoAlerta.update(alertaEditando.id, data);
      }
      return base44.entities.ConfiguracaoAlerta.create({ ...data, empresaId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configuracoes-alertas", empresaId] });
      toast.success(alertaEditando ? "Alerta atualizado!" : "Alerta criado!");
      fecharModal();
    },
  });

  const deletarMutation = useMutation({
    mutationFn: (id) => base44.entities.ConfiguracaoAlerta.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configuracoes-alertas", empresaId] });
      toast.success("Alerta excluído!");
    },
  });

  const verificarAlertasMutation = useMutation({
    mutationFn: () => base44.functions.invoke("verificarAlertas", {}),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["alertas"] });
      toast.success(`${response.data.alertas_disparados} alerta(s) verificado(s)!`);
    },
  });

  const toggleAtivoMutation = useMutation({
    mutationFn: ({ id, ativo }) => base44.entities.ConfiguracaoAlerta.update(id, { ativo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configuracoes-alertas", empresaId] });
    },
  });

  const handleSalvar = () => {
    if (!formData.nome || !formData.metrica) {
      toast.error("Preencha nome e métrica");
      return;
    }

    if (formData.destinatarios.length === 0) {
      toast.error("Selecione pelo menos um destinatário");
      return;
    }

    salvarMutation.mutate(formData);
  };

  const handleEditar = (config) => {
    setAlertaEditando(config);
    setFormData(config);
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setAlertaEditando(null);
    setFormData({
      nome: "",
      tipo: "meta_em_risco",
      metrica: "leads",
      condicao: "percentual_meta",
      valor_threshold: 70,
      periodo_avaliacao: "diario",
      destinatarios: [],
      notificar_no_app: true,
      enviar_email: false,
      ativo: true,
      escopo: "empresa",
      usuario_especifico: "",
    });
  };

  const toggleDestinatario = (email) => {
    setFormData((prev) => {
      const destinatarios = prev.destinatarios || [];
      if (destinatarios.includes(email)) {
        return { ...prev, destinatarios: destinatarios.filter((d) => d !== email) };
      }
      return { ...prev, destinatarios: [...destinatarios, email] };
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Configuração de Alertas</h1>
          <p className="text-slate-400 mt-1">Configure alertas automáticos para acompanhar metas e performance</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => verificarAlertasMutation.mutate()} variant="outline" className="border-slate-700">
            <AlertCircle className="w-4 h-4 mr-2" />
            Verificar Alertas Agora
          </Button>
          <Button onClick={() => setModalAberto(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Novo Alerta
          </Button>
        </div>
      </div>

      {/* Alertas Ativos */}
      <AlertasCard mostrarTodos limitarAlertas={10} />

      {/* Configurações de Alertas */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Regras de Alertas Configuradas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {configuracoes.map((config) => (
              <motion.div
                key={config.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-between p-4 rounded-lg bg-slate-900/50 border border-slate-700"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-white font-medium">{config.nome}</h3>
                    <Badge className={config.ativo ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-500/20 text-slate-400"}>
                      {config.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                    <Badge variant="outline" className="border-slate-600 text-slate-300">
                      {config.metrica}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-400">
                    {config.tipo} • {config.condicao} {config.valor_threshold}
                    {config.condicao === "percentual_meta" && "%"} • Avaliação {config.periodo_avaliacao}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Destinatários: {config.destinatarios?.length || 0} usuário(s)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={config.ativo}
                    onCheckedChange={(checked) => toggleAtivoMutation.mutate({ id: config.id, ativo: checked })}
                  />
                  <Button size="sm" variant="ghost" onClick={() => handleEditar(config)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deletarMutation.mutate(config.id)}>
                    <Trash2 className="w-4 h-4 text-rose-400" />
                  </Button>
                </div>
              </motion.div>
            ))}

            {configuracoes.length === 0 && (
              <div className="text-center py-12">
                <Bell className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">Nenhuma regra de alerta configurada</p>
                <Button onClick={() => setModalAberto(true)} className="mt-4 bg-blue-600">
                  Criar Primeiro Alerta
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal de Configuração */}
      <Dialog open={modalAberto} onOpenChange={fecharModal}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {alertaEditando ? "Editar Alerta" : "Novo Alerta"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Nome do Alerta *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Ex: Meta de Leads em Risco"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Tipo de Alerta *</Label>
                <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="meta_atingida">Meta Atingida</SelectItem>
                    <SelectItem value="meta_em_risco">Meta em Risco</SelectItem>
                    <SelectItem value="anomalia">Anomalia</SelectItem>
                    <SelectItem value="baixa_performance">Baixa Performance</SelectItem>
                    <SelectItem value="alta_performance">Alta Performance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Métrica *</Label>
                <Select value={formData.metrica} onValueChange={(v) => setFormData({ ...formData, metrica: v })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="leads">Leads</SelectItem>
                    <SelectItem value="mql">MQL</SelectItem>
                    <SelectItem value="conexoes">Conexões</SelectItem>
                    <SelectItem value="reunioes_marcadas">Reuniões Marcadas</SelectItem>
                    <SelectItem value="reunioes_realizadas">Reuniões Realizadas</SelectItem>
                    <SelectItem value="vendas">Vendas</SelectItem>
                    <SelectItem value="faturamento">Faturamento</SelectItem>
                    <SelectItem value="ligacoes">Ligações</SelectItem>
                    <SelectItem value="tarefas_concluidas">Tarefas Concluídas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Condição *</Label>
                <Select value={formData.condicao} onValueChange={(v) => setFormData({ ...formData, condicao: v })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="percentual_meta">% da Meta</SelectItem>
                    <SelectItem value="maior_que">Maior que</SelectItem>
                    <SelectItem value="menor_que">Menor que</SelectItem>
                    <SelectItem value="maior_igual">Maior ou igual</SelectItem>
                    <SelectItem value="menor_igual">Menor ou igual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Valor Limite *</Label>
                <Input
                  type="number"
                  value={formData.valor_threshold}
                  onChange={(e) => setFormData({ ...formData, valor_threshold: parseFloat(e.target.value) })}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Período de Avaliação *</Label>
                <Select value={formData.periodo_avaliacao} onValueChange={(v) => setFormData({ ...formData, periodo_avaliacao: v })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="diario">Diário</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Escopo *</Label>
                <Select value={formData.escopo} onValueChange={(v) => setFormData({ ...formData, escopo: v })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="empresa">Empresa Toda</SelectItem>
                    <SelectItem value="individual">Individual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.escopo === "individual" && (
              <div className="space-y-2">
                <Label className="text-slate-300">Usuário Específico *</Label>
                <Select value={formData.usuario_especifico} onValueChange={(v) => setFormData({ ...formData, usuario_especifico: v })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Selecione o usuário" />
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

            <div className="space-y-2">
              <Label className="text-slate-300">Destinatários *</Label>
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-800 rounded-lg border border-slate-700 max-h-48 overflow-y-auto">
                {usuarios.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 p-2 rounded hover:bg-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.destinatarios?.includes(u.email)}
                      onChange={() => toggleDestinatario(u.email)}
                      className="rounded border-slate-600"
                    />
                    <span className="text-slate-300 text-sm">{u.full_name || u.email}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
              <Label className="text-slate-300">Notificar no App</Label>
              <Switch checked={formData.notificar_no_app} onCheckedChange={(v) => setFormData({ ...formData, notificar_no_app: v })} />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
              <Label className="text-slate-300">Enviar E-mail</Label>
              <Switch checked={formData.enviar_email} onCheckedChange={(v) => setFormData({ ...formData, enviar_email: v })} />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
              <Button variant="ghost" onClick={fecharModal}>
                Cancelar
              </Button>
              <Button onClick={handleSalvar} className="bg-blue-600 hover:bg-blue-700">
                <Save className="w-4 h-4 mr-2" />
                Salvar Alerta
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}