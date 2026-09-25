import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, ShieldOff } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function DebugEmpresas() {
  const { data: currentUser, isLoading: loadingUser } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const isSuperAdmin = currentUser?.role === "admin";

  const { data: empresas, isLoading: loadingEmpresas } = useQuery({
    queryKey: ["debug-empresas"],
    queryFn: () => base44.entities.Empresa.list(),
    enabled: isSuperAdmin,
  });

  const { data: vinculos } = useQuery({
    queryKey: ["debug-vinculos"],
    queryFn: () => base44.entities.VinculoEmpresa.list(),
    enabled: isSuperAdmin,
  });

  const { data: convites } = useQuery({
    queryKey: ["debug-convites"],
    queryFn: () => base44.entities.ConviteEmpresa.list(),
    enabled: isSuperAdmin,
  });

  const { data: users } = useQuery({
    queryKey: ["debug-users"],
    queryFn: () => base44.entities.User.list(),
    enabled: isSuperAdmin,
  });

  const isLoading = loadingUser || loadingEmpresas;

  if (!loadingUser && !isSuperAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 flex items-center justify-center">
        <div className="text-center space-y-3">
          <ShieldOff className="w-10 h-10 text-rose-400 mx-auto" />
          <p className="text-white font-semibold">Acesso restrito a administradores globais</p>
          <Link to={createPageUrl("GerenciamentoEmpresas")}>
            <Button variant="outline" size="sm" className="text-slate-400">Voltar</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl("GerenciamentoEmpresas")}>
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-slate-800">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-white">🔍 Debug - Dados Completos</h1>
        </div>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">📊 Empresas ({empresas?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {empresas?.map((empresa) => (
              <div key={empresa.id} className="bg-slate-800 p-4 rounded-lg space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-400">ID:</span>
                    <span className="text-blue-400 font-mono ml-2">{empresa.id}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Nome:</span>
                    <span className="text-white ml-2">{empresa.nome}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">CNPJ:</span>
                    <span className="text-white ml-2">{empresa.cnpj}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Owner:</span>
                    <span className="text-white ml-2">{empresa.ownerEmail}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Plano:</span>
                    <span className="text-white ml-2">{empresa.plano}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Created Date:</span>
                    <span className="text-green-400 ml-2">{empresa.created_date}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Updated Date:</span>
                    <span className="text-yellow-400 ml-2">{empresa.updated_date}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Created By:</span>
                    <span className="text-purple-400 ml-2">{empresa.created_by}</span>
                  </div>
                </div>
                <details className="mt-2">
                  <summary className="text-slate-400 cursor-pointer">Ver JSON completo</summary>
                  <pre className="bg-slate-950 p-2 rounded mt-2 text-xs text-white overflow-x-auto">
                    {JSON.stringify(empresa, null, 2)}
                  </pre>
                </details>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">🔗 Vínculos ({vinculos?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {vinculos?.map((v) => (
              <div key={v.id} className="bg-slate-800 p-3 rounded text-sm">
                <p className="text-white">
                  ID: <span className="text-blue-400 font-mono">{v.id}</span> | 
                  EmpresaID: <span className="text-green-400 font-mono">{v.empresaId}</span> | 
                  User: <span className="text-yellow-400">{v.userEmail}</span> | 
                  Papel: <span className="text-purple-400">{v.papel}</span>
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">✉️ Convites ({convites?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {convites?.map((c) => (
              <div key={c.id} className="bg-slate-800 p-3 rounded text-sm">
                <p className="text-white">
                  ID: <span className="text-blue-400 font-mono">{c.id}</span> | 
                  EmpresaID: <span className="text-green-400 font-mono">{c.empresaId}</span> | 
                  Email: <span className="text-yellow-400">{c.email}</span> | 
                  Status: <span className="text-purple-400">{c.status}</span>
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">👥 Usuários ({users?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {users?.map((user) => (
              <div key={user.id} className="bg-slate-800 p-4 rounded-lg space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-400">ID:</span>
                    <span className="text-blue-400 font-mono ml-2">{user.id}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Nome:</span>
                    <span className="text-white ml-2">{user.full_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Email:</span>
                    <span className="text-yellow-400 ml-2">{user.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Role:</span>
                    <span className="text-purple-400 ml-2">{user.role}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Created Date:</span>
                    <span className="text-green-400 ml-2">{user.created_date}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Updated Date:</span>
                    <span className="text-yellow-400 ml-2">{user.updated_date}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400">Empresas vinculadas:</span>
                    <span className="text-white ml-2">
                      {vinculos?.filter(v => v.userEmail === user.email).map(v => (
                        <span key={v.id} className="inline-block bg-slate-700 px-2 py-1 rounded mr-2 text-xs">
                          {empresas?.find(e => e.id === v.empresaId)?.nome || v.empresaId} ({v.papel})
                        </span>
                      ))}
                    </span>
                  </div>
                </div>
                <details className="mt-2">
                  <summary className="text-slate-400 cursor-pointer">Ver JSON completo</summary>
                  <pre className="bg-slate-950 p-2 rounded mt-2 text-xs text-white overflow-x-auto">
                    {JSON.stringify(user, null, 2)}
                  </pre>
                </details>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}