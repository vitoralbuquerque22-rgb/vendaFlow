import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, Loader2, Trophy, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function QuizAvaliacaoModal({ open, onClose, produto, onAvaliar }) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [respostas, setRespostas] = useState({});
  const [showResult, setShowResult] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);

  const quiz = produto?.manual?.quiz_avaliacao || [];

  const handleResposta = (index) => {
    setRespostas({ ...respostas, [currentQuestion]: index });
  };

  const proximaPergunta = () => {
    if (currentQuestion < quiz.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const voltarPergunta = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const finalizarQuiz = async () => {
    setLoading(true);

    const respostasArray = quiz.map((q, i) => ({
      pergunta: q.pergunta,
      resposta_usuario: respostas[i],
      resposta_correta: q.resposta_correta,
      acertou: respostas[i] === q.resposta_correta,
    }));

    const acertos = respostasArray.filter((r) => r.acertou).length;
    const nota = (acertos / quiz.length) * 10;
    const aprovado = nota >= 7.0;

    const dadosAvaliacao = {
      respostas: respostasArray,
      acertos,
      nota: parseFloat(nota.toFixed(1)),
      aprovado,
    };

    setResultado(dadosAvaliacao);
    setShowResult(true);
    setLoading(false);

    // Salvar avaliação
    await onAvaliar(dadosAvaliacao);
  };

  const reiniciarQuiz = () => {
    setCurrentQuestion(0);
    setRespostas({});
    setShowResult(false);
    setResultado(null);
  };

  if (!quiz.length) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Avaliação do Produto</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center">
            <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <p className="text-slate-400">Quiz de avaliação não disponível para este produto.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">
            Avaliação do Produto - {produto?.nome}
          </DialogTitle>
          {!showResult && (
            <p className="text-slate-400 text-sm">
              Pergunta {currentQuestion + 1} de {quiz.length}
            </p>
          )}
        </DialogHeader>

        <AnimatePresence mode="wait">
          {!showResult ? (
            <motion.div
              key={currentQuestion}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Barra de progresso */}
              <div className="w-full bg-slate-800 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentQuestion + 1) / quiz.length) * 100}%` }}
                />
              </div>

              {/* Pergunta */}
              <Card className="bg-slate-800 border-slate-700 p-6">
                <p className="text-white text-lg font-medium mb-6">
                  {quiz[currentQuestion]?.pergunta}
                </p>

                <RadioGroup
                  value={String(respostas[currentQuestion])}
                  onValueChange={(v) => handleResposta(parseInt(v))}
                >
                  {quiz[currentQuestion]?.opcoes?.map((opcao, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex items-center space-x-3 p-4 rounded-lg border transition-all cursor-pointer",
                        respostas[currentQuestion] === index
                          ? "bg-blue-500/20 border-blue-500/50"
                          : "bg-slate-700/30 border-slate-600 hover:border-slate-500"
                      )}
                      onClick={() => handleResposta(index)}
                    >
                      <RadioGroupItem value={String(index)} id={`q${currentQuestion}-${index}`} />
                      <Label
                        htmlFor={`q${currentQuestion}-${index}`}
                        className="text-slate-300 cursor-pointer flex-1"
                      >
                        {opcao}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </Card>

              {/* Navegação */}
              <div className="flex justify-between items-center pt-4">
                <Button
                  variant="ghost"
                  onClick={voltarPergunta}
                  disabled={currentQuestion === 0}
                  className="text-slate-400"
                >
                  Voltar
                </Button>

                {currentQuestion === quiz.length - 1 ? (
                  <Button
                    onClick={finalizarQuiz}
                    disabled={respostas[currentQuestion] === undefined || loading}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Finalizar Avaliação
                  </Button>
                ) : (
                  <Button
                    onClick={proximaPergunta}
                    disabled={respostas[currentQuestion] === undefined}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Próxima
                  </Button>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6 py-4"
            >
              {/* Resultado */}
              <div className="text-center">
                <div
                  className={cn(
                    "w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center",
                    resultado.aprovado
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-rose-500/20 text-rose-400"
                  )}
                >
                  {resultado.aprovado ? (
                    <Trophy className="w-10 h-10" />
                  ) : (
                    <XCircle className="w-10 h-10" />
                  )}
                </div>
                <h3
                  className={cn(
                    "text-2xl font-bold mb-2",
                    resultado.aprovado ? "text-emerald-400" : "text-rose-400"
                  )}
                >
                  {resultado.aprovado ? "Aprovado!" : "Não Aprovado"}
                </h3>
                <p className="text-slate-400 mb-4">
                  Você acertou {resultado.acertos} de {quiz.length} perguntas
                </p>
                <div className="text-4xl font-bold text-white mb-2">
                  {resultado.nota.toFixed(1)}
                </div>
                <p className="text-slate-500 text-sm">Nota final</p>
              </div>

              {/* Respostas detalhadas */}
              <Card className="bg-slate-800 border-slate-700 p-4 max-h-60 overflow-y-auto">
                <h4 className="text-white font-medium mb-3">Suas Respostas:</h4>
                <div className="space-y-3">
                  {resultado.respostas.map((r, i) => (
                    <div
                      key={i}
                      className={cn(
                        "p-3 rounded-lg border",
                        r.acertou
                          ? "bg-emerald-500/10 border-emerald-500/30"
                          : "bg-rose-500/10 border-rose-500/30"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {r.acertou ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="text-slate-300 text-sm font-medium">{r.pergunta}</p>
                          {!r.acertou && (
                            <p className="text-xs text-slate-500 mt-1">
                              Resposta correta: {quiz[i].opcoes[r.resposta_correta]}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Ações */}
              <div className="flex gap-3 pt-4">
                {!resultado.aprovado && (
                  <Button
                    onClick={reiniciarQuiz}
                    variant="outline"
                    className="flex-1 border-slate-700 text-slate-300"
                  >
                    Tentar Novamente
                  </Button>
                )}
                <Button onClick={onClose} className="flex-1 bg-blue-600 hover:bg-blue-700">
                  Fechar
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}