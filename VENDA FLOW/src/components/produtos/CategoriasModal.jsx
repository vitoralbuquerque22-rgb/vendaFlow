import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";

export default function CategoriasModal({ open, onClose }) {
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ nome: "", descricao: "", cor: "#3b82f6", ativa: true });

  const queryClient = useQueryClient();

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias-produto"],
    queryFn: () => base44.entities.CategoriaProduto.list(),
  });

  const criarMutation = useMutation({
    mutationFn: (data) => base44.entities.CategoriaProduto.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorias-produto"] });
      toast.success("Categoria criada!");
      resetForm();
    },
  });

  const atualizarMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CategoriaProduto.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorias-produto"] });
      toast.success("Categoria atualizada!");
      resetForm();
    },
  });

  const deletarMutation = useMutation({
    mutationFn: (id) => base44.entities.CategoriaProduto.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorias-produto"] });
      toast.success("Categoria removida!");
    },
  });

  const resetForm = () => {
    setForm({ nome: "", descricao: "", cor: "#3b82f6", ativa: true });
    setEditando(null);
  };

  const handleSalvar = () => {
    if (!form.nome) return;

    if (editando) {
      atualizarMutation.mutate({ id: editando.id, data: form });
    } else {
      criarMutation.mutate(form);
    }
  };

  const handleEditar = (cat) => {
    setEditando(cat);
    setForm({
      nome: cat.nome,
      descricao: cat.descricao || "",
      cor: cat.cor || "#3b82f6",
      ativa: cat.ativa,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Tag className="w-5 h-5 text-blue-400" />
            Gerenciar Categorias de Produtos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Formulário */}
          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 space-y-3">
            <h3 className="text-sm font-medium text-slate-300 mb-3">
              {editando ? "Editar Categoria" : "Nova Categoria"}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-slate-300">Nome *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Software"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Cor</Label>
                <Input
                  type="color"
                  value={form.cor}
                  onChange={(e) => setForm({ ...form, cor: e.target.value })}
                  className="bg-slate-800 border-slate-700 h-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Descrição</Label>
              <Input
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Descrição opcional"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ativa"
                  checked={form.ativa}
                  onChange={(e) => setForm({ ...form, ativa: e.target.checked })}
                  className="rounded border-slate-600 bg-slate-700"
                />
                <Label htmlFor="ativa" className="text-slate-300 cursor-pointer">
                  Categoria ativa
                </Label>
              </div>
              <div className="flex gap-2">
                {editando && (
                  <Button variant="ghost" size="sm" onClick={resetForm}>
                    Cancelar
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleSalvar}
                  disabled={!form.nome}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {editando ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </div>
          </div>

          {/* Lista de Categorias */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-slate-300">
              Categorias Cadastradas ({categorias.length})
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {categorias.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: cat.cor }}
                    />
                    <div>
                      <p className="text-white font-medium">{cat.nome}</p>
                      {cat.descricao && (
                        <p className="text-slate-400 text-xs">{cat.descricao}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        cat.ativa
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-slate-600 text-slate-300"
                      }
                    >
                      {cat.ativa ? "Ativa" : "Inativa"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditar(cat)}
                      className="text-slate-400 hover:text-white"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm("Remover esta categoria?")) {
                          deletarMutation.mutate(cat.id);
                        }
                      }}
                      className="text-rose-400 hover:text-rose-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {categorias.length === 0 && (
                <p className="text-center text-slate-400 py-6">
                  Nenhuma categoria cadastrada
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}