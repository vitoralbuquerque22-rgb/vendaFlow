import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "../utils";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle, Sparkles, Building2, User, Briefcase } from "lucide-react";

const PAPEL_LABELS = {
  admin: "Administrador",
  gestor: "Gestor",
  gestor_empresa: "Gestor de Empresa",
  gerente_empresa: "Gerente de Empresa",
  gerente_filial: "Gerente de Filial",
  supervisor: "Supervisor",
  sdr: "SDR",
  closer: "Closer",
  cs: "Customer Success",
  social_seller: "Social Seller",
};

export default function AceitarConvite() {
  // fase: carregando | confirmar | processando | sucesso | erro
  const [fase, setFase] = useState("carregando");
  const [convite, setConvite] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const [user, setUser] = useState(null);
  const [erro, setErro] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const carregar = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const codigo = urlParams.get("convite");

      if (!codigo) {
        setErro("Nenhum código de convite encontrado na URL.");
        setFase("erro");
        return;
      }

      const isAuthenticated = await base44.auth.isAuthenticated();
      if (!isAuthenticated) {
        sessionStorage.setItem("redirect_after_login", window.location.href);
        navigate("/login");
        return;
      }

      const userData = await base44.auth.me();
      setUser(userData);

      const convites = await base44.entities.ConviteEmpresa.filter({ codigo });
      if (convites.length === 0) {
        setErro("Convite não encontrado ou já foi utilizado.");
        setFase("erro");
        return;
      }

      const c = convites[0];

      if (c.status !== "pendente") {
        setErro("Este convite já foi utilizado ou expirou.");
        setFase("erro");
        return;
      }

      if (c.expiraEm && new Date(c.expiraEm) < new Date()) {
        await base44.entities.ConviteEmpresa.update(c.id, { status: "expirado" });
        setErro("Este convite expirou.");
        setFase("erro");
        return;
      }

      if (c.email && c.email !== userData.email) {
        setErro(`Este convite é para ${c.email}, mas você está logado como ${userData.email}.`);
        setFase("erro");
        return;
      }

      // Buscar dados da empresa para exibir na confirmação
      let empresaData = null;
      try {
        const empresas = await base44.entities.Empresa.filter({ id: c.empresaId });
        empresaData = empresas[0] || null;
      } catch {}

      setConvite(c);
      setEmpresa(empresaData);
      setFase("confirmar");
    };

    carregar().catch((err) => {
      setErro("Erro ao carregar convite: " + err.message);
      setFase("erro");
    });
  }, [navigate]);

  const handleAceitar = async () => {
    setFase("processando");
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const empresaIdParam = urlParams.get("empresaId");
      const empresaId = empresaIdParam || convite.empresaId;

      // Verificar se já existe vínculo
      const vinculosExistentes = await base44.entities.VinculoEmpresa.filter({
        empresaId,
        userEmail: user.email,
      });

      let jaEraMembro = false;
      if (vinculosExistentes.length > 0) {
        const vinculo = vinculosExistentes[0];
        if (vinculo.status === "ativo") {
          // Já é membro ativo — marcar convite como aceito e redirecionar
          await base44.entities.ConviteEmpresa.update(convite.id, {
            status: "aceito",
            usadoEm: new Date().toISOString(),
          });
          await base44.auth.updateMe({ empresaAtualId: empresaId });
          setFase("sucesso");
          setTimeout(() => navigate(createPageUrl("Dashboard")), 2000);
          return;
        } else {
          // Vínculo inativo — reativar com o papel do convite
          await base44.entities.VinculoEmpresa.update(vinculo.id, {
            status: "ativo",
            papel: convite.papel,
          });
          jaEraMembro = true;
        }
      } else {
        // Nenhum vínculo — criar novo
        await base44.entities.VinculoEmpresa.create({
          empresaId,
          userEmail: user.email,
          userName: user.full_name || user.email,
          papel: convite.papel,
          status: "ativo",
        });
      }

      await base44.entities.ConviteEmpresa.update(convite.id, {
        status: "aceito",
        usadoEm: new Date().toISOString(),
      });

      // Criar UserProfile automaticamente
      try {
        await base44.functions.invoke("autoAssignProfile", {
          user_email: user.email,
          user_name: user.full_name || user.email,
          empresaId,
          role: convite.papel || "sdr",
        });
      } catch {}

      // Setar empresaAtualId
      await base44.auth.updateMe({ empresaAtualId: empresaId });

      setFase("sucesso");
      // Novo membro ou sem nome: vai para BoasVindas para completar o perfil
      const destino = (!jaEraMembro || !user.full_name) ? "BoasVindas" : "Dashboard";
      setTimeout(() => navigate(createPageUrl(destino)), 2000);
    } catch (err) {
      setErro("Erro ao aceitar convite: " + err.message);
      setFase("erro");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #070b12 0%, #0c1628 50%, #0a0d1a 100%)" }}>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}>
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight"
            style={{ background: "linear-gradient(90deg, #5B8EFF, #A855F7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            VendaFLOW
          </span>
        </div>

        <div className="rounded-2xl p-8"
          style={{ background: "rgba(15,23,42,0.9)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(24px)" }}>

          {/* CARREGANDO */}
          {fase === "carregando" && (
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: "#7c3aed" }} />
              <p className="text-slate-400">Verificando seu convite...</p>
            </div>
          )}

          {/* CONFIRMAR */}
          {fase === "confirmar" && convite && (
            <div>
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, rgba(91,142,255,0.2), rgba(168,85,247,0.2))", border: "1px solid rgba(168,85,247,0.3)" }}>
                  <Building2 className="w-7 h-7" style={{ color: "#a78bfa" }} />
                </div>
                <h1 className="text-2xl font-bold text-white mb-1">Convite para empresa</h1>
                <p className="text-slate-500 text-sm">Confirme os dados antes de entrar</p>
              </div>

              <div className="space-y-3 mb-7">
                <div className="rounded-xl p-4 flex items-center gap-3"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(91,142,255,0.15)" }}>
                    <Building2 className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Empresa</p>
                    <p className="text-white font-semibold">{empresa?.nome || convite.empresaId}</p>
                  </div>
                </div>

                <div className="rounded-xl p-4 flex items-center gap-3"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(168,85,247,0.15)" }}>
                    <Briefcase className="w-4 h-4 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Sua função</p>
                    <p className="text-white font-semibold">{PAPEL_LABELS[convite.papel] || convite.papel}</p>
                  </div>
                </div>

                <div className="rounded-xl p-4 flex items-center gap-3"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(52,211,153,0.15)" }}>
                    <User className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Você está logado como</p>
                    <p className="text-white font-semibold">{user?.email}</p>
                  </div>
                </div>
              </div>

              <Button onClick={handleAceitar} className="w-full h-11 font-semibold text-white rounded-xl"
                style={{ background: "linear-gradient(90deg, #5B8EFF, #A855F7)", border: "none" }}>
                Aceitar convite e entrar →
              </Button>
              <p className="text-center text-xs text-slate-600 mt-3">
                Ao aceitar, você terá acesso à plataforma como <strong className="text-slate-500">{PAPEL_LABELS[convite.papel] || convite.papel}</strong>.
              </p>
            </div>
          )}

          {/* PROCESSANDO */}
          {fase === "processando" && (
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: "#a78bfa" }} />
              <p className="text-white font-semibold mb-1">Configurando seu acesso...</p>
              <p className="text-slate-500 text-sm">Aguarde um momento</p>
            </div>
          )}

          {/* SUCESSO */}
          {fase === "sucesso" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)" }}>
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-1">Acesso confirmado!</h2>
              <p className="text-slate-500 text-sm">Redirecionando para o dashboard...</p>
            </div>
          )}

          {/* ERRO */}
          {fase === "erro" && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ background: "rgba(251,113,133,0.15)", border: "1px solid rgba(251,113,133,0.3)" }}>
                <AlertCircle className="w-7 h-7 text-rose-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Ops, algo deu errado</h2>
              <p className="text-slate-400 text-sm mb-6">{erro}</p>
              <div className="space-y-2">
                <Button onClick={() => navigate(createPageUrl("Dashboard"))} className="w-full font-semibold text-white rounded-xl h-10"
                  style={{ background: "linear-gradient(90deg, #5B8EFF, #A855F7)", border: "none" }}>
                  Ir para o Dashboard
                </Button>
                <Button onClick={() => window.location.reload()} variant="ghost"
                  className="w-full text-slate-400 hover:text-white rounded-xl h-10">
                  Tentar novamente
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}