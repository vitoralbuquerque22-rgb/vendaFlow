import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });

    let body;
    try { body = await req.json(); } catch { return Response.json({ error: 'Body inválido' }, { status: 400 }); }

    const { empresaId, dias = 30 } = body;
    if (!empresaId) return Response.json({ error: 'empresaId obrigatório' }, { status: 400 });

    const userProfile = await base44.asServiceRole.entities.UserProfile
      .filter({ user_email: user.email, empresaId })
      .then((r) => r[0] || null);
    const isGestorAdmin = user.role === 'admin' || userProfile?.role === 'admin' || userProfile?.role === 'gestor';
    if (!isGestorAdmin) return Response.json({ error: 'Sem permissão' }, { status: 403 });

    const integracoes = await base44.asServiceRole.entities.Integracao.filter({ empresaId, tipo: 'telefonia', ativa: true });
    const integracao = integracoes.find((i) => i.configuracao?.fornecedor === '3cplus');
    if (!integracao) return Response.json({ error: 'Integração 3C Plus não configurada' }, { status: 424 });

    const cfg = integracao.configuracao;
    const token = String(cfg.token_gestor || '').trim();
    if (!token) return Response.json({ error: 'token_gestor não configurado' }, { status: 424 });

    const baseUrl = 'https://3c.fluxoti.com/api/v1';

    // ── 1. Buscar mapa de agentes ────────────────────────────────────────────
    const agentesMapNomeEmail = {};
    const agentesMapEmailNome = {};
    try {
      const respA = await fetch(`${baseUrl}/agents?api_token=${encodeURIComponent(token)}&per_page=200`, { signal: AbortSignal.timeout(8000) });
      if (respA.ok) {
        const dadosA = await respA.json().catch(() => ({}));
        const lista = Array.isArray(dadosA) ? dadosA : (dadosA?.data || []);
        lista.forEach((a) => {
          const email = String(a.login || a.email || '').toLowerCase();
          const nome  = String(a.name || '');
          if (email && nome) {
            agentesMapEmailNome[email] = nome;
            agentesMapNomeEmail[nome.toLowerCase()] = email;
          }
        });
        console.log(`[repairGravacoes3CPlus] agentes: ${lista.length}`);
      }
    } catch (e) { console.warn('[repairGravacoes3CPlus] agentes erro:', e.message); }

    // ── 2. Buscar chamadas reais da API 3C Plus ──────────────────────────────
    const agora = new Date();
    const inicio = new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000);
    // Formato Y-m-d H:i:s no timezone de Brasília (UTC-3) — hífens, sem barras
    const fmtDate = (d) => {
      const br = new Date(d.getTime() - 3 * 60 * 60 * 1000);
      return br.toISOString().slice(0, 19).replace('T', ' ');
    };
    const startDate = fmtDate(inicio);
    const endDate   = fmtDate(agora);
    console.log('[repairGravacoes3CPlus] start_date (BR):', startDate, '| end_date (BR):', endDate);

    const urlCalls = `${baseUrl}/calls?api_token=${encodeURIComponent(token)}&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}&per_page=500&with_mailing=true`;

    console.log(`[repairGravacoes3CPlus] buscando calls dos últimos ${dias} dias...`);
    console.log(`[repairGravacoes3CPlus] URL: ${urlCalls.replace(token, 'TOKEN')}`);

    const respCalls = await fetch(urlCalls, { signal: AbortSignal.timeout(30000) });
    if (!respCalls.ok) {
      const err = await respCalls.text().catch(() => '');
      console.error(`[repairGravacoes3CPlus] /calls ${respCalls.status}:`, err.substring(0, 500));
      return Response.json({ error: `Erro API 3C Plus: HTTP ${respCalls.status}`, detalhe: err.substring(0, 300) }, { status: 502, headers: CORS });
    }
    const dadosCalls = await respCalls.json().catch(() => ({}));
    const calls = Array.isArray(dadosCalls) ? dadosCalls : (dadosCalls?.data || []);
    console.log(`[repairGravacoes3CPlus] calls da API: ${calls.length}`);

    // ── 3. Montar mapa de calls por ID real e por telefone+dia ───────────────
    const callsMapById = new Map();
    const callsMapByTelData = new Map();

    for (const call of calls) {
      const callId = String(call.id || '');
      if (callId) callsMapById.set(callId, call);

      const tel = String(call.number || '').replace(/\D/g, '');
      const dia = String(call.call_date_rfc3339 || call.call_date || '').substring(0, 10);
      if (tel && dia) {
        const chave = `${tel}|${dia}`;
        if (!callsMapByTelData.has(chave)) callsMapByTelData.set(chave, call);
      }
    }
    console.log(`[repairGravacoes3CPlus] calls indexados: por_id=${callsMapById.size}, por_tel_data=${callsMapByTelData.size}`);

    // ── 4. Buscar registros no banco que precisam repair ─────────────────────
    const todas = await base44.asServiceRole.entities.GravacaoLigacao.filter({ empresaId });
    const precisamRepair = todas.filter((g) =>
      !g.purged_at &&
      (!g.lead_nome || !g.sdr_email || g.sdr_email.trim() === '' || !g.campanha_nome)
    );
    console.log(`[repairGravacoes3CPlus] registros precisando repair: ${precisamRepair.length}`);

    let corrigidos = 0;
    let semMatch = 0;
    let jaCompletos = 0;

    for (const gravacao of precisamRepair) {
      try {
        const callIdAtual = String(gravacao.call_id_3cplus || '');

        // Tentativa 1: cruzar pelo call_id atual (pode ser inválido)
        let call = callsMapById.get(callIdAtual) || null;

        // Tentativa 2: cruzar por telefone + dia (quando call_id é inválido)
        if (!call && gravacao.lead_telefone) {
          const tel = String(gravacao.lead_telefone).replace(/\D/g, '');
          const dia = String(gravacao.data_gravacao || '').substring(0, 10);
          if (tel && dia) call = callsMapByTelData.get(`${tel}|${dia}`) || null;
        }

        if (!call) {
          semMatch++;
          continue;
        }

        // Extrair campos reais
        const agentNome    = String(call.agent || '');
        const sdrEmailNovo = (agentesMapNomeEmail[agentNome.toLowerCase()] || gravacao.sdr_email || '').toLowerCase();
        const sdrNomeNovo  = agentNome || gravacao.sdr_nome || '';
        // Campos reais confirmados: mailing_data.identifier=nome, mailing_data.phone=telefone
        const mailingData  = call.mailing_data || {};
        const leadNomeNovo = String(mailingData.identifier || call.list || gravacao.lead_nome || '');
        const telefoneNovo = String(mailingData.phone || call.number || gravacao.lead_telefone || '');
        const campanhaNome = String(call.campaign || gravacao.campanha_nome || '');
        const campanhaId   = String(call.campaign_id || gravacao.campanha_id || '');
        const callIdReal   = String(call.id || gravacao.call_id_3cplus || '');
        const resultado3C  = String(call.readable_behavior_text || call.qualification || gravacao.resultado || '');

        let duracao = gravacao.duracao_segundos || 0;
        if (call.speaking_time) {
          const st = String(call.speaking_time);
          if (st.includes(':')) {
            const [mm, ss] = st.split(':').map(Number);
            duracao = (mm * 60) + (ss || 0);
          } else {
            duracao = Number(st) || duracao;
          }
        }

        // Campo recording vem direto no response
        const urlGravacaoNova = String(call.recording || call.recording_after_consult_cancel || '') || null;

        // Montar update apenas com campos que estavam vazios
        const update = {};
        if (!gravacao.sdr_email && sdrEmailNovo)     update.sdr_email = sdrEmailNovo;
        if (!gravacao.sdr_nome  && sdrNomeNovo)      update.sdr_nome  = sdrNomeNovo;
        if (!gravacao.lead_nome && leadNomeNovo)     { update.lead_nome = leadNomeNovo; update.lead_nome_original = leadNomeNovo; }
        if (!gravacao.lead_telefone && telefoneNovo) { update.lead_telefone = telefoneNovo; update.lead_telefone_original = telefoneNovo; }
        if (!gravacao.campanha_nome && campanhaNome) update.campanha_nome = campanhaNome;
        if (!gravacao.campanha_id   && campanhaId)   update.campanha_id   = campanhaId;
        if (!gravacao.duracao_segundos && duracao)   update.duracao_segundos = duracao;
        if (!gravacao.resultado && resultado3C)       update.resultado = resultado3C;
        if (!gravacao.gravacao_url_backup && urlGravacaoNova) update.gravacao_url_backup = urlGravacaoNova;
        // Corrigir call_id inválido
        if (callIdAtual !== callIdReal && callIdReal) update.call_id_3cplus = callIdReal;

        if (Object.keys(update).length > 0) {
          await base44.asServiceRole.entities.GravacaoLigacao.update(gravacao.id, update);
          corrigidos++;
        } else {
          jaCompletos++;
        }

        await new Promise(r => setTimeout(r, 30));

      } catch (e) {
        console.error(`[repairGravacoes3CPlus] erro ${gravacao.id}:`, e.message);
      }
    }

    console.log(`[repairGravacoes3CPlus] resultado: corrigidos=${corrigidos}, semMatch=${semMatch}, jaCompletos=${jaCompletos}`);

    return Response.json({
      total_precisam_repair: precisamRepair.length,
      corrigidos,
      sem_match: semMatch,
      ja_completos: jaCompletos,
      calls_da_api: calls.length,
      mensagem: corrigidos > 0
        ? `${corrigidos} registros corrigidos com sucesso`
        : semMatch === precisamRepair.length
        ? `Nenhum registro cruzou com as ${calls.length} chamadas dos últimos ${dias} dias — tente aumentar o período com dias=60 ou dias=90`
        : `${jaCompletos} registros já estavam completos`,
    }, { headers: CORS });

  } catch (e) {
    console.error('[repairGravacoes3CPlus] erro crítico:', e.message);
    return Response.json({ error: e.message }, { status: 500, headers: CORS });
  }
});