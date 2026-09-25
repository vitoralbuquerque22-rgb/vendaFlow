import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, DollarSign, Save, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";

export default function DadosEmpresa() {
  const queryClient = useQueryClient();
  const { empresaId } = useEmpresaAtual();

  const { data: empresaAtual, isLoading: loadingEmpresa } = useQuery({
    queryKey: ["empresa-atual", empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      const empresas = await base44.entities.Empresa.filter({ id: empresaId });
      return empresas[0] || null;
    },
    enabled: !!empresaId,
  });

  const [dadosEmpresa, setDadosEmpresa] = useState({});
  const [editandoEmpresa, setEditandoEmpresa] = useState(false);
  const [criandoEmpresa, setCriandoEmpresa] = useState(false);
  const [novaEmpresa, setNovaEmpresa] = useState({ nome: "", cnpj: "", nomeProprietario: "", whatsappProprietario: "" });

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const criarEmpresaMutation = useMutation({
    mutationFn: async (dados) => {
      const empresa = await base44.entities.Empresa.create({
        ...dados,
        ownerEmail: user?.email,
        limiteUsuarios: 5,
        plano: "starter",
        statusPlano: "ativo",
      });
      await base44.entities.VinculoEmpresa.create({
        empresaId: empresa.id,
        userEmail: user?.email,
        userName: user?.full_name,
        papel: "admin",
        status: "ativo",
      });
      await base44.auth.updateMe({ empresaAtualId: empresa.id });
      return empresa;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresa-atual"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("Empresa criada com sucesso!");
      setCriandoEmpresa(false);
      setNovaEmpresa({ nome: "", cnpj: "", nomeProprietario: "", whatsappProprietario: "" });
      window.location.reload();
    },
  });

  const atualizarEmpresaMutation = useMutation({
    mutationFn: (data) => base44.entities.Empresa.update(empresaId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresa-atual", empresaId] });
      toast.success("Dados da empresa atualizados!");
      setDadosEmpresa({});
    },
  });

  const getDadosEmpresaValue = (campo) => {
    if (dadosEmpresa[campo] !== undefined) return dadosEmpresa[campo];
    return empresaAtual?.[campo] || "";
  };

  const handleDadosEmpresaChange = (campo, valor) => {
    setDadosEmpresa(prev => ({
      ...prev,
      [campo]: valor
    }));
  };

  const handleSalvarDadosEmpresa = async () => {
    const dados = {
      nome: dadosEmpresa.nome ?? empresaAtual?.nome,
      cnpj: dadosEmpresa.cnpj ?? empresaAtual?.cnpj,
      nomeProprietario: dadosEmpresa.nomeProprietario ?? empresaAtual?.nomeProprietario,
      whatsappProprietario: dadosEmpresa.whatsappProprietario ?? empresaAtual?.whatsappProprietario,
      telefonePropietario: dadosEmpresa.telefonePropietario ?? empresaAtual?.telefonePropietario,
      plano: dadosEmpresa.plano ?? empresaAtual?.plano,
      limiteUsuarios: dadosEmpresa.limiteUsuarios ?? empresaAtual?.limiteUsuarios,
      statusPlano: dadosEmpresa.statusPlano ?? empresaAtual?.statusPlano,
    };
    await atualizarEmpresaMutation.mutateAsync(dados);
    setEditandoEmpresa(false);
  };

  const handleCancelarEdicao = () => {
    setDadosEmpresa({});
    setEditandoEmpresa(false);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dados da Empresa</h1>
        <p className="text-slate-400 mt-1">Gerencie os dados cadastrais da sua empresa e plano contratado</p>
      </div>

      <Card className="bg-blue-500/10 border-blue-500/30">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Building2 className="w-5 h-5 text-blue-400 mt-0.5" />
            <div>
              <p className="text-blue-300 font-medium">Informações da Empresa</p>
              <p className="text-blue-200/70 text-sm mt-1">
                Atualize os dados cadastrais da sua empresa e gerencie o plano contratado.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {loadingEmpresa ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-12 text-center">
            <p className="text-slate-400">Carregando dados da empresa...</p>
          </CardContent>
        </Card>
      ) : empresaAtual ? (
        <>
          {!editandoEmpresa && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="py-4">
                <Button
                  onClick={() => setEditandoEmpresa(true)}
                  className="w-full bg-gradient-to-r from-[#ff6b35] to-[#ff8c42] hover:from-[#ff5c26] hover:to-[#ff7d33]"
                >
                  ✏️ Editar Informações da Empresa
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Dados Cadastrais */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#ff6b35]" />
                  Dados Cadastrais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-slate-300 text-xs">Nome da Empresa *</Label>
                  {editandoEmpresa ? (
                    <Input
                      value={getDadosEmpresaValue("nome")}
                      onChange={(e) => handleDadosEmpresaChange("nome", e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white"
                      placeholder="Minha Empresa LTDA"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-slate-700/50 rounded-md text-white">
                      {empresaAtual.nome}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300 text-xs">CNPJ *</Label>
                  {editandoEmpresa ? (
                    <Input
                      value={getDadosEmpresaValue("cnpj")}
                      onChange={(e) => handleDadosEmpresaChange("cnpj", e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white"
                      placeholder="00.000.000/0000-00"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-slate-700/50 rounded-md text-white">
                      {empresaAtual.cnpj}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300 text-xs">Nome do Proprietário *</Label>
                  {editandoEmpresa ? (
                    <Input
                      value={getDadosEmpresaValue("nomeProprietario")}
                      onChange={(e) => handleDadosEmpresaChange("nomeProprietario", e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white"
                      placeholder="Nome completo"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-slate-700/50 rounded-md text-white">
                      {empresaAtual.nomeProprietario}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300 text-xs">WhatsApp</Label>
                  {editandoEmpresa ? (
                    <Input
                      value={getDadosEmpresaValue("whatsappProprietario")}
                      onChange={(e) => handleDadosEmpresaChange("whatsappProprietario", e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white"
                      placeholder="(00) 00000-0000"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-slate-700/50 rounded-md text-white">
                      {empresaAtual.whatsappProprietario || "-"}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300 text-xs">Telefone</Label>
                  {editandoEmpresa ? (
                    <Input
                      value={getDadosEmpresaValue("telefonePropietario")}
                      onChange={(e) => handleDadosEmpresaChange("telefonePropietario", e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white"
                      placeholder="(00) 0000-0000"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-slate-700/50 rounded-md text-white">
                      {empresaAtual.telefonePropietario || "-"}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Plano e Configurações */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  Plano Contratado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-slate-300 text-xs">Plano</Label>
                  {editandoEmpresa ? (
                    <Select
                      value={getDadosEmpresaValue("plano")}
                      onValueChange={(value) => {
                        handleDadosEmpresaChange("plano", value);
                        const limites = { starter: 5, pro: 20, enterprise: 999 };
                        handleDadosEmpresaChange("limiteUsuarios", limites[value]);
                      }}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="starter">Starter - Até 5 usuários</SelectItem>
                        <SelectItem value="pro">Pro - Até 20 usuários</SelectItem>
                        <SelectItem value="enterprise">Enterprise - Ilimitado</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="px-3 py-2 bg-slate-700/50 rounded-md text-white capitalize">
                      {empresaAtual.plano} {empresaAtual.plano === "starter" && "- Até 5 usuários"} {empresaAtual.plano === "pro" && "- Até 20 usuários"} {empresaAtual.plano === "enterprise" && "- Ilimitado"}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300 text-xs">Limite de Usuários</Label>
                  {editandoEmpresa ? (
                    <Input
                      type="number"
                      min="1"
                      value={getDadosEmpresaValue("limiteUsuarios")}
                      onChange={(e) => handleDadosEmpresaChange("limiteUsuarios", parseInt(e.target.value) || 5)}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-slate-700/50 rounded-md text-white">
                      {empresaAtual.limiteUsuarios}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300 text-xs">Status do Plano</Label>
                  {editandoEmpresa ? (
                    <Select
                      value={getDadosEmpresaValue("statusPlano")}
                      onValueChange={(value) => handleDadosEmpresaChange("statusPlano", value)}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                        <SelectItem value="bloqueado">Bloqueado</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="px-3 py-2 bg-slate-700/50 rounded-md text-white capitalize">
                      {empresaAtual.statusPlano}
                    </div>
                  )}
                </div>

                <div className="pt-4">
                  <div className="p-3 bg-slate-700/50 rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Plano Atual:</span>
                      <span className="text-white font-medium capitalize">{empresaAtual.plano}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Status:</span>
                      <Badge className={
                        empresaAtual.statusPlano === "ativo" 
                          ? "bg-green-500/20 text-green-400" 
                          : empresaAtual.statusPlano === "bloqueado"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-yellow-500/20 text-yellow-400"
                      }>
                        {empresaAtual.statusPlano === "ativo" ? "Ativo" : empresaAtual.statusPlano === "bloqueado" ? "Bloqueado" : "Cancelado"}
                      </Badge>
                    </div>
                    {empresaAtual.dataRenovacao && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Renovação:</span>
                        <span className="text-white">{new Date(empresaAtual.dataRenovacao).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {editandoEmpresa && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="py-4 flex gap-3">
                <Button
                  onClick={handleSalvarDadosEmpresa}
                  disabled={atualizarEmpresaMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {atualizarEmpresaMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
                <Button
                  onClick={handleCancelarEdicao}
                  disabled={atualizarEmpresaMutation.isPending}
                  variant="outline"
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-10">
            {!criandoEmpresa ? (
              <div className="text-center">
                <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-300 font-medium mb-1">Nenhuma empresa cadastrada</p>
                <p className="text-slate-500 text-sm mb-6">Crie sua empresa para começar a usar o CRM</p>
                <Button
                  onClick={() => setCriandoEmpresa(true)}
                  className="bg-gradient-to-r from-[#ff6b35] to-[#ff8c42] hover:from-[#ff5c26] hover:to-[#ff7d33]"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Empresa
                </Button>
              </div>
            ) : (
              <div className="space-y-4 max-w-lg mx-auto">
                <h3 className="text-white font-semibold text-lg">Nova Empresa</h3>
                <div className="space-y-1">
                  <Label className="text-slate-300 text-xs">Nome da Empresa *</Label>
                  <Input
                    value={novaEmpresa.nome}
                    onChange={(e) => setNovaEmpresa(p => ({ ...p, nome: e.target.value }))}
                    className="bg-slate-700 border-slate-600 text-white"
                    placeholder="Minha Empresa LTDA"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300 text-xs">CNPJ *</Label>
                  <Input
                    value={novaEmpresa.cnpj}
                    onChange={(e) => setNovaEmpresa(p => ({ ...p, cnpj: e.target.value }))}
                    className="bg-slate-700 border-slate-600 text-white"
                    placeholder="00.000.000/0000-00"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300 text-xs">Nome do Proprietário *</Label>
                  <Input
                    value={novaEmpresa.nomeProprietario}
                    onChange={(e) => setNovaEmpresa(p => ({ ...p, nomeProprietario: e.target.value }))}
                    className="bg-slate-700 border-slate-600 text-white"
                    placeholder="Nome completo"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300 text-xs">WhatsApp</Label>
                  <Input
                    value={novaEmpresa.whatsappProprietario}
                    onChange={(e) => setNovaEmpresa(p => ({ ...p, whatsappProprietario: e.target.value }))}
                    className="bg-slate-700 border-slate-600 text-white"
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={() => criarEmpresaMutation.mutate(novaEmpresa)}
                    disabled={criarEmpresaMutation.isPending || !novaEmpresa.nome || !novaEmpresa.cnpj || !novaEmpresa.nomeProprietario}
                    className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {criarEmpresaMutation.isPending ? "Criando..." : "Criar Empresa"}
                  </Button>
                  <Button
                    onClick={() => setCriandoEmpresa(false)}
                    variant="outline"
                    className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}