import React, { useState } from "react";
import { api } from "@/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Pencil, Building2, Loader2, Mail, AlertCircle, Bug, ShieldCheck, LogIn } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import { toast } from "sonner";
import GerenciamentoEmpresasModal from "@/components/empresa/GerenciamentoEmpresasModal";
import { usePermissions } from "@/components/hooks/usePermissions";

export default function GerenciamentoEmpresas() {
  const { isSuperAdmin } = usePermissions();
  const [open, setOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState(null);
  const [validando, setValidando] = useState(false);
  const [resultadoValidacao, setResultadoValidacao] = useState(null);
  const [limpando, setLimpando] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, empresa: null, confirmText: '' });
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.auth.me(),
  });

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      // Admin global pode ver todas as empresas
      const todasEmpresas = await api.entities.Empresa.list();
      return todasEmpresas;
    },
  });

  const deleteEmpresaMutation = useMutation({
    mutationFn: (empresaId) => api.functions.invoke('excluirEmpresaCompleta', { empresaId }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      toast.success(response.data.message || "Empresa e acessos removidos");
    },
    onError: (error) => {
      toast.error("Erro ao deletar: " + error.message);
    },
  });

  const reenviarConviteMutation = useMutation({
    mutationFn: async (empresa) => {
      const response = await api.functions.invoke('reenviarConviteEmpresa', {
        empresaId: empresa.id,
        email: empresa.ownerEmail,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success("Email enviado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao reenviar: " + error.message);
    },
  });

  if (user && !isSuperAdmin) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6 text-center">
            <p className="text-slate-300">Acesso restrito a administradores</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleEdit = (empresa) => {
    setEditingEmpresa(empresa);
    setOpen(true);
  };

  const handleDelete = (empresa) => {
    setDeleteDialog({ open: true, empresa, confirmText: '' });
  };

  const confirmarDelete = () => {
    if (deleteDialog.confirmText !== deleteDialog.empresa?.nome) return;
    deleteEmpresaMutation.mutate(deleteDialog.empresa.id);
    setDeleteDialog({ open: false, empresa: null, confirmText: '' });
  };

  const planosCores = {
    starter: "bg-blue-100 text-blue-800",
    pro: "bg-purple-100 text-purple-800",
    enterprise: "bg-amber-100 text-amber-800",
  };

  const validarBanco = async () => {
    setValidando(true);
    try {
      const response = await api.functions.invoke('validarBancoDados', {});
      setResultadoValidacao(response.data);
      toast.success('Validação concluída!');
    } catch (error) {
      toast.error('Erro ao validar: ' + error.message);
    } finally {
      setValidando(false);
    }
  };

  const limparOrfaos = async () => {
    setLimpando(true);
    try {
      const response = await api.functions.invoke('limparRegistrosOrfaos', {});
      toast.success(response.data.message);
      // Revalidar após limpar
      setTimeout(() => validarBanco(), 1000);
    } catch (error) {
      toast.error('Erro ao limpar: ' + error.message);
    } finally {
      setLimpando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e1a] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Gerenciamento de Empresas</h1>
              <p className="text-slate-500 text-sm mt-0.5">Cadastro e configuração de empresas clientes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to={createPageUrl("DebugEmpresas")}>
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-slate-800">
                <Bug className="w-4 h-4 mr-2" />
                Debug
              </Button>
            </Link>
            <Button
              onClick={validarBanco}
              disabled={validando}
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-white hover:bg-slate-800"
            >
              {validando
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Validando...</>
                : <><ShieldCheck className="w-4 h-4 mr-2" />Validar</>}
            </Button>
            <Button
              onClick={() => { setEditingEmpresa(null); setOpen(true); }}
              size="sm"
              className="bg-blue-600 hover:bg-blue-500 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Empresa
            </Button>
          </div>
        </div>

        {resultadoValidacao && (
          <Card className="bg-slate-900 border-slate-800 mb-6">
            <CardHeader>
              <CardTitle className="text-white">{resultadoValidacao.status}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-5 gap-4">
                <div className="bg-slate-800 p-3 rounded"><p className="text-xs text-slate-400">Empresas</p><p className="text-xl font-bold text-white">{resultadoValidacao.estatisticas?.total_empresas || 0}</p></div>
                <div className="bg-slate-800 p-3 rounded"><p className="text-xs text-slate-400">Vínculos</p><p className="text-xl font-bold text-white">{resultadoValidacao.estatisticas?.total_vinculos || 0}</p></div>
                <div className="bg-slate-800 p-3 rounded"><p className="text-xs text-slate-400">Convites</p><p className="text-xl font-bold text-white">{resultadoValidacao.estatisticas?.total_convites || 0}</p></div>
                <div className="bg-slate-800 p-3 rounded"><p className="text-xs text-slate-400">Pendentes</p><p className="text-xl font-bold text-yellow-400">{resultadoValidacao.estatisticas?.convites_pendentes || 0}</p></div>
                <div className="bg-slate-800 p-3 rounded"><p className="text-xs text-slate-400">Aceitos</p><p className="text-xl font-bold text-green-400">{resultadoValidacao.estatisticas?.convites_aceitos || 0}</p></div>
              </div>
              {resultadoValidacao.empresas?.length > 0 && (<div><h3 className="text-white font-semibold mb-2">📋 Empresas no Banco:</h3><div className="space-y-2 max-h-64 overflow-y-auto">{resultadoValidacao.empresas.map(emp => (<div key={emp.id} className="bg-slate-800 p-3 rounded text-sm"><p className="text-white">ID: <span className="text-blue-400 font-mono">{emp.id}</span></p><p className="text-slate-400">Nome: {emp.nome}</p><p className="text-slate-400">Owner: {emp.ownerEmail}</p></div>))}</div></div>)}
              {resultadoValidacao.erros?.length > 0 && (<div><div className="flex items-center justify-between mb-2"><h3 className="text-red-400 font-semibold">❌ Erros ({resultadoValidacao.erros.length}):</h3><Button size="sm" onClick={limparOrfaos} disabled={limpando} className="bg-red-600 hover:bg-red-700">{limpando ? 'Limpando...' : 'Limpar Órfãos'}</Button></div><ul className="space-y-1 max-h-64 overflow-y-auto">{resultadoValidacao.erros.map((erro, i) => (<li key={i} className="text-red-300 text-sm">{erro}</li>))}</ul></div>)}
              {resultadoValidacao.avisos?.length > 0 && (<div><h3 className="text-yellow-400 font-semibold mb-2">⚠️ Avisos:</h3><ul className="space-y-1">{resultadoValidacao.avisos.map((aviso, i) => (<li key={i} className="text-yellow-300 text-sm">{aviso}</li>))}</ul></div>)}
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : empresas.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="pt-6 text-center">
              <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-300">Nenhuma empresa cadastrada</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Empresas</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400 hover:bg-transparent">ID</TableHead>
                    <TableHead className="text-slate-400 hover:bg-transparent">Nome</TableHead>
                    <TableHead className="text-slate-400 hover:bg-transparent">CNPJ</TableHead>
                    <TableHead className="text-slate-400 hover:bg-transparent">Plano</TableHead>
                    <TableHead className="text-slate-400 hover:bg-transparent">Usuários</TableHead>
                    <TableHead className="text-slate-400 hover:bg-transparent">Status</TableHead>
                    <TableHead className="text-slate-400 hover:bg-transparent">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empresas.map((empresa, index) => (
                    <TableRow key={empresa.id} className="border-slate-800 hover:bg-orange-500/5 transition-colors">
                      <TableCell className="text-slate-300 font-mono text-sm">
                        ID{String(index + 1).padStart(3, '0')}
                      </TableCell>
                      <TableCell className="text-white font-medium">
                        {empresa.nome}
                      </TableCell>
                      <TableCell className="text-slate-400">{empresa.cnpj}</TableCell>
                      <TableCell>
                        <Badge className={planosCores[empresa.plano] || "bg-slate-700"}>
                          {empresa.plano}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-400">
                        {empresa.limiteUsuarios}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            empresa.statusPlano === "ativo"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }
                        >
                          {empresa.statusPlano}
                        </Badge>
                      </TableCell>
                      <TableCell className="flex gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => reenviarConviteMutation.mutate(empresa)}
                          disabled={reenviarConviteMutation.isPending}
                          className="text-blue-400 hover:text-blue-600"
                          title="Reenviar email de acesso"
                        >
                          <Mail className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(empresa)}
                          className="text-slate-400 hover:text-white"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            localStorage.setItem("impersonated_empresa_id", empresa.id);
                            localStorage.setItem("impersonated_empresa_nome", empresa.nome);
                            toast.success(`Visualizando como "${empresa.nome}"`);
                            window.location.href = createPageUrl("Dashboard");
                          }}
                          className="text-violet-400 hover:text-violet-300 hover:bg-violet-500/10"
                          title="Entrar como esta empresa"
                        >
                          <LogIn className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(empresa)}
                          disabled={deleteEmpresaMutation.isPending}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Dialog de confirmação de exclusão */}
        <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, empresa: null, confirmText: '' })}>
          <AlertDialogContent className="bg-slate-900 border-slate-800 max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-400" />
                Excluir Empresa
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400 space-y-3">
                <p>Esta ação é <span className="text-red-400 font-semibold">irreversível</span>. Todos os vínculos, convites e dados da empresa serão removidos permanentemente.</p>
                <p className="text-slate-300">Digite <span className="font-mono font-bold text-white bg-slate-800 px-1.5 py-0.5 rounded">{deleteDialog.empresa?.nome}</span> para confirmar:</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              value={deleteDialog.confirmText}
              onChange={(e) => setDeleteDialog(prev => ({ ...prev, confirmText: e.target.value }))}
              placeholder={deleteDialog.empresa?.nome}
              className="bg-slate-800 border-slate-700 text-white mt-2"
              autoFocus
            />
            <AlertDialogFooter className="mt-4">
              <AlertDialogCancel className="bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:bg-slate-700 hover:text-white hover:border-slate-600 rounded-xl">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmarDelete}
                disabled={deleteDialog.confirmText !== deleteDialog.empresa?.nome || deleteEmpresaMutation.isPending}
                className="bg-red-600 hover:bg-red-500 text-white disabled:opacity-40"
              >
                {deleteEmpresaMutation.isPending
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Excluindo...</>
                  : 'Excluir definitivamente'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <GerenciamentoEmpresasModal
          open={open}
          onOpenChange={setOpen}
          empresa={editingEmpresa}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["empresas"] });
            setEditingEmpresa(null);
            setOpen(false);
          }}
        />
      </div>
    </div>
  );
}