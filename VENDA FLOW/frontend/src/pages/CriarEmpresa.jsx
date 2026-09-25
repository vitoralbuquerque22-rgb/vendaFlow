import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { createPageUrl } from "../utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Building2, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function CriarEmpresa() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [verificandoUsuario, setVerificandoUsuario] = useState(true);
  const [formData, setFormData] = useState({
    nome: "",
    cnpj: "",
    nomeProprietario: "",
    whatsappProprietario: "",
    telefonePropietario: "",
    plano: "starter",
  });

  useEffect(() => {
    verificarUsuario();
  }, []);

  const verificarUsuario = async () => {
    try {
      const user = await api.auth.me();
      
      if (!user) {
        toast.error("Você precisa estar logado");
        navigate(createPageUrl("Acesso"));
        return;
      }

      // Verificar se já tem empresa
      const vinculos = await api.entities.VinculoEmpresa.filter({
        userEmail: user.email,
        status: "ativo",
      });

      if (vinculos.length > 0) {
        toast.info("Você já possui empresa(s) cadastrada(s)");
        navigate(createPageUrl("ChooseEmpresa"));
        return;
      }

      // Preencher nome do proprietário
      setFormData((prev) => ({
        ...prev,
        nomeProprietario: user.full_name || "",
      }));
    } catch (error) {
      console.error("Erro ao verificar usuário:", error);
      navigate(createPageUrl("Acesso"));
    } finally {
      setVerificandoUsuario(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = await api.auth.me();

      // Validações
      if (!formData.nome || !formData.cnpj || !formData.nomeProprietario) {
        toast.error("Preencha todos os campos obrigatórios");
        setLoading(false);
        return;
      }

      // Criar empresa
      const novaEmpresa = await api.entities.Empresa.create({
        nome: formData.nome,
        cnpj: formData.cnpj,
        nomeProprietario: formData.nomeProprietario,
        whatsappProprietario: formData.whatsappProprietario,
        telefonePropietario: formData.telefonePropietario,
        plano: formData.plano,
        limiteUsuarios: formData.plano === "starter" ? 5 : formData.plano === "pro" ? 20 : 50,
        statusPlano: "ativo",
        ownerEmail: user.email,
        dataRenovacao: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      });

      // Criar vínculo como admin da empresa
      await api.entities.VinculoEmpresa.create({
        empresaId: novaEmpresa.id,
        userEmail: user.email,
        papel: "admin",
        status: "ativo",
      });

      // Atualizar empresa atual do usuário
      await api.auth.updateMe({
        empresaAtualId: novaEmpresa.id,
      });

      toast.success("Empresa criada com sucesso!");

      // Redirecionar para dashboard
      setTimeout(() => {
        navigate(createPageUrl("Dashboard"));
      }, 1000);
    } catch (error) {
      console.error("Erro ao criar empresa:", error);
      toast.error("Erro ao criar empresa: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (verificandoUsuario) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#ff6b35] animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Verificando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full bg-slate-900/95 backdrop-blur-xl border-slate-800">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ff6b35] to-[#ff8c42] flex items-center justify-center">
              <Building2 className="w-8 h-8 text-white" />
            </div>
          </div>
          <div>
            <CardTitle className="text-3xl font-bold text-white">
              Cadastre sua Empresa
            </CardTitle>
            <p className="text-slate-400 text-sm mt-1">
              Preencha os dados para começar a usar o CRM SDR
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Dados da Empresa */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="nome" className="text-slate-300">
                  Nome da Empresa *
                </Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Minha Empresa LTDA"
                  className="bg-slate-800 border-slate-700 text-white mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="cnpj" className="text-slate-300">
                  CNPJ *
                </Label>
                <Input
                  id="cnpj"
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                  className="bg-slate-800 border-slate-700 text-white mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="nomeProprietario" className="text-slate-300">
                  Nome do Proprietário *
                </Label>
                <Input
                  id="nomeProprietario"
                  value={formData.nomeProprietario}
                  onChange={(e) =>
                    setFormData({ ...formData, nomeProprietario: e.target.value })
                  }
                  placeholder="Seu nome completo"
                  className="bg-slate-800 border-slate-700 text-white mt-1"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="whatsappProprietario" className="text-slate-300">
                    WhatsApp
                  </Label>
                  <Input
                    id="whatsappProprietario"
                    value={formData.whatsappProprietario}
                    onChange={(e) =>
                      setFormData({ ...formData, whatsappProprietario: e.target.value })
                    }
                    placeholder="(00) 00000-0000"
                    className="bg-slate-800 border-slate-700 text-white mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="telefonePropietario" className="text-slate-300">
                    Telefone
                  </Label>
                  <Input
                    id="telefonePropietario"
                    value={formData.telefonePropietario}
                    onChange={(e) =>
                      setFormData({ ...formData, telefonePropietario: e.target.value })
                    }
                    placeholder="(00) 0000-0000"
                    className="bg-slate-800 border-slate-700 text-white mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="plano" className="text-slate-300">
                  Plano Inicial
                </Label>
                <Select
                  value={formData.plano}
                  onValueChange={(value) => setFormData({ ...formData, plano: value })}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="starter">
                      Starter - Até 5 usuários
                    </SelectItem>
                    <SelectItem value="pro">
                      Pro - Até 20 usuários
                    </SelectItem>
                    <SelectItem value="enterprise">
                      Enterprise - Até 50 usuários
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Informação */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex gap-2">
                <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-300">
                  <p className="font-medium mb-1">Você será o administrador desta empresa</p>
                  <p className="text-blue-400/80">
                    Poderá convidar colaboradores, gerenciar leads e cadências após criar a
                    empresa.
                  </p>
                </div>
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(createPageUrl("Acesso"))}
                className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-[#ff6b35] to-[#ff8c42] hover:from-[#ff5c26] hover:to-[#ff7d33] text-white font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  "Criar Empresa"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}