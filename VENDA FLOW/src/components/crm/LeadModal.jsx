import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { listarVinculos, vinculosParaUsuarios } from "@/lib/services/equipeService";
import {
  listarAtividadesDoLead, listarTarefasDoLead,
  listarLeadScoreDoLead, listarRespostasDiagnostico,
} from "@/lib/services/leadService";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { usePermissions } from "@/components/hooks/usePermissions";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bot, FileText, Clock, TrendingUp, RefreshCw, ClipboardList } from "lucide-react";
import ActivityTimeline from "./ActivityTimeline";
import PerfilEmpresaSection from "./PerfilEmpresaSection";
import FaturamentoSection from "./FaturamentoSection";
import MarketingAttributionTab from "./MarketingAttributionTab";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ReactMarkdown from "react-markdown";
import LeadScoreBadge from "./LeadScoreBadge";
import LeadScoreDetails from "./LeadScoreDetails";

export default function LeadModal({ open, onClose, lead, onSave, equipes, cadencias }) {
  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    email: "",
    empresa: "",
    cargo: "",
    origem: "trafego_pago",
    campanha: "",
    status: "novo",
    equipe: "",
    sdr_responsavel: "",
    closer_responsavel: "",
    instagram: "",
    facebook: "",
    tiktok: "",
    google_meu_negocio: "",
    linkedin: "",
    observacoes: "",
    cidade: "",
    estado: "",
    qtd_tecnicos: null,
    qtd_vendedores: null,
    qtd_administrativo: null,
    contratou_consultoria: null,
    tempo_seguindo: "",
    qtd_unidades: null,
    tipo_rede: "",
    tem_socios: false,
    nome_socio: "",
    telefone_socio: "",
    ja_cliente: false,
    produtos_comprados: [],
  });
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const { empresaId: empresaIdModal } = useEmpresaAtual();
  const { effectiveRole, isSuperAdmin, nivel } = usePermissions();
  const isEditando = !!lead;

  const isSDR          = ["sdr", "social_seller"].includes(effectiveRole);
  const isCloser       = ["closer", "cs"].includes(effectiveRole);
  const isGestorOrAdmin = isSuperAdmin || nivel >= 4 ||
    ["gestor", "admin", "gestor_empresa", "gerente_empresa", "gerente_filial", "supervisor"].includes(effectiveRole);

  const { data: vinculos = [] } = useQuery({
    queryKey: ["vinculos-leadmodal", empresaIdModal],
    queryFn: () => listarVinculos(empresaIdModal),
    enabled: !!empresaIdModal,
  });
  const usuarios = vinculosParaUsuarios(vinculos).map(u => ({ ...u, role: u.papel }));

  // Papel do usuário logado na empresa atual
  const vinculoAtualModal = vinculos.find(v => v.userEmail === currentUser?.email);
  const papelUsuarioLogado = vinculoAtualModal?.papel || null;

  const { data: atividades = [] } = useQuery({
    queryKey: ["atividades-lead", lead?.id],
    queryFn: () => listarAtividadesDoLead(lead?.id),
    enabled: !!lead?.id,
  });

  const { data: tarefasLead = [] } = useQuery({
    queryKey: ["tarefas-lead", lead?.id],
    queryFn: () => listarTarefasDoLead(lead?.id),
    enabled: !!lead?.id,
  });

  const { data: leadScore, isLoading: loadingScore } = useQuery({
    queryKey: ["lead-score", lead?.id],
    queryFn: () => listarLeadScoreDoLead(lead?.id),
    enabled: !!lead?.id,
  });

  const { data: respostasDiagnostico = [] } = useQuery({
    queryKey: ["respostas-diagnostico", lead?.id],
    queryFn: () => listarRespostasDiagnostico(lead?.id),
    enabled: !!lead?.id,
  });

  const recalcularScoreMutation = useMutation({
    mutationFn: async () => {
      await base44.functions.invoke('calcularLeadScore', { lead_id: lead.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-score", lead?.id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  useEffect(() => {
    if (lead) {
      setFormData({
        nome: lead.nome || "",
        telefone: lead.telefone || "",
        email: lead.email || "",
        empresa: lead.empresa || "",
        cargo: lead.cargo || "",
        origem: lead.origem || "trafego_pago",
        campanha: lead.campanha || "",
        status: lead.status || "novo",
        equipe: lead.equipe || "",
        sdr_responsavel: lead.sdr_responsavel || "",
        closer_responsavel: lead.closer_responsavel || "",
        instagram: lead.instagram || "",
        facebook: lead.facebook || "",
        tiktok: lead.tiktok || "",
        google_meu_negocio: lead.google_meu_negocio || "",
        linkedin: lead.linkedin || "",
        observacoes: lead.observacoes || "",
        cidade: lead.cidade || "",
        estado: lead.estado || "",
        qtd_tecnicos: lead.qtd_tecnicos ?? null,
        qtd_vendedores: lead.qtd_vendedores ?? null,
        qtd_administrativo: lead.qtd_administrativo ?? null,
        contratou_consultoria: lead.contratou_consultoria ?? null,
        tempo_seguindo: lead.tempo_seguindo || "",
        qtd_unidades: lead.qtd_unidades ?? null,
        tipo_rede: lead.tipo_rede || "",
        tem_socios: lead.tem_socios || false,
        nome_socio: lead.nome_socio || "",
        telefone_socio: lead.telefone_socio || "",
        ja_cliente: lead.ja_cliente || false,
        produtos_comprados: lead.produtos_comprados || [],
      });
    } else {
      const autoSdr    = isSDR    ? (currentUser?.email || "") : "";
      const autoCloser = isCloser ? (currentUser?.email || "") : "";
      setFormData({
        nome: "",
        telefone: "",
        email: "",
        empresa: "",
        cargo: "",
        origem: "trafego_pago",
        campanha: "",
        status: "novo",
        equipe: "",
        sdr_responsavel: autoSdr,
        closer_responsavel: autoCloser,
        instagram: "",
        facebook: "",
        tiktok: "",
        google_meu_negocio: "",
        linkedin: "",
        observacoes: "",
        cidade: "",
        estado: "",
        qtd_tecnicos: null,
        qtd_vendedores: null,
        qtd_administrativo: null,
        contratou_consultoria: null,
        tempo_seguindo: "",
        qtd_unidades: null,
        tipo_rede: "",
        tem_socios: false,
        nome_socio: "",
        telefone_socio: "",
        ja_cliente: false,
        produtos_comprados: [],
      });
    }
  }, [lead, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nome?.trim()) { alert("Nome é obrigatório"); return; }
    if (!formData.telefone?.trim()) { alert("Telefone é obrigatório"); return; }
    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      alert("Erro ao salvar lead: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const analisesIA = atividades.filter(a => a.tipo === "anotacao" && a.observacao?.includes("🤖 ANÁLISE IA"));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-xl flex items-center gap-3">
            {lead ? "Editar Lead" : "Novo Lead"}
            {leadScore && (
              <LeadScoreBadge 
                score={leadScore.score_total} 
                temperatura={leadScore.temperatura}
                size="default"
              />
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {lead ? "Formulário para editar dados do lead" : "Formulário para criar novo lead"}
          </DialogDescription>
        </DialogHeader>

        {lead ? (
          <Tabs defaultValue="dados" className="mt-4">
            <TabsList className="bg-slate-800 border-slate-700">
              <TabsTrigger value="dados">Dados do Lead</TabsTrigger>
              {respostasDiagnostico.length > 0 && (
                <TabsTrigger value="diagnostico" className="relative">
                  Diagnóstico
                  <Badge className="ml-2 bg-purple-600 text-white text-xs px-1.5">
                    {respostasDiagnostico.length}
                  </Badge>
                </TabsTrigger>
              )}
              <TabsTrigger value="analises" className="relative">
                Análises IA
                {analisesIA.length > 0 && (
                  <Badge className="ml-2 bg-blue-600 text-white text-xs px-1.5">
                    {analisesIA.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="historico" className="relative">
                Histórico
                {(atividades.length + tarefasLead.length) > 0 && (
                  <Badge className="ml-2 bg-slate-600 text-white text-xs px-1.5">
                    {atividades.length + tarefasLead.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="score">Lead Score</TabsTrigger>
              <TabsTrigger value="marketing"> Marketing</TabsTrigger>
            </TabsList>

            <TabsContent value="dados">
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Nome *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Telefone *</Label>
              <Input
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="(11) 99999-9999"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">E-mail</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Empresa</Label>
              <Input
                value={formData.empresa}
                onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Cargo</Label>
              <Input
                value={formData.cargo}
                onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Origem</Label>
              <Select
                value={formData.origem}
                onValueChange={(value) => setFormData({ ...formData, origem: value })}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="trafego_pago">Tráfego Pago</SelectItem>
                <SelectItem value="meta_ads">Meta Ads (automático webhook)</SelectItem>
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
                <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
                </Select>
                </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                <Label className="text-slate-300">Campanha</Label>
                <Input
                value={formData.campanha}
                onChange={(e) => setFormData({ ...formData, campanha: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Nome da campanha"
                />
                </div>
                <div className="space-y-2">
                <Label className="text-slate-300">Equipe</Label>
              <Select
                value={formData.equipe}
                onValueChange={(value) => setFormData({ ...formData, equipe: value })}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Selecionar equipe" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {equipes?.map((equipe) => (
                    <SelectItem key={equipe.id} value={equipe.nome}>
                      {equipe.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">SDR Responsável</Label>
              <Select
                value={formData.sdr_responsavel}
                onValueChange={(value) => setFormData({ ...formData, sdr_responsavel: value })}
                disabled={!isGestorOrAdmin}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white disabled:opacity-40">
                  <SelectValue placeholder="Selecionar SDR" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {usuarios.filter(u => ["sdr","social_seller","closer","cs","gestor","admin","gestor_empresa","gerente_empresa","gerente_filial","supervisor"].includes(u.role)).map((u) => (
                    <SelectItem key={u.id} value={u.email}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Closer Responsável</Label>
              <Select
                value={formData.closer_responsavel}
                onValueChange={(value) => setFormData({ ...formData, closer_responsavel: value })}
                disabled={!isGestorOrAdmin}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white disabled:opacity-40">
                  <SelectValue placeholder="Selecionar Closer" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {usuarios.filter(u => ["closer","cs","gestor","admin","gestor_empresa","gerente_empresa","gerente_filial","supervisor"].includes(u.role)).map((u) => (
                    <SelectItem key={u.id} value={u.email}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Instagram</Label>
              <Input
                value={formData.instagram}
                onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="@usuario"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Facebook</Label>
              <Input
                value={formData.facebook}
                onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="URL ou @usuario"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">TikTok</Label>
              <Input
                value={formData.tiktok}
                onChange={(e) => setFormData({ ...formData, tiktok: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="@usuario"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">LinkedIn</Label>
              <Input
                value={formData.linkedin}
                onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="URL do perfil"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Google Meu Negócio</Label>
            <Input
              value={formData.google_meu_negocio}
              onChange={(e) => setFormData({ ...formData, google_meu_negocio: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white"
              placeholder="URL do Google Meu Negócio"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Observações</Label>
            <Textarea
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white min-h-[100px]"
            />
          </div>

          <PerfilEmpresaSection formData={formData} setFormData={setFormData} />

          {lead?.id && (
            <FaturamentoSection leadId={lead.id} currentUserEmail={currentUser?.email} />
          )}

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="ghost" onClick={onClose} className="text-slate-400">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Salvar Alterações
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="diagnostico" className="space-y-4">
              {respostasDiagnostico.length === 0 ? (
                <div className="text-center py-12">
                  <ClipboardList className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">Nenhum diagnóstico preenchido</p>
                </div>
              ) : (
                respostasDiagnostico.map((resposta) => (
                  <div key={resposta.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-semibold text-white mb-1">
                          {resposta.landing_page_titulo}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Clock className="w-3 h-3" />
                          {format(new Date(resposta.created_date), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                        </div>
                      </div>
                      {resposta.pontuacao_diagnostico > 0 && (
                        <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                          Pontuação: {resposta.pontuacao_diagnostico}
                        </Badge>
                      )}
                    </div>

                    {resposta.respostas && resposta.respostas.length > 0 && (
                      <div className="space-y-3">
                        <h5 className="text-sm font-medium text-slate-300">Respostas:</h5>
                        {resposta.respostas.map((r, idx) => (
                          <div key={idx} className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/50">
                            <p className="text-sm text-slate-400 mb-2 font-medium">{r.pergunta}</p>
                            <p className="text-white">{r.resposta}</p>
                            {r.peso_score > 0 && (
                              <span className="text-xs text-purple-400 mt-1 inline-block">
                                Peso: {r.peso_score}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="analises" className="space-y-4">
              {analisesIA.length === 0 ? (
                <div className="text-center py-12">
                  <Bot className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">Nenhuma análise de IA registrada ainda</p>
                  <p className="text-sm text-slate-500 mt-2">
                    Use o Assistente de Vendas para analisar ligações com este lead
                  </p>
                </div>
              ) : (
                analisesIA.map((atividade) => (
                  <div key={atividade.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="p-2 bg-blue-500/20 rounded-lg">
                        <Bot className="w-5 h-5 text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-white">Análise IA</span>
                          <Badge variant="outline" className="text-xs bg-slate-700 text-slate-300">
                            {atividade.script_usado || "Assistente"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Clock className="w-3 h-3" />
                          {format(new Date(atividade.created_date), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                        </div>
                      </div>
                    </div>
                    <div className="prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown className="text-slate-300 text-sm whitespace-pre-line">
                        {atividade.observacao}
                      </ReactMarkdown>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="score" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Pontuação do Lead</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => recalcularScoreMutation.mutate()}
                  disabled={recalcularScoreMutation.isPending}
                  className="border-slate-600 text-slate-300"
                >
                  {recalcularScoreMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Recalcular
                </Button>
              </div>
              
              {loadingScore ? (
                <div className="text-center py-8">
                  <RefreshCw className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-3" />
                  <p className="text-slate-400">Carregando score...</p>
                </div>
              ) : leadScore ? (
                <LeadScoreDetails leadScore={leadScore} />
              ) : (
                <div className="text-center py-8">
                  <TrendingUp className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  <p className="text-slate-400 mb-4">Score ainda não calculado</p>
                  <Button
                    onClick={() => recalcularScoreMutation.mutate()}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Calcular Score
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="historico" className="pt-2">
              <ActivityTimeline atividades={atividades} tarefas={tarefasLead} />
            </TabsContent>

            <TabsContent value="marketing" className="pt-2">
              <MarketingAttributionTab leadId={lead?.id} />
            </TabsContent>
          </Tabs>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Nome *</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Telefone *</Label>
                <Input
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="(11) 99999-9999"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">E-mail</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Empresa</Label>
                <Input
                  value={formData.empresa}
                  onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Cargo</Label>
                <Input
                  value={formData.cargo}
                  onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Origem</Label>
                <Select
                  value={formData.origem}
                  onValueChange={(value) => setFormData({ ...formData, origem: value })}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="trafego_pago">Tráfego Pago</SelectItem>
                    <SelectItem value="meta_ads">Meta Ads (automático webhook)</SelectItem>
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
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Campanha</Label>
                <Input
                  value={formData.campanha}
                  onChange={(e) => setFormData({ ...formData, campanha: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="Nome da campanha"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Equipe</Label>
                <Select
                  value={formData.equipe}
                  onValueChange={(value) => setFormData({ ...formData, equipe: value })}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Selecionar equipe" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {equipes?.map((equipe) => (
                      <SelectItem key={equipe.id} value={equipe.nome}>
                        {equipe.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* SDR Responsável */}
              <div className="space-y-2">
                <Label className="text-slate-300">SDR Responsável</Label>
                {!isEditando && isSDR ? (
                  <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700/50 rounded-md px-3 py-2 text-slate-300 text-sm opacity-70 cursor-not-allowed">
                    <span className="flex-1">{usuarios.find(u => u.email === formData.sdr_responsavel)?.full_name || formData.sdr_responsavel || currentUser?.email}</span>
                    <span className="text-[10px] text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded">Fixo</span>
                  </div>
                ) : (
                  <Select
                    value={formData.sdr_responsavel}
                    onValueChange={(value) => setFormData({ ...formData, sdr_responsavel: value })}
                    disabled={!isEditando && isCloser}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white disabled:opacity-40">
                      <SelectValue placeholder="Selecionar SDR" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {usuarios.filter(u => ["sdr","social_seller","closer","cs","gestor","admin","gestor_empresa","gerente_empresa","gerente_filial","supervisor"].includes(u.role)).map((u) => (
                        <SelectItem key={u.id} value={u.email}>
                          {u.full_name || u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {/* Closer Responsável */}
              <div className="space-y-2">
                <Label className="text-slate-300">Closer Responsável</Label>
                {!isEditando && isCloser ? (
                  <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700/50 rounded-md px-3 py-2 text-slate-300 text-sm opacity-70 cursor-not-allowed">
                    <span className="flex-1">{usuarios.find(u => u.email === formData.closer_responsavel)?.full_name || formData.closer_responsavel || currentUser?.email}</span>
                    <span className="text-[10px] text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded">Fixo</span>
                  </div>
                ) : (
                  <Select
                    value={formData.closer_responsavel}
                    onValueChange={(value) => setFormData({ ...formData, closer_responsavel: value })}
                    disabled={!isEditando && isSDR}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white disabled:opacity-40">
                      <SelectValue placeholder="Selecionar Closer" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {usuarios.filter(u => ["closer","cs","gestor","admin","gestor_empresa","gerente_empresa","gerente_filial","supervisor"].includes(u.role)).map((u) => (
                        <SelectItem key={u.id} value={u.email}>
                          {u.full_name || u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Instagram</Label>
                <Input
                  value={formData.instagram}
                  onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="@usuario"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Facebook</Label>
                <Input
                  value={formData.facebook}
                  onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="URL ou @usuario"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">TikTok</Label>
                <Input
                  value={formData.tiktok}
                  onChange={(e) => setFormData({ ...formData, tiktok: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="@usuario"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">LinkedIn</Label>
                <Input
                  value={formData.linkedin}
                  onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="URL do perfil"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Google Meu Negócio</Label>
              <Input
                value={formData.google_meu_negocio}
                onChange={(e) => setFormData({ ...formData, google_meu_negocio: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="URL do Google Meu Negócio"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white min-h-[100px]"
              />
            </div>

            <PerfilEmpresaSection formData={formData} setFormData={setFormData} />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={onClose} className="text-slate-400">
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Criar Lead
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}