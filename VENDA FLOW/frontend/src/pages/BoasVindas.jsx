import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";
import { PartyPopper, Headphones, ExternalLink, Loader2 } from "lucide-react";

const cargoLabel = {
  admin: "Administrador",
  gestor: "Gestor",
  sdr: "SDR",
  closer: "Closer",
};

function maskPhone(v) {
  return v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function maskCPF(v) {
  return v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export default function BoasVindas() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const [vinculo, setVinculo] = useState(null);

  const [nome, setNome] = useState("");
  const [apelido, setApelido] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [nascimento, setNascimento] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const u = await api.auth.me();
        setUser(u);
        setNome(u.full_name || "");

        const vinculos = await api.entities.VinculoEmpresa.filter({
          userEmail: u.email,
          status: "ativo",
        });
        if (vinculos?.length > 0) {
          setVinculo(vinculos[0]);
          const empresas = await api.entities.Empresa.filter({ id: vinculos[0].empresaId });
          if (empresas?.length > 0) setEmpresa(empresas[0]);
        }

        // Pré-carregar dados do perfil se já existir
        const perfis = await api.entities.UserProfile.filter({ user_email: u.email });
        if (perfis?.length > 0) {
          const p = perfis[0];
          if (p.apelido) setApelido(p.apelido || "");
          if (p.telefone) setTelefone(p.telefone || "");
          if (p.cpf) setCpf(p.cpf || "");
          if (p.data_nascimento) setNascimento(p.data_nascimento || "");
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!nome.trim()) {
      toast.error("Por favor, informe seu nome completo.");
      return;
    }
    setSaving(true);
    try {
      // Atualizar nome no auth
      await api.auth.updateMe({ full_name: nome.trim() });

      // Atualizar UserProfile
      const perfis = await api.entities.UserProfile.filter({ user_email: user.email });
      const profileData = {
        user_name: nome.trim(),
        apelido: apelido.trim() || undefined,
        telefone: telefone || undefined,
        cpf: cpf || undefined,
        data_nascimento: nascimento || undefined,
      };
      if (perfis?.length > 0) {
        await api.entities.UserProfile.update(perfis[0].id, profileData);
      }

      toast.success("Perfil salvo! Bem-vindo ao time!");
      navigate(createPageUrl("Dashboard"));
    } catch (e) {
      toast.error("Erro ao salvar perfil: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#070b12" }}>
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
      </div>
    );
  }

  const cargo = cargoLabel[vinculo?.papel] || vinculo?.papel || "Colaborador";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(56,189,248,0.08) 0%, transparent 60%), #070b12" }}>
      <div className="w-full max-w-2xl">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.1 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-5"
            style={{ background: "linear-gradient(135deg, rgba(56,189,248,0.18), rgba(139,92,246,0.14))", border: "1px solid rgba(56,189,248,0.25)", boxShadow: "0 0 40px rgba(56,189,248,0.15)" }}
          >
            <PartyPopper className="w-10 h-10 text-sky-400" />
          </motion.div>

          <h1 className="text-3xl font-bold text-white mb-2">Bem-vindo ao VendaFlow!</h1>
          {empresa && (
            <p className="text-slate-400 text-base">
              Você entrou na empresa{" "}
              <span className="text-sky-400 font-semibold">{empresa.nome}</span>{" "}
              como{" "}
              <span className="text-violet-400 font-semibold">{cargo}</span>
            </p>
          )}
        </motion.div>

        {/* Formulário de perfil */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
          className="rounded-2xl p-6 mb-4"
          style={{ background: "rgba(30,41,59,0.4)", border: "1px solid rgba(71,85,105,0.4)", backdropFilter: "blur(12px)" }}
        >
          <h2 className="text-white font-semibold text-lg mb-5">Complete seu perfil</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-slate-400 text-sm mb-1.5">Nome completo *</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome completo"
                className="w-full px-4 py-2.5 rounded-xl text-sm"
                style={{ background: "rgba(15,23,42,0.8)", border: "1px solid rgba(71,85,105,0.5)", color: "#e2e8f0" }}
              />
            </div>

            <div>
              <label className="block text-slate-400 text-sm mb-1.5">Apelido (como quer ser chamado)</label>
              <input
                value={apelido}
                onChange={(e) => setApelido(e.target.value)}
                placeholder="Ex: João, Ju, Rafa..."
                className="w-full px-4 py-2.5 rounded-xl text-sm"
                style={{ background: "rgba(15,23,42,0.8)", border: "1px solid rgba(71,85,105,0.5)", color: "#e2e8f0" }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 text-sm mb-1.5">Telefone</label>
                <input
                  value={telefone}
                  onChange={(e) => setTelefone(maskPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className="w-full px-4 py-2.5 rounded-xl text-sm"
                  style={{ background: "rgba(15,23,42,0.8)", border: "1px solid rgba(71,85,105,0.5)", color: "#e2e8f0" }}
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-1.5">CPF</label>
                <input
                  value={cpf}
                  onChange={(e) => setCpf(maskCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  className="w-full px-4 py-2.5 rounded-xl text-sm"
                  style={{ background: "rgba(15,23,42,0.8)", border: "1px solid rgba(71,85,105,0.5)", color: "#e2e8f0" }}
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-sm mb-1.5">Data de nascimento</label>
              <input
                type="date"
                value={nascimento}
                onChange={(e) => setNascimento(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-sm"
                style={{ background: "rgba(15,23,42,0.8)", border: "1px solid rgba(71,85,105,0.5)", color: "#e2e8f0" }}
              />
            </div>
          </div>
        </motion.div>

        {/* Card 3C Plus */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}
          className="rounded-2xl p-5 mb-6 flex items-start gap-4"
          style={{ background: "rgba(30,41,59,0.4)", border: "1px solid rgba(71,85,105,0.4)", backdropFilter: "blur(12px)" }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)" }}>
            <Headphones className="w-5 h-5 text-violet-400" />
          </div>
          <div className="flex-1">
            <p className="text-white font-medium text-sm mb-1">Configuração de Ligações (3C Plus)</p>
            <p className="text-slate-400 text-sm mb-3">Para fazer ligações, você precisa do token 3C Plus. Peça ao seu gestor.</p>
            <a
              href={createPageUrl("ExtensaoVendaFlow")}
              className="inline-flex items-center gap-1.5 text-sky-400 hover:text-sky-300 text-sm font-medium transition-colors"
            >
              Instalar Extensão Chrome
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </motion.div>

        {/* Botão principal */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 text-base font-semibold rounded-xl"
            style={{ background: "linear-gradient(135deg, #0ea5e9, #7c3aed)", boxShadow: "0 0 32px rgba(14,165,233,0.25)" }}
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Começar a usar o VendaFlow →"}
          </Button>
        </motion.div>

      </div>
    </div>
  );
}