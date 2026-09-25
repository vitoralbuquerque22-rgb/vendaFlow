import { useState, useEffect } from "react";
import { api } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listarAtividadesPorSDR } from "@/lib/services/atividadeService";
import { listarLeadsPorSDR } from "@/lib/services/leadService";
import { listarTarefas } from "@/lib/services/tarefaService";
import { criarRelatorioPerformance, listarRelatoriosPerformance } from "@/lib/services/dashboardService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  User,
  TrendingUp,
  Calendar,
  Phone,
  Clock,
  Target,
  CheckCircle2,
  XCircle,
  Award,
  BarChart3,
  Loader2,
  Sparkles,
  FileText,
  Download,
  ListTodo,
  History,
  Eye,
  Wand2,
  Bot,
} from "lucide-react";
import GerarScriptModal from "@/components/assistente/GerarScriptModal";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { format, differenceInHours, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { jsPDF } from "jspdf";

export default function DetalhesColaboradorModal({ open, onClose, colaborador }) {
  const queryClient = useQueryClient();
  const [relatorioIA, setRelatorioIA] = useState(null);
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false);
  const [relatorioSalvo, setRelatorioSalvo] = useState(null);
  const [gerandoPDF, setGerandoPDF] = useState(false);
  const [pdiSelecionado, setPdiSelecionado] = useState(null);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [leadSelecionado, setLeadSelecionado] = useState(null);
  const [modalScriptAberto, setModalScriptAberto] = useState(false);

  const { data: atividades = [], refetch: refetchAtividades } = useQuery({
    queryKey: ["atividades-colaborador", colaborador?.email],
    queryFn: () => listarAtividadesPorSDR(null, colaborador.email),
    enabled: open && !!colaborador?.email,
  });

  const { data: leads = [], refetch: refetchLeads } = useQuery({
    queryKey: ["leads-colaborador", colaborador?.email],
    queryFn: () => listarLeadsPorSDR(null, colaborador.email),
    enabled: open && !!colaborador?.email,
  });

  const { data: avaliacoes = [], refetch: refetchAvaliacoes } = useQuery({
    queryKey: ["avaliacoes-colaborador", colaborador?.email],
    queryFn: () => api.entities.AvaliacaoProduto.filter({ usuario_email: colaborador.email }),
    enabled: open && !!colaborador?.email,
  });

  const { data: tarefas = [], refetch: refetchTarefas } = useQuery({
    queryKey: ["tarefas-colaborador", colaborador?.email],
    queryFn: () => listarTarefas(null, { apenasDoSDR: true, sdrEmail: colaborador.email }),
    enabled: open && !!colaborador?.email,
  });

  // Buscar histórico de PDIs
  const { data: historicoPDIs = [], refetch: refetchHistoricoPDIs } = useQuery({
    queryKey: ["pdis-colaborador", colaborador?.email],
    queryFn: () => api.entities.PDI.filter({ colaborador_email: colaborador.email }, "-created_date"),
    enabled: open && !!colaborador?.email,
  });

  // Buscar análises do Assistente IA relacionadas ao colaborador
  const { data: analisesIA = [], refetch: refetchAnalisesIA } = useQuery({
    queryKey: ["analises-ia-colaborador", colaborador?.email],
    queryFn: async () => {
      const analises = await listarAtividadesPorSDR(null, colaborador.email, { limit: 1000 }).then(a => a.filter(x => x.tipo === "anotacao"));
      return analises.filter(a => a.observacao?.includes("🤖 ANÁLISE IA") || a.observacao?.includes("ANÁLISE IA"));
    },
    enabled: open && !!colaborador?.email,
  });

  // Buscar leads do colaborador para geração de scripts
  const { data: leadsColaborador = [], refetch: refetchLeadsColaborador } = useQuery({
    queryKey: ["leads-colaborador-scripts", colaborador?.email],
    queryFn: () => listarLeadsPorSDR(null, colaborador.email),
    enabled: open && !!colaborador?.email,
  });

  // Buscar relatório salvo
  const mesReferencia = format(new Date(), "yyyy-MM");
  const { data: relatoriosSalvos = [], refetch: refetchRelatoriosSalvos } = useQuery({
    queryKey: ["relatorios-performance", colaborador?.email, mesReferencia],
    queryFn: () => listarRelatoriosPerformance(null).then(rs => rs.filter(r => r.colaborador_email === colaborador.email && r.mes_referencia === mesReferencia)),
    enabled: open && !!colaborador?.email,
  });

  // Calcular métricas com proteção contra dados inválidos
  const calcularMetricas = () => {
    // Garantir que sempre temos arrays válidos
    const atividadesValidas = Array.isArray(atividades) ? atividades : [];
    const leadsValidos = Array.isArray(leads) ? leads : [];
    const tarefasValidas = Array.isArray(tarefas) ? tarefas : [];

    const atividadesDoMes = atividadesValidas.filter(a => {
      try {
        if (!a?.created_date) return false;
        const data = new Date(a.created_date);
        return !isNaN(data.getTime()) && data >= startOfMonth(new Date()) && data <= endOfMonth(new Date());
      } catch {
        return false;
      }
    });

    const leadsDoMes = leadsValidos.filter(l => {
      try {
        if (!l?.created_date) return false;
        const data = new Date(l.created_date);
        return !isNaN(data.getTime()) && data >= startOfMonth(new Date()) && data <= endOfMonth(new Date());
      } catch {
        return false;
      }
    });

    const totalLigacoes = atividadesDoMes.filter(a => a?.tipo === "ligacao").length;
    const ligacoesAtendidas = atividadesDoMes.filter(a => a?.tipo === "ligacao" && a?.resultado === "atendeu").length;
    const reunioesAgendadas = atividadesDoMes.filter(a => a?.tipo === "reuniao_agendada").length;
    const reunioesRealizadas = atividadesDoMes.filter(a => a?.tipo === "reuniao_realizada").length;

    const taxaAtendimento = totalLigacoes > 0 ? (ligacoesAtendidas / totalLigacoes) * 100 : 0;
    const taxaAgendamento = leadsDoMes.length > 0 ? (reunioesAgendadas / leadsDoMes.length) * 100 : 0;
    const taxaComparecimento = reunioesAgendadas > 0 ? (reunioesRealizadas / reunioesAgendadas) * 100 : 0;

    // Tempo médio de resposta (diferença entre criação do lead e primeira atividade) em MINUTOS
    const temposResposta = leadsDoMes
      .map(lead => {
        try {
          const primeiraAtividade = atividadesValidas.find(a => a?.lead_id === lead?.id);
          if (primeiraAtividade?.created_date && lead?.created_date) {
            const dataAtividade = new Date(primeiraAtividade.created_date);
            const dataLead = new Date(lead.created_date);
            if (!isNaN(dataAtividade.getTime()) && !isNaN(dataLead.getTime())) {
              const diffMs = dataAtividade - dataLead;
              return Math.floor(diffMs / 1000 / 60); // minutos
            }
          }
        } catch {
          return null;
        }
        return null;
      })
      .filter(t => t !== null && t >= 0);

    const tempoMedioResposta = temposResposta.length > 0
      ? Math.round(temposResposta.reduce((a, b) => a + b, 0) / temposResposta.length)
      : 0;

    // Métricas de tarefas
    const tarefasDoMes = tarefasValidas.filter(t => {
      try {
        if (!t?.created_date) return false;
        const data = new Date(t.created_date);
        return !isNaN(data.getTime()) && data >= startOfMonth(new Date()) && data <= endOfMonth(new Date());
      } catch {
        return false;
      }
    });

    const tarefasConcluidas = tarefasDoMes.filter(t => t?.status === "concluida").length;
    const tarefasAtrasadas = tarefasDoMes.filter(t => t?.status === "atrasada").length;
    const tarefasPendentes = tarefasDoMes.filter(t => t?.status === "pendente").length;
    const taxaConclusao = tarefasDoMes.length > 0 ? (tarefasConcluidas / tarefasDoMes.length) * 100 : 0;

    // Garantir que todos os valores são números válidos
    const sanitize = (value) => {
      const num = Number(value);
      return isNaN(num) || !isFinite(num) ? 0 : Math.round(num);
    };

    return {
      totalLigacoes: sanitize(totalLigacoes),
      ligacoesAtendidas: sanitize(ligacoesAtendidas),
      reunioesAgendadas: sanitize(reunioesAgendadas),
      reunioesRealizadas: sanitize(reunioesRealizadas),
      taxaAtendimento: sanitize(taxaAtendimento),
      taxaAgendamento: sanitize(taxaAgendamento),
      taxaComparecimento: sanitize(taxaComparecimento),
      tempoMedioResposta: sanitize(tempoMedioResposta),
      totalLeads: sanitize(leadsDoMes.length),
      totalAtividades: sanitize(atividadesDoMes.length),
      totalTarefas: sanitize(tarefasDoMes.length),
      tarefasConcluidas: sanitize(tarefasConcluidas),
      tarefasAtrasadas: sanitize(tarefasAtrasadas),
      tarefasPendentes: sanitize(tarefasPendentes),
      taxaConclusao: sanitize(taxaConclusao),
    };
  };

  const metricas = colaborador ? calcularMetricas() : {
    totalLigacoes: 0,
    ligacoesAtendidas: 0,
    reunioesAgendadas: 0,
    reunioesRealizadas: 0,
    taxaAtendimento: 0,
    taxaAgendamento: 0,
    taxaComparecimento: 0,
    tempoMedioResposta: 0,
    totalLeads: 0,
    totalAtividades: 0,
    totalTarefas: 0,
    tarefasConcluidas: 0,
    tarefasAtrasadas: 0,
    tarefasPendentes: 0,
    taxaConclusao: 0,
  };

  const gerarRelatorioIA = async () => {
    setGerandoRelatorio(true);
    toast.info("Gerando análise de performance com IA...");

    // Refetch das análises para garantir dados atualizados
    await refetchAnalisesIA();

    try {
      const prompt = `
Você é um consultor especializado em gestão de vendas e análise de performance.

Analise a performance do vendedor ${colaborador.full_name} (${colaborador.role || "SDR"}) com base nos dados abaixo:

**MÉTRICAS DO MÊS ATUAL:**
- Total de Leads: ${metricas.totalLeads}
- Total de Atividades: ${metricas.totalAtividades}
- Total de Ligações: ${metricas.totalLigacoes}
- Ligações Atendidas: ${metricas.ligacoesAtendidas}
- Taxa de Atendimento: ${metricas.taxaAtendimento}%
- Reuniões Agendadas: ${metricas.reunioesAgendadas}
- Reuniões Realizadas: ${metricas.reunioesRealizadas}
- Taxa de Agendamento: ${metricas.taxaAgendamento}%
- Taxa de Comparecimento: ${metricas.taxaComparecimento}%
- Tempo Médio de Resposta: ${metricas.tempoMedioResposta} minutos

**TAREFAS:**
- Total de Tarefas: ${metricas.totalTarefas}
- Tarefas Concluídas: ${metricas.tarefasConcluidas}
- Tarefas Atrasadas: ${metricas.tarefasAtrasadas}
- Tarefas Pendentes: ${metricas.tarefasPendentes}
- Taxa de Conclusão: ${metricas.taxaConclusao}%

**AVALIAÇÕES DE PRODUTOS:**
${avaliacoes.length > 0 ? avaliacoes.map(av => 
  `- ${av?.produto_nome || "Produto"}: ${av?.aprovado ? "Aprovado" : "Não Aprovado"} (Nota: ${av?.nota || 0})`
).join("\n") : "Nenhuma avaliação realizada"}

**ANÁLISES DE LIGAÇÕES E COACHING (Assistente IA):**
Total de análises realizadas: ${analisesIA.length}

${analisesIA.length > 0 ? `

**🏆 MELHORES PERFORMANCES (Últimas 5):**
${analisesIA
  .filter(a => a.observacao?.toLowerCase().includes('excelente') || 
               a.observacao?.toLowerCase().includes('ótimo') ||
               a.observacao?.toLowerCase().includes('muito bem') ||
               a.observacao?.toLowerCase().includes('parabéns'))
  .slice(0, 5)
  .map(a => `\n---\nData: ${format(new Date(a.created_date), "dd/MM/yyyy", { locale: ptBR })}\nLead: ${a.lead_nome || "N/A"}\n${a.observacao}\n`)
  .join("\n") || "Nenhuma análise positiva destacada"}

**⚠️ PONTOS DE ATENÇÃO E ERROS (Últimos 5):**
${analisesIA
  .filter(a => a.observacao?.toLowerCase().includes('erro') || 
               a.observacao?.toLowerCase().includes('melhorar') ||
               a.observacao?.toLowerCase().includes('atenção') ||
               a.observacao?.toLowerCase().includes('evitar') ||
               a.observacao?.toLowerCase().includes('problema'))
  .slice(0, 5)
  .map(a => `\n---\nData: ${format(new Date(a.created_date), "dd/MM/yyyy", { locale: ptBR })}\nLead: ${a.lead_nome || "N/A"}\n${a.observacao}\n`)
  .join("\n") || "Nenhum ponto de atenção destacado"}
` : "Nenhuma análise com IA registrada"}

**HISTÓRICO DE ATIVIDADES (últimas 10):**
${atividades && atividades.length > 0 ? atividades.slice(0, 10).map(a => 
  `- ${a?.tipo || "Atividade"} (${a?.resultado || "sem resultado"}) - Lead: ${a?.lead_nome || "N/A"}`
).join("\n") : "Nenhuma atividade registrada"}

---

**GERE UM RELATÓRIO COMPLETO EM MARKDOWN COM:**

# 📊 ANÁLISE DE PERFORMANCE - ${colaborador.full_name} - ${colaborador.role === "admin" ? "Administrador" : colaborador.role === "gestor" ? "Gestor" : colaborador.role === "closer" ? "Closer" : "SDR"}

## 🎯 Resumo Executivo
[Resumo geral da performance - 2-3 parágrafos]

## 📈 Pontos Fortes
- [Lista de 3-5 pontos positivos com base nos dados]

## ⚠️ Áreas de Melhoria
- [Lista de 3-5 pontos que precisam de atenção]

## 🔍 Análise Detalhada

### Taxa de Conversão
[Análise das taxas de atendimento, agendamento e comparecimento]

### Tempo de Resposta
[Análise do tempo médio de atendimento e sugestões]

### Conhecimento de Produtos
[Análise das avaliações realizadas]

### Volume de Atividades
[Análise da quantidade e qualidade das atividades]

## 🎯 PLANO DE AÇÃO - PRÓXIMOS 30 DIAS

### Ação 1: [Título]
**Objetivo:** [O que melhorar]
**Como fazer:** [Passos práticos]
**Meta:** [Meta mensurável]

### Ação 2: [Título]
**Objetivo:** [O que melhorar]
**Como fazer:** [Passos práticos]
**Meta:** [Meta mensurável]

### Ação 3: [Título]
**Objetivo:** [O que melhorar]
**Como fazer:** [Passos práticos]
**Meta:** [Meta mensurável]

## 💡 Recomendações Gerais
[2-3 recomendações gerais para melhorar performance]

---

**Seja específico, prático e baseado nos dados reais fornecidos.**
`;

      const relatorio = await api.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: false,
      });

      setRelatorioIA(relatorio);
      
      // Salvar relatório no banco
      const relatorioData = {
        colaborador_email: colaborador.email,
        colaborador_nome: colaborador.full_name,
        mes_referencia: mesReferencia,
        metricas,
        relatorio_ia: relatorio,
        avaliacoes: avaliacoes || []
      };

      if (relatorioSalvo) {
        await api.entities.RelatorioPerformance.update(relatorioSalvo.id, relatorioData);
      } else {
        await criarRelatorioPerformance(relatorioData);
      }

      // Salvar como PDI (Plano de Desenvolvimento Individual)
      await api.entities.PDI.create({
        colaborador_email: colaborador.email,
        colaborador_nome: colaborador.full_name,
        mes_referencia: mesReferencia,
        analise_completa: relatorio,
        metricas_periodo: metricas,
        status: "em_andamento"
      });

      // Atualizar lista de PDIs
      await queryClient.invalidateQueries({ queryKey: ["pdis-colaborador", colaborador.email] });

      toast.success("Análise gerada e salva como PDI com sucesso!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao gerar análise");
    } finally {
      setGerandoRelatorio(false);
    }
  };

  const gerarPDF = async () => {
    setGerandoPDF(true);
    toast.info("Gerando PDF profissional...");

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 20;
      let yPos = margin;

      // Função auxiliar para adicionar nova página com cabeçalho e rodapé
      let currentPageNum = 1;
      const addNewPage = () => {
        addFooter(currentPageNum);
        doc.addPage();
        currentPageNum++;
        yPos = margin;
        addHeader();
        yPos = 25;
      };

      // Função para adicionar cabeçalho
      const addHeader = () => {
        doc.setFillColor(220, 38, 38);
        doc.rect(0, 0, pageWidth, 20, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("PDI - PLANO DE DESENVOLVIMENTO INDIVIDUAL", margin, 10);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text("Sistema de Gestão de Vendas - CRM Comercial", margin, 15);
      };

      // Função para adicionar rodapé com número de página
      const addFooter = (pageNum) => {
        doc.setFillColor(220, 38, 38);
        doc.rect(0, pageHeight - 10, pageWidth, 10, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`Página ${pageNum}`, pageWidth / 2, pageHeight - 4, { align: "center" });
      };

      // Cabeçalho primeira página
      addHeader();
      yPos = 25;

      // Título do processo
      doc.setFillColor(220, 38, 38);
      doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`RELATÓRIO DE PERFORMANCE - ${colaborador.full_name.toUpperCase()}`, margin + 3, yPos + 5.5);

      yPos += 12;
      doc.setTextColor(0, 0, 0);

      // 1. INFORMAÇÕES DO COLABORADOR
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("1. INFORMAÇÕES DO COLABORADOR", margin, yPos);
      yPos += 6;

      // Tabela de informações
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.5);
      
      const cargoFormatado = colaborador.role === "admin" ? "Administrador" :
                             colaborador.role === "gestor" ? "Gestor" :
                             colaborador.role === "closer" ? "Closer" : "SDR";
      const infoRows = [
        ["Nome Completo", `${colaborador.full_name} - ${cargoFormatado}`],
        ["E-mail", colaborador.email],
        ["Função", cargoFormatado],
        ["Período de Análise", format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })],
        ["Data de Emissão", format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })]
      ];

      const tableWidth = pageWidth - 2 * margin;
      const col1Width = tableWidth * 0.35;
      const col2Width = tableWidth * 0.65;

      doc.setFontSize(8);
      infoRows.forEach(([label, value]) => {
        doc.setFillColor(249, 250, 251);
        doc.rect(margin, yPos, col1Width, 6, 'FD');
        doc.setFont("helvetica", "bold");
        doc.text(label, margin + 2, yPos + 4);

        doc.setFillColor(255, 255, 255);
        doc.rect(margin + col1Width, yPos, col2Width, 6, 'FD');
        doc.setFont("helvetica", "normal");
        doc.text(String(value), margin + col1Width + 2, yPos + 4);
        yPos += 6;
      });

      yPos += 6;

      // 2. MÉTRICAS PRINCIPAIS - CARDS VISUAIS
      if (yPos > pageHeight - 100) addNewPage();
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("2. MÉTRICAS PRINCIPAIS DE PERFORMANCE", margin, yPos);
      yPos += 10;

      // Função para desenhar ícone
      const drawIcon = (type, x, y, size, color) => {
        const cx = x + size/2;
        const cy = y + size/2;
        
        doc.setDrawColor(255, 255, 255);
        doc.setFillColor(255, 255, 255);
        doc.setLineWidth(0.5);
        
        switch(type) {
          case "phone": // Telefone
            doc.roundedRect(x + 1, y + 0.5, size - 2, size - 1, 0.8, 0.8, 'S');
            doc.line(x + 1.5, y + 2, x + size - 1.5, y + 2);
            break;
          case "check": // Check
            doc.setLineWidth(0.8);
            doc.line(x + 1.5, y + size/2, x + size/2 - 0.3, y + size - 1.5);
            doc.line(x + size/2 - 0.3, y + size - 1.5, x + size - 1, y + 1);
            break;
          case "calendar": // Calendário
            doc.rect(x + 1, y + 1.5, size - 2, size - 2.5, 'S');
            doc.line(x + 1, y + 2.8, x + size - 1, y + 2.8);
            doc.line(x + 2, y + 1.5, x + 2, y + 0.8);
            doc.line(x + size - 2, y + 1.5, x + size - 2, y + 0.8);
            break;
          case "clock": // Relógio
            doc.circle(cx, cy, size/2 - 0.5, 'S');
            doc.line(cx, cy, cx, cy - 1.5);
            doc.line(cx, cy, cx + 1.2, cy);
            break;
          case "target": // Alvo
            doc.circle(cx, cy, size/2 - 0.5, 'S');
            doc.circle(cx, cy, size/3 - 0.3, 'S');
            doc.circle(cx, cy, 0.3, 'F');
            break;
          case "user": // Usuário
            doc.circle(cx, cy - 0.8, 1, 'S');
            doc.ellipse(cx, cy + 1.5, 1.8, 1.2, 'S');
            break;
          case "chart": // Gráfico de barras
            doc.rect(x + 1, y + 3, 1, 2.5, 'F');
            doc.rect(x + 2.5, y + 2, 1, 3.5, 'F');
            doc.rect(x + 4, y + 1, 1, 4.5, 'F');
            break;
        }
      };

      // Cards de métricas em grid 4x2
      const cardWidth = (pageWidth - 2 * margin - 15) / 4;
      const cardHeight = 18;
      const metricsCards = [
        { label: "Ligações", value: metricas.totalLigacoes, icon: "phone", color: [5, 150, 105] },
        { label: "Taxa Atendimento", value: `${metricas.taxaAtendimento}%`, icon: "check", color: [59, 130, 246] },
        { label: "Reuniões", value: metricas.reunioesAgendadas, icon: "calendar", color: [168, 85, 247] },
        { label: "Tempo Resposta", value: `${metricas.tempoMedioResposta}min`, icon: "clock", color: [245, 158, 11] },
        { label: "Taxa Agendamento", value: `${metricas.taxaAgendamento}%`, icon: "target", color: [239, 68, 68] },
        { label: "Taxa Comparecimento", value: `${metricas.taxaComparecimento}%`, icon: "check", color: [5, 150, 105] },
        { label: "Total Leads", value: metricas.totalLeads, icon: "user", color: [59, 130, 246] },
        { label: "Atividades", value: metricas.totalAtividades, icon: "chart", color: [34, 197, 94] }
      ];

      let cardX = margin;
      let cardY = yPos;
      
      metricsCards.forEach((card, idx) => {
        if (idx === 4) {
          cardY += cardHeight + 3;
          cardX = margin;
        }

        // Card background
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

        // Círculo de fundo colorido
        doc.setFillColor(card.color[0], card.color[1], card.color[2]);
        doc.circle(cardX + 6, cardY + 6, 2.5, 'F');

        // Desenhar ícone
        drawIcon(card.icon, cardX + 4, cardY + 4, 4, card.color);

        // Label
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "normal");
        doc.text(card.label, cardX + 3, cardY + 12);

        // Value
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.text(String(card.value), cardX + 3, cardY + 16);

        cardX += cardWidth + 5;
      });

      yPos = cardY + cardHeight + 8;

      // 3. DESEMPENHO DE TAREFAS
      if (yPos > pageHeight - 50) addNewPage();

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("3. DESEMPENHO DE TAREFAS", margin, yPos);
      yPos += 6;

      // Tabela de tarefas formatada
      const tarefasHeaders = ["MÉTRICA", "VALOR"];
      const tarefasRows = [
        ["Total de Tarefas", String(metricas.totalTarefas)],
        ["Tarefas Concluídas", String(metricas.tarefasConcluidas)],
        ["Tarefas Atrasadas", String(metricas.tarefasAtrasadas)],
        ["Tarefas Pendentes", String(metricas.tarefasPendentes)],
        ["Taxa de Conclusão", `${metricas.taxaConclusao}%`]
      ];

      // Header da tabela
      doc.setFillColor(220, 38, 38);
      doc.rect(margin, yPos, col1Width, 6, 'F');
      doc.rect(margin + col1Width, yPos, col2Width, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(tarefasHeaders[0], margin + 2, yPos + 4);
      doc.text(tarefasHeaders[1], margin + col1Width + 2, yPos + 4);
      yPos += 6;

      // Linhas da tabela
      doc.setFontSize(8);
      tarefasRows.forEach(([label, value], idx) => {
        // Coluna 1 - Label
        doc.setFillColor(idx % 2 === 0 ? 249 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 251 : 255);
        doc.setDrawColor(229, 231, 235);
        doc.rect(margin, yPos, col1Width, 5, 'FD');
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.text(label, margin + 2, yPos + 3.5);

        // Coluna 2 - Valor
        doc.setFillColor(255, 255, 255);
        doc.rect(margin + col1Width, yPos, col2Width, 5, 'FD');
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
        doc.text(value, margin + col1Width + 2, yPos + 3.5);
        yPos += 5;
      });

      yPos += 6;

      // 4. AVALIAÇÕES DE PRODUTOS
      if (avaliacoes.length > 0) {
        if (yPos > pageHeight - 60) addNewPage();

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("4. AVALIAÇÕES DE PRODUTOS", margin, yPos);
        yPos += 6;

        // Tabela de avaliações
        const avalHeaders = ["PRODUTO", "STATUS", "NOTA", "ACERTOS", "DATA"];
        const colWidths = [60, 30, 20, 25, 35];
        
        // Header
        doc.setFillColor(220, 38, 38);
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        let xPos = margin;
        avalHeaders.forEach((header, i) => {
          doc.rect(xPos, yPos, colWidths[i], 5, 'F');
          doc.text(header, xPos + 2, yPos + 3.5);
          xPos += colWidths[i];
        });
        yPos += 5;

        // Linhas
        doc.setFontSize(7);
        avaliacoes.slice(0, 8).forEach((av, idx) => {
          if (yPos > pageHeight - 15) addNewPage();

          xPos = margin;
          const rowData = [
            (av?.produto_nome || "Produto").substring(0, 25),
            av?.aprovado ? "Aprovado" : "Reprovado",
            (av?.nota || 0).toFixed(1),
            `${av?.acertos || 0}/${av?.total_perguntas || 0}`,
            av?.data_avaliacao ? format(new Date(av.data_avaliacao), "dd/MM/yy", { locale: ptBR }) : "N/A"
          ];

          rowData.forEach((data, i) => {
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(229, 231, 235);
            doc.rect(xPos, yPos, colWidths[i], 5, 'FD');
            doc.setTextColor(0, 0, 0);
            doc.setFont("helvetica", i === 0 ? "bold" : "normal");
            doc.text(String(data), xPos + 2, yPos + 3.5);
            xPos += colWidths[i];
          });
          yPos += 5;
        });

        yPos += 6;
        }

        // 5. RESUMO DE ANÁLISES - ASSISTENTE IA
        if (analisesIA.length > 0) {
          if (yPos > pageHeight - 60) addNewPage();

          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(0, 0, 0);
          doc.text("5. RESUMO DE ANÁLISES - ASSISTENTE IA", margin, yPos);
          yPos += 6;

          // Estatísticas gerais
          const melhoresAnalises = analisesIA.filter(a => 
            a.observacao?.toLowerCase().includes('excelente') || 
            a.observacao?.toLowerCase().includes('ótimo') ||
            a.observacao?.toLowerCase().includes('muito bem') ||
            a.observacao?.toLowerCase().includes('parabéns')
          );

          const pontosAtencao = analisesIA.filter(a => 
            a.observacao?.toLowerCase().includes('erro') || 
            a.observacao?.toLowerCase().includes('melhorar') ||
            a.observacao?.toLowerCase().includes('atenção') ||
            a.observacao?.toLowerCase().includes('evitar') ||
            a.observacao?.toLowerCase().includes('problema')
          );

          // Resumo em tabela compacta
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(51, 51, 51);

          const resumoData = [
            ["Total de Análises Realizadas", String(analisesIA.length)],
            ["Análises com Feedback Positivo", String(melhoresAnalises.length)],
            ["Análises com Pontos de Atenção", String(pontosAtencao.length)],
            ["Período de Análise", analisesIA.length > 0 && analisesIA[analisesIA.length - 1]?.created_date && analisesIA[0]?.created_date
              ? `${format(new Date(analisesIA[analisesIA.length - 1].created_date), "dd/MM/yy", { locale: ptBR })} a ${format(new Date(analisesIA[0].created_date), "dd/MM/yy", { locale: ptBR })}`
              : "N/A"]
          ];

          resumoData.forEach(([label, value]) => {
            doc.setFillColor(249, 250, 251);
            doc.setDrawColor(229, 231, 235);
            doc.rect(margin, yPos, col1Width, 5, 'FD');
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0, 0, 0);
            doc.text(label, margin + 2, yPos + 3.5);

            doc.setFillColor(255, 255, 255);
            doc.rect(margin + col1Width, yPos, col2Width, 5, 'FD');
            doc.setFont("helvetica", "normal");
            doc.text(value, margin + col1Width + 2, yPos + 3.5);
            yPos += 5;
          });

          yPos += 4;

          // Observação
          doc.setFontSize(7);
          doc.setTextColor(100, 116, 139);
          doc.setFont("helvetica", "italic");
          doc.text("* Detalhes completos das análises disponíveis no sistema", margin, yPos);
          yPos += 5;
          }

        // 6. ANÁLISE DE PERFORMANCE - IA
        addNewPage();

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("6. ANÁLISE DE PERFORMANCE - INTELIGÊNCIA ARTIFICIAL", margin, yPos);
        yPos += 7;

      if (relatorioIA) {
        // Limpar markdown de emojis e símbolos especiais
        const limparTexto = (texto) => {
          return texto
            .replace(/[📊🎯📈⚠️🔍💡]/g, '') // Remove emojis
            .replace(/\*\*/g, '') // Remove bold markdown
            .replace(/#{1,6}\s/g, '') // Remove # de títulos
            .trim();
        };

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        
        const linhas = relatorioIA.split('\n');
        linhas.forEach(linha => {
          if (yPos > pageHeight - 25) addNewPage();
          
          const linhaLimpa = linha.trim();
          
          // Título H1 (# )
          if (linhaLimpa.startsWith('# ')) {
            if (yPos > margin + 10) yPos += 5;
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0, 0, 0);
            const texto = limparTexto(linhaLimpa);
            doc.text(texto, margin, yPos);
            yPos += 8;
          }
          // Título H2 (##)
          else if (linhaLimpa.startsWith('## ')) {
            yPos += 3;
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(31, 41, 55);
            const texto = limparTexto(linhaLimpa);
            doc.text(texto, margin, yPos);
            yPos += 7;
          }
          // Subtítulo H3 (###)
          else if (linhaLimpa.startsWith('### ')) {
            yPos += 2;
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(55, 65, 81);
            const texto = limparTexto(linhaLimpa);
            doc.text(texto, margin, yPos);
            yPos += 6;
          }
          // Lista com bullet
          else if (linhaLimpa.startsWith('-') || linhaLimpa.startsWith('•') || linhaLimpa.startsWith('*')) {
            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(51, 51, 51);
            const textoSemBullet = limparTexto(linhaLimpa.replace(/^[-•*]\s*/, ''));
            const linhasQuebradas = doc.splitTextToSize(`  • ${textoSemBullet}`, pageWidth - 2 * margin - 5);
            linhasQuebradas.forEach(l => {
              if (yPos > pageHeight - 20) addNewPage();
              doc.text(l, margin + 2, yPos);
              yPos += 4.5;
            });
          }
          // Parágrafo normal
          else if (linhaLimpa && !linhaLimpa.startsWith('---')) {
            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(51, 51, 51);
            const textoLimpo = limparTexto(linhaLimpa);
            if (textoLimpo) {
              const linhasQuebradas = doc.splitTextToSize(textoLimpo, pageWidth - 2 * margin);
              linhasQuebradas.forEach(l => {
                if (yPos > pageHeight - 20) addNewPage();
                doc.text(l, margin, yPos);
                yPos += 4.5;
              });
              yPos += 1;
            }
          }
          // Separador ou linha vazia
          else {
            yPos += 2;
          }
        });
      }

      // 7. ASSINATURAS
      addNewPage();
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("7. ASSINATURAS", margin, yPos);
      yPos += 25;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      
      // Assinatura Colaborador (esquerda)
      const centroEsquerda = margin + 35;
      const cargoColaborador = colaborador.role === "admin" ? "Administrador" :
                               colaborador.role === "gestor" ? "Gestor" :
                               colaborador.role === "closer" ? "Closer" : "SDR";
      doc.line(margin + 10, yPos, margin + 60, yPos);
      doc.setFont("helvetica", "bold");
      doc.text(`${colaborador.full_name} - ${cargoColaborador}`, centroEsquerda, yPos + 5, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.text("Colaborador", centroEsquerda, yPos + 10, { align: "center" });

      // Assinatura Gestor (direita)
      const centroDireita = pageWidth - margin - 35;
      doc.line(pageWidth - margin - 60, yPos, pageWidth - margin - 10, yPos);
      doc.setFont("helvetica", "bold");
      doc.text("Gestor de Equipe", centroDireita, yPos + 5, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.text("Gestor", centroDireita, yPos + 10, { align: "center" });

      // Salvar PDF
      doc.save(`relatorio-performance-${colaborador.full_name.toLowerCase().replace(/\s/g, "-")}-${mesReferencia}.pdf`);
      toast.success("PDF profissional gerado com sucesso!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao gerar PDF");
    } finally {
      setGerandoPDF(false);
    }
  };

  // Resetar estado e refetch dados quando colaborador mudar
  useEffect(() => {
    if (open && colaborador?.email) {
      // Resetar estados locais
      setPdiSelecionado(null);
      setMostrarHistorico(false);
      setLeadSelecionado(null);
      setModalScriptAberto(false);
      setRelatorioIA(null);
      setRelatorioSalvo(null);
      
      // Refetch todas as queries com um pequeno delay para evitar race conditions
      setTimeout(() => {
        refetchAtividades();
        refetchLeads();
        refetchAvaliacoes();
        refetchTarefas();
        refetchHistoricoPDIs();
        refetchAnalisesIA();
        refetchLeadsColaborador();
        refetchRelatoriosSalvos();
      }, 100);
    }
  }, [open, colaborador?.email]);

  // Atualizar relatório quando dados carregarem
  useEffect(() => {
    if (open && relatoriosSalvos && relatoriosSalvos.length > 0) {
      const ultimoRelatorio = relatoriosSalvos[0];
      setRelatorioSalvo(ultimoRelatorio);
      setRelatorioIA(ultimoRelatorio.relatorio_ia);
    } else if (open) {
      setRelatorioIA(null);
      setRelatorioSalvo(null);
    }
  }, [open, relatoriosSalvos]);

  if (!colaborador) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
              <User className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <DialogTitle className="text-white text-xl">
                {colaborador.full_name} - {
                  colaborador.role === "admin" ? "Administrador" :
                  colaborador.role === "gestor" ? "Gestor" :
                  colaborador.role === "closer" ? "Closer" : "SDR"
                }
              </DialogTitle>
              <p className="text-slate-400 text-sm">{colaborador.email}</p>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6 mt-4">
            {/* Histórico de PDIs */}
            {historicoPDIs.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <History className="w-5 h-5 text-purple-400" />
                    Histórico de PDIs
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMostrarHistorico(!mostrarHistorico)}
                    className="border-slate-700 text-slate-300"
                  >
                    {mostrarHistorico ? "Ocultar" : "Ver Histórico"}
                  </Button>
                </div>

                {mostrarHistorico && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                    {historicoPDIs.slice(0, 6).map((pdi) => {
                      if (!pdi?.created_date) return null;
                      
                      return (
                        <Card key={pdi.id} className="bg-slate-800/50 border-slate-700 hover:border-purple-500/50 transition-all cursor-pointer"
                          onClick={() => {
                            setPdiSelecionado(pdi);
                            setRelatorioIA(pdi.analise_completa);
                          }}
                        >
                          <CardContent className="py-3">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-medium text-white">
                                  PDI - {format(new Date(pdi.created_date), "MMM/yyyy", { locale: ptBR })}
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                  {format(new Date(pdi.created_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </p>
                              </div>
                              <Badge className={cn(
                                "text-xs",
                                pdi.status === "concluido" ? "bg-emerald-500/20 text-emerald-400" :
                                pdi.status === "atrasado" ? "bg-rose-500/20 text-rose-400" :
                                "bg-blue-500/20 text-blue-400"
                              )}>
                                {pdi.status === "concluido" ? "Concluído" :
                                 pdi.status === "atrasado" ? "Atrasado" : "Em Andamento"}
                              </Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                            >
                              <Eye className="w-3 h-3 mr-2" />
                              Visualizar PDI
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {/* Métricas Principais */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                Métricas do Mês Atual
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Phone className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs text-slate-400">Ligações</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{metricas?.totalLigacoes || 0}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {metricas?.ligacoesAtendidas || 0} atendidas
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-slate-400">Taxa Atendimento</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{metricas?.taxaAtendimento || 0}%</p>
                    <Progress value={metricas?.taxaAtendimento || 0} className="h-1 mt-2" />
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-purple-400" />
                      <span className="text-xs text-slate-400">Reuniões</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{metricas?.reunioesAgendadas || 0}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {metricas?.reunioesRealizadas || 0} realizadas
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span className="text-xs text-slate-400">Tempo Médio Resposta</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{metricas?.tempoMedioResposta || 0}</p>
                    <p className="text-xs text-slate-500 mt-1">minutos</p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-rose-400" />
                      <span className="text-xs text-slate-400">Taxa Agendamento</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{metricas?.taxaAgendamento || 0}%</p>
                    <Progress value={metricas?.taxaAgendamento || 0} className="h-1 mt-2" />
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs text-slate-400">Comparecimento</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{metricas?.taxaComparecimento || 0}%</p>
                    <Progress value={metricas?.taxaComparecimento || 0} className="h-1 mt-2" />
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-slate-400">Total Leads</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{metricas?.totalLeads || 0}</p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-green-400" />
                      <span className="text-xs text-slate-400">Atividades</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{metricas?.totalAtividades || 0}</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Métricas de Tarefas */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <ListTodo className="w-5 h-5 text-blue-400" />
                Desempenho de Tarefas
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <ListTodo className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-slate-400">Total Tarefas</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{metricas?.totalTarefas || 0}</p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs text-slate-400">Concluídas</span>
                    </div>
                    <p className="text-2xl font-bold text-emerald-400">{metricas?.tarefasConcluidas || 0}</p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="w-4 h-4 text-rose-400" />
                      <span className="text-xs text-slate-400">Atrasadas</span>
                    </div>
                    <p className="text-2xl font-bold text-rose-400">{metricas?.tarefasAtrasadas || 0}</p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span className="text-xs text-slate-400">Pendentes</span>
                    </div>
                    <p className="text-2xl font-bold text-amber-400">{metricas?.tarefasPendentes || 0}</p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-purple-400" />
                      <span className="text-xs text-slate-400">Taxa Conclusão</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{metricas?.taxaConclusao || 0}%</p>
                    <Progress value={metricas?.taxaConclusao || 0} className="h-1 mt-2" />
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Avaliações de Produtos */}
            {avaliacoes && avaliacoes.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-purple-400" />
                  Avaliações de Produtos
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {avaliacoes.map(av => {
                    if (!av?.data_avaliacao) return null;

                    return (
                      <Card key={av.id} className="bg-slate-800/50 border-slate-700">
                        <CardContent className="py-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium text-white">{av?.produto_nome || "Produto"}</p>
                            <Badge className={cn(
                              av?.aprovado ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                            )}>
                              {av?.aprovado ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                              {av?.aprovado ? "Aprovado" : "Reprovado"}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-400">{av?.acertos || 0}/{av?.total_perguntas || 0} acertos</span>
                            <span className={cn(
                              "font-bold",
                              av?.aprovado ? "text-emerald-400" : "text-rose-400"
                            )}>
                              Nota: {(av?.nota || 0).toFixed(1)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-2">
                            {format(new Date(av.data_avaliacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Relatório IA */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  {pdiSelecionado ? `PDI - ${format(new Date(pdiSelecionado.created_date), "MMM/yyyy", { locale: ptBR })}` : 
                   relatorioIA ? "Análise de Performance - Última Gerada" : "Análise de Performance com IA"}
                </h3>
                <div className="flex gap-2">
                  {pdiSelecionado && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPdiSelecionado(null);
                        if (relatoriosSalvos && relatoriosSalvos.length > 0) {
                          const ultimoRelatorio = relatoriosSalvos[0];
                          setRelatorioSalvo(ultimoRelatorio);
                          setRelatorioIA(ultimoRelatorio.relatorio_ia);
                        } else {
                          setRelatorioIA(null);
                        }
                      }}
                      className="border-slate-700 text-slate-300"
                    >
                      Voltar para Última Análise
                    </Button>
                  )}
                  {!pdiSelecionado && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={gerarRelatorioIA}
                      disabled={gerandoRelatorio}
                      className="border-slate-700 text-slate-300"
                    >
                      {gerandoRelatorio ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      {relatorioIA ? "Gerar Nova Análise" : "Gerar Análise"}
                    </Button>
                  )}
                </div>
                </div>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="py-4">
                  {gerandoRelatorio ? (
                    <div className="text-center py-12">
                      <Loader2 className="w-12 h-12 text-blue-400 mx-auto mb-4 animate-spin" />
                      <p className="text-slate-400">Analisando dados e gerando relatório...</p>
                    </div>
                  ) : relatorioIA ? (
                    <>
                      {relatorioSalvo && !pdiSelecionado && (
                        <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                          <p className="text-blue-300 text-sm">
                            📅 Análise gerada em: {format(new Date(relatorioSalvo.created_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      )}
                      <div className="prose prose-invert prose-slate max-w-none">
                        <ReactMarkdown
                          components={{
                            h1: ({ children }) => (
                              <h1 className="text-2xl font-bold text-white mb-4 pb-2 border-b border-slate-700">
                                {children}
                              </h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="text-xl font-semibold text-white mb-3 mt-6">
                                {children}
                              </h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="text-lg font-semibold text-blue-300 mb-2 mt-4">
                                {children}
                              </h3>
                            ),
                            p: ({ children }) => (
                              <p className="text-slate-300 leading-relaxed mb-3">{children}</p>
                            ),
                            ul: ({ children }) => (
                              <ul className="list-disc list-inside text-slate-300 space-y-1 mb-3">
                                {children}
                              </ul>
                            ),
                            strong: ({ children }) => (
                              <strong className="text-white font-semibold">{children}</strong>
                            ),
                          }}
                        >
                          {relatorioIA}
                        </ReactMarkdown>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                      <p className="text-slate-400 mb-2">Nenhuma análise gerada ainda</p>
                      <p className="text-slate-500 text-sm">Clique em "Gerar Análise" para criar uma nova análise de performance</p>
                    </div>
                  )}
                  </CardContent>
                  </Card>
                  </div>

            {/* Gerador de Scripts Inteligente */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-purple-400" />
                Gerador de Scripts Inteligente
              </h3>
              <div className="space-y-3">
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mb-4">
                  <p className="text-purple-300 text-sm">
                    Selecione um lead para gerar scripts personalizados baseados no perfil e produto de interesse
                  </p>
                </div>

                {leadsColaborador.length === 0 ? (
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardContent className="py-12">
                      <div className="text-center">
                        <Wand2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-400">Nenhum lead encontrado</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto">
                    {leadsColaborador.map(lead => (
                      <Card 
                        key={lead.id}
                        className="bg-slate-800/30 border-slate-700/50 hover:border-purple-500/50 transition-all cursor-pointer"
                        onClick={() => {
                          setLeadSelecionado(lead);
                          setModalScriptAberto(true);
                        }}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-white">{lead.nome}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {lead.empresa || "Sem empresa"}
                                </Badge>
                                {lead.produto_interesse_nome && (
                                  <Badge className="text-xs bg-purple-500/20 text-purple-300">
                                    {lead.produto_interesse_nome}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Wand2 className="w-4 h-4 text-purple-400 flex-shrink-0" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                </div>
                </div>

                {/* Histórico de Análises */}
                <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                Histórico de Análises
                </h3>
                <div className="space-y-3">
                {analisesIA.length === 0 ? (
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardContent className="py-12">
                      <div className="text-center">
                        <Bot className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-400">Nenhuma análise encontrada</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  analisesIA.slice(0, 10).map(analise => {
                    if (!analise?.created_date) return null;
                    
                    return (
                      <Card key={analise.id} className="bg-slate-800/30 border-slate-700/50">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="p-2 bg-blue-500/20 rounded-lg">
                              <Bot className="w-4 h-4 text-blue-400" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-white">{analise?.lead_nome || "Análise IA"}</span>
                              </div>
                              <p className="text-xs text-slate-500">
                                {format(new Date(analise.created_date), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                          <div className="text-sm text-slate-300 whitespace-pre-line line-clamp-4">
                            {analise?.observacao || ""}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
                </div>
                </div>
                </div>
                </ScrollArea>

            <div className="flex justify-between pt-4 border-t border-slate-700">
            <Button
            onClick={gerarPDF}
            disabled={gerandoPDF || !relatorioIA}
            className="bg-blue-600 hover:bg-blue-700"
            >
            {gerandoPDF ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Baixar PDF
            </Button>
            <Button onClick={onClose} className="bg-slate-700 hover:bg-slate-600">
            Fechar
            </Button>
            </div>
            </DialogContent>

            {/* Modal de Geração de Scripts */}
            {leadSelecionado && (
            <GerarScriptModal
            open={modalScriptAberto}
            onClose={() => {
            setModalScriptAberto(false);
            setLeadSelecionado(null);
            }}
            lead={leadSelecionado}
            />
            )}
            </Dialog>
            );
            }