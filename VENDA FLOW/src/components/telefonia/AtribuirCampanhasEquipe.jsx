import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listarEquipes, atualizarEquipe } from "@/lib/services/equipeService";
import { buscarUserProfile, atualizarUserProfile, criarUserProfile, listarUserProfiles } from "@/lib/services/telefoniaService";
import { listarVinculos } from "@/lib/services/equipeService";
import { Users, ChevronDown, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function AtribuirCampanhasEquipe({ campanhas, habilitadas, empresaId }) {
  const [expandido, setExpandido] = useState(false);
  const [salvando, setSalvando]   = useState(null);
  const queryClient               = useQueryClient();

  const { data: equipes = [] } = useQuery({
    queryKey: ["equipes-campanha", empresaId],
    queryFn:  () => listarEquipes(empresaId).then(es => es.filter(e => e.ativa !== false)),
    enabled:  !!empresaId && expandido,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-campanha", empresaId],
    queryFn:  async () => {
      const vinculos = await listarVinculos(empresaId);
      const sdrs = vinculos.filter(v => v.papel === "sdr" || v.papel === "closer");
      const results = await Promise.all(
        sdrs.map(v =>
          buscarUserProfile(v.userEmail)
            .then(p => p || { user_email: v.userEmail, user_name: v.userName, campanhas_permitidas: [] })
        )
      );
      return results;
    },
    enabled: !!empresaId && expandido,
  });

  // Campanhas globalmente habilitadas pelo admin
  const campanhasHabilitadas = campanhas.filter(c => habilitadas.has(c.id));

  const toggleEquipe = async (equipe, campanhaId) => {
    const atual = new Set((equipe.campanhas_permitidas || []).map(String));
    if (atual.has(campanhaId)) atual.delete(campanhaId); else atual.add(campanhaId);
    setSalvando(`equipe-${equipe.id}`);
    try {
      await atualizarEquipe(equipe.id, { campanhas_permitidas: Array.from(atual) });
      queryClient.invalidateQueries({ queryKey: ["equipes-campanha", empresaId] });
      toast.success("Equipe atualizada");
    } catch { toast.error("Erro ao salvar"); }
    finally { setSalvando(null); }
  };

  const toggleUser = async (profile, campanhaId) => {
    const atual = new Set((profile.campanhas_permitidas || []).map(String));
    if (atual.has(campanhaId)) atual.delete(campanhaId); else atual.add(campanhaId);
    setSalvando(`user-${profile.user_email}`);
    try {
      if (profile.id) {
        await atualizarUserProfile(profile.id, { campanhas_permitidas: Array.from(atual) });
      } else {
        await criarUserProfile({ ...profile, campanhas_permitidas: Array.from(atual) });
      }
      queryClient.invalidateQueries({ queryKey: ["profiles-campanha", empresaId] });
      toast.success("Permissões salvas");
    } catch { toast.error("Erro ao salvar"); }
    finally { setSalvando(null); }
  };

  if (campanhasHabilitadas.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-700/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpandido(p => !p)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-slate-800/40 hover:bg-slate-800/60 transition-all text-left"
      >
        <Users className="w-4 h-4 text-sky-400" />
        <span className="text-sm font-semibold text-white">Permissões por Equipe e SDR</span>
        <span className="text-[11px] text-slate-500 ml-1">(deixe vazio = acessa todas as habilitadas)</span>
        <span className="ml-auto">
          {expandido
            ? <ChevronDown className="w-4 h-4 text-slate-500" />
            : <ChevronRight className="w-4 h-4 text-slate-500" />}
        </span>
      </button>

      {expandido && (
        <div className="p-4 space-y-6">

          {/* Por equipe */}
          {equipes.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Por Equipe</p>
              {equipes.map(equipe => {
                const permitidas = new Set((equipe.campanhas_permitidas || []).map(String));
                const isSaving   = salvando === `equipe-${equipe.id}`;
                return (
                  <div key={equipe.id} className="rounded-lg border border-slate-700/40 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-md bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                        <Users className="w-3 h-3 text-sky-400" />
                      </div>
                      <span className="text-sm font-semibold text-white">{equipe.nome}</span>
                      <span className="text-[10px] text-slate-500">{(equipe.membros || []).length} membros</span>
                      {permitidas.size === 0 && (
                        <span className="text-[10px] text-amber-500/70 ml-1">todas as habilitadas</span>
                      )}
                      {isSaving && <span className="ml-auto text-[10px] text-slate-500">Salvando...</span>}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {campanhasHabilitadas.map(c => {
                        const ativa = permitidas.size === 0 || permitidas.has(String(c.id));
                        const selecionada = permitidas.has(String(c.id));
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleEquipe(equipe, String(c.id))}
                            disabled={!!isSaving}
                            className={cn(
                              "flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border transition-all",
                              selecionada
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                : ativa
                                ? "bg-slate-700/30 border-slate-600/40 text-slate-400"
                                : "bg-slate-800/60 border-slate-700/40 text-slate-500"
                            )}
                          >
                            {selecionada && <Check className="w-2.5 h-2.5" />}
                            {c.nome}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Por SDR individual */}
          {profiles.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Por SDR Individual</p>
              {profiles.map(profile => {
                const permitidas = new Set((profile.campanhas_permitidas || []).map(String));
                const isSaving   = salvando === `user-${profile.user_email}`;
                return (
                  <div key={profile.user_email} className="rounded-lg border border-slate-700/40 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-white">
                        {(profile.user_name || profile.user_email)[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-white">
                        {profile.user_name?.trim() || profile.user_email.split("@")[0]}
                      </span>
                      <span className="text-[10px] text-slate-600 truncate">{profile.user_email}</span>
                      {permitidas.size === 0 && (
                        <span className="text-[10px] text-amber-500/70 ml-1">herda equipe</span>
                      )}
                      {isSaving && <span className="ml-auto text-[10px] text-slate-500">Salvando...</span>}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {campanhasHabilitadas.map(c => {
                        const selecionada = permitidas.has(String(c.id));
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleUser(profile, String(c.id))}
                            disabled={!!isSaving}
                            className={cn(
                              "flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border transition-all",
                              selecionada
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                : "bg-slate-800/60 border-slate-700/40 text-slate-500"
                            )}
                          >
                            {selecionada && <Check className="w-2.5 h-2.5" />}
                            {c.nome}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {equipes.length === 0 && profiles.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">
              Nenhuma equipe ou SDR cadastrado ainda.
            </p>
          )}
        </div>
      )}
    </div>
  );
}