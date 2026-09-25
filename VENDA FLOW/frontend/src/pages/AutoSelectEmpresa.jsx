import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { createPageUrl } from "../utils";
import { Loader2, ShieldOff } from "lucide-react";

export default function AutoSelectEmpresa() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [bloqueado, setBloqueado] = useState(false);

  useEffect(() => {
    const autoSelectOrRedirect = async () => {
      try {
        const user = await api.auth.me();
        
        if (!user?.email) {
          navigate(createPageUrl("Acesso"));
          return;
        }

        // Verificar se usuário está bloqueado
        const perfis = await api.entities.UserProfile.filter({ user_email: user.email });
        if (perfis?.[0]?.bloqueado === true) {
          setBloqueado(true);
          setIsLoading(false);
          return;
        }

        // Buscar todas as empresas vinculadas ao usuário
        const vinculos = await api.entities.VinculoEmpresa.filter({
          userEmail: user.email,
          status: "ativo",
        });

        if (!vinculos || vinculos.length === 0) {
          // Verificar se tem convite pendente (usuário foi convidado por admin)
          try {
            const convites = await api.entities.ConviteEmpresa.filter({
              email: user.email,
              status: "pendente",
            });

            if (convites && convites.length > 0) {
              const convite = convites[0];

              // Criar VinculoEmpresa automaticamente
              await api.entities.VinculoEmpresa.create({
                empresaId: convite.empresaId,
                userEmail: user.email,
                userName: user.full_name || user.email.split('@')[0],
                papel: convite.papel || 'sdr',
                status: 'ativo',
              });

              // Criar UserProfile
              await api.entities.UserProfile.create({
                user_email: user.email,
                user_name: user.full_name || user.email.split('@')[0],
                role: convite.papel || 'sdr',
              });

              // Marcar convite como aceito
              await api.entities.ConviteEmpresa.update(convite.id, { status: 'aceito' });

              // Setar empresa atual
              await api.auth.updateMe({ empresaAtualId: convite.empresaId });

              // Redirecionar para dashboard
              navigate(createPageUrl("Dashboard"));
              return;
            }
          } catch (e) {
            console.warn('[AutoSelectEmpresa] erro ao buscar convites:', e.message);
          }

          // Sem convites, redirecionar para onboarding (criar empresa nova)
          navigate(createPageUrl("Onboarding"));
          return;
        }

        if (vinculos.length === 1) {
          // Uma única empresa - atualizar user profile e ir direto pro dashboard
          const empresaId = vinculos[0].empresaId;
          
          // Atualizar empresaAtualId do usuário
          await api.auth.updateMe({ empresaAtualId: empresaId });
          
          // Redirecionar direto pro dashboard
          navigate(createPageUrl("Dashboard"));
          return;
        } else {
          // Múltiplas empresas - redirecionar para escolha
          navigate(createPageUrl("ChooseEmpresa"));
          return;
        }
      } catch (error) {
        console.error("Erro ao autoselecionar empresa:", error);
        navigate(createPageUrl("Acesso"));
      } finally {
        setIsLoading(false);
      }
    };

    autoSelectOrRedirect();
  }, [navigate]);

  if (bloqueado) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "radial-gradient(circle at 50% 40%, rgba(244,63,94,0.12) 0%, transparent 60%), #040816" }}>
        <div className="text-center max-w-sm mx-auto px-6">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6"
            style={{ background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.3)", boxShadow: "0 0 48px rgba(244,63,94,0.2)" }}>
            <ShieldOff className="w-10 h-10" style={{ color: "#FB7185" }} />
          </div>
          <h2 className="text-2xl font-bold mb-3" style={{ color: "#F8FAFC" }}>Acesso Bloqueado</h2>
          <p className="text-base leading-relaxed mb-8" style={{ color: "#94A3B8" }}>
            Usuário bloqueado, contate o administrador.
          </p>
          <button
            onClick={() => api.auth.logout()}
            className="px-6 py-3 rounded-2xl text-sm font-semibold text-white transition-all"
            style={{ background: "linear-gradient(135deg,#DC2626,#F43F5E)", boxShadow: "0 0 24px rgba(244,63,94,0.3)" }}
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-[#ff6b35] animate-spin mx-auto mb-4" />
        <p className="text-slate-400">Carregando sua empresa...</p>
      </div>
    </div>
  );
}