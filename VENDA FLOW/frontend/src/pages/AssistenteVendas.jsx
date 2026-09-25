import { useState, useEffect, useRef } from "react";
import { api } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Bot,
  Send,
  Loader2,
  Upload,
  FileText,
  Sparkles,
  MessageCircle,
  User,
  Users,
  Calendar,
  Target,
  Wand2,
  Award,
  Briefcase,
} from "lucide-react";
import GerarScriptModal from "@/components/assistente/GerarScriptModal";
import DetalhesColaboradorModal from "@/components/assistente/DetalhesColaboradorModal";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { usePermissions } from "@/components/hooks/usePermissions";
import { resolveDisplayName, resolveDisplayNameFromUser } from '@/lib/resolveDisplayName';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AssistenteVendas() {
  const [mensagem, setMensagem] = useState("");
  const [conversacaoId, setConversacaoId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [uploadando, setUploadando] = useState(false);
  const [sdrSelecionado, setSdrSelecionado] = useState("todos");
  const [leadSelecionado, setLeadSelecionado] = useState(null);
  const [modalScriptAberto, setModalScriptAberto] = useState(false);
  const [filtroRole, setFiltroRole] = useState("todos");
  const [filtroEquipe, setFiltroEquipe] = useState("todos");
  const [colaboradorDetalhes, setColaboradorDetalhes] = useState(null);
  const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.auth.me(),
  });

  const { empresaId } = useEmpresaAtual();

  const { effectiveRole, isAdmin, isGestor, isSuperAdmin, isGestorEmpresa, isGerenteEmpresa, isGerenteFilial, isSupervisor, nivel } = usePermissions();
  const isGestorOrAdmin = nivel >= 4;

  const { data: usuarios = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.entities.User.list(),
  });

  const { data: analisesIA = [] } = useQuery({
    queryKey: ["analises-ia", empresaId, effectiveRole, user?.email],
    queryFn: async () => {
      if (!empresaId) return [];
      const allAnalises = await api.entities.Atividade.filter({ empresaId, tipo: "anotacao" }, "-created_date", 1000);
      if (isGestorOrAdmin) return allAnalises;
      return allAnalises.filter(a => a.sdr_email === user.email);
    },
    enabled: !!user?.email && !!empresaId,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads", empresaId, effectiveRole, user?.email],
    queryFn: async () => {
      if (!empresaId) return [];
      const allLeads = await api.entities.Lead.filter({ empresaId }, "-updated_date", 100);
      if (isGestorOrAdmin) return allLeads;
      return allLeads.filter(l => l.sdr_responsavel === user.email);
    },
    enabled: !!user?.email && !!empresaId,
  });

  const { data: avaliacoesProdutos = [] } = useQuery({
    queryKey: ["avaliacoes-produtos-equipe", empresaId],
    queryFn: () => api.entities.AvaliacaoProduto.filter({ empresaId }, "-created_date"),
    enabled: isGestorOrAdmin && !!empresaId,
  });

  const { data: equipes = [] } = useQuery({
    queryKey: ["equipes", empresaId],
    queryFn: () => api.entities.Equipe.filter({ empresaId }),
    enabled: isGestorOrAdmin && !!empresaId,
  });

  useEffect(() => { criarConversa(); }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!conversacaoId) return;
    const unsubscribe = api.agents.subscribeToConversation(conversacaoId, (data) => {
      setMessages(data.messages || []);
      const lastMessage = data.messages?.[data.messages.length - 1];
      if (lastMessage?.role === "assistant") setEnviando(false);
    });
    return () => unsubscribe();
  }, [conversacaoId]);

  const criarConversa = async () => {
    try {
      const conversa = await api.agents.createConversation({
        agent_name: "assistente_vendas",
        metadata: { name: "Assistente de Vendas", description: "Conversa com agente especializado em SPIN Selling" },
      });
      setConversacaoId(conversa.id);
      setMessages(conversa.messages || []);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao iniciar conversa");
    }
  };

  const enviarMensagem = async () => {
    if (!mensagem.trim() || !conversacaoId || enviando) return;
    setEnviando(true);
    const textoMensagem = mensagem;
    setMensagem("");
    try {
      const conversa = await api.agents.getConversation(conversacaoId);
      await api.agents.addMessage(conversa, { role: "user", content: textoMensagem });
    } catch (error) {
      console.error(error);
      toast.error("Erro ao enviar mensagem");
      setEnviando(false);
      setMensagem(textoMensagem);
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !conversacaoId) return;
    const isAudio = file.type.startsWith('audio/') || file.name.match(/\.(mp3|mp4|m4a|wav|ogg)$/i);
    setUploadando(true);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      if (isAudio) {
        toast.info("Transcrevendo áudio, aguarde...");
        const { data } = await api.functions.invoke('transcreverAudio', { file_url });
        if (data.sucesso && data.transcricao) {
          const conversa = await api.agents.getConversation(conversacaoId);
          await api.agents.addMessage(conversa, { role: "user", content: `Analise esta transcrição de ligação:\n\n${data.transcricao}` });
          toast.success("Áudio transcrito e enviado!");
        } else {
          toast.error("Erro ao transcrever áudio");
        }
      } else {
        const conversa = await api.agents.getConversation(conversacaoId);
        await api.agents.addMessage(conversa, { role: "user", content: `Analise este arquivo (transcrição de ligação ou material de treinamento):`, file_urls: [file_url] });
        toast.success("Arquivo enviado!");
      }
    } catch (error) {
      console.error(error);
      const errorMessage = error?.message || "";
      if (errorMessage.includes("Unsupported file type")) toast.error("Tipo de arquivo não suportado.");
      else if (errorMessage.includes("muito grande") || errorMessage.includes("25MB")) toast.error("Arquivo muito grande. Limite: 25MB");
      else toast.error(`Erro: ${errorMessage || "Tente novamente"}`);
    } finally {
      setUploadando(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const novaConversa = () => {
    setConversacaoId(null);
    setMessages([]);
    criarConversa();
  };

  const calcularDiasUteis = () => {
    const inicio = startOfMonth(new Date());
    const fim = endOfMonth(new Date());
    const todosDias = eachDayOfInterval({ start: inicio, end: fim });
    return todosDias.filter(dia => !isWeekend(dia)).length;
  };

  const calcularEstatisticasSDR = (email) => {
    const analises = analisesIA.filter(a => a.sdr_email === email && a.observacao?.includes("🤖 ANÁLISE IA"));
    const diasComAnalise = new Set(analises.map(a => format(new Date(a.created_date), "yyyy-MM-dd"))).size;
    const diasUteis = calcularDiasUteis();
    const utilizacao = diasUteis > 0 ? (diasComAnalise / diasUteis) * 100 : 0;
    return { totalAnalises: analises.length, diasComAnalise, diasUteis, utilizacao: Math.round(utilizacao), analises: analises.slice(0, 10) };
  };

  const sdrs = usuarios.filter(u => u.role !== "admin");
  const analisesExibir = sdrSelecionado === "todos"
    ? analisesIA.filter(a => a.observacao?.includes("🤖 ANÁLISE IA"))
    : analisesIA.filter(a => a.sdr_email === sdrSelecionado && a.observacao?.includes("🤖 ANÁLISE IA"));

  const quickActions = [
    { label: "Análise de Ligações", icon: MessageCircle, borderColor: "border-[hsl(199_89%_60%/0.25)]", bg: "from-[hsl(199_89%_60%/0.10)]", hoverBorder: "hover:border-[hsl(199_89%_60%/0.55)]", hoverShadow: "hover:shadow-[0_18px_40px_-16px_hsl(199_89%_60%/0.45)]", iconBg: "bg-[hsl(199_89%_60%/0.15)] border-[hsl(199_89%_60%/0.30)]", iconColor: "text-[hsl(199_89%_75%)]", glowBg: "bg-[hsl(199_89%_60%/0.20)]" },
    { label: "Scripts & Manuais", icon: FileText, borderColor: "border-[hsl(262_83%_70%/0.25)]", bg: "from-[hsl(262_83%_70%/0.10)]", hoverBorder: "hover:border-[hsl(262_83%_70%/0.55)]", hoverShadow: "hover:shadow-[0_18px_40px_-16px_hsl(262_83%_70%/0.45)]", iconBg: "bg-[hsl(262_83%_70%/0.15)] border-[hsl(262_83%_70%/0.30)]", iconColor: "text-[hsl(262_83%_85%)]", glowBg: "bg-[hsl(262_83%_70%/0.20)]" },
    { label: "Treinamento", icon: Sparkles, borderColor: "border-[hsl(160_84%_55%/0.25)]", bg: "from-[hsl(160_84%_55%/0.10)]", hoverBorder: "hover:border-[hsl(160_84%_55%/0.55)]", hoverShadow: "hover:shadow-[0_18px_40px_-16px_hsl(160_84%_55%/0.45)]", iconBg: "bg-[hsl(160_84%_55%/0.15)] border-[hsl(160_84%_55%/0.30)]", iconColor: "text-[hsl(160_84%_70%)]", glowBg: "bg-[hsl(160_84%_55%/0.20)]" },
    { label: "Feedback IA", icon: Briefcase, borderColor: "border-[hsl(35_92%_60%/0.25)]", bg: "from-[hsl(35_92%_60%/0.10)]", hoverBorder: "hover:border-[hsl(35_92%_60%/0.55)]", hoverShadow: "hover:shadow-[0_18px_40px_-16px_hsl(35_92%_60%/0.45)]", iconBg: "bg-[hsl(35_92%_60%/0.15)] border-[hsl(35_92%_60%/0.30)]", iconColor: "text-[hsl(35_92%_70%)]", glowBg: "bg-[hsl(35_92%_60%/0.20)]" },
  ];

  const suggestions = [
    { icon: MessageCircle, label: "Analisar ligação recente", prompt: "Analise minha última ligação e dê feedback" },
    { icon: FileText, label: "Criar script de prospecção", prompt: "Crie um script SPIN para prospecção" },
    { icon: Sparkles, label: "Melhorar conversão", prompt: "Como melhorar minha taxa de conversão?" },
    { icon: Bot, label: "Aprender SPIN Selling", prompt: "Explique a metodologia SPIN Selling" },
  ];

  return (
    <div
      className="min-h-screen w-full flex flex-col gap-6 px-6 py-6"
      style={{
        background: "radial-gradient(ellipse 1200px 800px at 20% -10%, hsl(199 89% 60% / 0.10), transparent 60%), radial-gradient(ellipse 900px 600px at 90% 10%, hsl(262 83% 70% / 0.08), transparent 55%), linear-gradient(180deg, hsl(222 47% 4%), hsl(222 47% 6%))"
      }}
    >
      {/* ── Header ── */}
      <div className="relative rounded-2xl border border-[hsl(222_30%_18%)] bg-gradient-to-br from-[hsl(222_40%_10%)] to-[hsl(222_47%_7%)] p-6 overflow-hidden">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[hsl(199_89%_60%/0.15)] blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-[hsl(262_83%_70%/0.10)] blur-3xl pointer-events-none" />
        <div className="relative flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[hsl(199_89%_60%/0.20)] to-[hsl(262_83%_70%/0.20)] border border-[hsl(199_89%_60%/0.30)] flex items-center justify-center shadow-[0_0_24px_-4px_hsl(199_89%_60%/0.4)] flex-shrink-0">
            <Briefcase className="h-6 w-6 text-[hsl(199_89%_75%)]" />
          </div>
          <div>
            <h1
              className="text-3xl font-bold tracking-tight bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, hsl(210 40% 98%) 0%, hsl(199 89% 75%) 60%, hsl(262 83% 80%) 100%)" }}
            >
              Assistente de Vendas IA
            </h1>
            <p className="mt-1 text-sm text-[hsl(215_20%_70%)]">
              Especialista em SPIN Selling, treinamento e análise de performance
            </p>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="chat" className="flex flex-col gap-4 flex-1">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList className="inline-flex p-1 rounded-xl bg-[hsl(222_47%_7%)] border border-[hsl(222_30%_18%)] gap-1 h-auto">
            <TabsTrigger
              value="chat"
              className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 data-[state=active]:bg-gradient-to-br data-[state=active]:from-[hsl(222_40%_14%)] data-[state=active]:to-[hsl(222_35%_10%)] data-[state=active]:text-white data-[state=active]:shadow-[0_0_0_1px_hsl(199_89%_60%/0.25),0_8px_20px_-8px_hsl(199_89%_60%/0.35)] data-[state=inactive]:text-[hsl(215_20%_70%)] data-[state=inactive]:hover:text-white data-[state=inactive]:hover:bg-[hsl(222_35%_12%)] transition-all duration-250"
            >
              <MessageCircle className="w-4 h-4" />
              Chat
            </TabsTrigger>
            {isGestorOrAdmin && (
              <TabsTrigger
                value="gestao"
                className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 data-[state=active]:bg-gradient-to-br data-[state=active]:from-[hsl(222_40%_14%)] data-[state=active]:to-[hsl(222_35%_10%)] data-[state=active]:text-white data-[state=active]:shadow-[0_0_0_1px_hsl(199_89%_60%/0.25),0_8px_20px_-8px_hsl(199_89%_60%/0.35)] data-[state=inactive]:text-[hsl(215_20%_70%)] data-[state=inactive]:hover:text-white data-[state=inactive]:hover:bg-[hsl(222_35%_12%)] transition-all duration-250"
              >
                <Users className="w-4 h-4" />
                Gestão de Equipe
              </TabsTrigger>
            )}
          </TabsList>

          <button
            onClick={novaConversa}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-br from-[hsl(199_89%_60%/0.15)] to-[hsl(262_83%_70%/0.12)] border border-[hsl(199_89%_60%/0.30)] hover:border-[hsl(199_89%_60%/0.55)] hover:shadow-[0_0_24px_-6px_hsl(199_89%_60%/0.5)] transition-all duration-250"
          >
            <Sparkles className="w-4 h-4" />
            Nova Conversa
          </button>
        </div>

        {/* ── TAB CHAT ── */}
        <TabsContent value="chat" className="flex flex-col gap-5 flex-1 mt-0">
          {/* Quick Actions */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map(({ label, icon: Icon, borderColor, bg, hoverBorder, hoverShadow, iconBg, iconColor, glowBg }) => (
              <div
                key={label}
                className={cn(
                  "group relative overflow-hidden rounded-xl border bg-gradient-to-br to-[hsl(222_47%_7%)] p-4 cursor-pointer hover:-translate-y-0.5 transition-all duration-250",
                  borderColor, bg, hoverBorder, hoverShadow
                )}
              >
                <div className={cn("absolute -top-10 -right-10 h-24 w-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity", glowBg)} />
                <div className={cn("h-9 w-9 rounded-lg border flex items-center justify-center", iconBg)}>
                  <Icon className={cn("w-4 h-4", iconColor)} />
                </div>
                <p className="mt-3 text-sm font-semibold text-white">{label}</p>
              </div>
            ))}
          </div>

          {/* Chat Panel */}
          <div className="flex-1 flex flex-col rounded-2xl border border-[hsl(222_30%_18%)] bg-gradient-to-b from-[hsl(222_40%_10%)] to-[hsl(222_47%_6%)] overflow-hidden shadow-[0_1px_0_0_hsl(0_0%_100%/0.04)_inset,0_18px_50px_-20px_hsl(222_60%_2%/0.7)] min-h-[500px]">
            {/* Chat Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[hsl(222_25%_14%)] bg-[hsl(222_40%_8%)]">
              <div className="flex items-center gap-2.5 text-sm font-semibold text-white">
                <Briefcase className="h-4 w-4 text-[hsl(199_89%_75%)]" />
                Chat com Assistente
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[hsl(160_84%_55%/0.12)] border border-[hsl(160_84%_55%/0.35)] text-[hsl(160_84%_70%)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[hsl(160_84%_55%)] shadow-[0_0_8px_hsl(160_84%_55%/0.8)] animate-pulse" />
                Online
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-5" ref={scrollRef}>
              <div className="space-y-4">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[hsl(199_89%_60%/0.15)] to-[hsl(262_83%_70%/0.15)] border border-[hsl(199_89%_60%/0.25)] flex items-center justify-center mb-5 shadow-[0_0_40px_-8px_hsl(199_89%_60%/0.4)]">
                      <Bot className="h-8 w-8 text-[hsl(199_89%_75%)]" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">
                      Olá, {resolveDisplayName(user, null)?.split(" ")[0] || ""}! 👋
                    </h3>
                    <p className="mt-2 max-w-md text-sm text-[hsl(215_20%_70%)] leading-relaxed">
                      Sou seu assistente especializado em vendas SPIN Selling. Posso ajudar com análises, treinamentos, scripts e muito mais.
                    </p>
                    <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
                      {suggestions.map(({ icon: Icon, label, prompt }) => (
                        <button
                          key={label}
                          onClick={() => setMensagem(prompt)}
                          className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm text-[hsl(215_20%_75%)] bg-[hsl(222_35%_10%)] border border-[hsl(222_25%_16%)] hover:border-[hsl(199_89%_60%/0.45)] hover:bg-[hsl(222_40%_12%)] hover:text-white hover:shadow-[0_0_24px_-8px_hsl(199_89%_60%/0.4)] transition-all duration-250 text-left"
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, idx) => (
                  <div key={idx} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-lg bg-[hsl(199_89%_60%/0.15)] border border-[hsl(199_89%_60%/0.25)] flex items-center justify-center flex-shrink-0 mt-1">
                        <Bot className="w-4 h-4 text-[hsl(199_89%_75%)]" />
                      </div>
                    )}
                    <div className={cn(
                      "max-w-[80%] rounded-xl px-4 py-3 text-sm",
                      msg.role === "user"
                        ? "bg-gradient-to-br from-[hsl(199_89%_60%)] to-[hsl(217_91%_55%)] text-white shadow-[0_8px_20px_-6px_hsl(199_89%_60%/0.4)]"
                        : "bg-[hsl(222_40%_10%)] border border-[hsl(222_25%_16%)] text-[hsl(210_40%_90%)]"
                    )}>
                      {msg.role === "assistant" ? (
                        <ReactMarkdown
                          className="prose prose-invert prose-sm max-w-none"
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
                            li: ({ children }) => <li className="mb-1">{children}</li>,
                            strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                            code: ({ inline, children }) =>
                              inline ? (
                                <code className="bg-[hsl(222_47%_6%)] px-1 py-0.5 rounded text-[hsl(199_89%_75%)]">{children}</code>
                              ) : (
                                <code className="block bg-[hsl(222_47%_6%)] p-2 rounded my-2">{children}</code>
                              ),
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      ) : (
                        <p>{msg.content}</p>
                      )}
                    </div>
                    {msg.role === "user" && (
                      <div className="w-8 h-8 rounded-lg bg-[hsl(222_35%_14%)] border border-[hsl(222_25%_20%)] flex items-center justify-center flex-shrink-0 mt-1">
                        <User className="w-4 h-4 text-[hsl(215_20%_70%)]" />
                      </div>
                    )}
                  </div>
                ))}

                {enviando && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-8 h-8 rounded-lg bg-[hsl(199_89%_60%/0.15)] border border-[hsl(199_89%_60%/0.25)] flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-[hsl(199_89%_75%)]" />
                    </div>
                    <div className="bg-[hsl(222_40%_10%)] border border-[hsl(222_25%_16%)] rounded-xl px-4 py-3">
                      <Loader2 className="w-4 h-4 text-[hsl(199_89%_75%)] animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Composer */}
            <div className="border-t border-[hsl(222_25%_14%)] p-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleUpload}
                accept=".txt,.pdf,.doc,.docx,.mp3,.mp4,.m4a,.wav,.ogg"
                className="hidden"
              />
              <div className="flex items-center gap-3 rounded-2xl border border-[hsl(222_30%_18%)] bg-[hsl(222_40%_8%)] px-3 py-3 focus-within:border-[hsl(199_89%_60%/0.55)] focus-within:shadow-[0_0_0_3px_hsl(199_89%_60%/0.10)] transition-all duration-250">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadando || enviando}
                  className="h-10 w-10 shrink-0 rounded-xl bg-[hsl(222_35%_12%)] border border-[hsl(222_25%_18%)] flex items-center justify-center text-[hsl(215_20%_70%)] hover:text-white hover:border-[hsl(199_89%_60%/0.45)] transition-all disabled:opacity-50"
                >
                  {uploadando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                </button>
                <textarea
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarMensagem(); }
                  }}
                  placeholder="Digite sua mensagem... (Shift+Enter para quebra de linha)"
                  className="flex-1 bg-transparent border-0 outline-none text-sm text-white placeholder:text-[hsl(215_15%_42%)] resize-none min-h-[40px] max-h-[120px]"
                  disabled={enviando || uploadando}
                  rows={1}
                />
                <button
                  onClick={enviarMensagem}
                  disabled={!mensagem.trim() || enviando || uploadando}
                  className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-[hsl(199_89%_60%)] to-[hsl(217_91%_55%)] text-white flex items-center justify-center shadow-[0_8px_20px_-6px_hsl(199_89%_60%/0.55)] hover:shadow-[0_12px_28px_-6px_hsl(199_89%_60%/0.7)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              <p className="mt-2 px-1 text-xs text-[hsl(215_15%_55%)] flex items-center gap-1.5">
                💡 Dica: Envie áudios de ligações (MP3, MP4, M4A) ou transcrições (TXT, PDF, DOC) para análise
              </p>
            </div>
          </div>
        </TabsContent>

        {/* ── TAB GESTÃO DE EQUIPE ── */}
        {isGestorOrAdmin && (
          <TabsContent value="gestao" className="flex flex-col gap-5 mt-0">
            {/* Filtros */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1 grid grid-cols-3 gap-4 min-w-0">
                <Select value={sdrSelecionado} onValueChange={setSdrSelecionado}>
                  <SelectTrigger className="bg-[hsl(222_40%_8%)] border-[hsl(222_30%_18%)] text-white">
                    <SelectValue placeholder="Filtrar por vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Vendedores</SelectItem>
                    {sdrs.map(sdr => (
                      <SelectItem key={sdr.id} value={sdr.email}>{sdr.full_name || sdr.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filtroRole} onValueChange={setFiltroRole}>
                  <SelectTrigger className="bg-[hsl(222_40%_8%)] border-[hsl(222_30%_18%)] text-white">
                    <SelectValue placeholder="Filtrar por função" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as Funções</SelectItem>
                    <SelectItem value="sdr">SDR</SelectItem>
                    <SelectItem value="closer">Closer</SelectItem>
                    <SelectItem value="gestor">Gestor</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filtroEquipe} onValueChange={setFiltroEquipe}>
                  <SelectTrigger className="bg-[hsl(222_40%_8%)] border-[hsl(222_30%_18%)] text-white">
                    <SelectValue placeholder="Filtrar por equipe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as Equipes</SelectItem>
                    {equipes.map(equipe => (
                      <SelectItem key={equipe.id} value={equipe.nome}>{equipe.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(222_25%_18%)] bg-[hsl(222_40%_8%)] text-xs text-[hsl(215_20%_70%)]">
                <Calendar className="w-3 h-3" />
                {calcularDiasUteis()} dias úteis este mês
              </div>
            </div>

            {/* Colaboradores */}
            <div className="space-y-2">
              {(sdrSelecionado === "todos" ? sdrs : sdrs.filter(s => s.email === sdrSelecionado))
                .filter(sdr => filtroRole === "todos" || sdr.role === filtroRole)
                .filter(sdr => {
                  if (filtroEquipe === "todos") return true;
                  const equipeDoSdr = equipes.find(eq => eq.membros?.includes(sdr.email));
                  return equipeDoSdr?.nome === filtroEquipe;
                })
                .map(sdr => {
                  const stats = calcularEstatisticasSDR(sdr.email);
                  const avaliacoesDoSdr = avaliacoesProdutos.filter(av => av.usuario_email === sdr.email);
                  return (
                    <div key={sdr.id} className="rounded-xl border border-[hsl(222_30%_18%)] bg-gradient-to-br from-[hsl(222_40%_10%)] to-[hsl(222_47%_7%)] hover:border-[hsl(222_30%_24%)] transition-all p-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="w-10 h-10 flex-shrink-0">
                          <AvatarImage src={sdr.foto_perfil} alt={sdr.full_name} />
                          <AvatarFallback className="bg-[hsl(199_89%_60%/0.15)] text-[hsl(199_89%_75%)]">
                            <User className="w-5 h-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-white truncate">
                            {resolveDisplayNameFromUser(sdr)} — {sdr.role === "admin" ? "Administrador" : sdr.role === "gestor" ? "Gestor" : sdr.role === "closer" ? "Closer" : "SDR"}
                          </p>
                          <p className="text-xs text-[hsl(215_15%_55%)] truncate">{sdr.email}</p>
                        </div>
                        <div className="flex items-center gap-2 w-40">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-[hsl(215_15%_55%)]">Utilização</span>
                              <span className={cn(
                                "text-sm font-bold",
                                stats.utilizacao >= 80 ? "text-[hsl(160_84%_55%)]" :
                                stats.utilizacao >= 50 ? "text-[hsl(35_92%_60%)]" : "text-[hsl(346_84%_65%)]"
                              )}>{stats.utilizacao}%</span>
                            </div>
                            <Progress value={stats.utilizacao} className="h-1.5 bg-[hsl(222_30%_18%)]" />
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <div className="flex items-center gap-1 text-xs text-[hsl(215_15%_55%)] mb-0.5">
                              <Bot className="w-3 h-3" /><span>Análises</span>
                            </div>
                            <p className="text-lg font-bold text-white">{stats.totalAnalises}</p>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center gap-1 text-xs text-[hsl(215_15%_55%)] mb-0.5">
                              <Target className="w-3 h-3" /><span>Dias</span>
                            </div>
                            <p className="text-lg font-bold text-white">{stats.diasComAnalise}/{stats.diasUteis}</p>
                          </div>
                          {avaliacoesDoSdr.length > 0 && (
                            <div className="text-center">
                              <div className="flex items-center gap-1 text-xs text-[hsl(215_15%_55%)] mb-0.5">
                                <Award className="w-3 h-3" /><span>Avaliações</span>
                              </div>
                              <p className="text-lg font-bold text-white">{avaliacoesDoSdr.length}</p>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => { setColaboradorDetalhes(sdr); setModalDetalhesAberto(true); }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[hsl(222_25%_22%)] text-[hsl(215_20%_70%)] hover:text-white hover:border-[hsl(199_89%_60%/0.45)] hover:bg-[hsl(222_40%_12%)] transition-all flex-shrink-0"
                        >
                          Ver Detalhes
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Histórico de Análises */}
              <div className="rounded-2xl border border-[hsl(222_30%_18%)] bg-gradient-to-b from-[hsl(222_40%_10%)] to-[hsl(222_47%_6%)] overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-[hsl(222_25%_14%)]">
                  <FileText className="w-4 h-4 text-[hsl(199_89%_75%)]" />
                  <span className="text-sm font-semibold text-white flex-1">Histórico de Análises</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[hsl(199_89%_60%/0.15)] text-[hsl(199_89%_75%)]">{analisesExibir.length}</span>
                </div>
                <ScrollArea className="h-[400px] p-4">
                  <div className="space-y-3">
                    {analisesExibir.length === 0 ? (
                      <div className="text-center py-12">
                        <Bot className="w-10 h-10 text-[hsl(215_15%_40%)] mx-auto mb-3" />
                        <p className="text-sm text-[hsl(215_15%_55%)]">Nenhuma análise encontrada</p>
                      </div>
                    ) : analisesExibir.map(analise => (
                      <div key={analise.id} className="rounded-xl border border-[hsl(222_25%_16%)] bg-[hsl(222_35%_9%)] p-4">
                        <div className="flex items-start gap-3 mb-2">
                          <div className="p-1.5 bg-[hsl(199_89%_60%/0.12)] rounded-lg border border-[hsl(199_89%_60%/0.20)]">
                            <Bot className="w-3.5 h-3.5 text-[hsl(199_89%_75%)]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-medium text-white text-sm truncate">{analise.lead_nome || "Análise IA"}</span>
                              <span className="text-xs px-1.5 py-0.5 rounded bg-[hsl(222_30%_14%)] text-[hsl(215_15%_55%)] border border-[hsl(222_25%_18%)] flex-shrink-0">{resolveDisplayNameFromUser({ email: analise.sdr_email, full_name: analise.sdr_nome || analise.sdr_name })}</span>
                            </div>
                            <p className="text-xs text-[hsl(215_15%_45%)]">
                              {format(new Date(analise.created_date), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-[hsl(215_20%_70%)] whitespace-pre-line line-clamp-4">{analise.observacao}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Gerador de Scripts */}
              <div className="rounded-2xl border border-[hsl(222_30%_18%)] bg-gradient-to-b from-[hsl(222_40%_10%)] to-[hsl(222_47%_6%)] overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-[hsl(222_25%_14%)]">
                  <Wand2 className="w-4 h-4 text-[hsl(262_83%_80%)]" />
                  <span className="text-sm font-semibold text-white">Gerador de Scripts Inteligente</span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="rounded-xl border border-[hsl(262_83%_70%/0.25)] bg-[hsl(262_83%_70%/0.08)] p-3">
                    <p className="text-sm text-[hsl(262_83%_85%)]">
                      Selecione um lead para gerar scripts personalizados baseados no perfil e produto de interesse
                    </p>
                  </div>
                  <ScrollArea className="h-[340px]">
                    <div className="space-y-2 pr-2">
                      {leads.map(lead => (
                        <div
                          key={lead.id}
                          onClick={() => { setLeadSelecionado(lead); setModalScriptAberto(true); }}
                          className="rounded-xl border border-[hsl(222_25%_16%)] bg-[hsl(222_35%_9%)] hover:border-[hsl(262_83%_70%/0.45)] hover:bg-[hsl(222_40%_11%)] p-3 cursor-pointer transition-all"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-white text-sm truncate">{lead.nome}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-xs px-1.5 py-0.5 rounded border border-[hsl(222_25%_18%)] text-[hsl(215_15%_55%)]">{lead.empresa || "Sem empresa"}</span>
                                {lead.produto_interesse_nome && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-[hsl(262_83%_70%/0.12)] border border-[hsl(262_83%_70%/0.25)] text-[hsl(262_83%_85%)]">{lead.produto_interesse_nome}</span>
                                )}
                              </div>
                            </div>
                            <Wand2 className="w-4 h-4 text-[hsl(262_83%_80%)] flex-shrink-0" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {leadSelecionado && (
        <GerarScriptModal
          open={modalScriptAberto}
          onClose={() => { setModalScriptAberto(false); setLeadSelecionado(null); }}
          lead={leadSelecionado}
        />
      )}

      <DetalhesColaboradorModal
        open={modalDetalhesAberto}
        onClose={() => { setModalDetalhesAberto(false); setColaboradorDetalhes(null); }}
        colaborador={colaboradorDetalhes}
      />
    </div>
  );
}