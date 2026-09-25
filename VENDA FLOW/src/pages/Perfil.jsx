import { useState, useRef, useEffect } from "react";
import { Phone } from 'lucide-react';
import ConfiguracaoToken3CPlus from '@/components/telefonia/ConfiguracaoToken3CPlus';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { usePermissions } from "@/components/hooks/usePermissions";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import PerfilHero from "@/components/perfil/PerfilHero";
import PerfilTabs from "@/components/perfil/PerfilTabs";
import PerfilRecordes from "@/components/perfil/PerfilRecordes";
import PerfilQuickActions from "@/components/perfil/PerfilQuickActions";
import GoogleCalendarAuthCard from "@/components/perfil/GoogleCalendarAuthCard";
import PerfilComposer from "@/components/perfil/PerfilComposer";
import PerfilDadosPessoais from "@/components/perfil/PerfilDadosPessoais";
import PerfilMetasDoMes from "@/components/perfil/PerfilMetasDoMes";
import PerfilLeaderboard from "@/components/perfil/PerfilLeaderboard";
import DetalhesColaboradorModal from "@/components/assistente/DetalhesColaboradorModal";

export default function Perfil() {
  const [tabAtiva, setTabAtiva] = useState("visao-geral");
  const [modalDesempenhoAberto, setModalDesempenhoAberto] = useState(false);
  const queryClient = useQueryClient();
  const { empresaId } = useEmpresaAtual();

  const { data: user, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const { data: userProfile } = useQuery({
    queryKey: ["userProfile", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      return profiles[0] || null;
    },
    enabled: !!user?.email,
    staleTime: 60000,
  });

  // Objeto de usuário enriquecido: user_name do UserProfile tem prioridade no nome
  const userEnriquecido = user ? { ...user, full_name: userProfile?.user_name || user.full_name } : user;

  const { data: vinculoUsuario } = useQuery({
    queryKey: ["vinculo-usuario", empresaId, user?.email],
    queryFn: async () => {
      if (!empresaId || !user?.email) return null;
      const vinculos = await base44.entities.VinculoEmpresa.filter({ empresaId, userEmail: user.email });
      return vinculos?.[0] || null;
    },
    enabled: !!empresaId && !!user?.email,
  });

  const now = new Date();
  const inicio = startOfMonth(now);
  const fim = endOfMonth(now);

  const { data: atividadesHistoricas = [] } = useQuery({
    queryKey: ["atividades-historicas", user?.email],
    queryFn: () => base44.entities.Atividade.filter({ sdr_email: user.email }),
    enabled: !!user?.email,
  });

  const { data: tarefasHistoricas = [] } = useQuery({
    queryKey: ["tarefas-historicas", user?.email],
    queryFn: () => base44.entities.Tarefa.filter({ sdr_email: user.email }),
    enabled: !!user?.email,
  });

  const { data: leadsHistoricos = [] } = useQuery({
    queryKey: ["leads-historicos", user?.email],
    queryFn: () => base44.entities.Lead.filter({ sdr_responsavel: user.email }),
    enabled: !!user?.email,
  });

  const { isAdmin, isSuperAdmin, isGestorEmpresa } = usePermissions();
  const podeVerTodosUsuarios = isSuperAdmin || isGestorEmpresa || isAdmin;

  const { data: todosUsuarios = [] } = useQuery({
    queryKey: ["todos-usuarios"],
    queryFn: () => base44.entities.User.list(),
    enabled: podeVerTodosUsuarios,
  });

  const { data: todasAtividades = [] } = useQuery({
    queryKey: ["todas-atividades-mes"],
    queryFn: async () => {
      const ativs = await base44.entities.Atividade.list("-created_date", 10000);
      return ativs.filter((a) => {
        const d = new Date(a.created_date);
        return d >= inicio && d <= fim;
      });
    },
    enabled: podeVerTodosUsuarios,
  });

  const atividades = atividadesHistoricas.filter((a) => {
    const d = new Date(a.created_date);
    return d >= inicio && d <= fim;
  });
  const tarefas = tarefasHistoricas.filter((t) => {
    const d = new Date(t.created_date);
    return d >= inicio && d <= fim;
  });
  const leads = leadsHistoricos.filter((l) => {
    const d = new Date(l.created_date);
    return d >= inicio && d <= fim;
  });

  const getPapelUsuario = () => {
    if (vinculoUsuario?.papel) {
      const m = { admin: "Administrador", gestor: "Gestor", closer: "Closer", sdr: "SDR" };
      return m[vinculoUsuario.papel] || "SDR";
    }
    const m = { admin: "Administrador", gestor: "Gestor", closer: "Closer" };
    return m[user?.role] || "SDR";
  };

  const calcularMetas = () => {
    if (!user?.meta_mensal) return [];
    const m = user.meta_mensal;
    const metas = [];
    if (m.ligacoes) metas.push({ nome: "Ligações", meta: m.ligacoes, realizado: atividades.filter(a => a.tipo === "ligacao").length, accent: "199 89% 55%" });
    if (m.reunioes_agendadas) metas.push({ nome: "Reuniões Agendadas", meta: m.reunioes_agendadas, realizado: atividades.filter(a => a.tipo === "reuniao_agendada").length, accent: "262 83% 60%" });
    if (m.reunioes_realizadas) metas.push({ nome: "Reuniões Realizadas", meta: m.reunioes_realizadas, realizado: atividades.filter(a => a.tipo === "reuniao_realizada").length, accent: "330 82% 60%" });
    if (m.vendas) metas.push({ nome: "Vendas", meta: m.vendas, realizado: tarefas.filter(t => t.resultado_venda === "venda_realizada").length, accent: "38 92% 55%" });
    if (m.leads) metas.push({ nome: "Leads", meta: m.leads, realizado: leads.length, accent: "160 84% 45%" });
    if (m.tarefas_concluidas) metas.push({ nome: "Tarefas", meta: m.tarefas_concluidas, realizado: tarefas.filter(t => t.status === "concluida").length, accent: "199 89% 55%" });
    return metas.map(meta => ({ ...meta, percentual: meta.meta > 0 ? (meta.realizado / meta.meta) * 100 : 0 }));
  };

  const calcularRecordes = () => {
    if (!atividadesHistoricas.length) return [];
    const porMes = {};
    const add = (mes, key) => { if (!porMes[mes]) porMes[mes] = {}; porMes[mes][key] = (porMes[mes][key] || 0) + 1; };
    atividadesHistoricas.forEach(a => {
      const m = format(new Date(a.created_date), "yyyy-MM");
      if (a.tipo === "ligacao") add(m, "Ligações");
      if (a.tipo === "reuniao_agendada") add(m, "Reun. Agendadas");
      if (a.tipo === "reuniao_realizada") add(m, "Reun. Realizadas");
    });
    tarefasHistoricas.forEach(t => {
      const m = format(new Date(t.created_date), "yyyy-MM");
      if (t.resultado_venda === "venda_realizada") add(m, "Vendas");
    });
    leadsHistoricos.forEach(l => { add(format(new Date(l.created_date), "yyyy-MM"), "Leads"); });
    const best = {};
    Object.entries(porMes).forEach(([mes, data]) => {
      Object.entries(data).forEach(([key, val]) => {
        if (!best[key] || val > best[key].valor) best[key] = { valor: val, mes };
      });
    });
    return Object.entries(best).filter(([, b]) => b.valor > 0).map(([label, b]) => ({ label, valor: b.valor, mes: b.mes }));
  };

  const calcularRanking = () => {
    if (!podeVerTodosUsuarios || !todosUsuarios.length) return null;
    const ranking = todosUsuarios
      .filter(u => u.role !== "admin")
      .map(u => {
        const ativUs = todasAtividades.filter(a => a.sdr_email === u.email);
        const ligacoes = ativUs.filter(a => a.tipo === "ligacao").length;
        const reunioesAgendadas = ativUs.filter(a => a.tipo === "reuniao_agendada").length;
        const reunioesRealizadas = ativUs.filter(a => a.tipo === "reuniao_realizada").length;
        const pontuacao = ligacoes + reunioesAgendadas * 3 + reunioesRealizadas * 5;
        const cargoMap = { gestor: "Gestor", closer: "Closer" };
        return { email: u.email, nome: u.user_name || u.apelido || u.full_name, cargo: cargoMap[u.role] || "SDR", foto: u.foto_perfil, pontuacao };
      })
      .sort((a, b) => b.pontuacao - a.pontuacao);
    return { ranking: ranking.slice(0, 10), minhaColocacao: ranking.findIndex(r => r.email === user.email) + 1 };
  };

  const metas = calcularMetas();
  const mediaGeral = metas.length > 0 ? Math.round(metas.reduce((acc, m) => acc + m.percentual, 0) / metas.length) : 0;
  const recordes = calcularRecordes();
  const dadosRanking = calcularRanking();
  const papel = getPapelUsuario();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: "hsl(222 47% 4%)" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "hsl(199 89% 55%)" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative" style={{
      background: "hsl(222 47% 4%)",
      backgroundImage: "radial-gradient(circle at 50% 0%, hsl(199 89% 55% / 0.08), transparent 55%), radial-gradient(circle at 80% 60%, hsl(262 83% 60% / 0.06), transparent 50%)",
    }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6 space-y-5">

        {/* Hero */}
        <PerfilHero
          user={userEnriquecido}
          papel={papel}
          onDesempenho={() => setModalDesempenhoAberto(true)}
          queryClient={queryClient}
        />

        {/* Tabs */}
        <PerfilTabs tabAtiva={tabAtiva} onTab={setTabAtiva} />

        {/* ABA: Visão Geral */}
        {tabAtiva === 'visao-geral' && (
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-3 flex flex-col gap-5">
              <PerfilRecordes recordes={recordes} />
              <PerfilQuickActions
                onEditarPerfil={() => {}}
                onDesempenho={() => setModalDesempenhoAberto(true)}
              />
              <GoogleCalendarAuthCard />
              <PerfilComposer user={user} />
            </div>
            <div className="col-span-12 lg:col-span-9 flex flex-col gap-5">
              <PerfilDadosPessoais user={userEnriquecido} queryClient={queryClient} />
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <PerfilMetasDoMes metas={metas} mediaGeral={mediaGeral} />
                <PerfilLeaderboard dadosRanking={dadosRanking} userEmail={user?.email} />
              </div>
            </div>
          </div>
        )}

        {/* ABA: Atividade */}
        {tabAtiva === 'atividade' && (
          <div className="max-w-3xl">
            <PerfilDadosPessoais user={userEnriquecido} queryClient={queryClient} />
          </div>
        )}

        {/* ABA: Conquistas */}
        {tabAtiva === 'conquistas' && (
          <div className="max-w-3xl">
            <PerfilRecordes recordes={recordes} />
          </div>
        )}

        {/* ABA: Configurações */}
        {tabAtiva === 'configuracoes' && (
          <div className="max-w-2xl space-y-6">
            <PerfilDadosPessoais user={userEnriquecido} queryClient={queryClient} />
            <GoogleCalendarAuthCard />
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-4">
              <div className="flex items-center gap-3 pb-2 border-b border-white/[0.06]">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center">
                  <span className="text-sm">📞</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Telefonia 3C Plus</p>
                  <p className="text-xs text-slate-500">Configure seu token para usar o softphone</p>
                </div>
              </div>
              <ConfiguracaoToken3CPlus />
            </div>
          </div>
        )}
      </div>

      <DetalhesColaboradorModal
        open={modalDesempenhoAberto}
        onClose={() => setModalDesempenhoAberto(false)}
        colaborador={userEnriquecido}
      />
    </div>
  );
}