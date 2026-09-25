import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listarUserProfiles } from "@/lib/services/empresaService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2, Phone, Instagram, Users, TrendingUp,
  Calendar, Save, Pencil, Loader2,
} from "lucide-react";
import { toast } from "sonner";

export default function MetasPorVendedor() {
  const queryClient = useQueryClient();
  const [userEditando, setUserEditando] = useState(null);
  const [formData, setFormData] = useState({});

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: userProfiles = [] } = useQuery({
    queryKey: ["userProfiles"],
    queryFn: listarUserProfiles,
  });

  // Resolve role e nome do UserProfile (case-insensitive match)
  const getProfile = (userEmail) =>
    userProfiles.find((p) => p.user_email?.toLowerCase() === userEmail?.toLowerCase());

  // Resolve meta_mensal — pode estar em user.meta_mensal ou user.data.meta_mensal
  const getMeta = (user) => user.meta_mensal || user.data?.meta_mensal || {};

  const atualizarUsuarioMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Metas do vendedor atualizadas!");
      setUserEditando(null);
    },
  });

  const abrirModal = (user) => {
    setUserEditando(user);
    const m = getMeta(user);
    setFormData({
      ligacoes: m.ligacoes ?? 0,
      meta_leads_trabalhados: m.leads ?? 20,
      tarefas_concluidas: m.tarefas_concluidas ?? 0,
      vendas: m.vendas ?? 0,
      receita: m.receita ?? 0,
      meta_reunioes_agendadas: m.reunioes_agendadas ?? 5,
      meta_reunioes_realizadas: m.reunioes_realizadas ?? 3,
      plataforma_ligacao: user.plataforma_ligacao ?? user.data?.plataforma_ligacao ?? "",
      plataforma_ligacao_url: user.plataforma_ligacao_url ?? user.data?.plataforma_ligacao_url ?? "",
      instagram_username: user.instagram_username ?? user.data?.instagram_username ?? "",
    });
  };

  const handleChange = (campo, valor) => {
    const isText = ["plataforma_ligacao", "plataforma_ligacao_url", "instagram_username"].includes(campo);
    setFormData((prev) => ({
      ...prev,
      [campo]: isText ? valor : (parseFloat(valor) || 0),
    }));
  };

  const handleSalvar = async () => {
    await atualizarUsuarioMutation.mutateAsync({
      id: userEditando.id,
      data: {
        meta_mensal: {
          ligacoes: formData.ligacoes,
          leads: formData.meta_leads_trabalhados,
          tarefas_concluidas: formData.tarefas_concluidas,
          vendas: formData.vendas,
          receita: formData.receita,
          reunioes_agendadas: formData.meta_reunioes_agendadas,
          reunioes_realizadas: formData.meta_reunioes_realizadas,
        },
        plataforma_ligacao: formData.plataforma_ligacao,
        plataforma_ligacao_url: formData.plataforma_ligacao_url,
        instagram_username: formData.instagram_username,
      },
    });
  };

  const roleLabel = (role) => {
    if (role === "admin") return "Admin";
    if (role === "gestor") return "Gestor";
    if (role === "closer") return "Closer";
    if (role === "sdr") return "SDR";
    return role || "—";
  };

  const roleColor = (role) => {
    if (role === "admin") return "bg-purple-500/20 text-purple-300 border-purple-500/30";
    if (role === "gestor") return "bg-blue-500/20 text-blue-300 border-blue-500/30";
    if (role === "closer") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    return "bg-orange-500/20 text-orange-300 border-orange-500/30";
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Metas por Vendedor</h1>
        <p className="text-slate-400 mt-1">Configure metas individuais, plataforma de telefonia e Instagram</p>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-slate-700/60 overflow-hidden">
        {/* Cabeçalho */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_80px] bg-slate-800/80 text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-700/60">
          <div className="px-4 py-3">Vendedor</div>
          <div className="px-3 py-3 text-center">Ligações/Mês</div>
          <div className="px-3 py-3 text-center">Leads/Mês</div>
          <div className="px-3 py-3 text-center">Tarefas</div>
          <div className="px-3 py-3 text-center">Vendas</div>
          <div className="px-3 py-3 text-center">Receita (R$)</div>
          <div className="px-3 py-3 text-center">Reuniões Ag.</div>
          <div className="px-3 py-3 text-center">Reuniões Real.</div>
          <div className="px-3 py-3 text-center">Ações</div>
        </div>

        {/* Linhas */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 bg-slate-900/40">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center bg-slate-900/40">
            <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">Nenhum usuário encontrado</p>
          </div>
        ) : (
          users.map((user, idx) => {
            const profile = getProfile(user.email);
            const effectiveRole = profile?.role || user.role || "sdr";
            const m = getMeta(user);
            const displayName = profile?.user_name?.trim() || user.full_name || user.email;

            return (
            <div
              key={user.id}
              className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_80px] items-center border-b border-slate-700/40 transition-colors hover:bg-slate-800/40 ${
                idx % 2 === 0 ? "bg-slate-900/30" : "bg-slate-900/10"
              }`}
            >
              {/* Vendedor */}
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ff6b35]/30 to-[#ff8c42]/20 border border-[#ff6b35]/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#ff8c42] font-bold text-xs">
                    {displayName?.charAt(0)?.toUpperCase() || "U"}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{displayName}</p>
                  <p className="text-slate-500 text-xs truncate">{user.email}</p>
                </div>
                <Badge className={`text-[10px] px-2 py-0 h-5 flex-shrink-0 border ${roleColor(effectiveRole)}`}>
                  {roleLabel(effectiveRole)}
                </Badge>
              </div>

              {/* Métricas */}
              {[
                m.ligacoes ?? 0,
                m.leads ?? 20,
                m.tarefas_concluidas ?? 0,
                m.vendas ?? 0,
              ].map((val, i) => (
                <div key={i} className="px-3 py-3 text-center">
                  <span className="text-white text-sm font-medium">{val}</span>
                </div>
              ))}

              {/* Receita */}
              <div className="px-3 py-3 text-center">
                <span className="text-white text-sm font-medium">
                  {m.receita
                    ? `R$ ${Number(m.receita).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`
                    : "R$ 0"}
                </span>
              </div>

              {/* Reuniões Ag. */}
              <div className="px-3 py-3 text-center">
                <span className="text-white text-sm font-medium">{m.reunioes_agendadas ?? 5}</span>
              </div>

              {/* Reuniões Real. */}
              <div className="px-3 py-3 text-center">
                <span className="text-white text-sm font-medium">{m.reunioes_realizadas ?? 3}</span>
              </div>

              {/* Ações */}
              <div className="px-3 py-3 flex justify-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => abrirModal(user)}
                  className="h-7 px-3 border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white text-xs gap-1.5"
                >
                  <Pencil className="w-3 h-3" />
                  Editar
                </Button>
              </div>
            </div>
            );
          })
        )}
      </div>

      {/* Modal de Edição */}
      <Dialog open={!!userEditando} onOpenChange={() => setUserEditando(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ff6b35]/30 to-[#ff8c42]/20 border border-[#ff6b35]/20 flex items-center justify-center">
                <span className="text-[#ff8c42] font-bold text-xs">
                  {(getProfile(userEditando?.email)?.user_name?.trim() || userEditando?.full_name || userEditando?.email)?.charAt(0)?.toUpperCase()}
                </span>
              </div>
              {getProfile(userEditando?.email)?.user_name?.trim() || userEditando?.full_name || userEditando?.email}
              {userEditando && (
                <Badge className={`text-[10px] px-2 py-0 h-5 border ml-1 ${roleColor(getProfile(userEditando.email)?.role || userEditando.role)}`}>
                  {roleLabel(getProfile(userEditando.email)?.role || userEditando.role)}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Configure metas e integrações para este vendedor
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-2">
            {/* Produtividade */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-white">Metas de Produtividade</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { campo: "ligacoes", label: "Ligações por Mês" },
                  { campo: "meta_leads_trabalhados", label: "Leads Atribuídos no Mês" },
                  { campo: "tarefas_concluidas", label: "Tarefas Concluídas no Mês" },
                  { campo: "vendas", label: "Vendas no Mês" },
                  { campo: "receita", label: "Receita Mensal (R$)", step: "0.01" },
                ].map(({ campo, label, step }) => (
                  <div key={campo} className="space-y-1">
                    <Label className="text-slate-400 text-xs">{label}</Label>
                    <Input
                      type="number"
                      min="0"
                      step={step || "1"}
                      value={formData[campo] ?? 0}
                      onChange={(e) => handleChange(campo, e.target.value)}
                      className="bg-slate-800 border-slate-600 text-white"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Eficiência */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">Metas de Eficiência</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">Reuniões Agendadas</Label>
                  <Input
                    type="number" min="0"
                    value={formData.meta_reunioes_agendadas ?? 5}
                    onChange={(e) => handleChange("meta_reunioes_agendadas", e.target.value)}
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">Reuniões Realizadas (Meta Final)</Label>
                  <Input
                    type="number" min="0"
                    value={formData.meta_reunioes_realizadas ?? 3}
                    onChange={(e) => handleChange("meta_reunioes_realizadas", e.target.value)}
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
              </div>
            </div>

            {/* Plataforma de Telefonia */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Phone className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-white">Plataforma de Telefonia</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">Plataforma</Label>
                  <Select
                    value={formData.plataforma_ligacao || ""}
                    onValueChange={(v) => handleChange("plataforma_ligacao", v)}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="3cplus">3C+</SelectItem>
                      <SelectItem value="zenvia">Zenvia</SelectItem>
                      <SelectItem value="totalvoice">TotalVoice</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">URL da Plataforma</Label>
                  <Input
                    value={formData.plataforma_ligacao_url || ""}
                    onChange={(e) => handleChange("plataforma_ligacao_url", e.target.value)}
                    placeholder="https://exemplo.com/call?number={telefone}"
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
              </div>
            </div>

            {/* Instagram */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Instagram className="w-4 h-4 text-pink-400" />
                <h3 className="text-sm font-semibold text-white">Instagram da Empresa</h3>
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Usuário do Instagram</Label>
                <Input
                  value={formData.instagram_username || ""}
                  onChange={(e) => handleChange("instagram_username", e.target.value)}
                  placeholder="@oficinamaster"
                  className="bg-slate-800 border-slate-600 text-white"
                />
                <p className="text-xs text-slate-500">Usado para abrir o Instagram da empresa nas tarefas</p>
              </div>
            </div>

            {/* Ações */}
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-700">
              <Button
                variant="ghost"
                onClick={() => setUserEditando(null)}
                className="text-slate-400 hover:text-white"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSalvar}
                disabled={atualizarUsuarioMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {atualizarUsuarioMutation.isPending
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                  : <><Save className="w-4 h-4 mr-2" />Salvar Metas</>
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}