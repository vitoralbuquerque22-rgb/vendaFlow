/**
 * calcularCommercialInsights
 * Agrega Lead + Atividade + Tarefa + SdrDailyStats → CommercialInsights
 * Roda a cada 30 minutos via automação agendada.
 * Upsert por (empresaId + dia) — idempotente.
 */
import { createClientFromRequest } from "../../src/sdk.ts";

const DIAS_MS = (d) => d * 86400000;

function diasDesde(ts, now) {
  return Math.floor((now - ts) / DIAS_MS(1));
}

function nomeCurto(email) {
  return email?.split("@")[0]?.replace(/[._-]/g, " ") || email;
}

function calcularGargalos(leads) {
  const total = leads.length || 1;
  const cnt = {};
  leads.forEach((l) => { cnt[l.status] = (cnt[l.status] || 0) + 1; });
  return [
    { label: "Leads novos parados",      count: cnt["novo"]             || 0, pct: Math.round((cnt["novo"]             || 0) / total * 100) },
    { label: "Em cadência sem resposta", count: cnt["em_cadencia"]      || 0, pct: Math.round((cnt["em_cadencia"]      || 0) / total * 100) },
    { label: "Reuniões não realizadas",  count: cnt["reuniao_agendada"] || 0, pct: Math.round((cnt["reuniao_agendada"] || 0) / total * 100) },
    { label: "Desqualificados",          count: cnt["desqualificado"]   || 0, pct: Math.round((cnt["desqualificado"]   || 0) / total * 100) },
  ].filter((g) => g.count > 0).sort((a, b) => b.count - a.count);
}

export default async (req) => {
  try {
    const api = createClientFromRequest(req);
    const user   = await api.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const empresaId = payload.empresaId || user?.empresaAtualId;
    if (!empresaId) return Response.json({ error: "empresaId obrigatório" }, { status: 400 });

    const now     = Date.now();
    const hoje    = new Date().toISOString().slice(0, 10);
    const corte30 = new Date(now - DIAS_MS(30)).toISOString().slice(0, 10);

    const [leads, atividades, tarefas, stats] = await Promise.all([
      api.asServiceRole.entities.Lead.filter({ empresaId }),
      api.asServiceRole.entities.Atividade.filter({ empresaId }),
      api.asServiceRole.entities.Tarefa.filter({ empresaId, status: "pendente" }),
      api.asServiceRole.entities.SdrDailyStats.filter({ empresaId }),
    ]);

    // Índice: última atividade por lead
    const ultimaAtivPorLead = {};
    atividades.forEach((a) => {
      if (!a.lead_id) return;
      const t = new Date(a.created_date || 0).getTime();
      if (!ultimaAtivPorLead[a.lead_id] || t > ultimaAtivPorLead[a.lead_id]) {
        ultimaAtivPorLead[a.lead_id] = t;
      }
    });

    // Índice: lead por ID
    const leadById = {};
    leads.forEach((l) => { leadById[l.id] = l; });

    // Leads esquecidos (> 7 dias sem atividade)
    const leadsEsquecidos = leads
      .filter((l) => !["desqualificado", "sem_interesse", "cliente"].includes(l.status))
      .filter((l) => {
        const ultima = ultimaAtivPorLead[l.id];
        return !ultima || now - ultima > DIAS_MS(7);
      })
      .map((l) => {
        const ultima = ultimaAtivPorLead[l.id];
        const diasSemAtividade = ultima
          ? diasDesde(ultima, now)
          : diasDesde(new Date(l.created_date || now).getTime(), now);
        return {
          id:                 l.id,
          nome:               l.nome || "Lead sem nome",
          telefone:           l.telefone || null,
          status:             l.status || "novo",
          sdr_responsavel:    l.sdr_responsavel || null,
          sdr_nome:           l.sdr_responsavel ? nomeCurto(l.sdr_responsavel) : null,
          dias_sem_atividade: diasSemAtividade,
          origem:             l.origem || null,
        };
      })
      .sort((a, b) => b.dias_sem_atividade - a.dias_sem_atividade)
      .slice(0, 15);

    // Follow-ups atrasados
    const followupsAtrasados = tarefas
      .filter((t) => t.data_prevista && t.data_prevista < hoje)
      .map((t) => {
        const lead   = leadById[t.lead_id];
        const corteMs = new Date(t.data_prevista + "T00:00:00").getTime();
        const diasAtrasado = diasDesde(corteMs, now);
        return {
          id:               t.id,
          lead_id:          t.lead_id,
          lead_nome:        lead?.nome || "Lead",
          lead_telefone:    lead?.telefone || null,
          tipo:             t.tipo || t.type || "tarefa",
          data_prevista:    t.data_prevista,
          sdr_responsavel:  t.responsavel || lead?.sdr_responsavel || null,
          sdr_nome:         t.responsavel ? nomeCurto(t.responsavel) : (lead?.sdr_responsavel ? nomeCurto(lead.sdr_responsavel) : null),
          dias_atrasado:    diasAtrasado,
        };
      })
      .sort((a, b) => b.dias_atrasado - a.dias_atrasado)
      .slice(0, 15);

    // Oportunidades quentes (score simples)
    const oportunidadesQuentes = leads
      .map((l) => {
        let score = 0;
        if (l.temperatura === "quente") score += 20;
        const ultima = ultimaAtivPorLead[l.id];
        if (ultima && now - ultima < DIAS_MS(3)) score += 20;
        if (l.proximo_passo) score += 15;
        if ((l.dor_principal || l.observacoes) && l.urgencia) score += 15;
        if (l.urgencia === "imediata" || l.urgencia === "alta") score += 10;
        if ((l.probabilidade_fechamento ?? 0) >= 70) score += 10;
        if ((l.total_ligacoes ?? 0) >= 2) score += 10;
        return {
          lead_id:          l.id,
          nome:             l.nome || "Lead sem nome",
          telefone:         l.telefone || null,
          sdr_responsavel:  l.sdr_responsavel || null,
          sdr_nome:         l.sdr_responsavel ? nomeCurto(l.sdr_responsavel) : null,
          temperatura:      l.temperatura || null,
          proximo_passo:    l.proximo_passo || null,
          urgencia:         l.urgencia || null,
          score,
        };
      })
      .filter((x) => x.score >= 60)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    // SDR stats 30 dias
    const statsRecentes = stats.filter((s) => s.dia >= corte30);
    const sdrMap = {};
    statsRecentes.forEach((s) => {
      if (!sdrMap[s.user_email]) sdrMap[s.user_email] = { email: s.user_email, nome: nomeCurto(s.user_email), atendimentos: 0, conversoes: 0 };
      sdrMap[s.user_email].atendimentos += s.atendimentos || 0;
      sdrMap[s.user_email].conversoes   += s.conversoes   || 0;
    });
    const sdrList = Object.values(sdrMap);

    const sdrDestaque = [...sdrList]
      .sort((a, b) => b.conversoes - a.conversoes)
      .slice(0, 3);

    const sdrBaixaPerf = sdrList
      .filter((s) => s.atendimentos >= 5)
      .sort((a, b) => (a.conversoes / a.atendimentos) - (b.conversoes / b.atendimentos))
      .slice(0, 3)
      .map((s) => ({ ...s, taxa: Math.round(s.conversoes / s.atendimentos * 100) }));

    const leadsAtivos = leads.filter((l) => !["desqualificado", "sem_interesse"].includes(l.status)).length;

    const existing = await api.asServiceRole.entities.CommercialInsights.filter({ empresaId, dia: hoje });
    const docData = {
      empresaId,
      dia: hoje,
      leads_esquecidos:            leadsEsquecidos,
      leads_esquecidos_count:      leadsEsquecidos.length,
      followups_atrasados:         followupsAtrasados,
      followups_atrasados_count:   followupsAtrasados.length,
      oportunidades_quentes:       oportunidadesQuentes,
      oportunidades_quentes_count: oportunidadesQuentes.length,
      gargalos:                    calcularGargalos(leads),
      sdr_destaque:                sdrDestaque,
      sdr_baixa_perf:              sdrBaixaPerf,
      total_leads:                 leads.length,
      total_leads_ativos:          leadsAtivos,
      atualizado_em:               new Date().toISOString(),
    };

    if (existing?.[0]) {
      await api.asServiceRole.entities.CommercialInsights.update(existing[0].id, docData);
    } else {
      await api.asServiceRole.entities.CommercialInsights.create(docData);
    }

    return Response.json({ ok: true, empresaId, dia: hoje, leads_esquecidos: leadsEsquecidos.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};
