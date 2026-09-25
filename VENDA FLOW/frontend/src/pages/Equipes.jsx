import { useState } from "react";
import { api } from "@/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listarTodasEquipes, criarEquipe, atualizarEquipe, excluirEquipe } from "@/lib/services/equipeService";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Users, MoreVertical, Trash2, Edit2, UserPlus, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function Equipes() {
  const { empresaId } = useEmpresaAtual();
  const [modalAberto, setModalAberto] = useState(false);
  const [equipeEditando, setEquipeEditando] = useState(null);
  const [formData, setFormData] = useState({ nome: "", gestor_email: "", membros: [] });
  const [novoMembro, setNovoMembro] = useState("");

  const queryClient = useQueryClient();

  const { data: equipes = [], isLoading } = useQuery({
    queryKey: ["equipes", empresaId],
    queryFn: () => listarTodasEquipes(empresaId),
    enabled: !!empresaId,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users-empresa", empresaId],
    queryFn: () => api.entities.VinculoEmpresa.filter({ empresaId, status: "ativo" }).then(
      vinculos => vinculos.map(v => ({ id: v.userEmail, email: v.userEmail, full_name: v.userName || v.userEmail }))
    ),
    enabled: !!empresaId,
  });

  const criarEquipeMutation = useMutation({
    mutationFn: criarEquipe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipes"] });
      toast.success("Equipe criada com sucesso!");
      fecharModal();
    },
  });

  const atualizarEquipeMutation = useMutation({
    mutationFn: ({ id, data }) => atualizarEquipe(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipes"] });
      toast.success("Equipe atualizada!");
      fecharModal();
    },
  });

  const deletarEquipeMutation = useMutation({
    mutationFn: excluirEquipe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipes"] });
      toast.success("Equipe excluída!");
    },
  });

  const abrirModal = (equipe = null) => {
    if (equipe) {
      setEquipeEditando(equipe);
      setFormData({
        nome: equipe.nome,
        gestor_email: equipe.gestor_email || "",
        membros: equipe.membros || [],
      });
    } else {
      setEquipeEditando(null);
      setFormData({ nome: "", gestor_email: "", membros: [] });
    }
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEquipeEditando(null);
    setFormData({ nome: "", gestor_email: "", membros: [] });
    setNovoMembro("");
  };

  const handleSalvar = () => {
    if (equipeEditando) {
      atualizarEquipeMutation.mutate({ id: equipeEditando.id, data: formData });
    } else {
      criarEquipeMutation.mutate(formData);
    }
  };

  const adicionarMembro = () => {
    if (novoMembro && !formData.membros.includes(novoMembro)) {
      setFormData({ ...formData, membros: [...formData.membros, novoMembro] });
      setNovoMembro("");
    }
  };

  const removerMembro = (email) => {
    setFormData({ ...formData, membros: formData.membros.filter((m) => m !== email) });
  };

  const getNomePorEmail = (email) => {
    const user = users.find((u) => u.email === email);
    return user?.full_name || email;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Equipes</h1>
          <p className="text-slate-400 mt-1">Gerencie as equipes de vendas</p>
        </div>

        <Button onClick={() => abrirModal()} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Nova Equipe
        </Button>
      </div>

      {/* Lista de Equipes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {equipes.map((equipe) => (
            <motion.div
              key={equipe.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-white flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-blue-500/20">
                          <Users className="w-4 h-4 text-blue-400" />
                        </div>
                        {equipe.nome}
                      </CardTitle>
                      {equipe.gestor_email && (
                        <p className="text-sm text-slate-400 mt-2">
                          Gestor: {getNomePorEmail(equipe.gestor_email)}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                        <DropdownMenuItem onClick={() => abrirModal(equipe)} className="text-slate-200 focus:bg-slate-700">
                          <Edit2 className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deletarEquipeMutation.mutate(equipe.id)}
                          className="text-rose-400 focus:bg-slate-700 focus:text-rose-300"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-400 mb-3">
                    {equipe.membros?.length || 0} membros
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(equipe.membros || []).slice(0, 5).map((email) => (
                      <Badge key={email} variant="outline" className="bg-slate-700/50 text-slate-300 border-slate-600 text-xs">
                        {getNomePorEmail(email)}
                      </Badge>
                    ))}
                    {(equipe.membros?.length || 0) > 5 && (
                      <Badge variant="outline" className="bg-slate-700/50 text-slate-400 border-slate-600 text-xs">
                        +{equipe.membros.length - 5}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {equipes.length === 0 && !isLoading && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Nenhuma equipe criada</h3>
            <p className="text-slate-400 mb-4">Crie sua primeira equipe de vendas.</p>
            <Button onClick={() => abrirModal()} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Criar Equipe
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Modal */}
      <Dialog open={modalAberto} onOpenChange={fecharModal}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              {equipeEditando ? "Editar Equipe" : "Nova Equipe"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Nome da Equipe *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Ex: Vendas Inside Sales"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Gestor</Label>
              <Select
                value={formData.gestor_email}
                onValueChange={(value) => setFormData({ ...formData, gestor_email: value })}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Selecione o gestor" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.email}>
                      {user.full_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Membros</Label>
              <div className="flex gap-2">
                <Select value={novoMembro} onValueChange={setNovoMembro}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white flex-1">
                    <SelectValue placeholder="Selecione um membro" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {users
                      .filter((u) => !formData.membros.includes(u.email))
                      .map((user) => (
                        <SelectItem key={user.id} value={user.email}>
                          {user.full_name || user.email}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button onClick={adicionarMembro} variant="outline" className="border-slate-600 text-slate-300">
                  <UserPlus className="w-4 h-4" />
                </Button>
              </div>

              {formData.membros.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {formData.membros.map((email) => (
                    <Badge key={email} className="bg-slate-700 text-slate-200 flex items-center gap-1">
                      {getNomePorEmail(email)}
                      <button onClick={() => removerMembro(email)} className="ml-1 hover:text-rose-400">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={fecharModal} className="text-slate-400">
                Cancelar
              </Button>
              <Button onClick={handleSalvar} disabled={!formData.nome} className="bg-blue-600 hover:bg-blue-700">
                {equipeEditando ? "Salvar" : "Criar Equipe"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}