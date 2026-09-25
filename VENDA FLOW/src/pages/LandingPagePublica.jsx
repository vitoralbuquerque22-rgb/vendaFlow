import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
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
import { CheckCircle, Loader2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LandingPagePublica() {
  const [slug, setSlug] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [formData, setFormData] = useState({});
  const [respostas, setRespostas] = useState({});

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const slugFromUrl = urlParams.get('slug');
    setSlug(slugFromUrl || "");
  }, []);

  const { data: landingPage, isLoading } = useQuery({
    queryKey: ["landing-page-publica", slug],
    queryFn: async () => {
      const response = await base44.functions.invoke('buscarLandingPagePublica', { slug });
      return response.data?.landingPage || null;
    },
    enabled: !!slug,
    staleTime: 300000, // 5 minutos
    refetchOnWindowFocus: false,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEnviando(true);

    try {
      await base44.functions.invoke('processarLeadLandingPage', {
        landingPageId: slug,
        formData,
        respostas,
      });

      setEnviado(true);
    } catch (error) {
      console.error(error);
      alert("Erro ao enviar formulário. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (!landingPage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <Card className="bg-slate-900/95 backdrop-blur-xl border-slate-800 max-w-md">
          <CardContent className="py-12 text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Página não encontrada</h2>
            <p className="text-slate-400">Esta landing page não existe ou está inativa.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (enviado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <Card className="bg-slate-900/95 backdrop-blur-xl border-slate-800 max-w-2xl w-full">
          <CardContent className="py-16 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/20 mb-6">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Enviado com sucesso!</h2>
            <p className="text-slate-300 text-lg mb-8">
              {landingPage.material_entrega?.mensagem_agradecimento || 
               "Obrigado! Entraremos em contato em breve."}
            </p>
            {landingPage.tipo === "diagnostico" && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
                <TrendingUp className="w-8 h-8 text-blue-400 mx-auto mb-3" />
                <p className="text-blue-300 font-medium">
                  Suas respostas foram registradas e nossa equipe irá analisar seu diagnóstico!
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-12 px-4"
      style={{ accentColor: landingPage.cor_tema }}
    >
      <div className="max-w-3xl mx-auto">
        <Card className="bg-slate-900/95 backdrop-blur-xl border-slate-800">
          <CardContent className="p-8 md:p-12">
            {/* Header */}
            <div className="text-center mb-12">
              {landingPage.imagem_destaque && (
                <img 
                  src={landingPage.imagem_destaque} 
                  alt={landingPage.titulo}
                  className="w-32 h-32 object-cover rounded-xl mx-auto mb-6"
                />
              )}
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
                {landingPage.titulo}
              </h1>
              {landingPage.descricao && (
                <p className="text-slate-300 text-lg">
                  {landingPage.descricao}
                </p>
              )}
            </div>

            {/* Formulário */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Campos Básicos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {landingPage.formulario?.campos_basicos?.includes("nome") && (
                  <div className="space-y-2">
                    <Label className="text-slate-300">Nome *</Label>
                    <Input
                      value={formData.nome || ""}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      className="bg-slate-800 border-slate-700 text-white"
                      required
                    />
                  </div>
                )}

                {landingPage.formulario?.campos_basicos?.includes("email") && (
                  <div className="space-y-2">
                    <Label className="text-slate-300">E-mail *</Label>
                    <Input
                      type="email"
                      value={formData.email || ""}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="bg-slate-800 border-slate-700 text-white"
                      required
                    />
                  </div>
                )}

                {landingPage.formulario?.campos_basicos?.includes("telefone") && (
                  <div className="space-y-2">
                    <Label className="text-slate-300">Telefone *</Label>
                    <Input
                      value={formData.telefone || ""}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                      className="bg-slate-800 border-slate-700 text-white"
                      placeholder="(11) 99999-9999"
                      required
                    />
                  </div>
                )}

                {landingPage.formulario?.campos_basicos?.includes("empresa") && (
                  <div className="space-y-2">
                    <Label className="text-slate-300">Empresa</Label>
                    <Input
                      value={formData.empresa || ""}
                      onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                )}

                {landingPage.formulario?.campos_basicos?.includes("cargo") && (
                  <div className="space-y-2">
                    <Label className="text-slate-300">Cargo</Label>
                    <Input
                      value={formData.cargo || ""}
                      onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                )}
              </div>

              {/* Perguntas do Diagnóstico */}
              {landingPage.tipo === "diagnostico" && landingPage.formulario?.perguntas_diagnostico?.length > 0 && (
                <div className="space-y-6 pt-6 border-t border-slate-700">
                  <h3 className="text-xl font-semibold text-white">Diagnóstico</h3>
                  
                  {landingPage.formulario.perguntas_diagnostico.map((pergunta, index) => (
                    <div key={index} className="space-y-3">
                      <Label className="text-slate-300 font-medium">
                        {index + 1}. {pergunta.pergunta}
                      </Label>
                      
                      {pergunta.tipo === "multipla_escolha" && (
                        <Select
                          value={respostas[index] || ""}
                          onValueChange={(value) => setRespostas({ ...respostas, [index]: value })}
                        >
                          <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                            <SelectValue placeholder="Selecione uma opção" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700">
                            {pergunta.opcoes?.map((opcao, opcaoIndex) => (
                              <SelectItem key={opcaoIndex} value={opcao}>
                                {opcao}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {pergunta.tipo === "texto" && (
                        <Textarea
                          value={respostas[index] || ""}
                          onChange={(e) => setRespostas({ ...respostas, [index]: e.target.value })}
                          className="bg-slate-800 border-slate-700 text-white min-h-[100px]"
                          placeholder="Digite sua resposta..."
                        />
                      )}

                      {pergunta.tipo === "escala" && (
                        <Select
                          value={respostas[index] || ""}
                          onValueChange={(value) => setRespostas({ ...respostas, [index]: value })}
                        >
                          <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                            <SelectValue placeholder="Selecione de 1 a 10" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700">
                            {[1,2,3,4,5,6,7,8,9,10].map((num) => (
                              <SelectItem key={num} value={num.toString()}>
                                {num}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="submit"
                disabled={enviando}
                className="w-full py-6 text-lg font-semibold"
                style={{ backgroundColor: landingPage.cor_tema }}
              >
                {enviando ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}