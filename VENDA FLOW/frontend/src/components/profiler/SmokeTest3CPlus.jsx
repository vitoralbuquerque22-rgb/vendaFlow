import { useState, useRef, useCallback } from "react";
import { api } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import {
  CheckCircle2, XCircle, Loader2, Play, RotateCcw,
  ChevronDown, ChevronRight, AlertTriangle, FlaskConical,
  Wifi, Phone, PhoneOff, ShieldCheck, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ── Helpers ───────────────────────────────────────────────────
function elapsed(ms) {
  if (ms == null) return "—";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function StatusIcon({ state, size = "w-4 h-4" }) {
  if (state === "pass")    return <CheckCircle2 className={`${size} text-emerald-400 shrink-0`} />;
  if (state === "fail")    return <XCircle       className={`${size} text-red-400 shrink-0`} />;
  if (state === "running") return <Loader2       className={`${size} text-sky-400 shrink-0 animate-spin`} />;
  if (state === "warn")    return <AlertTriangle className={`${size} text-amber-400 shrink-0`} />;
  return <div className={`${size} rounded-full border border-white/20 shrink-0`} />;
}

function StateBadge({ state }) {
  const map = {
    pass:    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    fail:    "bg-red-500/10 text-red-400 border-red-500/20",
    running: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    warn:    "bg-amber-500/10 text-amber-400 border-amber-500/20",
    idle:    "bg-white/[0.04] text-slate-500 border-white/[0.08]",
  };
  const label = { pass: "OK", fail: "FALHOU", running: "...", warn: "AVISO", idle: "—" };
  return (
    <Badge className={`text-[10px] border font-mono ${map[state] || map.idle}`}>
      {label[state] || "—"}
    </Badge>
  );
}

// ── TestCard ──────────────────────────────────────────────────
function TestCard({ test, onRun }) {
  const [open, setOpen] = useState(false);
  const { state, ms, output, detail } = test;

  return (
    <div className={`rounded-xl border transition-colors ${
      state === "pass" ? "border-emerald-500/20" :
      state === "fail" ? "border-red-500/20" :
      state === "warn" ? "border-amber-500/20" :
      state === "running" ? "border-sky-500/20" :
      "border-white/[0.06]"
    }`}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors rounded-xl"
        onClick={() => setOpen(o => !o)}
      >
        <StatusIcon state={state} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{test.name}</p>
          {detail && state !== "idle" && (
            <p className={`text-xs mt-0.5 truncate ${state === "fail" ? "text-red-400" : state === "warn" ? "text-amber-400" : "text-slate-400"}`}>
              {detail}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StateBadge state={state} />
          {ms != null && <span className="text-[10px] text-slate-500 font-mono w-12 text-right">{elapsed(ms)}</span>}
          <Button
            size="sm"
            disabled={state === "running"}
            onClick={e => { e.stopPropagation(); onRun(test.id); }}
            className="h-7 px-2.5 text-xs bg-white/[0.04] border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.08]"
          >
            <Play className="w-3 h-3" />
          </Button>
          {open
            ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
          }
        </div>
      </div>

      {open && (
        <div className="border-t border-white/[0.06] px-4 py-3 space-y-2">
          <p className="text-xs text-slate-500">{test.description}</p>
          {output && (
            <pre className={`text-[11px] font-mono rounded-lg px-3 py-2.5 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed ${
              state === "fail" ? "bg-red-500/5 text-red-300 border border-red-500/15" :
              state === "warn" ? "bg-amber-500/5 text-amber-300 border border-amber-500/15" :
              "bg-white/[0.03] text-slate-300 border border-white/[0.06]"
            }`}>
              {typeof output === "string" ? output : JSON.stringify(output, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ── SummaryBar ────────────────────────────────────────────────
function SummaryBar({ tests }) {
  const pass = tests.filter(t => t.state === "pass").length;
  const fail = tests.filter(t => t.state === "fail").length;
  const warn = tests.filter(t => t.state === "warn").length;
  const idle = tests.filter(t => t.state === "idle").length;

  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="text-emerald-400 font-semibold">{pass} OK</span>
      <span className="text-red-400 font-semibold">{fail} falhou</span>
      {warn > 0 && <span className="text-amber-400 font-semibold">{warn} aviso</span>}
      <span className="text-slate-500">{idle} pendente</span>
    </div>
  );
}

// ── DEFINIÇÃO DOS TESTES ──────────────────────────────────────
// Cada teste recebe { empresaId, user, userProfile, integracao, api }
// e retorna { detail, output } ou lança erro.

function buildTests() {
  return [
    // ── SEÇÃO 1: Configuração ──────────────────────────────────
    {
      id: "cfg-userprofile",
      section: "Configuração",
      icon: ShieldCheck,
      name: "UserProfile — SDR com token configurado",
      description: "Busca todos os UserProfiles da empresa e encontra o primeiro SDR com token_3cplus. O admin não precisa ter token — o teste verifica se ao menos 1 SDR está configurado.",
      run: async ({ empresaId }) => {
        // Buscar todos os profiles da empresa — admin pode não ter token_3cplus
        const profiles = await api.entities.UserProfile.filter({ empresaId });
        if (!profiles?.length) throw new Error("Nenhum UserProfile encontrado nesta empresa");

        const comToken = profiles.filter(p => p.token_3cplus && p.token_3cplus.trim());
        if (!comToken.length) {
          throw new Error(
            `Nenhum SDR com token_3cplus configurado (${profiles.length} profile(s) encontrado(s)) — configure em Perfil → Telefonia`
          );
        }

        const semRamal = comToken.filter(p => !p.ramal_3cplus);
        const comRamal = comToken.filter(p => p.ramal_3cplus);

        return {
          detail: `${comToken.length} SDR(s) com token | ${comRamal.length} com ramal (click2call)`,
          output: {
            total_profiles: profiles.length,
            com_token: comToken.map(p => ({
              email: p.user_email,
              token: p.token_3cplus.slice(0, 8) + "...",
              ramal: p.ramal_3cplus || null,
            })),
            aviso: semRamal.length > 0
              ? `${semRamal.map(p => p.user_email).join(", ")} sem ramal_3cplus — usarão enter+dial`
              : null,
          },
          warn: comRamal.length === 0,
        };
      },
    },
    {
      id: "cfg-integracao",
      section: "Configuração",
      icon: Wifi,
      name: "Integração 3C Plus ativa",
      description: "Verifica se existe Integracao com fornecedor=3cplus, ativa=true, com dominio e token_gestor.",
      run: async ({ empresaId }) => {
        const integracoes = await api.entities.Integracao.filter({
          empresaId, tipo: "telefonia", ativa: true,
        });
        const integracao = integracoes?.find(i => i.configuracao?.fornecedor === "3cplus");
        if (!integracao) throw new Error("Integração 3C Plus não encontrada ou inativa");
        const cfg = integracao.configuracao;
        if (!cfg.dominio) throw new Error("Campo dominio não configurado na integração");
        return {
          detail: `dominio: ${cfg.dominio} | token_gestor: ${cfg.token_gestor ? "✓" : "✗ ausente"}`,
          output: {
            dominio: cfg.dominio,
            token_gestor: cfg.token_gestor ? cfg.token_gestor.slice(0, 8) + "..." : null,
            campanha_id_padrao: cfg.campanha_id_padrao || null,
          },
          warn: !cfg.token_gestor,
        };
      },
    },
    // ── SEÇÃO 2: API 3C Plus — leitura ───────────────────────
    {
      id: "api-campaigns",
      section: "API 3C Plus",
      icon: Wifi,
      name: "GET /agent/campaigns — token válido",
      description: "Usa o token do primeiro SDR com token_3cplus configurado para verificar conectividade com a API da 3C Plus.",
      run: async ({ empresaId }) => {
        // Pegar primeiro SDR com token — admin pode não ter
        const profiles = await api.entities.UserProfile.filter({ empresaId });
        const sdrProfile = profiles?.find(p => p.token_3cplus?.trim());
        if (!sdrProfile) throw new Error("Nenhum SDR com token_3cplus configurado nesta empresa");

        const res = await api.functions.invoke("testar3CPlus", {
          empresaId,
          token: sdrProfile.token_3cplus,
          endpoint: "/agent/campaigns",
          method: "GET",
        });

        const data = res?.data;
        if (data?.status === 401 || data?.httpStatus === 401) throw new Error(`Token do SDR ${sdrProfile.user_email} inválido ou expirado (401)`);
        if (data?.error) throw new Error(data.error);

        const campaigns = data?.result?.data || data?.result || [];
        const count = Array.isArray(campaigns) ? campaigns.length : "?";
        return {
          detail: `SDR: ${sdrProfile.user_email} | ${count} campanha(s)`,
          output: Array.isArray(campaigns)
            ? campaigns.map(c => ({ id: c.id, name: c.name, status: c.status }))
            : data?.result,
        };
      },
    },
    {
      id: "api-connect",
      section: "API 3C Plus",
      icon: Wifi,
      name: "POST /agent/connect — registrar ramal",
      description: "Testa o endpoint de connect usando o token do primeiro SDR configurado.",
      run: async ({ empresaId }) => {
        const profiles = await api.entities.UserProfile.filter({ empresaId });
        const sdrProfile = profiles?.find(p => p.token_3cplus?.trim());
        if (!sdrProfile) throw new Error("Nenhum SDR com token_3cplus configurado");

        const res = await api.functions.invoke("testar3CPlus", {
          empresaId,
          token: sdrProfile.token_3cplus,
          endpoint: "/agent/connect",
          method: "POST",
          payload: "",
        });

        const data = res?.data;
        const status = data?.httpStatus || data?.status;
        if (status === 401) throw new Error(`Token do SDR ${sdrProfile.user_email} inválido (401)`);
        const ok = status === 204 || status === 200 || status === 422;
        if (!ok) throw new Error(`Retornou ${status} — esperado 200/204`);
        return {
          detail: `SDR: ${sdrProfile.user_email} | HTTP ${status}`,
          output: { httpStatus: status, sdr: sdrProfile.user_email, result: data?.result || null },
          warn: status === 422,
        };
      },
    },
    // ── SEÇÃO 3: Entidades CRM ───────────────────────────────
    {
      id: "crm-lead-exists",
      section: "CRM",
      icon: Phone,
      name: "Lead de teste disponível",
      description: "Verifica se existe ao menos 1 Lead com telefone preenchido nesta empresa, necessário para testar discagem.",
      run: async ({ empresaId }) => {
        const leads = await api.entities.Lead.filter({ empresaId });
        if (!leads?.length) throw new Error("Nenhum lead encontrado nesta empresa");
        const comTel = leads.filter(l => l.telefone && l.telefone.replace(/\D/g, "").length >= 8);
        if (!comTel.length) throw new Error("Nenhum lead com telefone válido encontrado");
        const lead = comTel[0];
        return {
          detail: `${lead.nome} — ${lead.telefone}`,
          output: {
            lead_id: lead.id,
            nome: lead.nome,
            telefone: lead.telefone,
            status: lead.status,
            is_locked: lead.is_locked_for_call || false,
          },
        };
      },
    },
    {
      id: "crm-call-session-write",
      section: "CRM",
      icon: Phone,
      name: "CallSession — criar e deletar",
      description: "Cria uma CallSession de teste (status=failed) e verifica que foi criada corretamente. Não disca.",
      run: async ({ empresaId, user }) => {
        const sessao = await api.entities.CallSession.create({
          empresaId,
          lead_id: "smoke-test",
          lead_nome: "[Smoke Test]",
          lead_telefone: "00000000000",
          sdr_email: user.email,
          campanha_id_3cplus: "smoke",
          status: "failed",
          origem: "manual",
          session_scope: "lead",
          iniciada_em: new Date().toISOString(),
          spin_preenchido: false,
          gravacao_processada: false,
          erro_mensagem: "Criado pelo smoke test — pode ser deletado",
        });
        if (!sessao?.id) throw new Error("Falha ao criar CallSession");
        // Marcar como finished imediatamente
        await api.entities.CallSession.update(sessao.id, {
          status: "finished",
          finalizada_em: new Date().toISOString(),
        });
        return {
          detail: `id: ${sessao.id} | criada e finalizada`,
          output: { id: sessao.id, status: "finished", aviso: "Sessão de smoke test criada — pode ser removida manualmente" },
        };
      },
    },
    // ── SEÇÃO 4: Functions backend ────────────────────────────
    {
      id: "fn-ligar-agora-dry",
      section: "Functions",
      icon: Zap,
      name: "ligarAgoraLead3CPlus — lead locked (sem discar)",
      description: "Testa o fluxo de ligarAgoraLead3CPlus com um lead bloqueado — deve retornar 409 LEAD_LOCKED sem chamar a 3C Plus.",
      run: async ({ empresaId, user }) => {
        // Criar lead temporário já bloqueado
        const lead = await api.entities.Lead.create({
          empresaId,
          nome: "[Smoke Test Lead]",
          telefone: "11000000001",
          status: "novo",
          is_locked_for_call: true,
          lock_agent_email: "outro.sdr@empresa.com",
          lock_at: new Date().toISOString(),
        });

        let resultado = null;
        try {
          resultado = await api.functions.invoke("ligarAgoraLead3CPlus", {
            empresaId,
            lead_id: lead.id,
          });
        } catch (e) {
          // Limpar lead antes de lançar
          await api.entities.Lead.update(lead.id, { is_locked_for_call: false }).catch(() => {});
          const httpStatus = e.response?.status;
          const data = e.response?.data;
          if (httpStatus === 409 && data?.codigo === "LEAD_LOCKED") {
            // Esperado!
            await api.entities.Lead.update(lead.id, { is_locked_for_call: false }).catch(() => {});
            return {
              detail: `409 LEAD_LOCKED — bloqueio detectado corretamente`,
              output: { codigo: data.codigo, agent_lock: data.agent_lock, mensagem: data.mensagem },
            };
          }
          throw new Error(`Esperado 409 LEAD_LOCKED, recebido ${httpStatus}: ${e.message}`);
        } finally {
          await api.entities.Lead.update(lead.id, { is_locked_for_call: false }).catch(() => {});
        }

        // Se chegou aqui (2xx), algo está errado — lead bloqueado não deveria ser discado
        throw new Error(`Esperado 409, recebeu 2xx: ${JSON.stringify(resultado?.data)}`);
      },
    },
    {
      id: "fn-ligar-agora-sem-token",
      section: "Functions",
      icon: Zap,
      name: "ligarAgoraLead3CPlus — sem token (400)",
      description: "Passa um lead_id inexistente para forçar o retorno 404 ou 400 e confirmar que o backend valida corretamente.",
      run: async ({ empresaId }) => {
        try {
          await api.functions.invoke("ligarAgoraLead3CPlus", {
            empresaId,
            lead_id: "lead-inexistente-smoke-test-xyz",
          });
          throw new Error("Deveria ter retornado erro, mas retornou 2xx");
        } catch (e) {
          const status = e.response?.status;
          const data = e.response?.data;
          if (status === 404) {
            return {
              detail: "404 — Lead não encontrado (validação ok)",
              output: { status, error: data?.error },
            };
          }
          if (status === 400 && data?.codigo === "TOKEN_NOT_FOUND") {
            return {
              detail: "400 TOKEN_NOT_FOUND — token ausente detectado",
              output: { status, codigo: data?.codigo, mensagem: data?.mensagem },
            };
          }
          if (e.message === "Deveria ter retornado erro, mas retornou 2xx") throw e;
          throw new Error(`Status inesperado ${status}: ${e.message}`);
        }
      },
    },
    {
      id: "fn-finalizar-sessao-finished",
      section: "Functions",
      icon: PhoneOff,
      name: "finalizarLigacao3CPlus — sessão finished (sem crash)",
      description: "Cria CallSession com status=finished e chama finalizarLigacao — deve retornar 200+aviso, não 500.",
      run: async ({ empresaId, user }) => {
        const sessao = await api.entities.CallSession.create({
          empresaId,
          lead_nome: "[Smoke Test Finalizar]",
          lead_telefone: "00000000000",
          sdr_email: user.email,
          campanha_id_3cplus: "smoke",
          status: "finished",
          origem: "campanha_automatica",
          session_scope: "lead",
          iniciada_em: new Date().toISOString(),
          finalizada_em: new Date().toISOString(),
          spin_preenchido: false,
          gravacao_processada: false,
        });

        let res;
        try {
          res = await api.functions.invoke("finalizarLigacao3CPlus", {
            empresaId,
            call_session_id: sessao.id,
            resultado: "nao_atendeu",
            spin: null,
            observacao: "smoke test",
            duracao_segundos: 0,
          });
        } catch (e) {
          const status = e.response?.status;
          if (status === 500) throw new Error("Ainda retornando 500 — bug tokenAgenteHangup não corrigido");
          throw e;
        }

        const data = res?.data;
        if (!data?.success && !data?.aviso) throw new Error(`Retornou sem success nem aviso: ${JSON.stringify(data)}`);
        return {
          detail: data?.aviso ? `200 + aviso: "${data.aviso}"` : "200 success",
          output: data,
        };
      },
    },
  ];
}

// ── Main Component ────────────────────────────────────────────
export default function SmokeTest3CPlus() {
  const { empresaId } = useEmpresaAtual();
  const { data: user } = useQuery({ queryKey: ["me"], queryFn: () => api.auth.me() });

  const initialTests = buildTests().map(t => ({
    ...t,
    state: "idle",
    ms: null,
    output: null,
    detail: null,
  }));

  const [tests, setTests] = useState(initialTests);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);

  const updateTest = useCallback((id, patch) => {
    setTests(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }, []);

  const runOne = useCallback(async (id) => {
    if (!empresaId || !user) return;
    const test = buildTests().find(t => t.id === id);
    if (!test) return;

    updateTest(id, { state: "running", ms: null, output: null, detail: null });
    const t0 = Date.now();

    try {
      // Buscar integracao para passar ao teste
      let integracao = null;
      try {
        const integracoes = await api.entities.Integracao.filter({ empresaId, tipo: "telefonia", ativa: true });
        integracao = integracoes?.find(i => i.configuracao?.fornecedor === "3cplus") || null;
      } catch { /* não crítico */ }

      const result = await test.run({ empresaId, user, integracao });
      const ms = Date.now() - t0;
      updateTest(id, {
        state: result.warn ? "warn" : "pass",
        ms,
        detail: result.detail || null,
        output: result.output || null,
      });
    } catch (e) {
      const ms = Date.now() - t0;
      updateTest(id, {
        state: "fail",
        ms,
        detail: e.message,
        output: e.response?.data ? JSON.stringify(e.response.data, null, 2) : e.message,
      });
    }
  }, [empresaId, user, updateTest]);

  const runAll = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setTests(prev => prev.map(t => ({ ...t, state: "idle", ms: null, output: null, detail: null })));

    const ids = buildTests().map(t => t.id);
    for (const id of ids) {
      if (!runningRef.current) break;
      await runOne(id);
    }

    runningRef.current = false;
    setRunning(false);
  }, [runOne]);

  const reset = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    setTests(prev => prev.map(t => ({ ...t, state: "idle", ms: null, output: null, detail: null })));
  }, []);

  // Agrupar por seção
  const sections = [...new Set(tests.map(t => t.section))];

  const totalPass = tests.filter(t => t.state === "pass" || t.state === "warn").length;
  const totalFail = tests.filter(t => t.state === "fail").length;
  const allDone = tests.every(t => t.state !== "idle" && t.state !== "running");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FlaskConical className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-white">Smoke Test — Telefonia 3C Plus</h3>
          </div>
          <p className="text-xs text-slate-500">
            Testa configuração, conectividade com a API 3C Plus e functions backend usando credenciais reais.
            Os testes de token usam o primeiro SDR configurado na empresa — não exigem que o admin tenha token_3cplus.
            Nenhuma ligação real é realizada.
          </p>
          <div className="flex items-center gap-2 mt-2 px-3 py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/10 w-fit">
            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="text-[11px] text-amber-400">Os testes de Functions criam e finalizam entidades de teste no banco de dados desta empresa.</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={reset}
            disabled={running}
            className="h-8 px-3 text-xs bg-white/[0.04] border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.08] gap-1.5"
          >
            <RotateCcw className="w-3 h-3" />
            Resetar
          </Button>
          <Button
            size="sm"
            onClick={runAll}
            disabled={running || !empresaId || !user}
            className="h-8 px-4 text-xs bg-violet-500/10 border border-violet-500/20 text-violet-300 hover:bg-violet-500/20 gap-1.5"
          >
            {running
              ? <><Loader2 className="w-3 h-3 animate-spin" /> Rodando...</>
              : <><Play className="w-3 h-3" /> Rodar todos</>
            }
          </Button>
        </div>
      </div>

      {/* Summary */}
      {allDone && tests.some(t => t.state !== "idle") && (
        <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm ${
          totalFail > 0
            ? "bg-red-500/5 border-red-500/15 text-red-300"
            : "bg-emerald-500/5 border-emerald-500/15 text-emerald-300"
        }`}>
          {totalFail > 0
            ? <XCircle className="w-4 h-4 shrink-0" />
            : <CheckCircle2 className="w-4 h-4 shrink-0" />
          }
          <span className="font-medium">
            {totalFail > 0
              ? `${totalFail} teste(s) falharam — verifique a configuração`
              : `Todos os ${totalPass} testes passaram`
            }
          </span>
        </div>
      )}

      {!empresaId && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-400 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Selecione uma empresa para executar os testes.
        </div>
      )}

      {/* Testes por seção */}
      {sections.map(section => {
        const sectionTests = tests.filter(t => t.section === section);
        const sPass = sectionTests.filter(t => t.state === "pass" || t.state === "warn").length;
        const sFail = sectionTests.filter(t => t.state === "fail").length;

        return (
          <div key={section}>
            <div className="flex items-center gap-3 mb-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{section}</p>
              {sFail > 0 && <Badge className="text-[10px] bg-red-500/10 text-red-400 border-red-500/15">{sFail} falhou</Badge>}
              {sFail === 0 && sPass > 0 && <Badge className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/15">{sPass}/{sectionTests.length}</Badge>}
            </div>
            <div className="space-y-2">
              {sectionTests.map(test => (
                <TestCard
                  key={test.id}
                  test={test}
                  onRun={runOne}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}