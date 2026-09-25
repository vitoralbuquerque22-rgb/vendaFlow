import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
  } from "@/components/ui/dialog";
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select";
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table";
  import { Loader2, Users, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";

export default function GerenciamentoEmpresasModal({
  open,
  onOpenChange,
  empresa,
  onSuccess,
}) {
  const [formData, setFormData] = useState({
    nome: "",
    cnpj: "",
    nomeProprietario: "",
    whatsappProprietario: "",
    telefonePropietario: "",
    plano: "starter",
    limiteUsuarios: 5,
    statusPlano: "ativo",
    dataRenovacao: "",
    ownerEmail: "",
  });

  useEffect(() => {
    if (empresa) {
      setFormData(empresa);
    } else {
      setFormData({
        nome: "",
        cnpj: "",
        nomeProprietario: "",
        whatsappProprietario: "",
        telefonePropietario: "",
        plano: "starter",
        limiteUsuarios: 5,
        statusPlano: "ativo",
        dataRenovacao: "",
        ownerEmail: "",
      });
    }
  }, [empresa, open]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Usar backend function que faz tudo de forma segura
      const response = await base44.functions.invoke('criarEmpresaComConvite', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Empresa criada! Email enviado para " + formData.ownerEmail);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error("Erro ao criar: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data) =>
      base44.entities.Empresa.update(empresa.id, data),
    onSuccess: () => {
      toast.success("Empresa atualizada com sucesso");
      onSuccess?.();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar: " + error.message);
    },
  });

  const handleSubmit = async () => {
    if (!formData.nome || !formData.cnpj || !formData.ownerEmail || !formData.nomeProprietario) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (empresa) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const limites = {
    starter: 5,
    pro: 20,
    enterprise: 100,
  };

  const handlePlanoChange = (plano) => {
    setFormData({
      ...formData,
      plano,
      limiteUsuarios: limites[plano],
    });
  };

  // Buscar colaboradores vinculados à empresa (somente quando estiver editando)
  const { data: colaboradores = [], refetch, isLoading: colabLoading } = useQuery({
   queryKey: ["colaboradores-empresa", empresa?.id],
   queryFn: async () => {
     if (!empresa?.id) return [];

     // Debug: verificar qual ID está sendo usado
     console.log("🔍 Buscando VinculoEmpresa para empresaId:", empresa.id, "tipo:", typeof empresa.id);

     // Listar todos os VinculoEmpresa e filtrar manualmente
     const todos = await base44.entities.VinculoEmpresa.list();
     console.log("📋 Total de VinculoEmpresa no banco:", todos.length);

     // Mostrar todos os IDs únicos de empresa
     const empresasUnicas = [...new Set(todos.map(v => v.empresaId))];
     console.log("🏢 Empresas encontradas:", empresasUnicas);

     let vinculos = todos.filter(v => {
       const match = v.empresaId === empresa.id || String(v.empresaId) === String(empresa.id);
       if (match) console.log("✅ Vinculo encontrado:", v.userEmail, "papel:", v.papel);
       return match;
     });

     console.log("🔗 Vinculos filtrados para esta empresa:", vinculos.length);

     // Usar dados do próprio vínculo (que já tem userName e ultimoAcesso)
     const resultado = vinculos;

     console.log("✨ Resultado final:", resultado);
     return resultado;
   },
   enabled: !!empresa?.id && open,
   staleTime: 0,
   refetchOnWindowFocus: true,
  });

  // Refetch colaboradores quando modal abre
  useEffect(() => {
    if (open && empresa?.id) {
      refetch();
    }
  }, [open, empresa?.id]);

  const papelConfig = {
    admin: { label: "Admin", color: "bg-purple-500/20 text-purple-400" },
    gestor: { label: "Gestor", color: "bg-blue-500/20 text-blue-400" },
    sdr: { label: "SDR", color: "bg-green-500/20 text-green-400" },
    closer: { label: "Closer", color: "bg-orange-500/20 text-orange-400" },
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b border-slate-800 pb-4">
          <DialogTitle className="text-white text-2xl">
            {empresa ? "Editar Empresa" : "Nova Empresa"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-6">
            {/* Dados da Empresa */}
            <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-300 mb-2 block">
              Nome da Empresa *
            </label>
            <Input
              value={formData.nome}
              onChange={(e) =>
                setFormData({ ...formData, nome: e.target.value })
              }
              placeholder="Nome da empresa"
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>

          <div>
            <label className="text-sm text-slate-300 mb-2 block">CNPJ *</label>
            <Input
              value={formData.cnpj}
              onChange={(e) =>
                setFormData({ ...formData, cnpj: e.target.value })
              }
              placeholder="00.000.000/0000-00"
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>

          <div>
           <label className="text-sm text-slate-300 mb-2 block">
             Nome do Proprietário *
           </label>
           <Input
             value={formData.nomeProprietario}
             onChange={(e) =>
               setFormData({ ...formData, nomeProprietario: e.target.value })
             }
             placeholder="Nome completo"
             className="bg-slate-800 border-slate-700 text-white"
           />
          </div>

          <div>
           <label className="text-sm text-slate-300 mb-2 block">
             Email do Proprietário *
           </label>
           <Input
             value={formData.ownerEmail}
             onChange={(e) =>
               setFormData({ ...formData, ownerEmail: e.target.value })
             }
             placeholder="owner@empresa.com"
             type="email"
             className="bg-slate-800 border-slate-700 text-white"
           />
          </div>

          <div className="grid grid-cols-2 gap-4">
           <div>
             <label className="text-sm text-slate-300 mb-2 block">
               WhatsApp
             </label>
             <Input
               value={formData.whatsappProprietario}
               onChange={(e) =>
                 setFormData({ ...formData, whatsappProprietario: e.target.value })
               }
               placeholder="(11) 99999-9999"
               className="bg-slate-800 border-slate-700 text-white"
             />
           </div>

           <div>
             <label className="text-sm text-slate-300 mb-2 block">
               Telefone
             </label>
             <Input
               value={formData.telefonePropietario}
               onChange={(e) =>
                 setFormData({ ...formData, telefonePropietario: e.target.value })
               }
               placeholder="(11) 3333-3333"
               className="bg-slate-800 border-slate-700 text-white"
             />
           </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-300 mb-2 block">Plano</label>
              <Select value={formData.plano} onValueChange={handlePlanoChange}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-slate-300 mb-2 block">
                Limite de Usuários
              </label>
              <Input
                type="number"
                value={formData.limiteUsuarios}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    limiteUsuarios: parseInt(e.target.value),
                  })
                }
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-300 mb-2 block">
                Status do Plano
              </label>
              <Select
                value={formData.statusPlano}
                onValueChange={(value) =>
                  setFormData({ ...formData, statusPlano: value })
                }
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                  <SelectItem value="bloqueado">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-slate-300 mb-2 block">
                Data de Renovação
              </label>
              <Input
                type="date"
                value={formData.dataRenovacao}
                onChange={(e) =>
                  setFormData({ ...formData, dataRenovacao: e.target.value })
                }
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>
            </div>

            {/* Colaboradores - Tabela em full width */}
            {empresa && (
            <div className="border-t border-slate-800 pt-4">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-semibold text-white">Colaboradores</h3>
                <Badge className="ml-auto bg-blue-500/20 text-blue-400">
                  {colaboradores.length} vinculados
                </Badge>
              </div>

              {colabLoading ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-8 h-8 text-slate-600 mx-auto mb-3 animate-spin" />
                  <p className="text-slate-400">Carregando colaboradores...</p>
                </div>
              ) : colaboradores.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">Nenhum colaborador vinculado</p>
                  <p className="text-slate-500 text-xs mt-2">ID da empresa: {empresa?.id}</p>
                </div>
              ) : (
                <div className="border border-slate-700 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-800">
                      <TableRow className="border-slate-700 hover:bg-slate-800">
                        <TableHead className="text-slate-300">ID</TableHead>
                        <TableHead className="text-slate-300">Nome</TableHead>
                        <TableHead className="text-slate-300">Email</TableHead>
                        <TableHead className="text-slate-300">Função</TableHead>
                        <TableHead className="text-slate-300">Status</TableHead>
                        <TableHead className="text-slate-300">Último Acesso</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {colaboradores.map((colaborador) => (
                        <TableRow key={colaborador.id} className="border-slate-700 hover:bg-slate-800/50">
                          <TableCell className="text-slate-500 text-xs font-mono">{colaborador.id}</TableCell>
                          <TableCell className="text-white font-medium">{colaborador.userName?.trim() || colaborador.userEmail.split('@')[0]}</TableCell>
                          <TableCell className="text-slate-400 text-sm">{colaborador.userEmail}</TableCell>
                          <TableCell>
                            <Badge className={papelConfig[colaborador.papel]?.color || "bg-slate-600"}>
                              {papelConfig[colaborador.papel]?.label || colaborador.papel}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={
                                colaborador.status === "ativo" 
                                  ? "border-green-500/30 text-green-400" 
                                  : "border-slate-600 text-slate-500"
                              }
                            >
                              {colaborador.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-400 text-sm">
                            {colaborador.ultimoAcesso ? (
                              <span>{new Date(colaborador.ultimoAcesso).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}</span>
                            ) : (
                              <span className="text-slate-500">Nunca</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
            )}
            </div>
          </div>

        <DialogFooter className="border-t border-slate-800 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-slate-700"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}