import { createClientFromRequest } from "../../src/sdk.ts";
import { chamar3C, credencialGestor, respostaErro3C, listarAgentes } from "../../src/telefonia3c.ts";

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  try {
    const api = createClientFromRequest(req);
    const user = await api.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });

    let body;
    try { body = await req.json(); } catch { return Response.json({ error: 'Body inválido' }, { status: 400 }); }

    const { empresaId, sdr_email, dias = 7 } = body;
    if (!empresaId) return Response.json({ error: 'empresaId obrigatório' }, { status: 400 });

    // Verificar permissão — SDR só vê próprias gravações
    const userProfile = await api.asServiceRole.entities.UserProfile.filter({ user_email: user.email, empresaId }).then(r => r[0] || null);
    const isGestorAdmin = user.role === 'admin' || userProfile?.role === 'admin' || userProfile?.role === 'gestor';
    const filtroEmail = isGestorAdmin ? (sdr_email || null) : user.email;

    // Credencial de gestor (token de serviço 3cs_ ou pessoal legado) resolvida pelo módulo central
    const cred = await credencialGestor(api, empresaId);

    // Calcular janela de dias
    const agora = new Date();
    const inicio = new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000);
    // Formato Y-m-d H:i:s no timezone de Brasília (UTC-3) — hífens, sem barras
    const fmtDate = (d) => {
      const partes = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
      }).formatToParts(d);
      const get = (type) => partes.find(p => p.type === type)?.value || '00';
      return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
    };
    const startDate = fmtDate(inicio);
    const endDate   = fmtDate(agora);
    console.log('[buscarGravacoes3CPlus] start_date (BR):', startDate, '| end_date (BR):', endDate);

    // ── Buscar lista de agentes primeiro ────────────────────────────────────
    // GET /agents retorna: id, name, login (email), extension
    // Necessário para: (1) montar mapa nome→email, (2) resolver agent_id para filtro
    const agentesMapEmailId = {};  // email → id
    const agentesMapNomeEmail = {}; // name.lower → email
    const agentesMapEmailNome = {}; // email → name
    try {
      const respAgentes = await listarAgentes(cred).then((data) => ({ ok: true, json: async () => ({ data }) })); // todas as páginas
      if (respAgentes.ok) {
        const dadosAgentes = await respAgentes.json().catch(() => ({}));
        const lista = Array.isArray(dadosAgentes) ? dadosAgentes : (dadosAgentes?.data || []);
        lista.forEach((a) => {
          const email = String(a.login || a.email || '').toLowerCase();
          const nome  = String(a.name || '');
          const id    = Number(a.id || 0);
          if (email && id) agentesMapEmailId[email] = id;
          if (email && nome) agentesMapEmailNome[email] = nome;
          if (nome && email) agentesMapNomeEmail[nome.toLowerCase()] = email;
        });
        console.log('[buscarGravacoes3CPlus] agentes mapeados:', lista.length);
      }
    } catch (e) { console.warn('[buscarGravacoes3CPlus] agentes:', e.message); }

    // ── Montar URL do GET /calls ─────────────────────────────────────────────
    // Query string montada pelo chamar3C (URLSearchParams codifica as datas; o token vai no header)
    const queryCalls = {
      start_date: startDate,
      end_date: endDate,
      per_page: 200,
      with_mailing: 'true',
      minimum_duration: 5,
    };

    // Filtrar por agente: API exige agents[]={id} (array de IDs, não email)
    if (filtroEmail) {
      const agenteId = agentesMapEmailId[filtroEmail.toLowerCase()] || null;
      if (agenteId) {
        queryCalls['agents[]'] = agenteId; // agents[] encodado corretamente (agents%5B%5D)
        console.log('[buscarGravacoes3CPlus] filtrando agente:', filtroEmail, '→ id:', agenteId);
      } else {
        console.warn('[buscarGravacoes3CPlus] agente não encontrado no mapa:', filtroEmail);
      }
    }

    console.log('[buscarGravacoes3CPlus] GET /calls', JSON.stringify(queryCalls));

    const respCalls = await chamar3C(cred, '/calls', { query: queryCalls, timeoutMs: 15000 });
    if (!respCalls.ok) {
      const err = await respCalls.text().catch(() => '');
      console.error('[buscarGravacoes3CPlus] /calls erro:', respCalls.status, err.substring(0, 300));
      return Response.json(
        { error: `Erro ao buscar calls: HTTP ${respCalls.status}`, detalhe: err.substring(0, 200) },
        { status: 502, headers: CORS }
      );
    }
    const dadosCalls = await respCalls.json().catch(() => ({}));
    const calls = Array.isArray(dadosCalls) ? dadosCalls : (dadosCalls?.data || dadosCalls?.calls || []);
    console.log('[buscarGravacoes3CPlus] calls recebidas:', calls.length);

    // Buscar TODAS as gravações existentes de uma vez — evita rate limit
    const gravacoesBanco = await api.asServiceRole.entities.GravacaoLigacao.filter({ empresaId });
    console.log('[buscarGravacoes3CPlus] gravações no banco:', gravacoesBanco.length);
    const callIdsExistentes = new Set(gravacoesBanco.map(g => g.call_id_3cplus).filter(Boolean));
    const checksumsExistentes = new Map(gravacoesBanco.filter(g => g.checksum_metadata).map(g => [g.checksum_metadata, g.id]));

    const resultado = { sincronizadas: 0, novas: 0, atualizadas: 0, duplicatas: 0, erros: [] };
    const agora8601 = agora.toISOString();

    for (const call of calls) {
      try {
        const callId = String(call.id || call.call_id || '');
        if (!callId) continue;

        // Verificar duplicata — Camada 1: call_id (em memória, zero queries)
        if (callIdsExistentes.has(callId)) {
          resultado.atualizadas++;
          resultado.sincronizadas++;
          continue;
        }

        // Ignorar calls sem agente real (agent = '-' ou agent_id = 0)
        if (!call.agent || call.agent === '-' || call.agent_id === 0) {
          resultado.ignoradas = (resultado.ignoradas || 0) + 1;
          continue;
        }

        // ── Campos reais confirmados pelo response 200 da API 3C Plus ──
        // agent             → nome do agente
        // mailing_data.identifier → nome do lead
        // mailing_data.phone      → telefone do lead
        // number            → telefone discado (fallback)
        // campaign/campaign_id → campanha
        // call_date_rfc3339 → data ISO
        // speaking_time     → duração
        // readable_behavior_text → resultado
        // recording         → URL da gravação
        const agentNome    = String(call.agent || '');
        const sdrEmailCall = (agentesMapNomeEmail[agentNome.toLowerCase()] || filtroEmail || '').toLowerCase();
        const sdrNome      = agentNome || agentesMapEmailNome[sdrEmailCall] || sdrEmailCall;

        const dataGravacao = call.call_date_rfc3339 || call.call_date || agora8601;
        const expiresAt    = new Date(new Date(dataGravacao).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

        // Campos reais confirmados: mailing_data.identifier=nome, mailing_data.phone=telefone
        const mailingData = call.mailing_data || {};
        const telefone    = String(mailingData.phone || call.number || '');
        const leadNome    = String(mailingData.identifier || call.list || '');

        // Campanha
        const campanhaNome = String(call.campaign || call.campaign_name || '');
        const campanhaId   = String(call.campaign_id || '');

        // Duração: pode vir como "MM:SS" ou número inteiro em segundos
        let duracao = 0;
        const st = String(call.speaking_time || call.duration || '0');
        if (st.includes(':')) {
          const [mm, ss] = st.split(':').map(Number);
          duracao = (mm * 60) + (ss || 0);
        } else {
          duracao = Number(st) || 0;
        }

        // Resultado
        const resultado3C = String(call.readable_behavior_text || call.qualification || '');

        const metaStr    = `${sdrEmailCall}|${telefone}|${dataGravacao}|${duracao}`;
        const encoder    = new TextEncoder();
        const metaBytes  = encoder.encode(metaStr);
        const hashBuffer = await crypto.subtle.digest('SHA-256', metaBytes);
        const checksumMeta = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

        // Verificar duplicata — Camada 2: checksum_metadata (em memória)
        const idOriginal = checksumsExistentes.get(checksumMeta);
        if (idOriginal) {
          resultado.duplicatas++;
          console.warn(`[buscarGravacoes3CPlus] Duplicata metadata: call_id=${callId}`);
          continue;
        }

        // Nova gravação — criar em GravacaoLigacao
        // Campo 'recording' vem diretamente no response do /calls quando há gravação
        const urlGravacaoDireta = String(call.recording || '') || null;

        await api.asServiceRole.entities.GravacaoLigacao.create({
          empresaId,
          call_id_3cplus: callId,
          sdr_email: sdrEmailCall,
          sdr_nome: sdrNome,
          lead_nome: leadNome,
          lead_nome_original: leadNome,
          lead_telefone: telefone,
          lead_telefone_original: telefone,
          campanha_id: campanhaId,
          campanha_nome: campanhaNome,
          duracao_segundos: duracao,
          resultado: resultado3C,
          data_gravacao: dataGravacao,
          gravacao_url_backup: urlGravacaoDireta,
          transcricao_status: 'none',
          usar_treinamento: false,
          checksum_metadata: checksumMeta,
          is_duplicate: false,
          retention_policy: 'standard',
          expires_at: expiresAt,
        });

        resultado.novas++;
        resultado.sincronizadas++;
      } catch (e) {
        resultado.erros.push({ call_id: String(call.id || ''), erro: e.message });
        console.error('[buscarGravacoes3CPlus] erro call:', e.message);
      }
    }

    console.log('[buscarGravacoes3CPlus] resultado:', JSON.stringify(resultado));

    // ── REPAIR: corrigir registros existentes com sdr_email vazio ────────────
    const registrosVazios = gravacoesBanco.filter(g => !g.sdr_email || g.sdr_email.trim() === '');
    if (registrosVazios.length > 0) {
      console.log(`[buscarGravacoes3CPlus] REPAIR: ${registrosVazios.length} registros com sdr_email vazio`);
      const callsMap = new Map(calls.map((c) => [String(c.id || c.call_id || ''), c]));
      let repaired = 0;
      for (const reg of registrosVazios.slice(0, 100)) {
        const callData = callsMap.get(reg.call_id_3cplus);
        if (!callData) continue;
        const agentNomeRep  = String(callData.agent || '');
        const emailReparado = (agentesMapNomeEmail[agentNomeRep.toLowerCase()] || '').toLowerCase();
        if (!emailReparado) continue;
        const nomeReparado  = agentNomeRep || agentesMapEmailNome[emailReparado] || emailReparado;
        try {
          await api.asServiceRole.entities.GravacaoLigacao.update(reg.id, {
            sdr_email: emailReparado,
            sdr_nome: nomeReparado || reg.sdr_nome,
          });
          repaired++;
        } catch (e) {
          console.warn('[buscarGravacoes3CPlus] REPAIR erro:', e.message);
        }
      }
      resultado.repaired = repaired;
      console.log(`[buscarGravacoes3CPlus] REPAIR: ${repaired} registros corrigidos`);
    }
    // ── fim REPAIR ───────────────────────────────────────────────────────────

    return Response.json(resultado, { headers: CORS });

  } catch (e) {
    console.error('[buscarGravacoes3CPlus] erro crítico:', e.message);
    // Erro de credencial/integração (Erro3C) mantém o status próprio; demais → 500 { error } como antes
    return respostaErro3C(e, CORS);
  }
};
