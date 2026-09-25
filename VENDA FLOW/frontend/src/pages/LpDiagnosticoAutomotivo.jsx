import { useState } from "react";
import { CheckCircle, Loader2, Download, Car, TrendingUp, Shield, Award } from "lucide-react";

function LpDiagnosticoAutomotivoContent() {
  const [etapa, setEtapa] = useState(1);
  const [enviando, setEnviando] = useState(false);
  
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    telefone: "",
    empresa: ""
  });

  const [respostas, setRespostas] = useState({
    ano: "",
    km: "",
    manutencao: "",
    pintura: "",
    intencao: ""
  });

  const perguntas = [
    {
      id: "ano",
      pergunta: "Qual é o ano do seu veículo?",
      opcoes: ["2024-2023", "2022-2020", "2019-2016", "2015 ou anterior"]
    },
    {
      id: "km",
      pergunta: "Qual a quilometragem atual?",
      opcoes: ["Até 30.000 km", "30.000 - 60.000 km", "60.000 - 100.000 km", "Acima de 100.000 km"]
    },
    {
      id: "manutencao",
      pergunta: "O veículo possui histórico de manutenção em dia?",
      opcoes: ["Sim, todas as revisões na concessionária", "Sim, em oficinas independentes", "Parcialmente", "Não"]
    },
    {
      id: "pintura",
      pergunta: "Qual o estado geral da pintura?",
      opcoes: ["Excelente - sem arranhões", "Bom - pequenos arranhões", "Regular - precisa reparo", "Ruim - precisa pintura completa"]
    },
    {
      id: "intencao",
      pergunta: "O que você pretende fazer com o veículo?",
      opcoes: ["Vender", "Trocar por outro", "Manter e valorizar", "Ainda não decidi"]
    }
  ];

  const handleSubmitDiagnostico = async (e) => {
    e.preventDefault();
    setEnviando(true);

    try {
      const baseUrl = window.location.origin;
      const response = await fetch(`${baseUrl}/api/functions/processarLeadLandingPage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          landingPageId: "diagnostico-automotivo",
          formData,
          respostas
        })
      });

      if (response.ok) {
        setEtapa(3);
      } else {
        alert("Erro ao enviar. Tente novamente.");
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao enviar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-black">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }} />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 py-12">
        {etapa === 1 && (
          <div className="space-y-8">
            <div className="text-center">
              <img 
                src="/imagens/logo-autorizada-motors.png"
                alt="Autorizada Motors"
                className="h-24 mx-auto mb-8"
              />
            </div>

            <div className="bg-white/95 backdrop-blur-xl border-0 shadow-2xl rounded-xl">
              <div className="p-8 md:p-12">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-600 mb-6">
                    <Car className="w-10 h-10 text-white" />
                  </div>
                  <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-4 leading-tight">
                    Descubra Como Valorizar<br />
                    <span className="text-red-600">Seu Veículo</span> em 5 Minutos
                  </h1>
                  <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                    Responda 5 perguntas rápidas e receba <strong>GRÁTIS</strong> nosso guia completo em PDF
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-6 mb-10">
                  <div className="text-center p-6 bg-red-50 rounded-xl">
                    <TrendingUp className="w-12 h-12 text-red-600 mx-auto mb-3" />
                    <h3 className="font-bold text-gray-900 mb-2">Aumente o Valor</h3>
                    <p className="text-sm text-gray-600">Técnicas profissionais para valorizar seu carro</p>
                  </div>
                  <div className="text-center p-6 bg-red-50 rounded-xl">
                    <Shield className="w-12 h-12 text-red-600 mx-auto mb-3" />
                    <h3 className="font-bold text-gray-900 mb-2">Venda Mais Rápido</h3>
                    <p className="text-sm text-gray-600">Estratégias para acelerar a venda</p>
                  </div>
                  <div className="text-center p-6 bg-red-50 rounded-xl">
                    <Award className="w-12 h-12 text-red-600 mx-auto mb-3" />
                    <h3 className="font-bold text-gray-900 mb-2">Melhor Negócio</h3>
                    <p className="text-sm text-gray-600">Obtenha o melhor preço na troca</p>
                  </div>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); setEtapa(2); }} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-gray-700 font-medium text-sm">Nome Completo *</label>
                      <input
                        type="text"
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        className="w-full h-12 px-3 bg-white border border-gray-300 rounded-md text-gray-900"
                        placeholder="Seu nome"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-gray-700 font-medium text-sm">E-mail *</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full h-12 px-3 bg-white border border-gray-300 rounded-md text-gray-900"
                        placeholder="seu@email.com"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-gray-700 font-medium text-sm">WhatsApp *</label>
                      <input
                        type="tel"
                        value={formData.telefone}
                        onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                        className="w-full h-12 px-3 bg-white border border-gray-300 rounded-md text-gray-900"
                        placeholder="(11) 99999-9999"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-gray-700 font-medium text-sm">Cidade (opcional)</label>
                      <input
                        type="text"
                        value={formData.empresa}
                        onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
                        className="w-full h-12 px-3 bg-white border border-gray-300 rounded-md text-gray-900"
                        placeholder="Sua cidade"
                      />
                    </div>
                  </div>
                  <button type="submit" className="w-full h-14 text-lg font-bold bg-red-600 hover:bg-red-700 text-white rounded-md shadow-lg transition">
                    Iniciar Diagnóstico
                  </button>
                </form>

                <p className="text-center text-xs text-gray-500 mt-6">
                  🔒 Seus dados estão seguros e não serão compartilhados
                </p>
              </div>
            </div>
          </div>
        )}

        {etapa === 2 && (
          <div className="space-y-8">
            <div className="text-center">
              <img 
                src="/imagens/logo-autorizada-motors.png"
                alt="Autorizada Motors"
                className="h-16 mx-auto mb-4"
              />
            </div>

            <div className="bg-white/95 backdrop-blur-xl border-0 shadow-2xl rounded-xl">
              <div className="p-8 md:p-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
                  Responda as perguntas sobre seu veículo
                </h2>

                <form onSubmit={handleSubmitDiagnostico} className="space-y-6">
                  {perguntas.map((pergunta, index) => (
                    <div key={pergunta.id} className="space-y-3">
                      <label className="text-gray-800 font-semibold text-lg block">
                        {index + 1}. {pergunta.pergunta}
                      </label>
                      <select
                        value={respostas[pergunta.id]}
                        onChange={(e) => setRespostas({ ...respostas, [pergunta.id]: e.target.value })}
                        className="w-full h-12 px-3 bg-white border border-gray-300 rounded-md text-gray-900"
                        required
                      >
                        <option value="">Selecione uma opção</option>
                        {pergunta.opcoes.map((opcao, opcaoIndex) => (
                          <option key={opcaoIndex} value={opcao}>
                            {opcao}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}

                  <div className="flex gap-3 pt-6">
                    <button
                      type="button"
                      onClick={() => setEtapa(1)}
                      className="flex-1 h-14 border border-gray-300 rounded-md hover:bg-gray-50 transition"
                    >
                      Voltar
                    </button>
                    <button
                      type="submit"
                      disabled={enviando}
                      className="flex-1 h-14 text-lg font-bold bg-red-600 hover:bg-red-700 text-white rounded-md shadow-lg transition disabled:opacity-50 flex items-center justify-center"
                    >
                      {enviando ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <Download className="w-5 h-5 mr-2" />
                          Receber E-book Grátis
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {etapa === 3 && (
          <div className="space-y-8">
            <div className="text-center">
              <img 
                src="/imagens/brasao-marrafon.png"
                alt="Brasão"
                className="h-32 mx-auto mb-8 drop-shadow-2xl"
              />
            </div>

            <div className="bg-white/95 backdrop-blur-xl border-0 shadow-2xl rounded-xl">
              <div className="py-20 px-8 text-center">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-100 mb-8">
                  <CheckCircle className="w-14 h-14 text-emerald-600" />
                </div>

                <h2 className="text-4xl font-black text-gray-900 mb-4">
                  🎉 Parabéns!
                </h2>
                
                <p className="text-xl text-gray-700 mb-8 max-w-2xl mx-auto leading-relaxed">
                  Enviamos o e-book <strong className="text-red-600">"10 Passos para Valorizar seu Veículo"</strong> para o seu e-mail!
                </p>

                <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-2xl p-8 mb-8">
                  <TrendingUp className="w-12 h-12 text-red-600 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    Nossa Equipe Entrará em Contato!
                  </h3>
                  <p className="text-gray-700">
                    Com base no seu diagnóstico, vamos preparar uma análise personalizada 
                    e orientações específicas para o seu veículo.
                  </p>
                </div>

                <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                  <Shield className="w-5 h-5 text-red-600" />
                  <span>Atendimento 100% personalizado e sem compromisso</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {etapa < 3 && (
          <p className="text-center text-white/70 text-sm mt-8">
            © 2025 Autorizada Motors - Todos os direitos reservados
          </p>
        )}
      </div>
    </div>
  );
}

LpDiagnosticoAutomotivoContent.noLayout = true;

export default LpDiagnosticoAutomotivoContent;