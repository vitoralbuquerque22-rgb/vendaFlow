import { useState, useEffect } from "react";
import { api } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/components/hooks/usePermissions";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import {
  Zap, Eye, Phone, Clock, AlertCircle,
  CheckCircle2, Loader2, BarChart2, RefreshCw,
  PhoneCall, Lock, Calendar, Megaphone, Plus, ChevronRight,
  ChevronDown, Upload, List, PenLine, CheckCircle, X, AlertTriangle, ShieldAlert, Trash2, Database, BarChart3 } from
"lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export default function PowerDialerControle() {
  const { isAdmin, isGestor, nivel } = usePermissions();
  const { empresaId } = useEmpresaAtual();
  const queryClient = useQueryClient();

  const [quantidade, setQuantidade] = useState(1);
  const [sdrFiltro, setSdrFiltro] = useState("todos");
  const [campanhaFiltro, setCampanhaFiltro] = useState("");
  const [previewData, setPreviewData] = useState(null);
  const [carregandoPreview, setCarregandoPreview] = useState(false);
  const [discando, setDiscando] = useState(false);
  const [resultados, setResultados] = useState([]);

  // ── Estados Sheet / Campanhas 3C Plus ──
  const [sheetCriacaoAberto, setSheetCriacaoAberto] = useState(false);
  const [abaCampanhaAtiva, setAbaCampanhaAtiva] = useState("criar");
  const [campanhas3CPlus, setCampanhas3CPlus] = useState([]);
  const [carregandoCampanhas3C, setCarregandoCampanhas3C] = useState(false);
  const [campanhaEditando, setCampanhaEditando]     = useState(null);
  const [campanhaDeleteConfirm, setCampanhaDeleteConfirm] = useState(null);
  const [metricasCampanhas3C, setMetricasCampanhas3C] = useState({});
  const [expandida3C, setExpandida3C]               = useState(null);
  const [carregandoMetrica3C, setCarregandoMetrica3C] = useState({});
  const [acaoProcessando, setAcaoProcessando]       = useState({});
  const [acaoSucesso, setAcaoSucesso] = useState({});
  const [dadosAgentesCampanha, setDadosAgentesCampanha] = useState({});
  const [abaCampanhas, setAbaCampanhas] = useState(false);
  const [wizardPasso, setWizardPasso] = useState(1);
  const [campanhaNome, setCampanhaNome] = useState("");
  const [campanhaDescricao, setCampanhaDescricao] = useState("");
  const [campanhaStartTime, setCampanhaStartTime] = useState("08:00");
  const [campanhaEndTime, setCampanhaEndTime] = useState("18:30");
  const [campanhaQualList, setCampanhaQualList] = useState("");
  const [campanhaTeams, setCampanhaTeams] = useState([]);
  const [campanhaCallTime, setCampanhaCallTime] = useState(30);
  const [campanhaWaitTime, setCampanhaWaitTime] = useState(3);
  const [campanhaRecalls, setCampanhaRecalls] = useState(3);
  const [campanhaLeads, setCampanhaLeads] = useState([]);
  const [campanhaFonte, setCampanhaFonte] = useState("manual");
  const [campanhaTextoManual, setCampanhaTextoManual] = useState("");
  const [leadsDisponiveis, setLeadsDisponiveis] = useState([]);
  const [carregandoLeadsCRM, setCarregandoLeadsCRM] = useState(false);
  const [filtroStatusLead, setFiltroStatusLead] = useState("");
  const [leadsSelecionados, setLeadsSelecionados] = useState([]);
  const [dadosCampanha3C, setDadosCampanha3C] = useState(null);
  const [carregandoDados3C, setCarregandoDados3C] = useState(false);
  const [criandoCampanha, setCriandoCampanha] = useState(false);
  const [campanhasCriadas, setCampanhasCriadas] = useState([]);
  const [carregandoCampanhas, setCarregandoCampanhas] = useState(false);
  const [metricasPorCampanha, setMetricasPorCampanha] = useState({});
  const [campanhaExpandida, setCampanhaExpandida] = useState(null);
  const [carregandoMetricas, setCarregandoMetricas] = useState({});

  // Travar scroll quando modal de exclusão está aberto
  useEffect(() => {
    if (campanhaDeleteConfirm) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [campanhaDeleteConfirm]);

  // Forçar foco no input após abertura do modal
  useEffect(() => {
    if (campanhaDeleteConfirm) {
      const timer = setTimeout(() => {
        const input = document.querySelector('input[placeholder="EXCLUIR"]');
        if (input) input.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [campanhaDeleteConfirm]);

  // Buscar usuários da empresa para filtro SDR
  const { data: vinculos = [] } = useQuery({
    queryKey: ["vinculos-dialer", empresaId],
    queryFn: () => empresaId ? api.entities.VinculoEmpresa.filter({ empresaId, status: "ativo" }) : [],
    enabled: !!empresaId
  });

  const handlePreview = async () => {
    if (!empresaId) return;
    setCarregandoPreview(true);
    setPreviewData(null);
    try {
      const res = await api.functions.invoke("powerDialer3CPlus", {
        empresaId,
        modo: "preview",
        quantidade,
        sdr_email: sdrFiltro !== "todos" ? sdrFiltro : undefined,
        campanha: campanhaFiltro || undefined
      });
      setPreviewData(res);
    } catch (e) {
      toast.error("Erro ao carregar preview", { description: e.message });
    } finally {
      setCarregandoPreview(false);
    }
  };

  const handleExecutar = async () => {
    if (!empresaId) return;
    setDiscando(true);
    setResultados([]);
    try {
      const res = await api.functions.invoke("powerDialer3CPlus", {
        empresaId,
        modo: "executar",
        quantidade,
        sdr_email: sdrFiltro !== "todos" ? sdrFiltro : undefined,
        campanha: campanhaFiltro || undefined
      });

      setResultados(res.resultados || []);

      if (res.discados > 0) {
        toast.success(`${res.discados} ligação(ões) iniciada(s)`, {
          description: res.com_erro > 0 ? `${res.com_erro} com erro` : "Todas com sucesso"
        });
      } else {
        toast.info("Nenhuma ligação iniciada", {
          description: res.mensagem || "Nenhum lead elegível no momento"
        });
      }

      setPreviewData(null);
    } catch (e) {
      toast.error("Erro ao executar discagem", { description: e.message });
    } finally {
      setDiscando(false);
    }
  };

  // ── Funções Campanhas 3C Plus ──
  const carregarDados3C = async (forceEmpresaId) => {
    const eid = forceEmpresaId || empresaId;
    if (!eid || dadosCampanha3C) return;
    setCarregandoDados3C(true);
    try {
      const res = await api.functions.invoke("buscarDadosCampanha3CPlus", { empresaId: eid });
      // A função retorna { equipes, qualificacoes, intervalos, agentes } direto no data
      setDadosCampanha3C(res.data || res);
    } catch (e) {
      toast.error("Erro ao carregar dados do 3C Plus", { description: e.message });
    } finally {
      setCarregandoDados3C(false);
    }
  };

  const carregarCampanhasCriadas = async () => {
    if (!empresaId) return;
    setCarregandoCampanhas(true);
    try {
      const res = await api.entities.CampanhaVendaFlow.filter({ empresaId });
      // Sincronizar status real do 3C Plus para cada campanha
      const campanhasComStatus = await Promise.all((res || []).map(async (c) => {
        if (!c.campanha_id_3cplus) return c;
        try {
          const det = await api.functions.invoke("gerenciarCampanha3CPlus", {
            empresaId, campanha_id_3cplus: c.campanha_id_3cplus, acao: 'detalhes'
          });
          const camp3c = det?.data?.data || det?.data || {};
          const ativa3c = camp3c.is_active ?? camp3c.active;
          const statusReal = ativa3c === true ? 'ativa' : ativa3c === false ? 'pausada' : c.status;
          if (statusReal !== c.status) {
            api.entities.CampanhaVendaFlow.update(c.id, { status: statusReal }).catch(() => {});
          }
          return { ...c, status: statusReal, _dados3c: camp3c };
        } catch {
          return c;
        }
      }));
      setCampanhasCriadas(campanhasComStatus);
    } catch (e) {
      console.warn("Erro ao carregar campanhas:", e.message);
    } finally {
      setCarregandoCampanhas(false);
    }
  };

  const buscarMetricasCampanha = async (campanha) => {
    if (!campanha.campanha_id_3cplus) return;
    setCarregandoMetricas((prev) => ({ ...prev, [campanha.id]: true }));
    try {
      const res = await api.functions.invoke("buscarMetricasCampanha3CPlus", {
        empresaId,
        campanha_id_3cplus: campanha.campanha_id_3cplus,
        lista_id_3cplus: campanha.lista_id_3cplus
      });
      setMetricasPorCampanha((prev) => ({ ...prev, [campanha.id]: res.data?.resumo || res.resumo || {} }));
    } catch (e) {
      console.warn("[buscarMetricasCampanha] erro:", e.message);
    } finally {
      setCarregandoMetricas((prev) => ({ ...prev, [campanha.id]: false }));
    }
  };

  const toggleCampanhaExpandida = (campanha) => {
    if (campanhaExpandida === campanha.id) {
      setCampanhaExpandida(null);
    } else {
      setCampanhaExpandida(campanha.id);
      if (!metricasPorCampanha[campanha.id]) {
        buscarMetricasCampanha(campanha);
      }
    }
  };

  const parsearLeadsManual = (texto) => {
    return texto.split("\n").
    map((l) => l.trim()).
    filter((l) => l.length >= 8).
    map((l) => ({ phone: l.replace(/\D/g, ""), identifier: l.replace(/\D/g, "") })).
    filter((l) => l.phone.length >= 8);
  };

  const buscarLeadsCRM = async () => {
    if (!empresaId) return;
    setCarregandoLeadsCRM(true);
    try {
      const filtro = { empresaId };
      if (filtroStatusLead) filtro.status = filtroStatusLead;
      const leads = await api.entities.Lead.filter(filtro);
      const comTelefone = (leads || []).filter((l) => l.telefone && String(l.telefone).replace(/\D/g, '').length >= 8);
      setLeadsDisponiveis(comTelefone);
      setLeadsSelecionados([]);
    } catch (e) {
      toast.error("Erro ao buscar leads", { description: e.message });
    } finally {
      setCarregandoLeadsCRM(false);
    }
  };

  const toggleLeadSelecionado = (lead) => {
    setLeadsSelecionados((prev) =>
    prev.find((l) => l.id === lead.id) ?
    prev.filter((l) => l.id !== lead.id) :
    [...prev, lead]
    );
  };

  const toggleTodosLeads = () => {
    setLeadsSelecionados(
      leadsSelecionados.length === leadsDisponiveis.length ? [] : [...leadsDisponiveis]
    );
  };

  const buscarCampanhas3CPlus = async (forceEmpresaId) => {
    const eid = forceEmpresaId || empresaId;
    if (!eid) return;
    setCarregandoCampanhas3C(true);
    try {
      const res = await api.functions.invoke("listarCampanhas3CPlus", { empresaId: eid });
      const lista = res?.data?.campanhas || res?.campanhas || [];
      setCampanhas3CPlus(lista);
    } catch (e) {
      console.warn("[buscarCampanhas3CPlus] erro:", e.message);
    } finally {
      setCarregandoCampanhas3C(false);
    }
  };

  const buscarMetrica3C = async (campanha) => {
    if (!campanha.id_3cplus) return;
    setCarregandoMetrica3C(prev => ({ ...prev, [campanha.id_3cplus]: true }));
    try {
      const res = await api.functions.invoke("buscarMetricasCampanha3CPlus", {
        empresaId,
        campanha_id_3cplus: campanha.id_3cplus,
      });
      setMetricasCampanhas3C(prev => ({ ...prev, [campanha.id_3cplus]: res?.resumo || res?.data?.resumo || {} }));
    } catch (e) {
      console.warn("[buscarMetrica3C] erro:", e.message);
    } finally {
      setCarregandoMetrica3C(prev => ({ ...prev, [campanha.id_3cplus]: false }));
    }
  };

  const buscarAgentes3C = async (campanhaId) => {
    try {
      const res = await api.functions.invoke("gerenciarCampanha3CPlus", {
        empresaId,
        campanha_id_3cplus: campanhaId,
        acao: 'agentes',
      });
      const agentes = res?.data?.data || res?.data || [];
      setDadosAgentesCampanha(prev => ({ ...prev, [campanhaId]: agentes }));
    } catch (e) {
      console.warn("[buscarAgentes3C] erro:", e.message);
    }
  };

  const toggleExpandida3C = (campanha) => {
    if (expandida3C === campanha.id_3cplus) {
      setExpandida3C(null);
    } else {
      setExpandida3C(campanha.id_3cplus);
      if (!metricasCampanhas3C[campanha.id_3cplus]) buscarMetrica3C(campanha);
      if (!dadosAgentesCampanha[campanha.id_3cplus]) buscarAgentes3C(campanha.id_3cplus);
    }
  };

  const executarAcao3C = async (campanha, acao, dados = null) => {
    setAcaoProcessando(prev => ({ ...prev, [`${campanha.id_3cplus}_${acao}`]: true }));
    try {
      // Se ação for editar e houver agentes para sincronizar, faz em paralelo
      const [res] = await Promise.all([
        api.functions.invoke("gerenciarCampanha3CPlus", {
          empresaId,
          campanha_id_3cplus: campanha.id_3cplus,
          acao,
          ...(dados ? { dados } : {}),
        }),
        // Sincronizar agentes se vier no payload de editar
        (acao === 'editar' && campanha._edit_agentes !== undefined)
          ? api.functions.invoke("gerenciarCampanha3CPlus", {
              empresaId,
              campanha_id_3cplus: campanha.id_3cplus,
              acao: 'sincronizar_agentes',
              dados: { agentes_ids: (campanha._edit_agentes || []).map(Number) },
            }).catch(e => console.warn('[sincronizar_agentes]', e.message))
          : Promise.resolve(null),
      ]);
      if (res?.success || res?.data?.success) {
        setAcaoSucesso(prev => ({ ...prev, [`${campanha.id_3cplus}_${acao}`]: true }));
        setTimeout(() => setAcaoSucesso(prev => ({ ...prev, [`${campanha.id_3cplus}_${acao}`]: false })), 2500);
        toast.success(
          acao === 'pause'  ? `Campanha "${campanha.nome}" pausada` :
          acao === 'resume' ? `Campanha "${campanha.nome}" retomada` :
          acao === 'delete' ? `Campanha "${campanha.nome}" excluída` :
          acao === 'editar' ? `Campanha "${campanha.nome}" atualizada` :
          'Ação realizada com sucesso'
        );
        await buscarCampanhas3CPlus();
        carregarCampanhasCriadas();
        setCampanhaDeleteConfirm(null);
        setCampanhaEditando(null);
        setExpandida3C(null);
        setCampanhaExpandida(null);
      } else {
        toast.error('Erro ao executar ação', { description: res?.detalhe || res?.error || 'Erro desconhecido' });
      }
    } catch (e) {
      toast.error('Erro ao executar ação', { description: e.message });
    } finally {
      setAcaoProcessando(prev => ({ ...prev, [`${campanha.id_3cplus}_${acao}`]: false }));
    }
  };

  const handleAbrirCampanhas = () => {
    setAbaCampanhas((v) => !v);
    if (!abaCampanhas) {
      carregarDados3C(empresaId);
      carregarCampanhasCriadas();
    }
  };

  const handleCriarCampanha = async () => {
    if (!empresaId) return;
    const leadsFinais = campanhaFonte === "manual" ?
    parsearLeadsManual(campanhaTextoManual) :
    campanhaFonte === "leads_crm" ?
    leadsSelecionados.map((l) => ({ identifier: l.nome || l.telefone, phone: l.telefone })) :
    campanhaLeads;

    if (leadsFinais.length === 0) {
      toast.error("Adicione ao menos um número válido");
      return;
    }
    if (!campanhaNome || !campanhaQualList) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setCriandoCampanha(true);
    try {
      const res = await api.functions.invoke("criarCampanha3CPlus", {
        empresaId,
        nome: campanhaNome,
        descricao: campanhaDescricao,
        start_time: campanhaStartTime,
        end_time: campanhaEndTime,
        qualification_list: Number(campanhaQualList),
        teams: campanhaTeams.map(Number),
        allows_manual: true,
        is_predictive: false,
        call_time: campanhaCallTime,
        wait_time: campanhaWaitTime,
        recalls: campanhaRecalls,
        fonte: campanhaFonte,
        leads: leadsFinais
      });

      if (res.data?.success) {
        toast.success(`Campanha "${campanhaNome}" criada!`, {
          description: `${res.data.total_leads} leads enviados para o 3C Plus.`
        });
        // Reset wizard
        setWizardPasso(1);
        setCampanhaNome("");
        setCampanhaDescricao("");
        setCampanhaTextoManual("");
        setCampanhaLeads([]);
        setCampanhaTeams([]);
        setCampanhaQualList("");
        carregarCampanhasCriadas();
      } else {
        toast.error("Erro ao criar campanha", { description: res.data?.detalhe || res.data?.error });
      }
    } catch (e) {
      toast.error("Erro ao criar campanha", { description: e.message });
    } finally {
      setCriandoCampanha(false);
    }
  };

  const motivosBloqueio = previewData?.motivos_bloqueio;

  if (nivel < 5) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
        Acesso restrito a administradores e gestores.
      </div>);

  }

  return (
    <div className="p-6 space-y-6" inert={!!campanhaDeleteConfirm || !!campanhaEditando}>
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-0.5">
        <div className="w-1 h-6 bg-gradient-to-b from-sky-400 to-violet-500 rounded-full" />
        <h1 className="text-2xl font-bold text-white">Power Dialer</h1>
      </div>

      {/* ── Config card ────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-5 space-y-5">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Configuração da discagem</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Quantidade */}
          <div className="space-y-2">
            <label className="text-xs text-slate-400 font-medium">Leads por execução</label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 5, 10].map((n) =>
              <button
                key={n}
                onClick={() => setQuantidade(n)}
                className={cn(
                  "w-9 h-9 rounded-xl text-sm font-semibold border transition-all duration-200",
                  quantidade === n ?
                  "bg-gradient-to-br from-sky-500 to-violet-500 text-white border-transparent shadow-md shadow-sky-500/20" :
                  "border-slate-700/50 bg-slate-800/60 text-slate-400 hover:text-white hover:border-slate-600"
                )}>
                
                  {n}
                </button>
              )}
            </div>
          </div>

          {/* Filtro SDR */}
          <div className="space-y-2">
            <label className="text-xs text-slate-400 font-medium">SDR responsável</label>
            <select
              value={sdrFiltro}
              onChange={(e) => setSdrFiltro(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#1a1f2e] border border-white/10 text-sm text-slate-200 focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/20 cursor-pointer [&>option]:bg-[#1a1f2e] [&>option]:text-slate-200 [&>option:checked]:bg-orange-500 [&>option:checked]:text-white">
              
              <option value="todos">Todos os SDRs</option>
              {vinculos.map((v) =>
              <option key={v.id} value={v.userEmail}>{v.userName || v.userEmail}</option>
              )}
            </select>
          </div>

          {/* Filtro campanha */}
          <div className="space-y-2">
            <label className="text-xs text-slate-400 font-medium">Campanha (opcional)</label>
            <input
              value={campanhaFiltro}
              onChange={(e) => setCampanhaFiltro(e.target.value)}
              placeholder="Nome da campanha..."
              className="w-full px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/50 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20" />
            
          </div>
        </div>

        {/* Regras de elegibilidade */}
        <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/30 space-y-1">
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">Leads elegíveis são aqueles que:</p>
          {[
          "Não estão em ligação ativa",
          "Não têm cadência ativa em andamento",
          "Foram contatados há mais de 30 minutos",
          "Não estão com status: desqualificado, sem interesse, reunião agendada"].
          map((r, i) =>
          <div key={i} className="flex items-center gap-2 text-[10px] text-slate-500">
              <CheckCircle2 className="w-3 h-3 text-emerald-500/60 flex-shrink-0" />
              {r}
            </div>
          )}
        </div>

        {/* Botões */}
        <div className="flex items-center gap-3">
          <button
            onClick={handlePreview}
            disabled={carregandoPreview || discando}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200",
              "border-slate-600 bg-slate-800/60 text-slate-300 hover:text-white hover:border-slate-500",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}>
            
            {carregandoPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            Preview
          </button>

          <button
            onClick={handleExecutar}
            disabled={discando || carregandoPreview}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200",
              "bg-gradient-to-r from-sky-500 to-violet-500 hover:from-sky-400 hover:to-violet-400",
              "text-white shadow-lg shadow-sky-500/25 hover:shadow-sky-500/35 active:scale-[0.98]",
              "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            )}>
            
            {discando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {discando ? "Discando..." : `Discar ${quantidade} lead${quantidade > 1 ? "s" : ""}`}
          </button>
        </div>
      </div>

      {/* ── Preview ────────────────────────────────────── */}
      <AnimatePresence>
        {previewData &&
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="rounded-2xl border border-slate-800/60 bg-slate-900/60 overflow-hidden">
          
            <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-sky-400" />
                <span className="text-sm font-semibold text-white">Preview — {previewData.total_elegiveis} leads elegíveis</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="text-slate-500">{previewData.total_bloqueados} bloqueados</span>
              </div>
            </div>

            {/* Leads que seriam discados */}
            {previewData.leads_que_seriam_discados?.length > 0 &&
          <div className="p-4 space-y-2">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-3">Serão discados</p>
                {previewData.leads_que_seriam_discados.map((lead) =>
            <div key={lead.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-800/40 border border-slate-700/30">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                        <Phone className="w-3.5 h-3.5 text-sky-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{lead.nome}</p>
                        <p className="text-[10px] text-slate-500">{lead.telefone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-600">
                      <PhoneCall className="w-3 h-3" />
                      {lead.total_ligacoes || 0} ligações
                    </div>
                  </div>
            )}
              </div>
          }

            {/* Motivos de bloqueio */}
            {motivosBloqueio &&
          <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
            { label: "Status bloqueado", value: motivosBloqueio.status_bloqueado, icon: Lock, color: "text-rose-400" },
            { label: "Em cadência", value: motivosBloqueio.em_cadencia, icon: Calendar, color: "text-amber-400" },
            { label: "Lig. recente", value: motivosBloqueio.ligacao_recente, icon: Clock, color: "text-sky-400" },
            { label: "Com lock", value: motivosBloqueio.com_lock, icon: Lock, color: "text-violet-400" }].
            filter((m) => m.value > 0).map(({ label, value, icon: Icon, color }) =>
            <div key={label} className="px-3 py-2 rounded-xl bg-slate-800/40 border border-slate-700/30 flex items-center gap-2">
                    <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", color)} />
                    <div>
                      <p className="text-xs font-semibold text-white">{value}</p>
                      <p className="text-[10px] text-slate-500">{label}</p>
                    </div>
                  </div>
            )}
              </div>
          }
          </motion.div>
        }
      </AnimatePresence>

      {/* ── Resultados da discagem ─────────────────────── */}
      <AnimatePresence>
        {resultados.length > 0 &&
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-800/60 bg-slate-900/60 overflow-hidden">
          
            <div className="px-5 py-4 border-b border-slate-800/60">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-sky-400" />
                <span className="text-sm font-semibold text-white">Resultado da discagem</span>
              </div>
            </div>
            <div className="p-4 space-y-2">
              {resultados.map((r, i) =>
            <div key={i} className={cn(
              "flex items-center justify-between px-3 py-2.5 rounded-xl border",
              r.sucesso ?
              "bg-emerald-500/5 border-emerald-500/20" :
              "bg-rose-500/5 border-rose-500/20"
            )}>
                  <div className="flex items-center gap-3">
                    {r.sucesso ?
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> :
                <AlertCircle className="w-4 h-4 text-rose-400" />
                }
                    <div>
                      <p className="text-sm font-medium text-white">{r.lead_nome}</p>
                      <p className="text-[10px] text-slate-500">{r.lead_telefone}</p>
                    </div>
                  </div>
                  <span className={cn("text-[10px] font-medium", r.sucesso ? "text-emerald-400" : "text-rose-400")}>
                    {r.sucesso ? "Discando..." : r.erro || "Erro"}
                  </span>
                </div>
            )}
            </div>
          </motion.div>
        }
      </AnimatePresence>

      {/* ══════════════════════════════════════════════
             MÓDULO CAMPANHAS 3C PLUS
          ══════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/60 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/20 via-violet-500/20 to-emerald-500/20 border border-white/10 flex items-center justify-center flex-shrink-0">
              <Megaphone className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Campanhas 3C Plus</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Crie e gerencie campanhas de discagem integradas ao 3C Plus
              </p>
              {campanhasCriadas.length > 0 &&
              <p className="text-[10px] text-violet-400 mt-1">
                  {campanhasCriadas.length} campanha{campanhasCriadas.length > 1 ? "s" : ""} criada{campanhasCriadas.length > 1 ? "s" : ""}
                </p>
              }
            </div>
          </div>
          <button
            onClick={() => {
              if (!empresaId) { toast.error("Empresa não identificada. Aguarde e tente novamente."); return; }
              setSheetCriacaoAberto(true);
              carregarDados3C(empresaId);
              carregarCampanhasCriadas();
              buscarCampanhas3CPlus(empresaId);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500/20 via-violet-500/20 to-emerald-500/20 border border-white/10 text-xs font-semibold text-white hover:from-sky-500/30 hover:via-violet-500/30 hover:to-emerald-500/30 transition-all flex-shrink-0">
            
            <Megaphone className="w-3.5 h-3.5 text-violet-400" />
            Gerenciar campanhas
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
             SHEET PREMIUM — CAMPAIGN STUDIO
          ══════════════════════════════════════════════ */}
      <Sheet modal={true} open={campanhaDeleteConfirm ? false : sheetCriacaoAberto} onOpenChange={(open) => {
        if (campanhaDeleteConfirm || campanhaEditando) return;
        if (!open) {
          setSheetCriacaoAberto(false);
          setWizardPasso(1);
          setCampanhaNome('');
          setCampanhaDescricao('');
          setCampanhaQualList('');
          setCampanhaTeams([]);
          setLeadsSelecionados([]);
          setCampanhaLeads([]);
          setCampanhaRecalls(3);
          setCampanhaCallTime(30);
          setCampanhaWaitTime(3);
          setCampanhaFonte('manual');
          setCampanhaTextoManual('');
          setLeadsDisponiveis([]);
        }
      }}>
        <SheetContent
          side="right"
          className="w-[75vw] max-w-[1100px] p-0 border-l border-white/10 bg-zinc-950/95 backdrop-blur-2xl overflow-visible flex flex-col">
          
          {/* Botão fechar — flutua na borda esquerda do Sheet */}
          <div className="group fixed top-1/2 -translate-y-1/2 z-[1300]" style={{ right: "calc(min(75vw, 1100px) - 18px)" }}>
            <button
              onClick={() => setSheetCriacaoAberto(false)}
              aria-label="Fechar modal"
              className="relative grid place-items-center h-[34px] w-[34px] rounded-full text-white bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 shadow-[0_2px_8px_rgba(0,0,0,0.4)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.5)] hover:scale-110 active:scale-95 transition-all duration-200 overflow-hidden focus:outline-none opacity-85">
              
              <span className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.4)_50%,transparent_75%)] transition-transform duration-600 ease-out rounded-full" />
              <ChevronRight className="h-4 w-4 relative z-10 transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
          </div>
          {/* Glow ambiental topo */}
          <div className="absolute top-0 left-0 right-0 h-48 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-b from-sky-500/10 via-violet-500/10 to-transparent" />
          </div>

          {/* Glow ambiental rodapé */}
          <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/5 via-amber-500/5 to-transparent" />
          </div>

          {/* Header Premium */}
          <div className="relative flex items-center justify-between px-8 pt-8 pb-6 border-b border-white/[0.06] flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 via-violet-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
                <PhoneCall className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h2 className="text-lg font-bold text-white">Campaign Studio</h2>
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-2 py-0.5 tracking-wider">
                    3C PLUS ACTIVE
                  </span>
                </div>
                <p className="text-xs text-slate-400">Gerencie campanhas inteligentes de discagem</p>
              </div>
            </div>
          </div>

          {/* Tabs Premium */}
          <div className="relative px-8 pt-5 pb-0 flex-shrink-0">
            <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-1 w-fit">
              {[
              { key: "criar", label: "Criar Campanha", icon: Plus },
              { key: "criadas", label: "Campanhas Criadas", icon: List },
              { key: "3cplus", label: "3C Plus", icon: BarChart2 }].
              map(({ key, label, icon: Icon }) =>
              <button
                key={key}
                onClick={() => {
                  setAbaCampanhaAtiva(key);
                  if (key === "3cplus" && campanhas3CPlus.length === 0 && empresaId) buscarCampanhas3CPlus();
                  if (key === "criadas") carregarCampanhasCriadas();
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all",
                  abaCampanhaAtiva === key ?
                  "bg-white/10 border border-white/15 text-white shadow-sm" :
                  "text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]"
                )}>
                
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                  {key === "criadas" && campanhasCriadas.length > 0 &&
                <span className="text-[10px] bg-violet-500/20 text-violet-400 rounded-md px-1.5">
                      {campanhasCriadas.length}
                    </span>
                }
                  {key === "3cplus" && campanhas3CPlus.length > 0 &&
                <span className="text-[10px] bg-sky-500/20 text-sky-400 rounded-md px-1.5">
                      {campanhas3CPlus.length}
                    </span>
                }
                </button>
              )}
            </div>
          </div>

          {/* Conteúdo das Tabs */}
          <div className="relative flex-1 overflow-y-auto px-8 py-6">

            {/* ─── TAB: CRIAR CAMPANHA ─── */}
            {abaCampanhaAtiva === "criar" &&
            <div className="space-y-6">

                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{wizardPasso === 1 ? "Informações" : wizardPasso === 2 ? "Configuração de discagem" : wizardPasso === 3 ? "Leads" : "Revisão"}</span>
                    <span>Passo {wizardPasso} de 4</span>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((p) =>
                  <div key={p} className={cn(
                    "flex-1 h-0.5 rounded-full transition-all duration-300",
                    wizardPasso >= p ? "bg-gradient-to-r from-sky-500 via-violet-500 to-emerald-500" : "bg-white/[0.06]"
                  )} />
                  )}
                  </div>
                </div>

                {/* Passo 1 — Informações */}
                {wizardPasso === 1 &&
              <div className="space-y-4 p-6 rounded-2xl bg-white/[0.02] border border-white/[0.07] shadow-[0_0_40px_rgba(0,0,0,0.4)]">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400 font-medium">Nome da campanha *</label>
                      <input value={campanhaNome} onChange={(e) => setCampanhaNome(e.target.value)} placeholder="Ex: Campanha Maio 2026" className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400 font-medium">Descrição</label>
                      <input value={campanhaDescricao} onChange={(e) => setCampanhaDescricao(e.target.value)} placeholder="Opcional" className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all" />
                    </div>
                    {carregandoDados3C ?
                <div className="flex items-center gap-2 text-xs text-slate-500 py-4 justify-center">
                        <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                        Carregando dados do 3C Plus...
                      </div> :
                dadosCampanha3C &&
                <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs text-slate-400 font-medium">Lista de qualificações *</label>
                          <select value={campanhaQualList} onChange={(e) => setCampanhaQualList(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[#1a1f2e] border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all cursor-pointer [&>option]:bg-[#1a1f2e] [&>option]:text-slate-200 [&>option:checked]:bg-orange-500 [&>option:checked]:text-white">
                            <option value="">Selecione...</option>
                            {(dadosCampanha3C.qualificacoes || []).map((q) => <option key={q.id} value={q.id}>{q.nome}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-slate-400 font-medium">Equipe</label>
                          <select value={campanhaTeams[0] || ""} onChange={(e) => setCampanhaTeams(e.target.value ? [e.target.value] : [])} className="w-full px-4 py-3 rounded-xl bg-[#1a1f2e] border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all cursor-pointer [&>option]:bg-[#1a1f2e] [&>option]:text-slate-200 [&>option:checked]:bg-orange-500 [&>option:checked]:text-white">
                            <option value="">Todas as equipes</option>
                            {(dadosCampanha3C.equipes || []).map((eq) => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
                          </select>
                        </div>
                      </div>
                }
                    <button onClick={() => setWizardPasso(2)} disabled={!campanhaNome || !campanhaQualList} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 via-violet-500 to-emerald-500 text-white text-sm font-semibold hover:scale-[1.02] transition-all shadow-lg shadow-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100">
                      Próximo <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
              }

                {/* Passo 2 — Configuração de discagem */}
                {wizardPasso === 2 &&
              <div className="space-y-4 p-6 rounded-2xl bg-white/[0.02] border border-white/[0.07] shadow-[0_0_40px_rgba(0,0,0,0.4)]">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400 font-medium">Horário início *</label>
                        <input type="time" value={campanhaStartTime} onChange={(e) => setCampanhaStartTime(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50 transition-all" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400 font-medium">Horário término *</label>
                        <input type="time" value={campanhaEndTime} onChange={(e) => setCampanhaEndTime(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50 transition-all" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                  { label: "Tempo de chamada (s)", desc: "Tempo máximo aguardando atendimento", value: campanhaCallTime, set: setCampanhaCallTime, min: 10, max: 120 },
                  { label: "Espera entre tentativas (s)", desc: "Intervalo entre rediscagens", value: campanhaWaitTime, set: setCampanhaWaitTime, min: 1, max: 30 },
                  { label: "Tentativas de retorno", desc: "Quantas vezes tentar o número", value: campanhaRecalls, set: setCampanhaRecalls, min: 1, max: 10 }].
                  map(({ label, desc, value, set, min, max }) =>
                  <div key={label} className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2">
                          <div>
                            <p className="text-xs font-medium text-white">{label}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{desc}</p>
                          </div>
                          <input type="number" min={min} max={max} value={value} onChange={(e) => set(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50 transition-all" />
                        </div>
                  )}
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setWizardPasso(1)} className="px-5 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white text-sm font-semibold transition-all">Voltar</button>
                      <button onClick={() => setWizardPasso(3)} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 via-violet-500 to-emerald-500 text-white text-sm font-semibold hover:scale-[1.02] transition-all shadow-lg shadow-violet-500/20">
                        Próximo <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
              }

                {/* Passo 3 — Leads */}
                {wizardPasso === 3 &&
              <div className="space-y-4 p-6 rounded-2xl bg-white/[0.02] border border-white/[0.07] shadow-[0_0_40px_rgba(0,0,0,0.4)]">
                    <div className="grid grid-cols-3 gap-3">
                      {[
                  { key: "manual", label: "Manual", icon: PenLine, desc: "Digite os números" },
                  { key: "csv", label: "CSV", icon: Upload, desc: "Importe um arquivo" },
                  { key: "leads_crm", label: "Leads do CRM", icon: List, desc: "Use leads existentes" }].
                  map(({ key, label, icon: Icon, desc }) =>
                  <button key={key} onClick={() => setCampanhaFonte(key)} className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all",
                    campanhaFonte === key ?
                    "bg-white/10 border-white/15 text-white shadow-sm" :
                    "bg-white/[0.02] border-white/[0.06] text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]"
                  )}>
                          <Icon className="w-5 h-5" />
                          <div className="text-center">
                            <p className="text-xs font-semibold">{label}</p>
                            <p className="text-[10px] opacity-60 mt-0.5">{desc}</p>
                          </div>
                        </button>
                  )}
                    </div>

                    {campanhaFonte === "manual" &&
                <div className="space-y-1">
                        <label className="text-xs text-slate-400 font-medium">Números (um por linha)</label>
                        <textarea value={campanhaTextoManual} onChange={(e) => setCampanhaTextoManual(e.target.value)} placeholder={"Cole números ou contatos aqui...\n47999999999\n11988888888"} rows={8} className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500/50 font-mono resize-none transition-all" />
                        {campanhaTextoManual && <p className="text-[10px] text-emerald-400">{parsearLeadsManual(campanhaTextoManual).length} números válidos detectados</p>}
                      </div>
                }

                    {campanhaFonte === "csv" &&
                <div className="border-2 border-dashed border-white/10 rounded-xl p-10 text-center space-y-3 cursor-pointer hover:border-violet-500/40 hover:bg-white/[0.02] transition-all"
                onDragOver={(e) => e.preventDefault()}
                onDrop={async (e) => {e.preventDefault();const file = e.dataTransfer.files[0];if (!file) return;const text = await file.text();const linhas = text.split("\n").slice(1);const ps = new Set();const leads = linhas.map((l) => {const c = l.split(",");return { identifier: c[0]?.trim() || "", phone: (c[1] || c[0] || "").replace(/\D/g, "") };}).filter((l) => {if (l.phone.length < 8 || ps.has(l.phone)) return false;ps.add(l.phone);return true;});setCampanhaLeads(leads);toast.success(`${leads.length} leads carregados`);}}
                onClick={() => document.getElementById("csv-input-premium").click()}>
                  
                        <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto">
                          <Upload className="w-5 h-5 text-violet-400" />
                        </div>
                        <div>
                          <p className="text-sm text-slate-300 font-medium">Arraste o CSV ou clique para selecionar</p>
                          <p className="text-[11px] text-slate-600 mt-1">Formato: nome,telefone (uma linha de header)</p>
                        </div>
                        {campanhaLeads.length > 0 && <p className="text-xs text-emerald-400 font-semibold">{campanhaLeads.length} leads carregados</p>}
                        <input id="csv-input-premium" type="file" accept=".csv" className="hidden" onChange={async (e) => {const file = e.target.files[0];if (!file) return;const text = await file.text();const linhas = text.split("\n").slice(1);const ps = new Set();const leads = linhas.map((l) => {const c = l.split(",");return { identifier: c[0]?.trim() || "", phone: (c[1] || c[0] || "").replace(/\D/g, "") };}).filter((l) => {if (l.phone.length < 8 || ps.has(l.phone)) return false;ps.add(l.phone);return true;});setCampanhaLeads(leads);toast.success(`${leads.length} leads carregados`);}} />
                      </div>
                }

                    {campanhaFonte === "leads_crm" &&
                <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <select value={filtroStatusLead} onChange={(e) => setFiltroStatusLead(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[#1a1f2e] border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all cursor-pointer [&>option]:bg-[#1a1f2e] [&>option]:text-slate-200 [&>option:checked]:bg-orange-500 [&>option:checked]:text-white">
                            <option value="">Todos os status</option>
                            <option value="novo">Novo</option>
                            <option value="em_cadencia">Em cadência</option>
                            <option value="respondeu">Respondeu</option>
                            <option value="reuniao_agendada">Reunião agendada</option>
                            <option value="qualificado">Qualificado</option>
                            <option value="desqualificado">Desqualificado</option>
                            <option value="sem_interesse">Sem interesse</option>
                          </select>
                          <button onClick={buscarLeadsCRM} disabled={carregandoLeadsCRM} className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-violet-500/20 border border-violet-500/30 text-sm text-violet-300 hover:bg-violet-500/30 transition-all disabled:opacity-40">
                            {carregandoLeadsCRM ? <><Loader2 className="w-4 h-4 animate-spin" />Buscando...</> : <><List className="w-4 h-4" />Buscar leads</>}
                          </button>
                        </div>
                        {leadsDisponiveis.length > 0 &&
                  <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <button onClick={toggleTodosLeads} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">{leadsSelecionados.length === leadsDisponiveis.length ? "Desmarcar todos" : "Selecionar todos"}</button>
                              <span className="text-xs text-slate-500">{leadsSelecionados.length} de {leadsDisponiveis.length} selecionados</span>
                            </div>
                            <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                              {leadsDisponiveis.map((lead) => {const sel = leadsSelecionados.find((l) => l.id === lead.id);return (
                          <div key={lead.id} onClick={() => toggleLeadSelecionado(lead)} className={cn("flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all border", sel ? "bg-violet-500/10 border-violet-500/30" : "bg-white/[0.02] border-white/[0.06] hover:border-white/10")}>
                                  <div className={cn("w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all", sel ? "bg-violet-500 border-violet-500" : "border-white/20")}>
                                    {sel && <CheckCircle className="w-3 h-3 text-white" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-white truncate">{lead.nome}</p>
                                    <p className="text-[10px] text-slate-500">{lead.telefone}</p>
                                  </div>
                                  <span className="text-[10px] text-slate-500">{lead.status}</span>
                                </div>);
                      })}
                            </div>
                          </div>
                  }
                        {leadsDisponiveis.length === 0 && !carregandoLeadsCRM &&
                  <div className="text-center py-10 space-y-2">
                            <div className="w-10 h-10 rounded-2xl bg-slate-800/60 border border-slate-700/30 flex items-center justify-center mx-auto">
                              <List className="w-5 h-5 text-slate-600" />
                            </div>
                            <p className="text-sm text-slate-500">Nenhum lead encontrado</p>
                            <p className="text-xs text-slate-600">Clique em "Buscar leads" para carregar</p>
                          </div>
                  }
                      </div>
                }

                    <div className="flex items-center gap-3">
                      <button onClick={() => setWizardPasso(2)} className="px-5 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white text-sm font-semibold transition-all">Voltar</button>
                      <button onClick={() => setWizardPasso(4)} disabled={campanhaFonte === "manual" && parsearLeadsManual(campanhaTextoManual).length === 0 || campanhaFonte === "csv" && campanhaLeads.length === 0 || campanhaFonte === "leads_crm" && leadsSelecionados.length === 0} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 via-violet-500 to-emerald-500 text-white text-sm font-semibold hover:scale-[1.02] transition-all shadow-lg shadow-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100">
                        Revisar <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
              }

                {/* Passo 4 — Revisão */}
                {wizardPasso === 4 &&
              <div className="space-y-4 p-6 rounded-2xl bg-white/[0.02] border border-white/[0.07] shadow-[0_0_40px_rgba(0,0,0,0.4)]">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                  { label: "Campanha", value: campanhaNome },
                  { label: "Horário", value: `${campanhaStartTime} → ${campanhaEndTime}` },
                  { label: "Qualificação", value: dadosCampanha3C?.qualificacoes?.find((q) => String(q.id) === String(campanhaQualList))?.nome || campanhaQualList },
                  { label: "Equipe", value: dadosCampanha3C?.equipes?.find((e) => String(e.id) === String(campanhaTeams[0]))?.nome || "Todas" },
                  { label: "Tentativas", value: `${campanhaRecalls}x · ${campanhaCallTime}s chamada · ${campanhaWaitTime}s espera` },
                  { label: "Total leads", value: campanhaFonte === "manual" ? parsearLeadsManual(campanhaTextoManual).length : campanhaFonte === "leads_crm" ? leadsSelecionados.length : campanhaLeads.length }].
                  map(({ label, value }) =>
                  <div key={label} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                          <p className="text-[10px] text-slate-500 mb-1">{label}</p>
                          <p className="text-sm font-semibold text-white">{value}</p>
                        </div>
                  )}
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setWizardPasso(3)} className="px-5 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white text-sm font-semibold transition-all">Voltar</button>
                      <button
                    onClick={async () => {
                      await handleCriarCampanha();
                      if (!criandoCampanha) {
                        setAbaCampanhaAtiva("criadas");
                        setWizardPasso(1);
                      }
                    }}
                    disabled={criandoCampanha}
                    className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-sky-500 via-violet-500 to-emerald-500 text-white text-sm font-semibold hover:scale-[1.02] transition-all shadow-lg shadow-violet-500/25 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100">
                    
                        {criandoCampanha ?
                    <><Loader2 className="w-4 h-4 animate-spin" />Criando campanha...</> :
                    <><Megaphone className="w-4 h-4" />Criar campanha no 3C Plus</>
                    }
                      </button>
                    </div>
                  </div>
              }
              </div>
            }

            {/* ─── TAB: CAMPANHAS CRIADAS ─── */}
            {abaCampanhaAtiva === "criadas" &&
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">Campanhas criadas pelo CRM VendaFlow</p>
                  <div className="flex items-center gap-2">
                    <button onClick={carregarCampanhasCriadas} className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
                      <RefreshCw className="w-3 h-3" /> Atualizar
                    </button>
                    <button onClick={() => {setAbaCampanhaAtiva("criar");setWizardPasso(1);}} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/10 text-xs font-semibold text-white hover:bg-white/10 transition-all">
                      <Plus className="w-3.5 h-3.5" /> Nova campanha
                    </button>
                  </div>
                </div>

                {carregandoCampanhas ?
              <div className="flex items-center justify-center gap-2 text-xs text-slate-500 py-10">
                    <Loader2 className="w-4 h-4 animate-spin text-violet-400" /> Carregando campanhas...
                  </div> :
              campanhasCriadas.length === 0 ?
              <div className="text-center py-16 space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500/10 via-violet-500/10 to-emerald-500/10 border border-white/[0.06] flex items-center justify-center mx-auto">
                      <Megaphone className="w-6 h-6 text-violet-400" />
                    </div>
                    <p className="text-sm text-slate-400 font-medium">Nenhuma campanha criada ainda</p>
                    <button onClick={() => {setAbaCampanhaAtiva("criar");setWizardPasso(1);}} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                      Criar primeira campanha →
                    </button>
                  </div> :

              <div className="grid grid-cols-1 gap-3">
                    {campanhasCriadas.map((c) => {
                      const c3c = c.campanha_id_3cplus ? { id_3cplus: c.campanha_id_3cplus, nome: c.nome, ativa: c.status === 'ativa', start_time: '', end_time: '' } : null;
                      return (
                <div key={c.id} className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 hover:-translate-y-0.5 hover:shadow-xl transition-all overflow-hidden">
                        <button onClick={() => toggleCampanhaExpandida(c)} className="w-full flex items-center justify-between px-5 py-4">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                        "w-2.5 h-2.5 rounded-full flex-shrink-0",
                        c.status === "ativa" ? "bg-emerald-400 shadow-lg shadow-emerald-400/50 animate-[pulse_2s_ease-in-out_infinite]" :
                        c.status === "erro" ? "bg-rose-400" :
                        c.status === "pausada" ? "bg-amber-400" :
                        "bg-slate-600"
                      )} />
                            <div className="text-left">
                              <p className="text-sm font-semibold text-white">{c.nome}</p>
                              <p className="text-[10px] text-slate-500">
                                {c.total_leads} leads · ID 3C: {c.campanha_id_3cplus || "—"}
                                {c.data_criacao && ` · ${new Date(c.data_criacao).toLocaleDateString("pt-BR")}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                        "text-[10px] font-semibold px-2.5 py-1 rounded-lg border",
                        c.status === "ativa" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                        c.status === "erro" ? "text-rose-400 bg-rose-500/10 border-rose-500/20" :
                        c.status === "rascunho" ? "text-slate-400 bg-white/[0.04] border-white/[0.06]" :
                        c.status === "pausada" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
                        "text-slate-400 bg-white/[0.04] border-white/[0.06]"
                      )}>{c.status}</span>
                            {campanhaExpandida === c.id ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          </div>
                        </button>
                        {campanhaExpandida === c.id &&
                  <div className="border-t border-white/[0.06]">
                            {/* Métricas */}
                            <div className="px-5 py-4">
                            {carregandoMetricas[c.id] ?
                    <div className="flex items-center gap-2 text-xs text-slate-500 py-3 justify-center">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" /> Carregando métricas...
                              </div> :
                    metricasPorCampanha[c.id] ?
                    <div className="space-y-3">
                                <div className="grid grid-cols-3 gap-3">
                                  {[
                        { label: "Discados", value: metricasPorCampanha[c.id].discados || 0, cor: "sky" },
                        { label: "Atendidos", value: metricasPorCampanha[c.id].atendidos || 0, cor: "emerald" },
                        { label: "Tx. Atend.", value: metricasPorCampanha[c.id].taxa_atendimento || "0%", cor: "violet" }].
                        map(({ label, value, cor }) =>
                        <div key={label} className={cn(
                          "flex flex-col items-center py-3 rounded-xl border",
                          cor === "sky" ? "bg-sky-500/5 border-sky-500/10" :
                          cor === "emerald" ? "bg-emerald-500/5 border-emerald-500/10" :
                          "bg-violet-500/5 border-violet-500/10"
                        )}>
                                      <span className={cn("text-xl font-bold", cor === "sky" ? "text-sky-300" : cor === "emerald" ? "text-emerald-300" : "text-violet-300")}>{value}</span>
                                      <span className="text-[10px] text-slate-500 mt-1">{label}</span>
                                    </div>
                        )}
                                </div>
                                <button onClick={() => buscarMetricasCampanha(c)} className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors">
                                  <RefreshCw className="w-3 h-3" /> Atualizar métricas
                                </button>
                              </div> :

                    <div className="text-center py-4 text-xs text-slate-500">Sem dados de métricas disponíveis</div>
                    }
                            {c.status === "erro" && c.erro_mensagem &&
                    <div className="mt-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-400">
                                <strong>Erro:</strong> {c.erro_mensagem}
                              </div>
                    }
                            </div>

                            {/* Ações — mesmo estilo da tab 3C Plus */}
                            {c3c && (
                              <div className="px-5 py-3 border-t border-white/[0.06] flex items-center gap-2 flex-wrap">
                                {c.status === "ativa" ? (
                                  <button
                                    onClick={() => executarAcao3C(c3c, 'pause')}
                                    disabled={acaoProcessando[`${c3c.id_3cplus}_pause`]}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 transition-all disabled:opacity-40"
                                  >
                                    {acaoProcessando[`${c3c.id_3cplus}_pause`] ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>⏸</span>}
                                    Pausar
                                  </button>
                                ) : c.status !== "encerrada" ? (
                                  <button
                                    onClick={() => executarAcao3C(c3c, 'resume')}
                                    disabled={acaoProcessando[`${c3c.id_3cplus}_resume`]}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-40"
                                  >
                                    {acaoProcessando[`${c3c.id_3cplus}_resume`] ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>▶</span>}
                                    Retomar
                                  </button>
                                ) : null}

                                {c.status !== "encerrada" && (
                                  <button
                                    onClick={async () => {
                                      // Buscar dados atuais da campanha do 3C Plus
                                      const camp3c = c._dados3c || {};
                                      setCampanhaEditando({
                                        ...c3c,
                                        _edit_name:       camp3c.name || c.nome,
                                        _edit_start_time: camp3c.start_time || '',
                                        _edit_end_time:   camp3c.end_time || '',
                                        _edit_allows_manual:              camp3c.allows_manual              ?? true,
                                        _edit_is_predictive:              camp3c.is_predictive              ?? false,
                                        _edit_check_amd:                  camp3c.amd_enabled                ?? false,
                                        _edit_filter_calls:               camp3c.filter_calls               ?? true,
                                        _edit_should_complete_failed_call: camp3c.should_complete_failed_call ?? true,
                                        _edit_update_mailing_data:        camp3c.update_mailing_data        ?? false,
                                        _edit_active_list_notify:         camp3c.active_list_notify         ?? false,
                                        _edit_copy_identifier:            camp3c.copy_identifier            ?? false,
                                        call_time:           camp3c.dialer_settings?.call_time ?? 25,
                                        wait_time:           camp3c.dialer_settings?.wait_time ?? 3,
                                        recalls:             camp3c.dialer_settings?.recalls ?? 3,
                                        limit_call_per_agent: camp3c.limit_call_per_agent ?? 0,
                                        limit_call_time:     camp3c.limit_call_time ?? 0,
                                        exit_manual_mode:    camp3c.exit_manual_mode ?? 30,
                                      });
                                      // Carregar dados do 3C Plus se ainda não tiver
                                      if (!dadosCampanha3C) carregarDados3C(empresaId);
                                      // Carregar agentes vinculados
                                      try {
                                        const res = await api.functions.invoke("gerenciarCampanha3CPlus", {
                                          empresaId,
                                          campanha_id_3cplus: c3c.id_3cplus,
                                          acao: 'agentes',
                                        });
                                        const payload = res?.data?.data?.data || res?.data?.data || res?.data || [];
                                        const agentesVinculados = Array.isArray(payload) ? payload.map(a => String(a.id)) : [];
                                        setCampanhaEditando(prev => prev ? ({ ...prev, _edit_agentes: agentesVinculados }) : prev);
                                      } catch (e) {
                                        console.warn("[editarCampanha criadas] erro ao carregar agentes:", e.message);
                                      }
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/10 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-all"
                                  >
                                    <PenLine className="w-3 h-3" /> Editar
                                  </button>
                                )}

                                <button
                                  onClick={() => setCampanhaDeleteConfirm(c3c)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition-all ml-auto"
                                >
                                  <X className="w-3 h-3" /> Excluir
                                </button>
                              </div>
                            )}
                          </div>
                  }
                      </div>);
                    })}
                  </div>
              }
              </div>
            }

            {/* ─── TAB: 3C PLUS ─── */}
            {abaCampanhaAtiva === "3cplus" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">Campanhas existentes na conta 3C Plus</p>
                  <button onClick={buscarCampanhas3CPlus} className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
                    <RefreshCw className="w-3 h-3" /> Sincronizar
                  </button>
                </div>

                {carregandoCampanhas3C ? (
                  <div className="flex items-center justify-center gap-2 text-xs text-slate-500 py-10">
                    <Loader2 className="w-4 h-4 animate-spin text-sky-400" /> Sincronizando campanhas...
                  </div>
                ) : campanhas3CPlus.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-xs">Nenhuma campanha encontrada no 3C Plus.</div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {campanhas3CPlus.map(c => (
                      <div key={c.id_3cplus} className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 hover:-translate-y-0.5 hover:shadow-xl transition-all overflow-hidden">

                        {/* Header */}
                        <button onClick={() => toggleExpandida3C(c)} className="w-full flex items-center justify-between px-5 py-4">
                          <div className="flex items-center gap-4">
                            <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", c.ativa ? "bg-emerald-400 shadow-lg shadow-emerald-400/50 animate-[pulse_2s_ease-in-out_infinite]" : "bg-slate-600")} />
                            <div className="text-left">
                              <p className="text-sm font-semibold text-white">{c.nome}</p>
                              <p className="text-[10px] text-slate-500">{c.start_time} → {c.end_time} · {c.is_predictive ? "Preditivo" : "Manual"}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-600 font-mono">#{c.id_3cplus}</span>
                              <span className={cn("text-[10px] font-semibold px-2.5 py-1 rounded-lg border", c.ativa ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-slate-400 bg-white/[0.04] border-white/[0.06]")}>
                                {c.ativa ? "ativa" : "pausada"}
                              </span>
                            </div>
                            {expandida3C === c.id_3cplus ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          </div>
                        </button>

                        {/* Expandido */}
                        {expandida3C === c.id_3cplus && (
                          <div className="border-t border-white/[0.06]">

                            {/* Métricas */}
                            <div className="px-5 py-4 space-y-3">
                              {carregandoMetrica3C[c.id_3cplus] ? (
                                <div className="flex items-center gap-2 text-xs text-slate-500 justify-center py-2">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" /> Carregando métricas...
                                </div>
                              ) : metricasCampanhas3C[c.id_3cplus] ? (
                                <div className="space-y-2">
                                  <div className="grid grid-cols-3 gap-2">
                                    {[
                                      { label: "Discados",   value: metricasCampanhas3C[c.id_3cplus].discados        || 0,    cor: "sky"     },
                                      { label: "Atendidos",  value: metricasCampanhas3C[c.id_3cplus].atendidos       || 0,    cor: "emerald" },
                                      { label: "Tx. Atend.", value: metricasCampanhas3C[c.id_3cplus].taxa_atendimento || "0%", cor: "violet"  },
                                    ].map(({ label, value, cor }) => (
                                      <div key={label} className={cn("flex flex-col items-center py-3 rounded-xl border", cor === "sky" ? "bg-sky-500/5 border-sky-500/10" : cor === "emerald" ? "bg-emerald-500/5 border-emerald-500/10" : "bg-violet-500/5 border-violet-500/10")}>
                                        <span className={cn("text-xl font-bold", cor === "sky" ? "text-sky-300" : cor === "emerald" ? "text-emerald-300" : "text-violet-300")}>{value}</span>
                                        <span className="text-[10px] text-slate-500 mt-1">{label}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <button onClick={() => buscarMetrica3C(c)} className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors">
                                    <RefreshCw className="w-3 h-3" /> Atualizar métricas
                                  </button>
                                </div>
                              ) : (
                                <div className="text-center py-2 text-xs text-slate-500">Sem dados de métricas disponíveis</div>
                              )}
                            </div>

                            {/* Footer com ações */}
                            <div className="px-5 py-3 border-t border-white/[0.06] flex items-center gap-2 flex-wrap">
                              {c.ativa ? (
                                <button
                                  onClick={() => executarAcao3C(c, 'pause')}
                                  disabled={acaoProcessando[`${c.id_3cplus}_pause`]}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 transition-all disabled:opacity-40"
                                >
                                  {acaoProcessando[`${c.id_3cplus}_pause`] ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>⏸</span>}
                                  Pausar
                                </button>
                              ) : (
                                <button
                                  onClick={() => executarAcao3C(c, 'resume')}
                                  disabled={acaoProcessando[`${c.id_3cplus}_resume`]}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-40"
                                >
                                  {acaoProcessando[`${c.id_3cplus}_resume`] ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>▶</span>}
                                  Retomar
                                </button>
                              )}

                              <button
                                onClick={async () => {
                                  setCampanhaEditando({
                                    ...c,
                                    _edit_name:       c.nome,
                                    _edit_start_time: c.start_time,
                                    _edit_end_time:   c.end_time,
                                    _edit_allows_manual:              c.allows_manual              ?? true,
                                    _edit_is_predictive:              c.is_predictive              ?? false,
                                    _edit_check_amd:                  c.check_amd                  ?? false,
                                    _edit_filter_calls:               c.filter_calls               ?? true,
                                    _edit_should_complete_failed_call: c.should_complete_failed_call ?? true,
                                    _edit_update_mailing_data:        c.update_mailing_data        ?? false,
                                    _edit_active_list_notify:         c.active_list_notify         ?? false,
                                    _edit_copy_identifier:            c.copy_identifier            ?? false,
                                  });
                                  try {
                                    const res = await api.functions.invoke("gerenciarCampanha3CPlus", {
                                      empresaId,
                                      campanha_id_3cplus: c.id_3cplus,
                                      acao: 'agentes',
                                    });
                                    const payload = res?.data?.data?.data || res?.data?.data || res?.data || [];
                                  const agentesVinculados = Array.isArray(payload) ? payload.map(a => String(a.id)) : [];
                                    setCampanhaEditando(prev => prev ? ({ ...prev, _edit_agentes: agentesVinculados }) : prev);
                                  } catch (e) {
                                    console.warn("[editarCampanha] erro ao carregar agentes:", e.message);
                                  }
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/10 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-all"
                              >
                                <PenLine className="w-3 h-3" /> Editar
                              </button>

                              <button
                                onClick={() => setCampanhaDeleteConfirm(c)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition-all ml-auto"
                              >
                                <X className="w-3 h-3" /> Excluir
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}



                    </div>
                    )}

          </div>

          {/* Modal de edição com 3 abas — compartilhado entre tabs */}
          <AnimatePresence>
          {campanhaEditando && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[1300] flex items-center justify-center p-4"
            >
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setCampanhaEditando(null)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="relative z-10 w-full max-w-2xl rounded-2xl bg-zinc-950 border border-white/10 shadow-2xl flex flex-col"
                style={{maxHeight: "85vh"}}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
                  <p className="text-sm font-semibold text-white">Editar campanha — {campanhaEditando.nome}</p>
                  <button onClick={() => setCampanhaEditando(null)} className="text-slate-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                </div>

                {/* Abas */}
                <div className="flex items-center gap-1 px-6 pt-4 flex-shrink-0">
                  {[
                    { key: "geral", label: "Geral" },
                    { key: "agentes", label: "Agentes" },
                    { key: "estrategia", label: "Estratégia" },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setCampanhaEditando(prev => ({ ...prev, _aba: key }))}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-semibold transition-all",
                        (campanhaEditando._aba || "geral") === key
                          ? "bg-white/10 text-white border border-white/15"
                          : "text-slate-500 hover:text-slate-300"
                      )}
                    >{label}</button>
                  ))}
                </div>

                {/* Conteúdo scrollável */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3" style={{overflowX: "visible"}}>

                  {/* ABA GERAL */}
                  {(campanhaEditando._aba || "geral") === "geral" && (
                    <div className="space-y-3">
                      {[
                        { label: "Nome da campanha", field: "_edit_name", type: "text" },
                        { label: "Horário início", field: "_edit_start_time", type: "time" },
                        { label: "Horário término", field: "_edit_end_time", type: "time" },
                      ].map(({ label, field, type }) => (
                        <div key={field} className="space-y-1">
                          <label className="text-xs text-slate-400 font-medium">{label}</label>
                          <input type={type} value={campanhaEditando[field] || ""} onChange={e => setCampanhaEditando(prev => ({ ...prev, [field]: e.target.value }))}
                            className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50 transition-all" />
                        </div>
                      ))}
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400 font-medium">Lista de qualificações</label>
                        <select value={campanhaEditando._edit_qualification_list || ""} onChange={e => setCampanhaEditando(prev => ({ ...prev, _edit_qualification_list: e.target.value }))}
                          className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50 transition-all appearance-none [&>option]:bg-zinc-900">
                          <option value="">Selecione...</option>
                          {(dadosCampanha3C?.qualificacoes || []).map(q => <option key={q.id} value={q.id}>{q.nome}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400 font-medium">Grupo de intervalos</label>
                        <select value={campanhaEditando._edit_work_break_group_id || ""} onChange={e => setCampanhaEditando(prev => ({ ...prev, _edit_work_break_group_id: e.target.value }))}
                          className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50 transition-all appearance-none [&>option]:bg-zinc-900">
                          <option value="">Nenhum</option>
                          {(dadosCampanha3C?.intervalos || []).map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* ABA AGENTES */}
                  {campanhaEditando._aba === "agentes" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">Equipes</label>
                        <div className="space-y-1">
                          {(dadosCampanha3C?.equipes || []).map(eq => {
                            const sel = (campanhaEditando._edit_teams || []).includes(String(eq.id));
                            return (
                              <div key={eq.id} onClick={() => setCampanhaEditando(prev => { const teams = prev._edit_teams || []; const id = String(eq.id); return { ...prev, _edit_teams: teams.includes(id) ? teams.filter(t => t !== id) : [...teams, id] }; })}
                                className={cn("flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer border transition-all", sel ? "bg-violet-500/10 border-violet-500/30" : "bg-white/[0.02] border-white/[0.06] hover:border-white/10")}>
                                <div className={cn("w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all", sel ? "bg-violet-500 border-violet-500" : "border-white/20")}>
                                  {sel && <CheckCircle className="w-3 h-3 text-white" />}
                                </div>
                                <div><p className="text-sm font-medium text-white">{eq.nome}</p><p className="text-[10px] text-slate-500">{eq.total_agentes} agentes</p></div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">Agentes individuais</label>
                          {(campanhaEditando._edit_agentes || []).length > 0 && (
                            <span className="text-[10px] text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-md px-2 py-0.5">
                              {(campanhaEditando._edit_agentes || []).length} selecionado{(campanhaEditando._edit_agentes || []).length > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        {(campanhaEditando._edit_agentes || []).length > 0 && (
                          <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-violet-500/5 border border-violet-500/20">
                            {(campanhaEditando._edit_agentes || []).map(id => {
                              const agente = (dadosCampanha3C?.agentes || []).find(a => String(a.id) === id);
                              if (!agente) return null;
                              return (
                                <div key={id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-violet-500/20 border border-violet-500/30 text-[11px] text-violet-300">
                                  <span>{agente.ramal} — {agente.nome}</span>
                                  <button onClick={() => setCampanhaEditando(prev => ({ ...prev, _edit_agentes: (prev._edit_agentes || []).filter(x => x !== id) }))} className="text-violet-400 hover:text-rose-400 transition-colors"><X className="w-3 h-3" /></button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <input placeholder="Pesquisar agente..." value={campanhaEditando._search_agente || ""} onChange={e => setCampanhaEditando(prev => ({ ...prev, _search_agente: e.target.value }))}
                          className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500/50 transition-all" />
                        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                          <div onClick={() => { const todos = (dadosCampanha3C?.agentes || []).map(a => String(a.id)); const jaTemTodos = todos.every(id => (campanhaEditando._edit_agentes || []).includes(id)); setCampanhaEditando(prev => ({ ...prev, _edit_agentes: jaTemTodos ? [] : todos })); }}
                            className="flex items-center gap-3 px-4 py-2.5 cursor-pointer bg-white/[0.02] hover:bg-white/[0.06] border-b border-white/[0.06] transition-all">
                            <div className={cn("w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all", (dadosCampanha3C?.agentes || []).every(a => (campanhaEditando._edit_agentes || []).includes(String(a.id))) ? "bg-violet-500 border-violet-500" : "border-white/20")}>
                              {(dadosCampanha3C?.agentes || []).every(a => (campanhaEditando._edit_agentes || []).includes(String(a.id))) && <CheckCircle className="w-3 h-3 text-white" />}
                            </div>
                            <span className="text-xs font-semibold text-slate-300">Selecionar todas</span>
                          </div>
                          {(dadosCampanha3C?.agentes || []).filter(a => { const jaVinculado = (campanhaEditando._edit_agentes || []).includes(String(a.id)); const matchBusca = !campanhaEditando._search_agente || a.nome.toLowerCase().includes((campanhaEditando._search_agente || "").toLowerCase()); return !jaVinculado && matchBusca; }).map(a => (
                            <div key={a.id} onClick={() => setCampanhaEditando(prev => { const ags = prev._edit_agentes || []; const id = String(a.id); return { ...prev, _edit_agentes: ags.includes(id) ? ags.filter(x => x !== id) : [...ags, id] }; })}
                              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-white/[0.06] border-b border-white/[0.03] last:border-0 transition-all">
                              <div className={cn("w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all", (campanhaEditando._edit_agentes || []).includes(String(a.id)) ? "bg-violet-500 border-violet-500" : "border-white/20")}>
                                {(campanhaEditando._edit_agentes || []).includes(String(a.id)) && <CheckCircle className="w-3 h-3 text-white" />}
                              </div>
                              <div className="flex-1 min-w-0"><p className="text-xs font-medium text-white">{a.nome}</p><p className="text-[10px] text-slate-500">Ramal {a.ramal}</p></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ABA ESTRATÉGIA */}
                  {campanhaEditando._aba === "estrategia" && (
                    <div className="space-y-3">
                      {[
                        { label: "Limite de tempo chamando (s)", field: "_edit_call_time", value: campanhaEditando.call_time || 25 },
                        { label: "Tempo de espera (s)", field: "_edit_wait_time", value: campanhaEditando.wait_time || 3 },
                        { label: "Tentativas de discagem", field: "_edit_recalls", value: campanhaEditando.recalls || 3 },
                        { label: "Limite de lig. por agente", field: "_edit_limit_call_per_agent", value: campanhaEditando.limit_call_per_agent || 0 },
                        { label: "Tempo máx. de ligação (s)", field: "_edit_limit_call_time", value: campanhaEditando.limit_call_time || 0 },
                        { label: "Tempo saída modo manual (s)", field: "_edit_exit_manual_mode", value: campanhaEditando.exit_manual_mode || 30 },
                      ].map(({ label, field, value }) => (
                        <div key={field} className="flex items-center justify-between gap-4">
                          <label className="text-xs text-slate-400 flex-1">{label}</label>
                          <input type="number" min={0} defaultValue={value} onChange={e => setCampanhaEditando(prev => ({ ...prev, [field]: Number(e.target.value) }))}
                            className="w-24 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-sky-500/50 transition-all" />
                        </div>
                      ))}
                      <div className="border-t border-white/[0.06] pt-3 space-y-2">
                        {[
                          { label: "Ligação manual", field: "_edit_allows_manual", desc: "Permite ligações manuais pelos agentes" },
                          { label: "Modo preditivo", field: "_edit_is_predictive", desc: "Discador prevê disponibilidade dos agentes" },
                          { label: "Detectar secretária (AMD)", field: "_edit_check_amd", desc: "Descarta ligações com caixa postal" },
                          { label: "Filtro de chamadas", field: "_edit_filter_calls", desc: "Filtro inteligente 3C Plus" },
                          { label: "Concluir ao falhar", field: "_edit_should_complete_failed_call", desc: "Números que falham não se repetem" },
                          { label: "Atualizar dados do mailing", field: "_edit_update_mailing_data", desc: "Sincroniza alterações feitas pelo agente" },
                          { label: "Notificação de lista ativa", field: "_edit_active_list_notify", desc: "Notifica quando a lista de discagem estiver ativa" },
                          { label: "Copiar identificador", field: "_edit_copy_identifier", desc: "Copia o identificador do mailing para o histórico" },
                        ].map(({ label, field, desc }) => {
                          const val = campanhaEditando[field] !== undefined ? campanhaEditando[field] : false;
                          return (
                            <div key={field} onClick={() => setCampanhaEditando(prev => ({ ...prev, [field]: !prev[field] }))}
                              className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/10 cursor-pointer transition-all">
                              <div><p className="text-xs font-medium text-white">{label}</p><p className="text-[10px] text-slate-500 mt-0.5">{desc}</p></div>
                              <div className={cn("w-9 h-5 rounded-full transition-all flex-shrink-0 relative", val ? "bg-violet-500" : "bg-white/10")}>
                                <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all", val ? "left-4" : "left-0.5")} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center gap-3 px-6 py-4 border-t border-white/[0.06] flex-shrink-0">
                  <button onClick={() => setCampanhaEditando(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white text-sm font-semibold transition-all">Cancelar</button>
                  <button
                    onClick={async () => {
                      const payload = {};
                      if (campanhaEditando._edit_name) payload.name = campanhaEditando._edit_name;
                      if (campanhaEditando._edit_start_time) payload.start_time = campanhaEditando._edit_start_time;
                      if (campanhaEditando._edit_end_time) payload.end_time = campanhaEditando._edit_end_time;
                      if (campanhaEditando._edit_qualification_list) payload.qualification_list = Number(campanhaEditando._edit_qualification_list);
                      if (campanhaEditando._edit_work_break_group_id) payload.work_break_group_id = campanhaEditando._edit_work_break_group_id;
                      if (campanhaEditando._edit_teams) payload.teams = campanhaEditando._edit_teams.map(Number);
                      if (campanhaEditando._edit_call_time !== undefined) payload.call_time = campanhaEditando._edit_call_time;
                      if (campanhaEditando._edit_wait_time !== undefined) payload.wait_time = campanhaEditando._edit_wait_time;
                      if (campanhaEditando._edit_recalls !== undefined) payload.recalls = campanhaEditando._edit_recalls;
                      if (campanhaEditando._edit_limit_call_per_agent !== undefined) payload.limit_call_per_agent = campanhaEditando._edit_limit_call_per_agent;
                      if (campanhaEditando._edit_limit_call_time !== undefined) payload.limit_call_time = campanhaEditando._edit_limit_call_time;
                      if (campanhaEditando._edit_exit_manual_mode !== undefined) payload.exit_manual_mode = campanhaEditando._edit_exit_manual_mode;
                      if (campanhaEditando._edit_allows_manual !== undefined) payload.allows_manual = campanhaEditando._edit_allows_manual;
                      if (campanhaEditando._edit_is_predictive !== undefined) payload.is_predictive = campanhaEditando._edit_is_predictive;
                      if (campanhaEditando._edit_check_amd !== undefined) payload.check_amd = campanhaEditando._edit_check_amd;
                      if (campanhaEditando._edit_filter_calls !== undefined) payload.filter_calls = campanhaEditando._edit_filter_calls;
                      if (campanhaEditando._edit_should_complete_failed_call !== undefined) payload.should_complete_failed_call = campanhaEditando._edit_should_complete_failed_call;
                      if (campanhaEditando._edit_update_mailing_data !== undefined) payload.update_mailing_data = campanhaEditando._edit_update_mailing_data;
                      if (campanhaEditando._edit_active_list_notify !== undefined) payload.active_list_notify = campanhaEditando._edit_active_list_notify;
                      if (campanhaEditando._edit_copy_identifier !== undefined) payload.copy_identifier = campanhaEditando._edit_copy_identifier;
                      if (Object.keys(payload).length === 0) { setCampanhaEditando(null); return; }
                      executarAcao3C(campanhaEditando, 'editar', payload);
                    }}
                    disabled={acaoProcessando[`${campanhaEditando.id_3cplus}_editar`]}
                    className={cn("flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-40", acaoSucesso[`${campanhaEditando.id_3cplus}_editar`] ? "bg-emerald-500" : "bg-gradient-to-r from-sky-500 via-violet-500 to-emerald-500")}
                  >
                    {acaoProcessando[`${campanhaEditando.id_3cplus}_editar`]
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                      : acaoSucesso[`${campanhaEditando.id_3cplus}_editar`]
                      ? <><CheckCircle className="w-4 h-4" /> Salvo!</>
                      : <><PenLine className="w-4 h-4" /> Salvar alterações</>}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
          </AnimatePresence>

        </SheetContent>
      </Sheet>

      {/* Modal destrutivo via Portal */}
      {campanhaDeleteConfirm &&
        createPortal(
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[999999] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            style={{
              background: 'rgba(0, 0, 0, 0.78)',
              backdropFilter: 'blur(8px)',
              isolation: 'isolate',
              pointerEvents: 'auto',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setCampanhaDeleteConfirm(null);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-[440px] overflow-hidden rounded-[20px] border border-rose-500/25 pointer-events-auto"
              style={{
                background: 'linear-gradient(180deg, hsl(0 30% 8%) 0%, hsl(222 47% 5%) 100%)',
                boxShadow: '0 30px 80px -20px hsl(0 80% 30% / 0.55), 0 0 0 1px hsl(0 70% 50% / 0.15)',
              }}
            >
              {/* Top accent line */}
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{
                  background: 'linear-gradient(90deg, transparent, hsl(0 84% 60% / 0.8), transparent)',
                }}
              />

              {/* Header */}
              <div className="relative flex items-start gap-3.5 px-6 pt-6 pb-2">
                <div
                  className="relative h-11 w-11 shrink-0 rounded-xl grid place-items-center"
                  style={{
                    background: 'linear-gradient(135deg, hsl(0 84% 60% / 0.2), hsl(0 84% 60% / 0.08))',
                    boxShadow: '0 0 24px -4px hsl(0 84% 55% / 0.45), inset 0 1px 0 hsl(0 0% 100% / 0.04)',
                    border: '1px solid hsl(0 84% 55% / 0.4)',
                  }}
                >
                  <div className="absolute inset-0 rounded-xl bg-rose-500/10 animate-pulse" />
                  <AlertTriangle className="h-5 w-5 text-rose-300 relative z-10" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-white leading-tight tracking-tight">
                    Excluir campanha permanentemente
                  </p>
                  <div className="text-xs text-rose-300/80 mt-1 flex items-center gap-1.5">
                    <ShieldAlert className="h-3 w-3" />
                    Esta ação não pode ser desfeita
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="relative px-6 pt-4 pb-5 space-y-4">
                <p className="text-sm leading-relaxed text-slate-300">
                  Tem certeza que deseja excluir a campanha{' '}
                  <span
                    className="inline rounded-md px-1.5 py-0.5 font-mono text-[12px] text-rose-200 break-all"
                    style={{
                      background: 'hsl(0 84% 60% / 0.1)',
                      border: '1px solid hsl(0 84% 60% / 0.2)',
                    }}
                  >
                    "{campanhaDeleteConfirm.nome}"
                  </span>
                  {' '}do 3C Plus?
                </p>

                {/* Impact list */}
                <div
                  className="rounded-xl border border-white/5 p-3.5 space-y-2"
                  style={{ background: 'hsl(0 0% 0% / 0.3)' }}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Será removido:
                  </p>
                  {[
                    { icon: Database, label: 'Todos os dados da campanha' },
                    { icon: PhoneCall, label: 'Histórico completo de ligações' },
                    { icon: BarChart3, label: 'Métricas e relatórios associados' },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-2.5 text-xs text-slate-400">
                      <Icon className="h-3.5 w-3.5 text-rose-400/70" />
                      {label}
                    </div>
                  ))}
                </div>

                {/* Confirmation input */}
                <div>
                  <label className="text-[11px] font-medium text-slate-400 mb-1.5 block">
                    Digite EXCLUIR para confirmar
                  </label>
                  <input
                    type="text"
                    placeholder="EXCLUIR"
                    value={campanhaDeleteConfirm._confirmText || ''}
                    onChange={(e) => setCampanhaDeleteConfirm(prev => ({ ...prev, _confirmText: e.target.value }))}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter' && (campanhaDeleteConfirm._confirmText || '') === 'EXCLUIR') {
                        executarAcao3C(campanhaDeleteConfirm, 'delete');
                      }
                    }}
                    className="w-full h-10 rounded-lg bg-black/40 border border-white/10 px-3 text-sm text-white placeholder-slate-600 font-mono tracking-wider outline-none focus:border-rose-500/60 focus:ring-4 focus:ring-rose-500/15 transition-all"
                  />
                </div>
              </div>

              {/* Footer */}
              <div
                className="relative flex items-center justify-end gap-2.5 px-6 pb-6 pt-2 border-t border-white/5"
                style={{ background: 'hsl(0 0% 0% / 0.2)' }}
              >
                <button
                   onClick={() => setCampanhaDeleteConfirm(null)}
                   className="h-10 px-5 rounded-lg border border-white/10 bg-white/[0.04] text-sm font-medium text-slate-200 hover:bg-white/10 hover:border-white/20 transition-all"
                 >
                   Cancelar
                 </button>
                 <button
                   onClick={() => executarAcao3C(campanhaDeleteConfirm, 'delete')}
                   disabled={
                     acaoProcessando[`${campanhaDeleteConfirm.id_3cplus}_delete`] ||
                     (campanhaDeleteConfirm._confirmText || '') !== 'EXCLUIR'
                   }
                   className="group relative h-10 px-5 rounded-lg text-sm font-semibold text-white overflow-hidden transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:saturate-50"
                   style={{
                     background: 'linear-gradient(180deg, hsl(0 84% 58%), hsl(0 78% 48%))',
                     boxShadow: '0 10px 28px -8px hsl(0 84% 50% / 0.6), 0 0 0 1px hsl(0 84% 55% / 0.3)',
                   }}
                   onMouseEnter={(e) => {
                     e.currentTarget.style.boxShadow = '0 14px 36px -8px hsl(0 84% 50% / 0.8), 0 0 24px -4px hsl(0 84% 55% / 0.5)';
                   }}
                   onMouseLeave={(e) => {
                     e.currentTarget.style.boxShadow = '0 10px 28px -8px hsl(0 84% 50% / 0.6), 0 0 0 1px hsl(0 84% 55% / 0.3)';
                   }}
                 >
                  <span
                    className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"
                    style={{
                      background: 'linear-gradient(110deg, transparent 35%, hsl(0 0% 100% / 0.35) 50%, transparent 65%)',
                    }}
                  />
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {acaoProcessando[`${campanhaDeleteConfirm.id_3cplus}_delete`] ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Excluindo...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" /> Excluir permanentemente
                      </>
                    )}
                  </span>
                </button>
              </div>
            </motion.div>
          </motion.div>,
          document.body
        )
      }
    </div>);

}