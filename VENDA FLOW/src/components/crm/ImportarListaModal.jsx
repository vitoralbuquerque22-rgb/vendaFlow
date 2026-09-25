import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { criarLead, atualizarLead } from "@/lib/services/leadService";
import { criarTarefa } from "@/lib/services/tarefaService";
import { listarCadencias } from "@/lib/services/cadenciaService";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { base44 } from "@/api/base44Client";
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
import { Loader2, Upload, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";

export default function ImportarListaModal({ open, onClose }) {
  const { empresaId } = useEmpresaAtual();
  const [etapa, setEtapa] = useState(1); // 1 = upload, 2 = config distribuição, 3 = processando
  const [arquivo, setArquivo] = useState(null);
  const [leadsPreview, setLeadsPreview] = useState([]);
  const [configDistribuicao, setConfigDistribuicao] = useState({
    sdr_emails: [],
    closer_email: "",
    cadencia_id: "",
    leads_por_sdr: 0,
    modo_distribuicao: "igual", // igual ou especifico
  });
  
  const queryClient = useQueryClient();

  const { data: usuarios = [] } = useQuery({
    queryKey: ["users-empresa", empresaId],
    queryFn: () => base44.entities.VinculoEmpresa.filter({ empresaId, status: "ativo" }).then(
      vinculos => vinculos.map(v => ({ id: v.userEmail, email: v.userEmail, full_name: v.userName || v.userEmail, role: v.papel }))
    ),
    enabled: !!empresaId,
  });

  const { data: cadencias = [] } = useQuery({
    queryKey: ["cadencias", empresaId],
    queryFn: () => listarCadencias(empresaId),
    enabled: !!empresaId,
  });

  const ROLES_SDR = ["sdr", "social_seller", "gestor", "admin", "gestor_empresa", "gerente_empresa", "gerente_filial"];
  const ROLES_CLOSER = ["closer", "cs", "gestor", "admin", "gestor_empresa", "gerente_empresa", "gerente_filial"];
  const sdrs = usuarios.filter(u => ROLES_SDR.includes(u.role));
  const closers = usuarios.filter(u => ROLES_CLOSER.includes(u.role));

  const importarMutation = useMutation({
    mutationFn: async (dados) => {
      const hoje = new Date();

      // 1. Criar todos os leads em paralelo
      const leadsImportados = await Promise.all(
        dados.leads.map((leadData) => criarLead(leadData))
      );

      // 2. Para cada lead, fazer update + tarefas em paralelo
      await Promise.all(
        leadsImportados.map(async (lead, index) => {
          const sdrEmail = dados.config.sdr_emails[index % dados.config.sdr_emails.length];

          const atualizacoes = { sdr_responsavel: sdrEmail };
          if (dados.config.closer_email) {
            atualizacoes.closer_responsavel = dados.config.closer_email;
          }

          let etapasCadencia = [];
          if (dados.config.cadencia_id) {
            const cadencia = cadencias.find(c => c.id === dados.config.cadencia_id);
            if (cadencia) {
              atualizacoes.status = 'em_cadencia';
              atualizacoes.cadencia_id = cadencia.id;
              atualizacoes.dia_cadencia = 1;
              atualizacoes.data_inicio_cadencia = format(hoje, 'yyyy-MM-dd');
              etapasCadencia = cadencia.etapas || [];
            }
          }

          await Promise.all([
            atualizarLead(lead.id, atualizacoes),
            ...etapasCadencia.map((etapa) => {
              const dataPrevista = addDays(hoje, etapa.dia - 1);
              return criarTarefa({
                empresaId: dados.leads[0].empresaId,
                lead_id: lead.id,
                lead_nome: lead.nome,
                lead_telefone: lead.telefone,
                lead_empresa: lead.empresa,
                sdr_email: sdrEmail,
                tipo: etapa.tipo,
                data_prevista: format(dataPrevista, 'yyyy-MM-dd'),
                periodo: etapa.periodo,
                status: 'pendente',
                dia_cadencia: etapa.dia,
                cadencia_id: dados.config.cadencia_id,
                script_id: etapa.script_id,
              });
            }),
          ]);
        })
      );

      return leadsImportados;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      toast.success(`${data.length} leads importados e distribuídos!`);
      fecharModal();
    },
    onError: () => {
      toast.error("Erro ao importar lista");
    },
  });

  const handleArquivoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setArquivo(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        const lines = text.split("\n");
        const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());

        const leadsTemp = [];
        for (let i = 1; i < lines.length && i < 6; i++) {
          if (!lines[i].trim()) continue;

          const values = lines[i].split(",").map((v) => v.replace(/"/g, "").trim());
          const lead = {
            nome: values[0],
            telefone: values[1] || values[2],
            empresa: values[1],
            email: values[3],
            origem: "lista_fria",
          };

          if (lead.nome && lead.telefone) {
            leadsTemp.push(lead);
          }
        }

        setLeadsPreview(leadsTemp);
        setEtapa(2);
      } catch (error) {
        toast.error("Erro ao ler arquivo. Verifique o formato.");
      }
    };
    reader.readAsText(file);
  };

  const handleImportar = async () => {
    if (!arquivo || configDistribuicao.sdr_emails.length === 0) {
      toast.error("Selecione pelo menos 1 SDR");
      return;
    }

    setEtapa(3);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result;
        const lines = text.split("\n");

        const leadsParaImportar = [];
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;

          const values = lines[i].split(",").map((v) => v.replace(/"/g, "").trim());
          const lead = {
            nome: values[0],
            telefone: values[1] || values[2],
            empresa: values[1],
            email: values[3],
            origem: "lista_fria",
          };

          if (lead.nome && lead.telefone) {
            leadsParaImportar.push(lead);
          }
        }

        await importarMutation.mutateAsync({
          leads: leadsParaImportar,
          config: configDistribuicao,
        });
      } catch (error) {
        toast.error("Erro ao processar importação");
        setEtapa(2);
      }
    };
    reader.readAsText(arquivo);
  };

  const toggleSDR = (email) => {
    const sdrs = configDistribuicao.sdr_emails || [];
    if (sdrs.includes(email)) {
      setConfigDistribuicao({
        ...configDistribuicao,
        sdr_emails: sdrs.filter(s => s !== email),
      });
    } else {
      setConfigDistribuicao({
        ...configDistribuicao,
        sdr_emails: [...sdrs, email],
      });
    }
  };

  const fecharModal = () => {
    setEtapa(1);
    setArquivo(null);
    setLeadsPreview([]);
    setConfigDistribuicao({
      sdr_emails: [],
      closer_email: "",
      cadencia_id: "",
      leads_por_sdr: 0,
      modo_distribuicao: "igual",
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={fecharModal}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">Importar Lista com Distribuição</DialogTitle>
          <DialogDescription className="sr-only">
            Importe um arquivo CSV e distribua leads entre SDRs com cadência automática
          </DialogDescription>
        </DialogHeader>

        {etapa === 1 && (
          <div className="space-y-4 mt-4">
            <div className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Selecione um arquivo CSV</h3>
              <p className="text-sm text-slate-400 mb-4">
                Formato: Nome, Empresa, Telefone, Email
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleArquivoChange}
                className="hidden"
                id="file-upload"
              />
              <Button
                onClick={() => document.getElementById("file-upload")?.click()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Escolher Arquivo
              </Button>
            </div>
          </div>
        )}

        {etapa === 2 && (
          <div className="space-y-4 mt-4">
            <div className="bg-slate-800 rounded-lg p-4 mb-4">
              <p className="text-sm text-slate-400">Preview dos primeiros leads:</p>
              <div className="mt-2 space-y-1">
                {leadsPreview.map((lead, i) => (
                  <p key={i} className="text-xs text-slate-300">
                    • {lead.nome} - {lead.telefone}
                  </p>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">SDRs para Distribuição *</Label>
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-800 rounded-lg border border-slate-700 max-h-48 overflow-y-auto">
                {sdrs.map((sdr) => (
                  <label
                    key={sdr.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-slate-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={configDistribuicao.sdr_emails.includes(sdr.email)}
                      onChange={() => toggleSDR(sdr.email)}
                      className="rounded border-slate-600"
                    />
                    <span className="text-slate-300 text-sm">{sdr.full_name || sdr.email}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                {configDistribuicao.sdr_emails.length} SDR(s) selecionado(s)
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Closer Padrão (Opcional)</Label>
              <Select
                value={configDistribuicao.closer_email}
                onValueChange={(value) => setConfigDistribuicao({ ...configDistribuicao, closer_email: value })}
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
              <Label className="text-slate-300">Cadência Automática (Opcional)</Label>
              <Select
                value={configDistribuicao.cadencia_id}
                onValueChange={(value) => setConfigDistribuicao({ ...configDistribuicao, cadencia_id: value })}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value={null}>Nenhuma</SelectItem>
                  {cadencias.map((cadencia) => (
                    <SelectItem key={cadencia.id} value={cadencia.id}>
                      {cadencia.nome} ({cadencia.duracao_dias} dias)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
              <Button variant="ghost" onClick={fecharModal} className="text-slate-400">
                Cancelar
              </Button>
              <Button
                onClick={handleImportar}
                disabled={configDistribuicao.sdr_emails.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Importar e Distribuir
              </Button>
            </div>
          </div>
        )}

        {etapa === 3 && (
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Importando e Distribuindo</h3>
            <p className="text-slate-400">Aguarde enquanto processamos sua lista...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}