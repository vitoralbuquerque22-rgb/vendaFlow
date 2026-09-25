import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * receberEvento3CPlus
 *
 * Webhook chamado pelo serviço Node.js bridge quando
 * eventos acontecem nas ligações via Socket.IO do 3C Plus.
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Bridge-Secret',
      },
    });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    // Validar secret
    const secret = req.headers.get('X-Bridge-Secret') || req.headers.get('x-bridge-secret');
    const expectedSecret = Deno.env.get('BRIDGE_WEBHOOK_SECRET');
    if (!expectedSecret) {
      console.error('[receberEvento3CPlus] BRIDGE_WEBHOOK_SECRET não configurado');
      return Response.json({ error: 'Configuração inválida' }, { status: 500 });
    }

    // Timing-safe compare para evitar timing attacks
    const encoder = new TextEncoder();
    const a = encoder.encode(secret || '');
    const b = encoder.encode(expectedSecret);
    const isValid = a.length === b.length && (() => {
      let result = 0;
      const len = a.length;
      const padA = new Uint8Array(32);
      const padB = new Uint8Array(32);
      padA.set(a.slice(0, 32));
      padB.set(b.slice(0, 32));
      for (let i = 0; i < 32; i++) result |= padA[i] ^ padB[i];
      return result === 0 && a.length === b.length;
    })();
    if (!isValid) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const base44 = createClientFromRequest(req);
    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Body inválido' }, { status: 400 });
    }

    const evento    = body.evento;
    const dados     = body.dados || {};
    const timestamp = body.timestamp;

    // Anti-replay: rejeitar eventos com timestamp > 5 minutos no passado ou no futuro
    if (timestamp) {
      const eventTime = new Date(timestamp).getTime();
      const now = Date.now();
      const diffMin = Math.abs(now - eventTime) / 60000;
      if (diffMin > 5) {
        console.warn('[receberEvento3CPlus] Evento fora da janela temporal:', timestamp);
        return Response.json({ error: 'Evento expirado ou timestamp inválido' }, { status: 400 });
      }
    }

    console.log(`[receberEvento3CPlus] ${evento}`, JSON.stringify(dados).substring(0, 200));

    const email         = dados.email;
    const callSessionId = dados.call_session_id;
    const chamadaId     = dados.call_id;
    const eventoTimestamp = timestamp || new Date().toISOString();

    // empresaId vem sempre do payload do bridge — obrigatório para escopar queries ao tenant
    const empresaId = dados.empresaId || body.empresaId || null;

    const QUALIFICACAO_PARA_STATUS = {
      'Atendeu - Interesse':        'respondeu',
      'Atendeu - Sem Interesse':    'sem_interesse',
      'Atendeu - Reunião Agendada': 'reuniao_agendada',
      'Não Atendeu':                'em_cadencia',
      'Caixa Postal':               'em_cadencia',
      'Número Inválido':            'desqualificado',
      'Desqualificado':             'desqualificado',
    };

    const DISPOSICAO_PARA_RESULTADO = {
      'answered':  'atendeu',
      'no-answer': 'nao_atendeu',
      'busy':      'ocupado',
      'failed':    'numero_invalido',
      'voicemail': 'caixa_postal',
      'machine':   'caixa_postal',
    };

    const buscarSessaoAtiva = async () => {
      if (callSessionId) {
        // Busca por ID com empresaId quando disponível
        const filter = empresaId ? { id: callSessionId, empresaId } : { id: callSessionId };
        const s = await base44.asServiceRole.entities.CallSession.filter(filter);
        return s[0] || null;
      }
      if (email && empresaId) {
        // Sempre filtrar por empresaId para evitar cross-tenant
        const s = await base44.asServiceRole.entities.CallSession.filter({ sdr_email: email, empresaId });
        const ativos = s.filter(x => ['iniciando', 'ringing', 'answered', 'aguardando_confirmacao'].includes(x.status));
        return ativos.sort((a, b) =>
          new Date(b.iniciada_em).getTime() - new Date(a.iniciada_em).getTime()
        )[0] || null;
      }
      return null;
    };

    switch (evento) {

      case 'agent-is-idle': {
        if (email && empresaId) {
          const p = await base44.asServiceRole.entities.UserProfile.filter({ user_email: email, empresaId });
          if (p[0]) await base44.asServiceRole.entities.UserProfile.update(p[0].id, {
            status_3cplus: 'idle', ultima_atualizacao_status: eventoTimestamp,
          });
        }
        break;
      }

      case 'agent-entered-manual-mode':
      case 'agent-entered-manual': {
        const s = await buscarSessaoAtiva();
        if (s) await base44.asServiceRole.entities.CallSession.update(s.id, { status: 'ringing' });
        break;
      }

      // Eventos de ligação atendida/conectada
      case 'manual-call-was-answered':
      case 'call-was-answered':
      case 'call-answered':
      case 'call-was-connected': {
        const s = await buscarSessaoAtiva();
        if (s) {
          const chamadaIdNova = dados.call?.id || dados.call_id || chamadaId || s.chamada_id_3cplus;
          const telefonyId = dados.call?.telephony_id || dados.telephony_id || null;
          console.log(`[receberEvento3CPlus] ${evento} → atualizar CallSession:`, {
            chamada_id: chamadaIdNova,
            telephony_id: telefonyId,
          });
          await base44.asServiceRole.entities.CallSession.update(s.id, {
            status: 'answered',
            chamada_id_3cplus: chamadaIdNova,
            telephony_id_3cplus: telefonyId || s.telephony_id_3cplus,
            atendida_em: eventoTimestamp,
          });
          await base44.asServiceRole.entities.Lead.update(s.lead_id, {
            ultima_ligacao_em: eventoTimestamp,
          });
        }
        break;
      }

      // Eventos de ligação encerrada
      case 'call-finished':
      case 'call-was-finished':
      case 'call-ended':
      case 'call-hangup':
      case 'call-was-ended': {
        const s = await buscarSessaoAtiva();
        if (s && s.status !== 'finished') {
          await base44.asServiceRole.entities.CallSession.update(s.id, {
            status: 'finished', finalizada_em: eventoTimestamp,
          });
          // BUG-TEL-07: liberar lock do lead caso browser tenha fechado sem finalizar
          if (s.lead_id) {
            await base44.asServiceRole.entities.Lead.update(s.lead_id, {
              is_locked_for_call: false,
              lock_agent_email: null,
              lock_at: null,
              call_session_id: null,
            }).catch(e => console.warn('[receberEvento] unlock lead:', e.message));
          }
        }
        break;
      }

      case 'call-history-was-created':
      case 'call-history-created': {
        const callData    = dados.call || dados;
        const gravacaoUrl = callData.recording || dados.gravacao_url || null;
        const duracao     = callData.speaking_time || dados.duracao || null;
        const s = await buscarSessaoAtiva();
        if (s) {
          await base44.asServiceRole.entities.CallSession.update(s.id, {
            gravacao_url:        gravacaoUrl || null,
            duracao_segundos:    duracao || null,
            status:              'finished',
            finalizada_em:       eventoTimestamp,
            gravacao_processada: false,
          });
          if (gravacaoUrl) {
            const urlSelf = new URL(req.url);
            const baseUrl = `${urlSelf.protocol}//${urlSelf.host}`;
            fetch(`${baseUrl}/functions/processarGravacao3CPlus`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': req.headers.get('Authorization') || '',
              },
              body: JSON.stringify({
                empresaId: s.empresaId,
                call_session_id: s.id,
                gravacao_url: gravacaoUrl,
              }),
            }).catch(e => console.warn('[receberEvento] gravação async:', e.message));
          }
        }

        // ── Criar Atividade em tempo real (mesmo que sincronizarTelefonia faz) ──
        if (s && s.empresaId) {
          const chamadaIdStr = String(callData.id || chamadaId || s.chamada_id_3cplus || '');

          // Dedup: verificar se já existe atividade para esta chamada
          const atividadesExistentes = await base44.asServiceRole.entities.Atividade.filter({
            empresaId: s.empresaId,
            chamada_id_3cplus: chamadaIdStr,
          });

          if (chamadaIdStr && atividadesExistentes.length === 0) {
            const telefone = String(callData.number || s.lead_telefone || '');
            const qualificacao = String(callData.readable_status_text || callData.qualification || '');
            const disposicao = String(callData.status_id || callData.status || 'no-answer').toLowerCase();
            const resultado_atividade = DISPOSICAO_PARA_RESULTADO[disposicao] || 'outro';
            const tpa = Number(callData.acw_time || 0);

            await base44.asServiceRole.entities.Atividade.create({
              empresaId: s.empresaId,
              tipo: 'ligacao',
              resultado: resultado_atividade,
              duracao_segundos: duracao || 0,
              tpa_segundos: tpa,
              chamada_id_3cplus: chamadaIdStr,
              gravacao_url: gravacaoUrl || '',
              observacao: qualificacao ? `Qualificação 3C Plus: ${qualificacao}` : '',
              sdr_email: s.sdr_email || email || '',
              lead_id: s.lead_id || '',
              lead_telefone: telefone,
              lead_nome: s.lead_nome || telefone,
              created_date: eventoTimestamp,
              origem_sincronizacao: '3cplus_realtime',
            });

            // Atualizar status do Lead com base na qualificação
            if (s.lead_id && qualificacao) {
              const novoStatus = QUALIFICACAO_PARA_STATUS[qualificacao];
              if (novoStatus) {
                await base44.asServiceRole.entities.Lead.update(s.lead_id, {
                  status: novoStatus,
                  ultima_ligacao_em: eventoTimestamp,
                }).catch(e => console.warn('[receberEvento] atualizar lead status:', e.message));
              }
            }
          }
        }
        break;
      }

      case 'call-was-abandoned':
      case 'call-was-abandoned-due-amd':
      case 'call-not-answered':
      case 'call-failed':
      case 'call-was-not-answered':
      case 'call-was-failed': {
        const s = await buscarSessaoAtiva();
        if (s) {
          await base44.asServiceRole.entities.CallSession.update(s.id, {
            status: evento === 'call-failed' ? 'failed' : 'finished',
            finalizada_em: eventoTimestamp,
          });
          await base44.asServiceRole.entities.Lead.update(s.lead_id, {
            is_locked_for_call: false,
            lock_agent_email: null,
            lock_at: null,
            call_session_id: null,
            ultima_ligacao_em: eventoTimestamp,
          });
        }
        break;
      }

      case 'agent-logged-out':
      case 'agent-was-logged-out':
      case 'agent-in-acw': {
        if (email && empresaId) {
          const p = await base44.asServiceRole.entities.UserProfile.filter({ user_email: email, empresaId });
          if (p[0]) await base44.asServiceRole.entities.UserProfile.update(p[0].id, {
            status_3cplus: evento === 'agent-in-acw' ? 'acw' : 'offline',
            ultima_atualizacao_status: eventoTimestamp,
          });
        }
        break;
      }

      case 'agent-entered-work-break': {
        if (email && empresaId) {
          const p = await base44.asServiceRole.entities.UserProfile.filter({ user_email: email, empresaId });
          if (p[0]) await base44.asServiceRole.entities.UserProfile.update(p[0].id, {
            status_3cplus: 'work_break', ultima_atualizacao_status: eventoTimestamp,
          });
        }
        break;
      }

      case 'agent-left-work-break': {
        if (email && empresaId) {
          const p = await base44.asServiceRole.entities.UserProfile.filter({ user_email: email, empresaId });
          if (p[0]) await base44.asServiceRole.entities.UserProfile.update(p[0].id, {
            status_3cplus: 'idle', ultima_atualizacao_status: eventoTimestamp,
          });
        }
        break;
      }

      default:
        console.log(`[receberEvento3CPlus] Evento não tratado: ${evento}`);
    }

    return Response.json(
      { ok: true, evento, processado: true },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );

  } catch (error) {
    console.error('[receberEvento3CPlus]', error.message);
    return Response.json(
      { error: error.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
});