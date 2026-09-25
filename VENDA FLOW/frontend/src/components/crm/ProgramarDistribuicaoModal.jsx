import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listarLeads } from "@/lib/services/leadService";
import { listarCadencias } from "@/lib/services/cadenciaService";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { api } from "@/api/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ProgramarDistribuicaoModal({ open, onClose }) {
  const { empresaId } = useEmpresaAtual();
  const [formData, setFormData] = useState({
    nome: "",
    filtro_origem: "todas",
    filtro_status: "novo",
    filtro_campanha: "",
    filtro_sem_sdr: true,
    data_inicio: "",
    data_fim: "",
    leads_por_dia_por_sdr: 10,
    sdrs_atribuidos: [],
    closer_padrao: "",
    cadencia_id: "",
  });

  const queryClient = useQueryClient();

  const { data: usuarios = [] } = useQuery({
    queryKey: ["users-empresa", empresaId],
    queryFn: () => api.entities.VinculoEmpresa.filter({ empresaId, status: "ativo" }).then(
      vinculos => vinculos.map(v => ({ id: v.userEmail, email: v.userEmail, full_name: v.userName || v.userEmail, role: v.papel }))
    ),
    enabled: !!empresaId,
  });

  const { data: cadencias = [] } = useQuery({
    queryKey: ["cadencias", empresaId],
    queryFn: () => listarCadencias(empresaId),
    enabled: !!empresaId,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads", empresaId],
    queryFn: () => listarLeads(empresaId),
    enabled: !!empresaId,
  });

  const ROLES_SDR = ["sdr", "social_seller", "gestor", "admin", "gestor_empresa", "gerente_empresa", "gerente_filial"];
  const ROLES_CLOSER = ["closer", "cs", "gestor", "admin", "gestor_empresa", "gerente_empresa", "gerente_filial"];
  const sdrs = usuarios.filter(u => ROLES_SDR.includes(u.role));
  const closers = usuarios.filter(u => ROLES_CLOSER.includes(u.role));

  const criarProgramacaoMutation = useMutation({
    mutationFn: async (data) => {
      // Construir filtro
      const filtro = {};
      if (data.filtro_status && data.filtro_status !== "todos") {
        filtro.status = data.filtro_status;
      }
      if (data.filtro_origem && data.filtro_origem !== "todas") {
        filtro.origem = data.filtro_origem;
      }
      if (data.filtro_campanha) {
        filtro.campanha = data.filtro_campanha;
      }
      if (data.filtro_sem_sdr) {
        filtro.sem_sdr = true;
      }

      // Contar leads disponíveis
      const leadsDisponiveis = leads.filter(lead => {
        if (filtro.status && lead.status !== filtro.status) return false;
        if (filtro.origem && lead.origem !== filtro.origem) return false;
        if (filtro.campanha && lead.campanha !== filtro.campanha) return false;
        if (filtro.sem_sdr && lead.sdr_responsavel) return false;
        return true;
      });

      return api.entities.ProgramacaoDistribuicao.create({
        nome: data.nome,
        filtro_leads: filtro,
        data_inicio: data.data_inicio,
        data_fim: data.data_fim,
        leads_por_dia_por_sdr: data.leads_por_dia_por_sdr,
        sdrs_atribuidos: data.sdrs_atribuidos,
        closer_padrao: data.closer_padrao || null,
        cadencia_id: data.cadencia_id || null,
        status: "aguardando",
        total_leads_disponiveis: leadsDisponiveis.length,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programacoes-distribuicao"] });
      toast.success("Programação criada! A distribuição iniciará na data configurada.");
      fecharModal();
    },
  });

  const toggleSDR = (email) => {
    const sdrs = formData.sdrs_atribuidos || [];
    if (sdrs.includes(email)) {
      setFormData({ ...formData, sdrs_atribuidos: sdrs.filter(s => s !== email) });
    } else {
      setFormData({ ...formData, sdrs_atribuidos: [...sdrs, email] });
    }
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    await criarProgramacaoMutation.mutateAsync(formData);
  };

  const fecharModal = () => {
    setFormData({
      nome: "",
      filtro_origem: "todas",
      filtro_status: "novo",
      filtro_campanha: "",
      filtro_sem_sdr: true,
      data_inicio: "",
      data_fim: "",
      leads_por_dia_por_sdr: 10,
      sdrs_atribuidos: [],
      closer_padrao: "",
      cadencia_id: "",
    });
    onClose();
  };

  // Calcular leads que serão distribuídos
  const leadsDisponiveis = leads.filter(lead => {
    if (formData.filtro_status !== "todos" && lead.status !== formData.filtro_status) return false;
    if (formData.filtro_origem !== "todas" && lead.origem !== formData.filtro_origem) return false;
    if (formData.filtro_campanha && lead.campanha !== formData.filtro_campanha) return false;
    if (formData.filtro_sem_sdr && lead.sdr_responsavel) return false;
    return true;
  }).length;

  return (
    <Dialog open={open} onOpenChange={fecharModal}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Programar Distribuição de Leads
          </DialogTitle>
          <DialogDescription className="sr-only">
            Configure a distribuição automática de leads entre SDRs por período
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSalvar} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Nome da Programação *</Label>
            <Input
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white"
              placeholder="Ex: Distribuição Lista Fria Janeiro"
              required
            />
          </div>

          {/* Filtros */}
          <div className="space-y-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <h3 className="text-sm font-medium text-white">Filtros de Leads</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-slate-300 text-sm">Status</Label>
                <Select
                  value={formData.filtro_status}
                  onValueChange={(value) => setFormData({ ...formData, filtro_status: value })}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="novo">Novo</SelectItem>
                    <SelectItem value="desqualificado">Desqualificado</SelectItem>
                    <SelectItem value="sem_interesse">Sem Interesse</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300 text-sm">Origem</Label>
                <Select
                  value={formData.filtro_origem}
                  onValueChange={(value) => setFormData({ ...formData, filtro_origem: value })}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="lista_fria">Lista Fria</SelectItem>
                    <SelectItem value="trafego_pago">Tráfego Pago</SelectItem>
                    <SelectItem value="indicacao">Indicação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Campanha Específica</Label>
              <Input
                value={formData.filtro_campanha}
                onChange={(e) => setFormData({ ...formData, filtro_campanha: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Deixe vazio para todas"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={formData.filtro_sem_sdr}
                onChange={(e) => setFormData({ ...formData, filtro_sem_sdr: e.target.checked })}
                className="rounded border-slate-600"
              />
              Apenas leads sem SDR atribuído
            </label>

            <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded">
              <p className="text-sm text-blue-300">
                📊 {leadsDisponiveis} leads correspondem aos filtros
              </p>
            </div>
          </div>

          {/* Período */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Data Início *</Label>
              <Input
                type="date"
                value={formData.data_inicio}
                onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Data Fim *</Label>
              <Input
                type="date"
                value={formData.data_fim}
                onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Leads por Dia (por SDR) *</Label>
            <Input
              type="number"
              min="1"
              max="100"
              value={formData.leads_por_dia_por_sdr}
              onChange={(e) => setFormData({ ...formData, leads_por_dia_por_sdr: parseInt(e.target.value) || 10 })}
              className="bg-slate-800 border-slate-700 text-white"
            />
            <p className="text-xs text-slate-500">
              Total diário: {formData.leads_por_dia_por_sdr * formData.sdrs_atribuidos.length} leads/dia
            </p>
          </div>

          {/* SDRs */}
          <div className="space-y-2">
            <Label className="text-slate-300">SDRs para Distribuição *</Label>
            <div className="grid grid-cols-2 gap-2 p-3 bg-slate-800 rounded-lg border border-slate-700 max-h-40 overflow-y-auto">
              {sdrs.map((sdr) => (
                <label
                  key={sdr.id}
                  className="flex items-center gap-2 p-2 rounded hover:bg-slate-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formData.sdrs_atribuidos.includes(sdr.email)}
                    onChange={() => toggleSDR(sdr.email)}
                    className="rounded border-slate-600"
                  />
                  <span className="text-slate-300 text-sm">{sdr.full_name || sdr.email}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Opcionais */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Closer Padrão</Label>
              <Select
                value={formData.closer_padrao}
                onValueChange={(value) => setFormData({ ...formData, closer_padrao: value })}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value={null}>Nenhum</SelectItem>
                  {closers.map((closer) => (
                    <SelectItem key={closer.id} value={closer.email}>
                      {closer.full_name || closer.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Cadência Automática</Label>
              <Select
                value={formData.cadencia_id}
                onValueChange={(value) => setFormData({ ...formData, cadencia_id: value })}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value={null}>Nenhuma</SelectItem>
                  {cadencias.map((cadencia) => (
                    <SelectItem key={cadencia.id} value={cadencia.id}>
                      {cadencia.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <Button type="button" variant="ghost" onClick={fecharModal} className="text-slate-400">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={criarProgramacaoMutation.isPending || formData.sdrs_atribuidos.length === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {criarProgramacaoMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar Programação
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}