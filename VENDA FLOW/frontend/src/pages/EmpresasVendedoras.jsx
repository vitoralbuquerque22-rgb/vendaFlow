import { useState } from "react";
import { api } from "@/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2, Building2 } from "lucide-react";
import { toast } from "sonner";

export default function EmpresasVendedoras() {
  const [modalAberto, setModalAberto] = useState(false);
  const [empresaEditando, setEmpresaEditando] = useState(null);
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    cor: "#ff6b35",
    meta_mensal: 0,
    ativa: true,
  });

  const queryClient = useQueryClient();

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-vendedoras"],
    queryFn: () => api.entities.EmpresaVendedora.list("-created_date"),
  });

  const criarMutation = useMutation({
    mutationFn: (data) => api.entities.EmpresaVendedora.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas-vendedoras"] });
      toast.success("Empresa criada com sucesso!");
      fecharModal();
    },
  });

  const atualizarMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.EmpresaVendedora.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas-vendedoras"] });
      toast.success("Empresa atualizada!");
      fecharModal();
    },
  });

  const deletarMutation = useMutation({
    mutationFn: (id) => api.entities.EmpresaVendedora.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas-vendedoras"] });
      toast.success("Empresa removida!");
    },
  });

  const abrirModal = (empresa = null) => {
    if (empresa) {
      setEmpresaEditando(empresa);
      setFormData({
        nome: empresa.nome || "",
        descricao: empresa.descricao || "",
        cor: empresa.cor || "#ff6b35",
        meta_mensal: empresa.meta_mensal || 0,
        ativa: empresa.ativa !== false,
      });
    } else {
      setEmpresaEditando(null);
      setFormData({
        nome: "",
        descricao: "",
        cor: "#ff6b35",
        meta_mensal: 0,
        ativa: true,
      });
    }
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEmpresaEditando(null);
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (empresaEditando) {
      await atualizarMutation.mutateAsync({ id: empresaEditando.id, data: formData });
    } else {
      await criarMutation.mutateAsync(formData);
    }
  };

  const handleDeletar = async (id) => {
    if (confirm("Tem certeza que deseja remover esta empresa?")) {
      await deletarMutation.mutateAsync(id);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Empresas Vendedoras</h1>
          <p className="text-slate-400 mt-1">Gerencie as empresas/produtos que você vende</p>
        </div>
        <Button onClick={() => abrirModal()} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Nova Empresa
        </Button>
      </div>

      {/* Lista de Empresas */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 hover:bg-transparent">
                <TableHead className="text-slate-400">Empresa</TableHead>
                <TableHead className="text-slate-400">Descrição</TableHead>
                <TableHead className="text-slate-400 text-center">Meta Mensal</TableHead>
                <TableHead className="text-slate-400 text-center">Status</TableHead>
                <TableHead className="text-slate-400 text-center w-32">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empresas.length === 0 ? (
                <TableRow className="border-slate-700">
                  <TableCell colSpan={5} className="text-center py-12">
                    <Building2 className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                    <p className="text-slate-400">Nenhuma empresa cadastrada</p>
                    <p className="text-slate-500 text-sm mt-1">
                      Clique em "Nova Empresa" para começar
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                empresas.map((empresa) => (
                  <TableRow key={empresa.id} className="border-slate-700">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: empresa.cor }}
                        >
                          <span className="text-white font-bold text-xs">
                            {empresa.nome.substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-white font-medium">{empresa.nome}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-300 max-w-xs truncate">
                      {empresa.descricao || "-"}
                    </TableCell>
                    <TableCell className="text-center text-slate-300">
                      {empresa.meta_mensal > 0
                        ? `R$ ${empresa.meta_mensal.toLocaleString("pt-BR")}`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        className={
                          empresa.ativa
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-slate-600 text-slate-300"
                        }
                      >
                        {empresa.ativa ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => abrirModal(empresa)}
                          className="text-slate-400 hover:text-white"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletar(empresa.id)}
                          className="text-slate-400 hover:text-rose-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de Criar/Editar */}
      <Dialog open={modalAberto} onOpenChange={fecharModal}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              {empresaEditando ? "Editar Empresa" : "Nova Empresa"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSalvar} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Nome da Empresa *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Ex: VORP EDUCAÇÃO, Matrix, JobMac"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Descrição</Label>
              <Textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white h-20"
                placeholder="Descreva o que esta empresa/produto oferece"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Cor de Identificação</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={formData.cor}
                    onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                    className="w-16 h-10 bg-slate-800 border-slate-700"
                  />
                  <Input
                    value={formData.cor}
                    onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                    className="flex-1 bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Meta Mensal (R$)</Label>
                <Input
                  type="number"
                  value={formData.meta_mensal}
                  onChange={(e) =>
                    setFormData({ ...formData, meta_mensal: parseFloat(e.target.value) || 0 })
                  }
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ativa"
                checked={formData.ativa}
                onChange={(e) => setFormData({ ...formData, ativa: e.target.checked })}
                className="rounded border-slate-600"
              />
              <Label htmlFor="ativa" className="text-slate-300 cursor-pointer">
                Empresa ativa
              </Label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
              <Button
                type="button"
                variant="ghost"
                onClick={fecharModal}
                className="text-slate-400"
              >
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {empresaEditando ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}