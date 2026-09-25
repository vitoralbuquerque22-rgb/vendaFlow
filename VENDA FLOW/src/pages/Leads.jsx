import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  buscarLeadsPaginados, listarLeads, listarLeadScores, criarLead, atualizarLead, excluirLead, liberarLockLead, listarTarefasDoLead,
} from "@/lib/services/leadService";
import { criarTarefa, criarTarefasDaCadencia } from "@/lib/services/tarefaService";
import { listarCadencias } from "@/lib/services/cadenciaService";
import { listarEquipes, listarVinculos, vinculosParaUsuarios, carregarMapaNomes } from "@/lib/services/equipeService";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import SeletorCampanha from "@/components/telefonia/SeletorCampanha";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, Users, RefreshCw, Upload, Download, Filter, MoreVertical, ArrowUpDown, ArrowUp, ArrowDown, Columns, FileSpreadsheet, Grid, TableIcon, Instagram, TrendingUp, Calendar, Trash2, Radio, Lock, Clock, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/components/hooks/usePermissions";
import LeadScoreBadge from "@/components/crm/LeadScoreBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import LeadCard from "@/components/crm/LeadCard";
import LeadModal from "@/components/crm/LeadModal";
import ProximosContatosCard from "@/components/crm/ProximosContatosCard";
import LeadsExternos from "@/components/crm/LeadsExternos";
import ImportarListaModal from "@/components/crm/ImportarListaModal";
import ProgramarDistribuicaoModal from "@/components/crm/ProgramarDistribuicaoModal";
import ExportarLeadsModal from "@/components/crm/ExportarLeadsModal";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format, addDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatarTelefone } from "@/lib/formatarTelefone";

function ClientesCard({ leads, colaboradores = [], isLoading }) {
  const nomePorEmail = (email) => {
    if (!email) return null;
    const colab = colaboradores.find(c => c.email === email);
    return colab?.nome || colab?.full_name || email.split('@')[0];
  };

  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="py-12 text-center">
          <Loader2 className="w-6 h-6 text-slate-500 animate-spin mx-auto mb-2" />
          <p className="text-slate-500 text-sm">Carregando clientes...</p>
        </CardContent>
      </Card>
    );
  }

  if (!leads.length) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="py-12 text-center">
          <p className="text-slate-500 text-sm">Nenhum cliente com venda realizada ainda</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          🏆 Clientes — Vendas Realizadas
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
            {leads.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {leads.map(lead => (
          <div key={lead.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/50 border border-slate-700 hover:border-emerald-500/50 transition-colors cursor-pointer">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-400">
              🏆
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{lead.nome}</p>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                {lead.empresa && <span>{lead.empresa}</span>}
                {lead.telefone && <><span className="text-slate-600">·</span><span>{formatarTelefone(lead.telefone)}</span></>}
                {lead.sdr_responsavel && <><span className="text-slate-600">·</span><span>SDR: {nomePorEmail(lead.sdr_responsavel)}</span></>}
                {lead.closer_responsavel && <><span className="text-slate-600">·</span><span>Closer: {nomePorEmail(lead.closer_responsavel)}</span></>}
              </div>
            </div>
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
              Venda Realizada
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function Leads() {
  const [buscaInput, setBuscaInput] = useState("");
  const [busca, setBusca] = useState("");
  const debounceRef = useRef(null);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroOrigem, setFiltroOrigem] = useState("todas");
  const [filtroSDR, setFiltroSDR] = useState("todos");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [leadEditando, setLeadEditando] = useState(null);
  const [modalCadencia, setModalCadencia] = useState(false);
  const [leadCadencia, setLeadCadencia] = useState(null);
  const [cadenciaSelecionada, setCadenciaSelecionada] = useState("");
  const [visualizacao, setVisualizacao] = useState("tabela");
  const [ordenacao, setOrdenacao] = useState({ campo: "created_date", direcao: "desc" });
  const [colunasVisiveis, setColunasVisiveis] = useState({
    id: true,
    nome: true,
    empresa: true,
    telefone: true,
    email: true,
    status: true,
    origem: true,
    sdr: true,
    closer: true,
    data: true,
  });
  const hashInicial = window.location.hash === '#campanhas' ? 'campanhas' : 'proximos';
  const [abaAtiva, setAbaAtiva] = useState(hashInicial);
  const [modalImportar, setModalImportar] = useState(false);
  const [modalProgramar, setModalProgramar] = useState(false);
  const [modalExportar, setModalExportar] = useState(false);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const LEADS_POR_PAGINA = 100;
  const containerRef = useRef(null);

  const queryClient = useQueryClient();
  const { empresaId } = useEmpresaAtual();

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const { effectiveRole, isAdmin, isGestor, isSuperAdmin, nivel } = usePermissions();
  const isGestorOrAdmin = nivel >= 4;

  // Limpar hash após ativar aba via redirect do Softphone
  useEffect(() => {
    if (window.location.hash === '#campanhas') {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const { data: resultadoPaginado, isLoading, isFetching: isFetchingLeads } = useQuery({
    queryKey: ["leads-paginados", empresaId, paginaAtual, busca, filtroStatus, filtroOrigem, filtroSDR, filtroDataInicio, filtroDataFim, ordenacao.campo, ordenacao.direcao],
    queryFn: () => base44.functions.invoke("buscarLeadsPaginados", {
      empresaId,
      pagina: paginaAtual,
      itensPorPagina: LEADS_POR_PAGINA,
      busca: busca || "",
      status: filtroStatus !== "todos" ? filtroStatus : "",
      origem: filtroOrigem !== "todas" ? filtroOrigem : "",
      sdrEmail: filtroSDR !== "todos" ? filtroSDR : "",
      dataInicio: filtroDataInicio || "",
      dataFim: filtroDataFim || "",
      ordenacaoCampo: ordenacao.campo,
      ordenacaoDirecao: ordenacao.direcao,
      apenasDoSDR: !isGestorOrAdmin,
    }).then(r => r.data),
    enabled: !!user?.email && !!empresaId && abaAtiva === "base",
    staleTime: 60_000,
  });

  const leads = resultadoPaginado?.leads ?? [];
  const totalLeads = resultadoPaginado?.total ?? 0;
  const totalPaginas = resultadoPaginado?.totalPaginas ?? Math.max(1, Math.ceil(totalLeads / LEADS_POR_PAGINA));
  const temProxima = resultadoPaginado?.temProxima ?? false;
  const totalExato = resultadoPaginado?.totalExato ?? false;
  const contadoresPorStatusServidor = resultadoPaginado?.contadores ?? {};

  // Prefetch da próxima página em background
  useEffect(() => {
    if (!temProxima || !empresaId || !user?.email) return;
    queryClient.prefetchQuery({
      queryKey: ["leads-paginados", empresaId, paginaAtual + 1, busca, filtroStatus, filtroOrigem, filtroSDR, filtroDataInicio, filtroDataFim, ordenacao.campo, ordenacao.direcao],
      queryFn: () => base44.functions.invoke("buscarLeadsPaginados", {
        empresaId,
        pagina: paginaAtual + 1,
        itensPorPagina: LEADS_POR_PAGINA,
        busca: busca || "",
        status: filtroStatus !== "todos" ? filtroStatus : "",
        origem: filtroOrigem !== "todas" ? filtroOrigem : "",
        sdrEmail: filtroSDR !== "todos" ? filtroSDR : "",
        dataInicio: filtroDataInicio || "",
        dataFim: filtroDataFim || "",
        ordenacaoCampo: ordenacao.campo,
        ordenacaoDirecao: ordenacao.direcao,
        apenasDoSDR: !isGestorOrAdmin,
      }).then(r => r.data),
      staleTime: 60_000,
    });
  }, [paginaAtual, temProxima, empresaId, busca, filtroStatus, filtroOrigem, filtroSDR, filtroDataInicio, filtroDataFim, ordenacao.campo, ordenacao.direcao]);

  // Query separada para leads travados (aba travados) - apenas gestores/admins
  const { data: todosLeads = [] } = useQuery({
    queryKey: ["leads-todos", empresaId],
    queryFn: () => listarLeads(empresaId, { apenasDoSDR: false }),
    enabled: !!empresaId && isGestorOrAdmin,
  });

  const { data: leadScores = [] } = useQuery({
    queryKey: ["lead-scores", empresaId],
    queryFn: () => listarLeadScores(empresaId),
    enabled: !!empresaId,
  });

  const getLeadScore = (leadId) => {
    return leadScores.find(s => s.lead_id === leadId);
  };

  const { data: equipes = [] } = useQuery({
    queryKey: ["equipes", empresaId],
    queryFn: () => listarEquipes(empresaId),
    enabled: !!empresaId,
  });

  const { data: cadencias = [] } = useQuery({
    queryKey: ["cadencias", empresaId],
    queryFn: () => listarCadencias(empresaId),
    enabled: !!empresaId,
  });

  const { data: vinculos = [] } = useQuery({
    queryKey: ["vinculos", empresaId],
    queryFn: () => listarVinculos(empresaId),
    enabled: !!empresaId,
  });

  const { data: mapaNomes = new Map() } = useQuery({
    queryKey: ["mapaNomes", empresaId],
    queryFn: () => carregarMapaNomes(empresaId),
    enabled: !!empresaId,
    staleTime: 120000,
  });

  const users = vinculosParaUsuarios(vinculos, mapaNomes);

  // Aba Clientes — busca dedicada: TODAS as vendas fechadas da empresa, independente do papel do usuário
  const { data: clientesVenda = [], isLoading: loadingClientes } = useQuery({
    queryKey: ["leads-clientes", empresaId],
    queryFn: () => base44.entities.Lead.filter({ empresaId, status: "venda_sucesso" }, "-updated_date"),
    enabled: !!empresaId && abaAtiva === "clientes",
  });

  const { data: colaboradoresEmpresa = [] } = useQuery({
    queryKey: ["colaboradores-empresa", empresaId],
    queryFn: async () => {
      const res = await base44.functions.invoke("buscarColaboradoresEmpresa", { empresaId });
      return res?.data?.colaboradores || [];
    },
    enabled: !!empresaId && abaAtiva === "clientes",
    staleTime: 5 * 60_000,
  });

  const criarLeadMutation = useMutation({
    mutationFn: (data) => criarLead(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads-paginados"] });
      queryClient.invalidateQueries({ queryKey: ["leads-todos"] });
      toast.success("Lead criado com sucesso!");
    },
  });

  const atualizarLeadMutation = useMutation({
    mutationFn: ({ id, data }) => atualizarLead(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads-paginados"] });
      queryClient.invalidateQueries({ queryKey: ["leads-todos"] });
      toast.success("Lead atualizado!");
    },
  });

  const criarTarefaMutation = useMutation({
    mutationFn: (data) => criarTarefa(data),
  });

  const excluirLeadMutation = useMutation({
    mutationFn: (id) => excluirLead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads-paginados"] });
      queryClient.invalidateQueries({ queryKey: ["leads-todos"] });
      toast.success("Lead excluído!");
    },
  });

  const handleExcluirLead = (e, lead) => {
    e.stopPropagation();
    if (window.confirm(`Tem certeza que deseja excluir o lead "${lead.nome}"? Esta ação não pode ser desfeita.`)) {
      excluirLeadMutation.mutate(lead.id);
    }
  };

  const handleSalvarLead = async (dados) => {
    if (!empresaId || typeof empresaId !== 'string') {
      toast.error("Erro: Empresa não selecionada ou inválida");
      return;
    }
    if (leadEditando) {
      await atualizarLeadMutation.mutateAsync({ id: leadEditando.id, data: dados });
    } else {
      const novoLead = await criarLeadMutation.mutateAsync({
        ...dados,
        empresaId: String(empresaId).trim(),
      });
      // Registrar entrada no histórico
      if (novoLead?.id) {
        try {
          await base44.entities.Atividade.create({
            empresaId: String(empresaId).trim(),
            lead_id: novoLead.id,
            lead_nome: dados.nome,
            lead_telefone: dados.telefone,
            tipo: "anotacao",
            sdr_email: user?.email,
            resultado: "outro",
            observacao: `Lead cadastrado por ${user?.full_name || user?.email} em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.`,
          });
        } catch {}
      }
    }
  };

  const handleIniciarCadencia = async () => {
    if (!leadCadencia || !cadenciaSelecionada) return;
    const cadencia = cadencias.find((c) => c.id === cadenciaSelecionada);
    if (!cadencia) return;

    if (leadCadencia.status === "em_cadencia" && leadCadencia.cadencia_id === cadencia.id) {
      toast.info("Este lead já está nesta cadência.");
      return;
    }

    await atualizarLeadMutation.mutateAsync({
      id: leadCadencia.id,
      data: {
        status: "em_cadencia",
        cadencia_id: cadencia.id,
        dia_cadencia: 1,
        data_inicio_cadencia: format(new Date(), "yyyy-MM-dd"),
        sdr_responsavel: leadCadencia.sdr_responsavel || user?.email,
      },
    });

    const tarefasExistentes = await base44.entities.Tarefa.filter({ empresaId, lead_id: leadCadencia.id, cadencia_id: cadencia.id, status: "pendente" });
    if (tarefasExistentes.length > 0) {
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      setModalCadencia(false);
      setLeadCadencia(null);
      setCadenciaSelecionada("");
      toast.success("Cadência já iniciada para este lead!");
      return;
    }

    const hoje = new Date();
    await Promise.all(
      (cadencia.etapas || []).map(async (etapa) => {
        const dataPrevista = addDays(hoje, etapa.dia - 1);
        return criarTarefaMutation.mutateAsync({
          empresaId,
          lead_id: leadCadencia.id,
          lead_nome: leadCadencia.nome,
          lead_telefone: leadCadencia.telefone,
          lead_empresa: leadCadencia.empresa,
          sdr_email: user?.email,
          tipo: etapa.tipo,
          data_prevista: format(dataPrevista, "yyyy-MM-dd"),
          periodo: etapa.periodo,
          status: "pendente",
          dia_cadencia: etapa.dia,
          cadencia_id: cadencia.id,
          script_id: etapa.script_id,
          campanha: leadCadencia.campanha,
          equipe: leadCadencia.equipe,
        });
      })
    );

    queryClient.invalidateQueries({ queryKey: ["tarefas"] });
    setModalCadencia(false);
    setLeadCadencia(null);
    setCadenciaSelecionada("");
    toast.success("Cadência iniciada com sucesso!");
  };

  // Debounce da busca textual
  const handleBuscaChange = (valor) => {
    setBuscaInput(valor);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setBusca(valor), 400);
  };

  // Indicador visual: digitando (debounce pendente) ou buscando no servidor
  const isBuscando = (buscaInput !== busca) || (isFetchingLeads && !isLoading);

  // Resetar para página 1 quando filtros mudam
  useEffect(() => { setPaginaAtual(1); }, [busca, filtroStatus, filtroOrigem, filtroSDR, filtroDataInicio, filtroDataFim, ordenacao.campo, ordenacao.direcao]);

  // Com server-side, leads já chegam filtrados, ordenados e paginados
  const leadsPaginados = leads;

  const toggleOrdenacao = (campo) => {
    setOrdenacao((prev) => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === "asc" ? "desc" : "asc",
    }));
  };

  const irParaPagina = (novaPagina) => {
    setPaginaAtual(novaPagina);
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const ControlePaginacao = () => {
    const podeAnterior = paginaAtual > 1;
    const podeProxima = temProxima;
    if (!podeAnterior && !podeProxima) return null;
    const inicio = totalLeads === 0 ? 0 : (paginaAtual - 1) * LEADS_POR_PAGINA + 1;
    const fim = inicio + leads.length - 1;
    return (
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-slate-700 sticky bottom-0 bg-slate-800/95 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => irParaPagina(Math.max(1, paginaAtual - 1))}
            disabled={!podeAnterior}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-slate-700 text-slate-300 disabled:opacity-30 hover:bg-slate-600 transition-colors font-medium"
          >
            ← Anterior
          </button>
          <span className="text-xs text-slate-500 px-1">
            Página {paginaAtual}{totalExato ? ` / ${totalPaginas}` : ""}
          </span>
          <button
            onClick={() => irParaPagina(paginaAtual + 1)}
            disabled={!podeProxima}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-slate-700 text-slate-300 disabled:opacity-30 hover:bg-slate-600 transition-colors font-medium"
          >
            Próxima →
          </button>
        </div>
        <span className="text-xs text-slate-400">
          {inicio > 0 ? `${inicio}–${fim}` : "0"} {totalExato ? `de ${totalLeads} leads` : "leads"}
        </span>
      </div>
    );
  };

  const toggleColuna = (coluna) => {
    setColunasVisiveis((prev) => ({ ...prev, [coluna]: !prev[coluna] }));
  };

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const exportarCSV = () => {
    const headers = ["ID", "Nome", "Empresa", "Telefone", "Email", "Status", "Origem", "SDR", "Closer", "Data"];
    const rows = leads.map((lead, index) => [
      index + 1,
      lead.nome,
      lead.empresa || "",
      lead.telefone,
      lead.email || "",
      lead.status,
      lead.origem || "",
      lead.sdr_responsavel || "",
      lead.closer_responsavel || "",
      lead.created_date ? format(new Date(lead.created_date), "dd/MM/yyyy", { locale: ptBR }) : "",
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `leads_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast.success("Leads exportados com sucesso!");
  };

  // Contagem real assíncrona — roda em background sem bloquear a listagem
  const { data: contagemReal } = useQuery({
    queryKey: ["leads-contagem-real", empresaId],
    queryFn: () => base44.functions.invoke("contarLeadsEmpresa", { empresaId }).then(r => r.data?.total ?? null),
    enabled: !!empresaId && abaAtiva === "base",
    staleTime: 2 * 60_000, // revalida a cada 2 min
  });

  const contadoresPorStatus = {
    novo: contadoresPorStatusServidor.novo ?? 0,
    em_cadencia: contadoresPorStatusServidor.em_cadencia ?? 0,
    reuniao_agendada: contadoresPorStatusServidor.reuniao_agendada ?? 0,
  };

  // Leads criados hoje — via contarLeadsEmpresa com filtro de data
  const { data: leadsHojeData } = useQuery({
    queryKey: ["leads-hoje", empresaId],
    queryFn: async () => {
      const hoje = format(new Date(), "yyyy-MM-dd");
      const res = await base44.functions.invoke("contarLeadsEmpresa", { empresaId, dataInicio: hoje, dataFim: hoje });
      return res.data ?? { total: 0, origens: {}, atualizadoEm: null };
    },
    enabled: !!empresaId,
    staleTime: 2 * 60_000,
  });
  const leadsHoje = leadsHojeData?.total ?? null;
  const leadsHojeOrigens = leadsHojeData?.origens ?? {};
  const leadsHojeAtualizadoEm = leadsHojeData?.atualizadoEm ?? null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Leads</h1>
          <p className="text-slate-400 mt-1">
            {totalLeads} leads encontrados
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setModalImportar(true)}
            className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            <Upload className="w-4 h-4 mr-2" />
            Importar Lista
          </Button>
          <Button
            variant="outline"
            onClick={() => setModalProgramar(true)}
            className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Programar Distribuição
          </Button>
          <Button
            variant="outline"
            onClick={() => setModalExportar(true)}
            className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          <Button
            onClick={() => {
              setLeadEditando(null);
              setModalAberto(true);
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Lead
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isLoading ? (
          <>
            {[0,1,2].map(i => (
              <Card key={i} className="bg-slate-800/50 border-slate-700">
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-20 bg-slate-700/60 rounded" />
                    <Skeleton className="h-8 w-12 bg-slate-700/80 rounded" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded-full bg-slate-700/60" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <Card className="bg-blue-500/10 border-blue-500/30">
              <CardContent className="py-4 flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-blue-300 text-sm">Novos Hoje</p>
                  <p className="text-2xl font-bold text-white">
                    {leadsHoje ?? <span className="text-slate-500 text-base">...</span>}
                  </p>
                  {Object.keys(leadsHojeOrigens).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {Object.entries(leadsHojeOrigens).map(([origem, qtd]) => (
                        <span key={origem} className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium">
                          {origem.replaceAll("_", " ")} {qtd}
                        </span>
                      ))}
                    </div>
                  )}
                  {leadsHojeAtualizadoEm && (
                    <p className="text-[10px] text-slate-500 mt-1">
                      atualizado {format(new Date(leadsHojeAtualizadoEm), "dd/MM HH:mm", { locale: ptBR })}
                    </p>
                  )}
                </div>
                <Users className="w-8 h-8 text-blue-400 flex-shrink-0" />
              </CardContent>
            </Card>
            <Card className="bg-yellow-500/10 border-yellow-500/30">
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <p className="text-yellow-300 text-sm">Em Cadência</p>
                  <p className="text-2xl font-bold text-white">{contadoresPorStatus.em_cadencia}</p>
                </div>
                <RefreshCw className="w-8 h-8 text-yellow-400" />
              </CardContent>
            </Card>
            <Card className="bg-purple-500/10 border-purple-500/30">
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <p className="text-purple-300 text-sm">Reunião Agendada</p>
                  <p className="text-2xl font-bold text-white">{contadoresPorStatus.reuniao_agendada}</p>
                </div>
                <Users className="w-8 h-8 text-purple-400" />
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Abas */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-2">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setAbaAtiva("proximos")}
              variant={abaAtiva === "proximos" ? "default" : "ghost"}
              className={abaAtiva === "proximos" ? "bg-blue-600 hover:bg-blue-700" : "text-slate-400 hover:text-white hover:bg-slate-700"}
            >
              📅 Próximos Contatos Agendados
            </Button>
            <Button
              onClick={() => setAbaAtiva("base")}
              variant={abaAtiva === "base" ? "default" : "ghost"}
              className={abaAtiva === "base" ? "bg-blue-600 hover:bg-blue-700" : "text-slate-400 hover:text-white hover:bg-slate-700"}
            >
              📊 Base de Leads
            </Button>
            <Button
              onClick={() => setAbaAtiva("externos")}
              variant={abaAtiva === "externos" ? "default" : "ghost"}
              className={abaAtiva === "externos" ? "bg-blue-600 hover:bg-blue-700" : "text-slate-400 hover:text-white hover:bg-slate-700"}
            >
              🌐 Leads Externos
            </Button>
            <Button
              variant={abaAtiva === "campanhas" ? "default" : "ghost"}
              className={abaAtiva === "campanhas" ? "bg-blue-600 hover:bg-blue-700" : "text-slate-400 hover:text-white hover:bg-slate-700"}
              onClick={() => setAbaAtiva("campanhas")}
            >
              <Radio className="w-4 h-4 mr-1" />
              📡 Campanhas
            </Button>
            <Button
              variant={abaAtiva === "clientes" ? "default" : "ghost"}
              className={abaAtiva === "clientes" ? "bg-emerald-600 hover:bg-emerald-700" : "text-slate-400 hover:text-white hover:bg-slate-700"}
              onClick={() => setAbaAtiva("clientes")}
            >
              🏆 Clientes
            </Button>
            {isGestorOrAdmin && (
              <Button
                onClick={() => setAbaAtiva("travados")}
                variant={abaAtiva === "travados" ? "default" : "ghost"}
                className={abaAtiva === "travados" ? "bg-rose-600 hover:bg-rose-700" : "text-slate-400 hover:text-white hover:bg-slate-700"}
              >
                <Lock className="w-4 h-4 mr-1" />
                🔒 Travados
                {todosLeads.filter(l => l.is_locked_for_call).length > 0 && (
                  <span className="ml-1.5 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {todosLeads.filter(l => l.is_locked_for_call).length}
                  </span>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Conteúdo das Abas */}
      {abaAtiva === "proximos" && <ProximosContatosCard />}
      {abaAtiva === "externos" && <LeadsExternos />}
      {abaAtiva === "clientes" && (
        <ClientesCard leads={clientesVenda} colaboradores={colaboradoresEmpresa} isLoading={loadingClientes} />
      )}
      {abaAtiva === "campanhas" && (
        <Card className="bg-slate-800/50 border-slate-700">
          <SeletorCampanha />
        </Card>
      )}

      {/* Leads Travados */}
      {abaAtiva === "travados" && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-rose-400" />
              Leads travados para ligação
            </h2>
            {todosLeads.filter(l => l.is_locked_for_call).length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <Lock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Nenhum lead travado no momento.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todosLeads.filter(l => l.is_locked_for_call).map(lead => {
                  const lockMs = lead.lock_at ? Date.now() - new Date(lead.lock_at).getTime() : null;
                  const lockMin = lockMs ? Math.floor(lockMs / 60000) : null;
                  const lockSec = lockMs ? Math.floor((lockMs % 60000) / 1000) : null;
                  const tempoTravado = lockMs !== null
                    ? lockMin > 0 ? `${lockMin}min ${lockSec}s` : `${lockSec}s`
                    : "—";

                  return (
                    <div key={lead.id} className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-rose-500/5 border border-rose-500/20">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-rose-400 flex-shrink-0 animate-pulse" />
                        <div className="min-w-0">
                          <p className="text-white font-semibold text-sm truncate">{lead.nome}</p>
                          <p className="text-slate-400 text-xs">{lead.telefone}</p>
                        </div>
                      </div>
                      <div className="text-xs text-slate-400 flex-shrink-0 hidden sm:block">
                        <span className="text-slate-500">Agente: </span>
                        <span className="text-slate-300">{mapaNomes.get((lead.lock_agent_email || '').toLowerCase()) || lead.lock_agent_email?.split('@')[0] || '—'}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-amber-400 flex-shrink-0">
                        <Clock className="w-3 h-3" />
                        {tempoTravado}
                      </div>
                      <Button
                        size="sm"
                        onClick={async () => {
                          await liberarLockLead(lead.id);
                          queryClient.invalidateQueries({ queryKey: ["leads-paginados"] });
                          queryClient.invalidateQueries({ queryKey: ["leads-todos"] });
                          toast.success(`Lead "${lead.nome}" liberado`);
                        }}
                        className="bg-rose-600/80 hover:bg-rose-600 text-white text-xs px-3 flex-shrink-0"
                      >
                        Liberar
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Base de Leads */}
      {abaAtiva === "base" && (
        <>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${isBuscando ? "text-blue-400" : "text-slate-400"}`} />
                  {isBuscando && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                  )}
                  <Input
                   value={buscaInput}
                   onChange={(e) => handleBuscaChange(e.target.value)}
                   placeholder="Buscar por nome, empresa, telefone, email..."
                   className="pl-10 bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="w-44 bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="todos">Todos os status</SelectItem>
                    <SelectItem value="novo">Novo</SelectItem>
                    <SelectItem value="em_cadencia">Em Cadência</SelectItem>
                    <SelectItem value="em_contato">Em Contato</SelectItem>
                    <SelectItem value="respondeu">Respondeu</SelectItem>
                    <SelectItem value="reuniao_agendada">Reunião Agendada</SelectItem>
                    <SelectItem value="reuniao_realizada">Reunião Realizada</SelectItem>
                    <SelectItem value="qualificado">Qualificado</SelectItem>
                    <SelectItem value="proposta_enviada">Proposta Enviada</SelectItem>
                    <SelectItem value="em_negociacao">Em Negociação</SelectItem>
                    <SelectItem value="venda_sucesso">Venda Realizada ✓</SelectItem>
                    <SelectItem value="perdido">Perdido</SelectItem>
                    <SelectItem value="desqualificado">Desqualificado</SelectItem>
                    <SelectItem value="sem_interesse">Sem Interesse</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
                  <SelectTrigger className="w-40 bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Origem" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="todas">Todas origens</SelectItem>
                    <SelectItem value="trafego_pago">Tráfego Pago</SelectItem>
                    <SelectItem value="meta_ads">Meta Ads</SelectItem>
                    <SelectItem value="google_ads">Google Ads</SelectItem>
                    <SelectItem value="indicacao">Indicação</SelectItem>
                    <SelectItem value="instagram_feed">Instagram Feed</SelectItem>
                    <SelectItem value="instagram_story">Instagram Story</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="many_chat">ManyChat</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="campanha_whats">Campanha WhatsApp</SelectItem>
                    <SelectItem value="organico">Orgânico</SelectItem>
                    <SelectItem value="evento">Evento</SelectItem>
                    <SelectItem value="lista_fria">Lista Fria</SelectItem>
                    <SelectItem value="typeform">Typeform</SelectItem>
                    <SelectItem value="wordpress">WordPress</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filtroSDR} onValueChange={setFiltroSDR}>
                  <SelectTrigger className="w-44 bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="SDR" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="todos">Todos SDRs</SelectItem>
                    <SelectItem value="sem_atribuicao">Sem Atribuição</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.email}>
                        {u.full_name || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={filtroDataInicio}
                    onChange={(e) => setFiltroDataInicio(e.target.value)}
                    className="w-40 bg-slate-700 border-slate-600 text-white"
                  />
                  <span className="text-slate-400">até</span>
                  <Input
                    type="date"
                    value={filtroDataFim}
                    onChange={(e) => setFiltroDataFim(e.target.value)}
                    className="w-40 bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <Button
                    variant={visualizacao === "tabela" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setVisualizacao("tabela")}
                    className={visualizacao === "tabela" ? "bg-blue-600" : "text-slate-400"}
                  >
                    <TableIcon className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={visualizacao === "cards" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setVisualizacao("cards")}
                    className={visualizacao === "cards" ? "bg-blue-600" : "text-slate-400"}
                  >
                    <Grid className="w-4 h-4" />
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-slate-400">
                        <Columns className="w-4 h-4 mr-2" />
                        Colunas
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-slate-800 border-slate-700">
                      {Object.keys(colunasVisiveis).map((col) => (
                        <DropdownMenuCheckboxItem
                          key={col}
                          checked={colunasVisiveis[col]}
                          onCheckedChange={() => toggleColuna(col)}
                        >
                          {col.charAt(0).toUpperCase() + col.slice(1)}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>

          {(isLoading || isBuscando) ? (
            <Card className="bg-slate-800/50 border-slate-700">
              {isBuscando && !isLoading && (
                <div className="px-4 py-2.5 border-b border-slate-700/60 flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                  <span className="text-xs text-blue-400 font-medium">Buscando "{buscaInput}"...</span>
                </div>
              )}
              {visualizacao === "tabela" ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        {[80, 160, 120, 110, 150, 100, 90, 110, 110, 80].map((w, i) => (
                          <th key={i} className="px-4 py-3 text-left">
                            <Skeleton className="h-3 bg-slate-700/80 rounded" style={{ width: w }} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i} className="border-b border-slate-800/60">
                          {[40, 140, 100, 90, 130, 80, 70, 90, 90, 60].map((w, j) => (
                            <td key={j} className="px-4 py-3">
                              <Skeleton className="h-4 bg-slate-700/60 rounded" style={{ width: w }} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-slate-700/60 p-4 space-y-2">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full bg-slate-700/60" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-4 w-40 bg-slate-700/60 rounded" />
                          <Skeleton className="h-3 w-24 bg-slate-700/40 rounded" />
                        </div>
                        <Skeleton className="h-5 w-20 bg-slate-700/40 rounded-full" />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Skeleton className="h-3 w-28 bg-slate-700/40 rounded" />
                        <Skeleton className="h-3 w-20 bg-slate-700/40 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ) : totalLeads === 0 ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Nenhum lead encontrado</h3>
                <p className="text-slate-400">Tente ajustar os filtros ou adicione um novo lead.</p>
              </CardContent>
            </Card>
          ) : visualizacao === "tabela" ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <div ref={containerRef} className="overflow-auto" style={{ maxHeight: "calc(100vh - 340px)" }}>
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700 hover:bg-slate-700/50">
                      {colunasVisiveis.id && <TableHead className="text-slate-300">ID</TableHead>}
                      {colunasVisiveis.nome && (
                        <TableHead className="text-slate-300 cursor-pointer hover:text-white" onClick={() => toggleOrdenacao("nome")}>
                          <div className="flex items-center gap-2">
                            Nome / Score
                            {ordenacao.campo === "nome" && (ordenacao.direcao === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}
                          </div>
                        </TableHead>
                      )}
                      {colunasVisiveis.empresa && (
                        <TableHead className="text-slate-300 cursor-pointer hover:text-white" onClick={() => toggleOrdenacao("empresa")}>
                          <div className="flex items-center gap-2">
                            Empresa
                            {ordenacao.campo === "empresa" && (ordenacao.direcao === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}
                          </div>
                        </TableHead>
                      )}
                      {colunasVisiveis.telefone && <TableHead className="text-slate-300">Telefone</TableHead>}
                      {colunasVisiveis.email && <TableHead className="text-slate-300">Email</TableHead>}
                      {colunasVisiveis.status && (
                        <TableHead className="text-slate-300 cursor-pointer hover:text-white" onClick={() => toggleOrdenacao("status")}>
                          <div className="flex items-center gap-2">
                            Status
                            {ordenacao.campo === "status" && (ordenacao.direcao === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}
                          </div>
                        </TableHead>
                      )}
                      {colunasVisiveis.origem && <TableHead className="text-slate-300">Origem</TableHead>}
                      {colunasVisiveis.sdr && <TableHead className="text-slate-300">SDR</TableHead>}
                      {colunasVisiveis.closer && <TableHead className="text-slate-300">Closer</TableHead>}
                      {colunasVisiveis.data && (
                        <TableHead className="text-slate-300 cursor-pointer hover:text-white" onClick={() => toggleOrdenacao("created_date")}>
                          <div className="flex items-center gap-2">
                            Data
                            {ordenacao.campo === "created_date" && (ordenacao.direcao === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}
                          </div>
                        </TableHead>
                      )}
                      <TableHead className="text-slate-300 w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leadsPaginados.map((lead) => (
                      <TableRow
                        key={lead.id}
                        className="border-slate-700 hover:bg-slate-700/30 cursor-pointer"
                        onClick={() => { setLeadEditando(lead); setModalAberto(true); }}
                        style={
                          lead.campos_personalizados?.importado_em &&
                          (Date.now() - new Date(lead.campos_personalizados.importado_em).getTime()) < 24 * 60 * 60 * 1000
                            ? { outline: "1.5px solid rgba(239,68,68,0.7)", outlineOffset: "-1px", background: "rgba(239,68,68,0.04)" }
                            : undefined
                        }
                      >
                        {colunasVisiveis.id && (
                          <TableCell className="text-slate-300 font-semibold">#{(paginaAtual - 1) * LEADS_POR_PAGINA + leadsPaginados.indexOf(lead) + 1}</TableCell>
                        )}
                        {colunasVisiveis.nome && (
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-medium">{lead.nome}</span>
                              {(() => {
                                const score = getLeadScore(lead.id);
                                return score ? <LeadScoreBadge score={score.score_total} temperatura={score.temperatura} size="sm" showLabel={false} /> : null;
                              })()}
                            </div>
                          </TableCell>
                        )}
                        {colunasVisiveis.empresa && <TableCell className="text-slate-300">{lead.empresa || "-"}</TableCell>}
                        {colunasVisiveis.telefone && <TableCell className="text-slate-300">{formatarTelefone(lead.telefone)}</TableCell>}
                        {colunasVisiveis.email && <TableCell className="text-slate-300">{lead.email || "-"}</TableCell>}
                        {colunasVisiveis.status && (
                          <TableCell>
                            <Badge className={
                              lead.status === "novo" ? "bg-blue-500/20 text-blue-400"
                              : lead.status === "em_cadencia" ? "bg-yellow-500/20 text-yellow-400"
                              : lead.status === "reuniao_agendada" ? "bg-purple-500/20 text-purple-400"
                              : "bg-slate-600 text-slate-300"
                            }>
                              {lead.status?.replaceAll("_", " ")}
                            </Badge>
                          </TableCell>
                        )}
                        {colunasVisiveis.origem && <TableCell className="text-slate-300 capitalize">{lead.origem?.replaceAll("_", " ") || "-"}</TableCell>}
                        {colunasVisiveis.sdr && (
                          <TableCell>
                            {lead.sdr_responsavel ? (
                              <div className="flex items-center gap-2">
                                <Avatar className="w-7 h-7">
                                  <AvatarFallback className="bg-blue-600 text-white text-xs font-semibold">
                                    {getInitials(users.find((u) => u.email === lead.sdr_responsavel)?.full_name || lead.sdr_responsavel)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-slate-300 text-sm">
                                  {users.find((u) => u.email === lead.sdr_responsavel)?.full_name || mapaNomes.get((lead.sdr_responsavel || '').toLowerCase()) || lead.sdr_responsavel?.split("@")[0]}
                                </span>
                              </div>
                            ) : <span className="text-slate-500 text-sm">-</span>}
                          </TableCell>
                        )}
                        {colunasVisiveis.closer && (
                          <TableCell>
                            {lead.closer_responsavel ? (
                              <div className="flex items-center gap-2">
                                <Avatar className="w-7 h-7">
                                  <AvatarFallback className="bg-purple-600 text-white text-xs font-semibold">
                                    {getInitials(users.find((u) => u.email === lead.closer_responsavel)?.full_name || lead.closer_responsavel)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-slate-300 text-sm">
                                  {users.find((u) => u.email === lead.closer_responsavel)?.full_name || mapaNomes.get((lead.closer_responsavel || '').toLowerCase()) || lead.closer_responsavel?.split("@")[0]}
                                </span>
                              </div>
                            ) : <span className="text-slate-500 text-sm">-</span>}
                          </TableCell>
                        )}
                        {colunasVisiveis.data && (
                          <TableCell className="text-slate-300 text-sm">
                            {lead.created_date ? format(new Date(lead.created_date), "dd/MM/yyyy", { locale: ptBR }) : "-"}
                          </TableCell>
                        )}
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-slate-800 border-slate-700">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setLeadEditando(lead); setModalAberto(true); }}>
                                Editar
                              </DropdownMenuItem>
                              {lead.status === "novo" && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setLeadCadencia(lead); setModalCadencia(true); }}>
                                  Iniciar Cadência
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/55${lead.telefone?.replace(/\D/g, "")}`, "_blank"); }}
                                className="text-emerald-400"
                              >
                                Abrir WhatsApp
                              </DropdownMenuItem>
                              {lead.instagram && (
                                <DropdownMenuItem
                                  onClick={(e) => { e.stopPropagation(); window.open(`https://instagram.com/${lead.instagram.replace('@', '')}`, "_blank"); }}
                                  className="text-pink-400"
                                >
                                  <Instagram className="w-4 h-4 mr-2" />
                                  Abrir Instagram
                                </DropdownMenuItem>
                              )}
                              {isAdmin && (
                                <>
                                  <DropdownMenuSeparator className="bg-slate-700" />
                                  <DropdownMenuItem
                                    onClick={(e) => handleExcluirLead(e, lead)}
                                    className="text-rose-400 focus:text-rose-300 focus:bg-rose-500/10"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Excluir Lead
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ControlePaginacao />
            </Card>
          ) : (
            <Card className="bg-slate-800/50 border-slate-700">
              <div ref={containerRef} className="overflow-y-auto p-3 space-y-3" style={{ maxHeight: "calc(100vh - 340px)" }}>
                <AnimatePresence>
                  {leadsPaginados.map((lead) => (
                    <motion.div key={lead.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                      <LeadCard
                        lead={lead}
                        leadScore={getLeadScore(lead.id)}
                        onEdit={(l) => { setLeadEditando(l); setModalAberto(true); }}
                        onIniciarCadencia={(l) => { setLeadCadencia(l); setModalCadencia(true); }}
                        onAgendarReuniao={(l) => { setLeadEditando(l); setModalAberto(true); }}
                        onExcluir={isAdmin ? (l) => handleExcluirLead({ stopPropagation: () => {} }, l) : null}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              <ControlePaginacao />
            </Card>
          )}
        </>
      )}

      {/* Modais */}
      <LeadModal
        open={modalAberto}
        onClose={() => { setModalAberto(false); setLeadEditando(null); }}
        lead={leadEditando}
        onSave={handleSalvarLead}
        equipes={equipes}
        cadencias={cadencias}
      />

      <ImportarListaModal open={modalImportar} onClose={() => setModalImportar(false)} />
      <ProgramarDistribuicaoModal open={modalProgramar} onClose={() => setModalProgramar(false)} />
      <ExportarLeadsModal open={modalExportar} onClose={() => setModalExportar(false)} empresaId={empresaId} users={users} />

      {/* Badge flutuante — contagem real da base */}
      {abaAtiva === "base" && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/90 border border-slate-600/60 backdrop-blur-md shadow-xl">
            {contagemReal == null
              ? <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              : <span className="w-2 h-2 rounded-full bg-blue-400" />
            }
            <span className="text-xs font-semibold text-slate-300">
              {contagemReal != null
                ? <><span className="text-white font-bold">{contagemReal.toLocaleString("pt-BR")}</span> leads na base</>
                : <span className="text-slate-400">contando leads...</span>
              }
            </span>
          </div>
        </div>
      )}

      {modalCadencia && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="bg-slate-900 border-slate-700 max-w-md w-full">
            <CardContent className="p-6 space-y-4">
              <h2 className="text-xl font-bold text-white">Iniciar Cadência</h2>
              <p className="text-slate-400">
                Selecione uma cadência para o lead: <strong className="text-white">{leadCadencia?.nome}</strong>
              </p>
              <Select value={cadenciaSelecionada} onValueChange={setCadenciaSelecionada}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Selecione uma cadência" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {cadencias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome} ({c.duracao_dias} dias)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="ghost" onClick={() => { setModalCadencia(false); setLeadCadencia(null); }} className="text-slate-400">
                  Cancelar
                </Button>
                <Button onClick={handleIniciarCadencia} disabled={!cadenciaSelecionada} className="bg-blue-600 hover:bg-blue-700">
                  Iniciar Cadência
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}