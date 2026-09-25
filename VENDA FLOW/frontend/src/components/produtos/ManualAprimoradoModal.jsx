import { useState } from "react";
import { api } from "@/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import { 
  BookOpen, 
  Download, 
  Printer, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Sparkles,
  Loader2,
  Trophy,
  ImageIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import QuizAvaliacaoModal from "./QuizAvaliacaoModal";

export default function ManualAprimoradoModal({ open, onClose, produto }) {
  const [tab, setTab] = useState("manual");
  const [quizAberto, setQuizAberto] = useState(false);
  const [gerandoPDF, setGerandoPDF] = useState(false);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.auth.me(),
  });

  const { data: minhaAvaliacao } = useQuery({
    queryKey: ["avaliacao-produto", produto?.id, user?.email],
    queryFn: async () => {
      const avaliacoes = await api.entities.AvaliacaoProduto.filter({
        produto_id: produto.id,
        usuario_email: user.email,
      });
      return avaliacoes[0];
    },
    enabled: open && !!produto?.id && !!user?.email,
  });

  const salvarAvaliacaoMutation = useMutation({
    mutationFn: (dados) =>
      api.entities.AvaliacaoProduto.create({
        produto_id: produto.id,
        produto_nome: produto.nome,
        usuario_email: user.email,
        usuario_nome: user.full_name,
        ...dados,
        total_perguntas: produto.manual.quiz_avaliacao.length,
        data_avaliacao: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["avaliacao-produto"] });
      toast.success("Avaliação registrada com sucesso!");
    },
  });

  const gerarPDFApresentacao = async () => {
    setGerandoPDF(true);
    toast.info("Gerando PDF de apresentação...");

    try {
      const prompt = `
Você é um designer de apresentações comerciais.

Crie um conteúdo de apresentação em HTML para o produto:

**Nome:** ${produto.nome}
**Descrição:** ${produto.descricao}
**Valor:** ${produto.valor ? `R$ ${produto.valor}` : ""}
**ICP:** ${produto.icp}

Use as seguintes imagens do produto:
${produto.imagens?.map((img, i) => `- Imagem ${i + 1}: ${img}`).join("\n") || "Nenhuma imagem disponível"}

Manual do Produto:
${produto.manual.conteudo}

---

Crie uma apresentação comercial VISUAL e PERSUASIVA com:
- Capa impactante
- Problema que resolve
- Benefícios com ícones/bullets
- Diferenciais competitivos
- Provas sociais (se houver)
- Gatilhos mentais (escassez, urgência, autoridade)
- Preço e garantias
- Call-to-action final

Use HTML/CSS inline, design moderno, cores atrativas, e inclua as imagens fornecidas.
Retorne APENAS o HTML completo, pronto para converter em PDF.
`;

      const htmlContent = await api.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: false,
      });

      // TODO: Converter HTML em PDF e fazer upload
      // Por enquanto, vamos simular
      toast.success("PDF gerado! (simulação)");
    } catch (error) {
      toast.error("Erro ao gerar PDF");
    } finally {
      setGerandoPDF(false);
    }
  };

  if (!produto?.manual?.gerado) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-400" />
              Manual do Produto - {produto?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="py-12 text-center">
            <BookOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Manual não gerado</h3>
            <p className="text-slate-400">
              O manual comercial deste produto ainda não foi gerado.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const conteudo = produto.manual.conteudo || "";
  const perguntas = produto.manual.perguntas_spin || {};
  const quiz = produto.manual.quiz_avaliacao || [];

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-[1600px] max-h-[90vh] w-[98vw]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-400" />
                  Manual do Produto - {produto.nome}
                </DialogTitle>
                <p className="text-slate-400 text-sm mt-1">
                  Gerado em{" "}
                  {new Date(produto.manual.data_geracao).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex items-center gap-2 mt-4">
            {minhaAvaliacao ? (
              <Badge
                className={
                  minhaAvaliacao.aprovado
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-rose-500/20 text-rose-400"
                }
              >
                {minhaAvaliacao.aprovado ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Aprovado ({minhaAvaliacao.nota})
                  </>
                ) : (
                  <>
                    <XCircle className="w-3 h-3 mr-1" />
                    Não Aprovado ({minhaAvaliacao.nota})
                  </>
                )}
              </Badge>
            ) : (
              <Badge className="bg-amber-500/20 text-amber-400">
                Avaliação Pendente
              </Badge>
            )}
          </div>

          <Tabs value={tab} onValueChange={setTab} className="mt-4">
            <TabsList className="bg-slate-800 w-1/2 h-10">
              <TabsTrigger value="manual" className="flex-1 text-sm py-1.5">
                <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                Manual Completo
              </TabsTrigger>
              <TabsTrigger value="perguntas" className="flex-1 text-sm py-1.5">
                <FileText className="w-3.5 h-3.5 mr-1.5" />
                Perguntas SPIN
              </TabsTrigger>
              <TabsTrigger value="imagens" className="flex-1 text-sm py-1.5">
                <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                Imagens
              </TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="mt-4">
              <ScrollArea className="h-[60vh] pr-4">
                <div className="prose prose-invert prose-slate max-w-none break-words">
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => (
                        <h1 className="text-2xl font-bold text-white mb-4 mt-6 pb-2 border-b border-slate-700">
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-xl font-semibold text-white mb-3 mt-5">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-lg font-semibold text-blue-300 mb-2 mt-4">
                          {children}
                        </h3>
                      ),
                      p: ({ children }) => (
                        <p className="text-white leading-relaxed mb-3 w-[90%]">{children}</p>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc list-inside text-white space-y-1 mb-3">
                          {children}
                        </ul>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-4 bg-blue-500/10 text-white italic">
                          {children}
                        </blockquote>
                      ),
                      code: ({ inline, children }) =>
                        inline ? (
                          <code className="bg-slate-800 px-1.5 py-0.5 rounded text-blue-300 text-sm">
                            {children}
                          </code>
                        ) : (
                          <pre className="block bg-slate-800 p-4 rounded-lg text-white text-sm my-3 overflow-x-auto whitespace-pre-wrap">
                            {children}
                          </pre>
                        ),
                      strong: ({ children }) => (
                        <strong className="text-white font-bold">{children}</strong>
                      ),
                      em: ({ children }) => (
                        <em className="text-blue-300">{children}</em>
                      ),
                      li: ({ children }) => (
                        <li className="text-white">{children}</li>
                      ),
                    }}
                  >
                    {conteudo}
                  </ReactMarkdown>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="perguntas" className="mt-4">
              <ScrollArea className="h-[60vh] pr-4">
                <div className="space-y-6">
                  {Object.entries(perguntas).map(([tipo, lista]) => (
                    <div key={tipo}>
                      <h3 className="text-lg font-semibold text-white mb-3 capitalize">
                        Perguntas de {tipo}
                      </h3>
                      <ul className="space-y-2">
                       {lista.map((pergunta, i) => (
                         <li
                           key={i}
                           className="bg-slate-800 border border-slate-700 p-3 rounded-lg text-white"
                         >
                           {i + 1}. {pergunta}
                         </li>
                       ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="imagens" className="mt-4">
              <ScrollArea className="h-[60vh] pr-4">
                {produto.imagens && produto.imagens.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {produto.imagens.map((img, i) => (
                      <img
                        key={i}
                        src={img}
                        alt={`Produto ${i + 1}`}
                        className="w-full h-48 object-cover rounded-lg border border-slate-700"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <ImageIcon className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">Nenhuma imagem cadastrada</p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <div className="flex justify-between items-center pt-4 border-t border-slate-700 gap-3">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const blob = new Blob([conteudo], { type: "text/markdown" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `manual-${produto.nome.toLowerCase().replace(/\s/g, "-")}.md`;
                  a.click();
                }}
                className="border-slate-700 text-slate-300"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={gerarPDFApresentacao}
                disabled={gerandoPDF}
                className="border-slate-700 text-purple-400"
              >
                {gerandoPDF ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                Gerar PDF Cliente
              </Button>
            </div>
            <div className="flex gap-2">
              {quiz.length > 0 && !minhaAvaliacao?.aprovado && (
                <Button
                  onClick={() => setQuizAberto(true)}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Trophy className="w-4 h-4 mr-2" />
                  Fazer Avaliação
                </Button>
              )}
              <Button onClick={onClose} className="bg-slate-700 hover:bg-slate-600">
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <QuizAvaliacaoModal
        open={quizAberto}
        onClose={() => setQuizAberto(false)}
        produto={produto}
        onAvaliar={async (dados) => {
          await salvarAvaliacaoMutation.mutateAsync(dados);
          setQuizAberto(false);
        }}
      />
    </>
  );
}