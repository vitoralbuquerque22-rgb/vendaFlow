import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "../utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, User, Building2, Zap, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const GRAD = "linear-gradient(90deg, #5B8EFF, #A855F7)";

const ETAPAS = [
  { label: "Empresa",  icon: Building2 },
  { label: "Perfil",   icon: User },
  { label: "Plano",    icon: Zap },
];

const PLANOS = [
  {
    id: "starter",
    nome: "Starter",
    preco: "Grátis",
    limite: 5,
    popular: false,
    features: ["5 usuários", "Leads ilimitados", "Cadências básicas", "Suporte por email"],
  },
  {
    id: "pro",
    nome: "Pro",
    preco: "R$ 297/mês",
    limite: 20,
    popular: true,
    features: ["20 usuários", "Leads ilimitados", "Cadências avançadas", "IA + Automações", "Suporte prioritário"],
  },
  {
    id: "enterprise",
    nome: "Enterprise",
    preco: "Sob consulta",
    limite: 999,
    popular: false,
    features: ["Usuários ilimitados", "Tudo do Pro", "Integrações customizadas", "Suporte dedicado 24/7"],
  },
];

export default function Onboarding() {
  const [etapa, setEtapa] = useState(1);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  const [dadosEmpresa, setDadosEmpresa] = useState({ nome: "", cnpj: "", telefone: "", whatsapp: "" });
  const [dadosPerfil, setDadosPerfil] = useState({ nomeCompleto: "", cargo: "gestor" });
  const [planoEscolhido, setPlanoEscolhido] = useState("pro");

  useEffect(() => {
    (async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
        const vinculos = await base44.entities.VinculoEmpresa.filter({ userEmail: userData.email, status: "ativo" });
        if (vinculos.length > 0) navigate(createPageUrl("Dashboard"));
      } catch {
        navigate(createPageUrl("Acesso"));
      }
    })();
  }, [navigate]);

  const avancar = () => {
    if (etapa === 1 && (!dadosEmpresa.nome || !dadosEmpresa.cnpj)) {
      toast.error("Preencha nome e CNPJ da empresa"); return;
    }
    if (etapa === 2 && !dadosPerfil.nomeCompleto) {
      toast.error("Preencha seu nome completo"); return;
    }
    setEtapa(e => e + 1);
  };

  const finalizar = async () => {
    setLoading(true);
    try {
      const plano = PLANOS.find(p => p.id === planoEscolhido);
      const empresa = await base44.entities.Empresa.create({
        nome: dadosEmpresa.nome,
        cnpj: dadosEmpresa.cnpj,
        nomeProprietario: dadosPerfil.nomeCompleto,
        whatsappProprietario: dadosEmpresa.whatsapp,
        telefonePropietario: dadosEmpresa.telefone,
        plano: planoEscolhido,
        limiteUsuarios: plano.limite,
        statusPlano: "ativo",
        ownerEmail: user.email,
      });

      await base44.entities.VinculoEmpresa.create({
        empresaId: empresa.id, userEmail: user.email, papel: "admin", status: "ativo",
      });

      await base44.entities.UserProfile.create({
        user_email: user.email,
        user_name: dadosPerfil.nomeCompleto,
        role: dadosPerfil.cargo || "admin",
        is_active: true,
        assigned_by: "system",
        empresaId: empresa.id,
      });

      await base44.auth.updateMe({ empresaAtualId: empresa.id, full_name: dadosPerfil.nomeCompleto });

      toast.success("🎉 Bem-vindo ao VendaFLOW!");
      setTimeout(() => navigate(createPageUrl("Dashboard")), 1500);
    } catch (err) {
      toast.error("Erro ao criar empresa: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#070b12" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#a855f7" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #070b12 0%, #0c1628 50%, #0a0d1a 100%)" }}>
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}>
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight"
            style={{ background: GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            VendaFLOW
          </span>
        </div>

        <div className="rounded-2xl p-8"
          style={{ background: "rgba(15,23,42,0.9)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(24px)" }}>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-1">Configure sua empresa</h1>
            <p className="text-slate-500 text-sm">3 etapas simples para começar</p>
          </div>

          {/* Stepper */}
          <div className="flex items-center justify-center gap-0 mb-8">
            {ETAPAS.map((e, i) => {
              const step = i + 1;
              const done = etapa > step;
              const active = etapa === step;
              const Icon = e.icon;
              return (
                <div key={step} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center transition-all"
                      style={{
                        background: done || active ? GRAD : "rgba(255,255,255,0.06)",
                        border: done || active ? "none" : "1px solid rgba(255,255,255,0.1)",
                      }}>
                      {done
                        ? <CheckCircle2 className="w-5 h-5 text-white" />
                        : <Icon className="w-4 h-4" style={{ color: active ? "#fff" : "#64748b" }} />
                      }
                    </div>
                    <span className="text-xs mt-1.5 font-medium"
                      style={{ color: active ? "#a78bfa" : done ? "#6d28d9" : "#475569" }}>
                      {e.label}
                    </span>
                  </div>
                  {i < ETAPAS.length - 1 && (
                    <div className="w-16 h-0.5 mb-4 mx-1 transition-all"
                      style={{ background: etapa > step ? GRAD : "rgba(255,255,255,0.08)" }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* ETAPA 1 */}
          {etapa === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-semibold text-white">Dados da Empresa</h3>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Nome da Empresa *</label>
                <Input value={dadosEmpresa.nome}
                  onChange={e => setDadosEmpresa({ ...dadosEmpresa, nome: e.target.value })}
                  placeholder="Minha Empresa LTDA" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">CNPJ *</label>
                <Input value={dadosEmpresa.cnpj}
                  onChange={e => setDadosEmpresa({ ...dadosEmpresa, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Telefone</label>
                  <Input value={dadosEmpresa.telefone}
                    onChange={e => setDadosEmpresa({ ...dadosEmpresa, telefone: e.target.value })}
                    placeholder="(00) 0000-0000" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">WhatsApp</label>
                  <Input value={dadosEmpresa.whatsapp}
                    onChange={e => setDadosEmpresa({ ...dadosEmpresa, whatsapp: e.target.value })}
                    placeholder="(00) 00000-0000" />
                </div>
              </div>
              <Button onClick={avancar} className="w-full h-11 font-semibold text-white rounded-xl mt-2"
                style={{ background: GRAD, border: "none" }}>
                Próxima etapa →
              </Button>
            </div>
          )}

          {/* ETAPA 2 */}
          {etapa === 2 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-5 h-5 text-violet-400" />
                <h3 className="text-lg font-semibold text-white">Seu Perfil</h3>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Nome Completo *</label>
                <Input value={dadosPerfil.nomeCompleto}
                  onChange={e => setDadosPerfil({ ...dadosPerfil, nomeCompleto: e.target.value })}
                  placeholder="Seu nome completo" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
                <Input value={user.email} disabled className="opacity-50 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Função</label>
                <Select value={dadosPerfil.cargo} onValueChange={v => setDadosPerfil({ ...dadosPerfil, cargo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="gestor">Gestor</SelectItem>
                    <SelectItem value="sdr">SDR</SelectItem>
                    <SelectItem value="closer">Closer</SelectItem>
                    <SelectItem value="cs">Customer Success</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 pt-1">
                <Button onClick={() => setEtapa(1)} variant="ghost"
                  className="flex-1 h-11 rounded-xl text-slate-400 hover:text-white border border-white/8">
                  ← Voltar
                </Button>
                <Button onClick={avancar} className="flex-1 h-11 font-semibold text-white rounded-xl"
                  style={{ background: GRAD, border: "none" }}>
                  Próxima etapa →
                </Button>
              </div>
            </div>
          )}

          {/* ETAPA 3 */}
          {etapa === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-semibold text-white">Escolha seu Plano</h3>
              </div>
              <div className="space-y-3">
                {PLANOS.map(plano => {
                  const selected = planoEscolhido === plano.id;
                  return (
                    <div key={plano.id} onClick={() => setPlanoEscolhido(plano.id)}
                      className="relative rounded-xl p-4 cursor-pointer transition-all"
                      style={{
                        background: selected ? "rgba(91,142,255,0.08)" : "rgba(255,255,255,0.03)",
                        border: selected ? "1px solid rgba(168,85,247,0.5)" : "1px solid rgba(255,255,255,0.07)",
                      }}>
                      {plano.popular && (
                        <span className="absolute -top-2.5 left-4 text-xs font-bold px-2.5 py-0.5 rounded-full text-white"
                          style={{ background: GRAD }}>Popular</span>
                      )}
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="text-base font-bold text-white">{plano.nome}</h4>
                          <p className="text-lg font-bold mt-0.5" style={{ color: selected ? "#a78bfa" : "#64748b" }}>
                            {plano.preco}
                          </p>
                        </div>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{
                            background: selected ? GRAD : "transparent",
                            border: selected ? "none" : "1.5px solid rgba(255,255,255,0.15)",
                          }}>
                          {selected && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </div>
                      </div>
                      <ul className="flex flex-wrap gap-x-4 gap-y-0.5">
                        {plano.features.map((f, i) => (
                          <li key={i} className="text-xs text-slate-500 flex items-center gap-1">
                            <span className="text-emerald-500">✓</span> {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-3 pt-2">
                <Button onClick={() => setEtapa(2)} variant="ghost"
                  className="flex-1 h-11 rounded-xl text-slate-400 hover:text-white border border-white/8">
                  ← Voltar
                </Button>
                <Button onClick={finalizar} disabled={loading}
                  className="flex-1 h-11 font-semibold text-white rounded-xl"
                  style={{ background: GRAD, border: "none" }}>
                  {loading
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Finalizando...</>
                    : "Finalizar e Começar 🚀"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}