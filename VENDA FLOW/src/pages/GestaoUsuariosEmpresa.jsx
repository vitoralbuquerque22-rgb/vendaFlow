import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listarVinculos, listarEquipes } from "@/lib/services/equipeService";
import { buscarUserProfile, atualizarUserProfile, listarUserProfiles } from "@/lib/services/telefoniaService";

import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, MoreVertical, Trash2, AlertCircle, Phone, RefreshCw,
  CheckCircle2, XCircle, Loader2, Save, Edit2, X, UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import ConviteUsuarioModal from "@/components/empresa/ConviteUsuarioModal";
import CopiarLinkConvite from "@/components/empresa/CopiarLinkConvite";

export default function GestaoUsuariosEmpresa() {
  const [modalOpen, setModalOpen]             = useState(false);
  const [editandoRamal, setEditandoRamal]     = useState(null); // email do usuário sendo editado
  const [ramalInput, setRamalInput]           = useState("");
  const [sincronizando, setSincronizando]     = useState(false);
  const queryClient = useQueryClient();
  const { empresaId } = useEmpresaAtual();

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const { data: vinculoUsuario } = useQuery({
    queryKey: ["vinculo-usuario", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const vinculos = await listarVinculos(null);
      return vinculos.find(v => v.userEmail === user.email) || null;
    },
    enabled: !!user?.email,
  });

  const { data: empresa } = useQuery({
    queryKey: ["empresa", empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      return await base44.entities.Empresa.filter({ id: empresaId });
    }, // Empresa usa RLS própria — mantido direto
    enabled: !!empresaId,
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ["usuarios-empresa", empresa?.[0]?.id],
    queryFn: async () => {
      if (!empresa?.[0]?.id) return [];
      return await listarVinculos(empresa[0].id);
    },
    enabled: !!empresa?.[0]?.id,
  });

  const { data: convites = [] } = useQuery({
    queryKey: ["convites-empresa", empresa?.[0]?.id],
    queryFn: async () => {
      if (!empresa?.[0]?.id) return [];
      const todos = await base44.entities.ConviteEmpresa.filter({ empresaId: empresa[0].id });
      return todos.filter(c => c.status !== "aceito");
    },
    enabled: !!empresa?.[0]?.id,
  });

  // Buscar UserProfiles para ver ramal e status 3C Plus de cada usuário
  const { data: profiles = [] } = useQuery({
    queryKey: ["user-profiles-empresa", empresa?.[0]?.id],
    queryFn: async () => {
      if (!empresa?.[0]?.id || usuarios.length === 0) return [];
      const emails = usuarios.map(u => u.userEmail);
      const todos = await listarUserProfiles(null);
      return todos.filter(p => emails.includes(p.user_email));
    },
    enabled: usuarios.length > 0,
  });

  const desativarMutation = useMutation({
    mutationFn: async (vinculoId) => await base44.entities.VinculoEmpresa.update(vinculoId, { status: "inativo" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["usuarios-empresa"] }); toast.success("Usuário desativado"); },
  });

  const alterarPapelMutation = useMutation({
    mutationFn: async ({ vinculoId, novoPapel, userEmail }) => {
      await base44.entities.VinculoEmpresa.update(vinculoId, { papel: novoPapel });
      const profiles = await base44.entities.UserProfile.filter({ user_email: userEmail, empresaId: empresa[0]?.id });
      if (profiles.length > 0) {
        await base44.entities.UserProfile.update(profiles[0].id, { role: novoPapel });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios-empresa"] });
      queryClient.invalidateQueries({ queryKey: ["user-profiles-empresa"] });
      toast.success("Papel atualizado com sucesso!");
    },
  });

  const reativarMutation = useMutation({
    mutationFn: async (vinculoId) => await base44.entities.VinculoEmpresa.update(vinculoId, { status: "ativo" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios-empresa"] });
      toast.success("Usuário reativado!");
    },
  });

  const deletarConviteMutation = useMutation({
    mutationFn: async (conviteId) => await base44.entities.ConviteEmpresa.delete(conviteId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["convites-empresa"] }); toast.success("Convite removido"); },
  });

  const reenviarConviteMutation = useMutation({
    mutationFn: async (conviteAntigo) => {
      await base44.entities.ConviteEmpresa.delete(conviteAntigo.id);
      const codigo = Math.random().toString(36).substring(2, 12).toUpperCase();
      await base44.entities.ConviteEmpresa.create({
        empresaId: conviteAntigo.empresaId || empresa[0]?.id,
        email: conviteAntigo.email,
        papel: conviteAntigo.papel,
        codigo,
        expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
      return { codigo };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["convites-empresa"] });
      toast.success("Novo link gerado! Copie e envie ao colaborador.");
    },
    onError: (e) => toast.error("Erro ao regenerar: " + e.message),
  });

  const salvarRamalMutation = useMutation({
    mutationFn: async ({ email, ramal }) => {
      const perfil = await buscarUserProfile(email);
      if (perfil?.id) {
        await atualizarUserProfile(perfil.id, {
          ramal_3cplus: ramal,
          "3cplus_sincronizado": false, // marcar para re-sincronizar
        });
      }
    }, // fim salvarRamalMutation
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profiles-empresa"] });
      toast.success("Ramal salvo! Clique em 'Sincronizar' para vincular ao 3C Plus.");
      setEditandoRamal(null);
    },
  });

  const handleSincronizar = async () => {
    if (!empresa?.[0]?.id) return;
    setSincronizando(true);
    try {
      const res = await base44.functions.invoke("sincronizarAgentes3CPlus", {
        empresaId: empresa[0].id,
      });
      queryClient.invalidateQueries({ queryKey: ["user-profiles-empresa"] });
      toast.success(
        res.agentes_vinculados > 0
          ? `${res.agentes_vinculados} agente(s) sincronizado(s) com o 3C Plus`
          : "Nenhum agente novo para sincronizar",
        {
          description: res.agentes_nao_encontrados?.length > 0
            ? `Não encontrado: ${res.agentes_nao_encontrados.join(", ")}`
            : undefined,
        }
      );
    } catch (e) {
      toast.error("Erro na sincronização", { description: e.message });
    } finally {
      setSincronizando(false);
    }
  };

  const getProfile = (email) => profiles.find(p => p.user_email === email || p.user_email?.toLowerCase() === email?.toLowerCase());

  const usuariosAtivos = usuarios.filter(u => u.status === "ativo").length;
  const podeConvidarMais = usuariosAtivos < (empresa?.[0]?.limiteUsuarios || 5);
  const isAdmin = vinculoUsuario?.papel === "admin" || user?.role === "admin";

  // Quantos têm ramal configurado mas não sincronizado
  const pendentesSync = profiles.filter(p => p.ramal_3cplus && !p["3cplus_sincronizado"]).length;

  // Novos membros nas últimas 48h
  const DISMISSED_KEY = "dismissed_new_members";
  const getDismissed = () => {
    try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]"); } catch { return []; }
  };
  const [dismissed, setDismissed] = useState(getDismissed);

  const novosMembers = useMemo(() => {
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    return usuarios.filter(v =>
      v.status === "ativo" &&
      new Date(v.created_date) > new Date(cutoff) &&
      !dismissed.includes(v.id)
    );
  }, [usuarios, dismissed]);

  const dispensarMembro = (id) => {
    const next = [...dismissed, id];
    setDismissed(next);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
  };

  if (!empresa) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-6">
          <p className="text-slate-400 text-sm">Carregando dados da empresa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-1 h-6 bg-gradient-to-b from-sky-400 to-violet-500 rounded-full" />
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              Usuários da Empresa
              {novosMembers.length > 0 && (
                <span className="relative flex h-5 w-5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                  <span className="relative inline-flex items-center justify-center h-5 w-5 rounded-full bg-emerald-500 text-white text-[9px] font-bold">
                    {novosMembers.length}
                  </span>
                </span>
              )}
            </h1>
          </div>
          <p className="text-slate-500 text-sm ml-3">{empresa[0]?.nome}</p>
        </div>

        {/* Botão sincronizar */}
        {isAdmin && (
          <button
            onClick={handleSincronizar}
            disabled={sincronizando}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all",
              pendentesSync > 0
                ? "bg-gradient-to-r from-sky-500 to-violet-500 text-white shadow-md shadow-sky-500/20 hover:from-sky-400 hover:to-violet-400"
                : "border border-slate-700/50 bg-slate-800/60 text-slate-400 hover:text-white",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            {sincronizando
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <RefreshCw className="w-4 h-4" />
            }
            Sincronizar 3C Plus
            {pendentesSync > 0 && (
              <span className="w-5 h-5 rounded-full bg-white/20 text-white text-[10px] font-bold flex items-center justify-center">
                {pendentesSync}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ── Novos colaboradores ────────────────────────── */}
      <AnimatePresence>
        {novosMembers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(52,211,153,0.25)", background: "linear-gradient(135deg, rgba(16,185,129,0.06), rgba(52,211,153,0.04))" }}
          >
            <div className="px-5 py-3 border-b border-emerald-500/15 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <p className="text-sm font-semibold text-emerald-300">Novos Colaboradores</p>
              <span className="ml-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                {novosMembers.length}
              </span>
            </div>
            <div className="divide-y divide-emerald-500/10">
              {novosMembers.map(v => (
                <div key={v.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm text-white font-medium">{v.userName || v.userEmail}</p>
                    <p className="text-xs text-slate-400">{v.userEmail}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize">
                        {v.papel}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Entrou em {new Date(v.created_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={v.papel}
                      onChange={(e) => alterarPapelMutation.mutate({ vinculoId: v.id, novoPapel: e.target.value, userEmail: v.userEmail })}
                      className="px-2 py-1 rounded-lg text-xs border bg-slate-800/80 cursor-pointer outline-none"
                      style={{ borderColor: "rgba(52,211,153,0.2)", color: "#e2e8f0" }}
                    >
                      <option value="admin">Admin</option>
                      <option value="gestor">Gestor</option>
                      <option value="sdr">SDR</option>
                      <option value="closer">Closer</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="cs">CS</option>
                    </select>
                    <button
                      onClick={() => dispensarMembro(v.id)}
                      className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors px-2 py-1 rounded-lg hover:bg-slate-700/40"
                    >
                      Dispensar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Plano ──────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-5">
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-xs text-slate-500 mb-1">Usuários ativos</p>
            <p className="text-2xl font-bold text-white">{usuariosAtivos}<span className="text-slate-600 text-base">/{empresa[0]?.limiteUsuarios}</span></p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Plano</p>
            <Badge className="bg-sky-500/10 text-sky-400 border border-sky-500/20">{empresa[0]?.plano || "—"}</Badge>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Status</p>
            <Badge className={cn(
              "border",
              empresa[0]?.statusPlano === "ativo"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
            )}>
              {empresa[0]?.statusPlano || "—"}
            </Badge>
          </div>
        </div>
      </div>

      {!podeConvidarMais && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-300">Limite de {empresa[0]?.limiteUsuarios} usuários atingido. Faça upgrade para adicionar mais.</p>
        </div>
      )}

      {/* ── Botão convidar ─────────────────────────────── */}
      {isAdmin && (
        <button
          onClick={() => setModalOpen(true)}
          disabled={!podeConvidarMais}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all",
            podeConvidarMais
              ? "bg-gradient-to-r from-sky-500 to-violet-500 text-white shadow-md shadow-sky-500/20 hover:from-sky-400 hover:to-violet-400"
              : "border border-slate-700/50 bg-slate-800/60 text-slate-500 cursor-not-allowed"
          )}
        >
          <Plus className="w-4 h-4" />
          Convidar colaborador
        </button>
      )}

      {/* ── Convites ───────────────────────────────────── */}
      {convites.length > 0 && (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/60 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800/40">
            <p className="text-sm font-semibold text-white">Convites</p>
          </div>
          <div className="divide-y divide-slate-800/40">
            {convites.map(convite => (
              <div key={convite.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm text-white">{convite.email}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-500 font-mono">Código: {convite.codigo}</span>
                    <span className="text-[10px] text-slate-500">•</span>
                    <span className="text-[10px] text-slate-500 capitalize">{convite.papel}</span>
                    {convite.expiraEm && new Date(convite.expiraEm) < new Date() && convite.status === "pendente" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">Expirado</span>
                    )}
                    {convite.status === "expirado" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">Expirado</span>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <CopiarLinkConvite codigo={convite.codigo} variant="icon" />
                    <Button variant="ghost" size="sm" onClick={() => reenviarConviteMutation.mutate(convite)}
                      className="h-7 px-2 text-slate-400/60 hover:text-slate-300 text-xs" title="Gerar novo código">
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Novo código
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deletarConviteMutation.mutate(convite.id)}
                      className="h-7 w-7 p-0 text-rose-400/60 hover:text-rose-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabela de usuários ─────────────────────────── */}
      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800/40 flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Colaboradores ({usuariosAtivos})</p>
          <p className="text-[10px] text-slate-500 flex items-center gap-1">
            <Phone className="w-3 h-3" />
            Ramal 3C Plus — preenchido pelo admin, sincronizado automaticamente
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800/40">
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">Usuário</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">Papel</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">Status</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-sky-400" />
                    Ramal 3C Plus
                  </span>
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">3C Plus</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30">
              {usuarios.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-slate-500 py-10 text-sm">
                    Nenhum usuário cadastrado
                  </td>
                </tr>
              ) : (
                usuarios.map(usuario => {
                  const profile = getProfile(usuario.userEmail);
                  const sincronizado = profile?.["3cplus_sincronizado"];
                  const ramal = profile?.ramal_3cplus;
                  const id3C = profile?.id_3cplus;

                  return (
                    <tr key={usuario.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Email */}
                      <td className="px-5 py-3">
                        <p className="text-white text-sm">{usuario.userEmail}</p>
                        <p className="text-[10px] text-slate-600">{usuario.userName}</p>
                      </td>

                      {/* Papel */}
                      <td className="px-5 py-3">
                        {isAdmin && usuario.userEmail !== user?.email ? (
                          <select
                            value={usuario.papel}
                            onChange={(e) => alterarPapelMutation.mutate({ vinculoId: usuario.id, novoPapel: e.target.value, userEmail: usuario.userEmail })}
                            className="px-2 py-0.5 rounded-md text-xs font-medium border bg-transparent cursor-pointer outline-none capitalize"
                            style={{ borderColor: "rgba(255,255,255,0.1)", color: "#e2e8f0" }}
                          >
                            <option value="admin">Admin</option>
                            <option value="gestor_empresa">Gestor Empresa</option>
                            <option value="gerente_empresa">Gerente</option>
                            <option value="gerente_filial">Ger. Filial</option>
                            <option value="supervisor">Supervisor</option>
                            <option value="marketing">Marketing</option>
                            <option value="gestor">Gestor</option>
                            <option value="sdr">SDR</option>
                            <option value="closer">Closer</option>
                            <option value="cs">CS</option>
                            <option value="social_seller">Social Seller</option>
                          </select>
                        ) : (
                          <span className={cn(
                            "px-2 py-0.5 rounded-md text-[10px] font-medium border capitalize",
                            usuario.papel === "admin"  && "bg-violet-500/10 text-violet-400 border-violet-500/20",
                            usuario.papel === "gestor" && "bg-sky-500/10 text-sky-400 border-sky-500/20",
                            usuario.papel === "sdr"    && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                            usuario.papel === "closer" && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                            !["admin","gestor","sdr","closer"].includes(usuario.papel) && "bg-slate-700/60 text-slate-400 border-slate-700/40"
                          )}>
                            {usuario.papel}
                          </span>
                        )}
                      </td>

                      {/* Status vínculo */}
                      <td className="px-5 py-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[10px] font-medium border",
                          usuario.status === "ativo"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-slate-700/60 text-slate-500 border-slate-700/40"
                        )}>
                          {usuario.status}
                        </span>
                      </td>

                      {/* Ramal 3C Plus (editável) */}
                      <td className="px-5 py-3">
                        {editandoRamal === usuario.userEmail ? (
                          <div className="flex items-center gap-1.5">
                            <Input
                              value={ramalInput}
                              onChange={e => setRamalInput(e.target.value)}
                              placeholder="Ex: 159270"
                              className="h-7 w-28 text-xs bg-slate-800 border-slate-700 text-white font-mono"
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === "Enter") salvarRamalMutation.mutate({ email: usuario.userEmail, ramal: ramalInput });
                                if (e.key === "Escape") setEditandoRamal(null);
                              }}
                            />
                            <Button size="sm" variant="ghost" onClick={() => salvarRamalMutation.mutate({ email: usuario.userEmail, ramal: ramalInput })}
                              className="h-7 w-7 p-0 text-emerald-400 hover:bg-emerald-500/10">
                              <Save className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditandoRamal(null)}
                              className="h-7 w-7 p-0 text-slate-500">
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 group">
                            <span className={cn("text-xs font-mono", ramal ? "text-slate-300" : "text-slate-600")}>
                              {ramal || "—"}
                            </span>
                            {isAdmin && (
                              <button
                                onClick={() => { setEditandoRamal(usuario.userEmail); setRamalInput(ramal || ""); }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Edit2 className="w-3 h-3 text-slate-500 hover:text-sky-400" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Status 3C Plus */}
                      <td className="px-5 py-3">
                        {!ramal ? (
                          <span className="text-[10px] text-slate-600">sem ramal</span>
                        ) : sincronizado ? (
                          <div className="flex items-center gap-1 text-[10px] text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            {id3C ? `ID ${id3C}` : "Vinculado"}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[10px] text-amber-400">
                            <AlertCircle className="w-3 h-3" />
                            Pendente sync
                          </div>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="px-5 py-3 text-right">
                        {isAdmin && usuario.userEmail !== user?.email && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                              {usuario.status === "inativo" && (
                                <DropdownMenuItem
                                  onClick={() => reativarMutation.mutate(usuario.id)}
                                  className="text-emerald-400 focus:bg-emerald-900/20 text-sm"
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-2" />
                                  Reativar
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => desativarMutation.mutate(usuario.id)}
                                className="text-rose-400 focus:bg-rose-900/20 text-sm"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Desativar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Legenda 3C Plus ────────────────────────────── */}
      <div className="px-4 py-3 rounded-2xl bg-slate-900/40 border border-slate-800/40 flex items-start gap-3">
        <Phone className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-slate-500 space-y-1">
          <p><span className="text-slate-300">Para vincular um novo vendedor ao 3C Plus:</span></p>
          <p>1. Crie o agente no painel 3C Plus → anote o ramal</p>
          <p>2. Preencha o ramal na coluna acima (clique no ícone de lápis)</p>
          <p>3. Clique em <span className="text-sky-400 font-medium">Sincronizar 3C Plus</span> — o token e ID são vinculados automaticamente</p>
        </div>
      </div>

      {/* Modal de convite */}
      <ConviteUsuarioModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        empresaId={empresa[0]?.id}
        onConviteSuccess={() => queryClient.invalidateQueries({ queryKey: ["convites-empresa"] })}
      />
    </div>
  );
}