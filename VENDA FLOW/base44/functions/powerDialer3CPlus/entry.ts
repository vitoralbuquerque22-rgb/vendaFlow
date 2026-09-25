import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function b64decode(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
async function decryptToken(value) {
  if (!value) return '';
  if (!value.startsWith('enc:')) return value;
  try {
    const [, ivB64, ctB64] = value.split(':');
    const keyB64 = Deno.env.get('TOKEN_ENCRYPTION_KEY');
    if (!keyB64) throw new Error('TOKEN_ENCRYPTION_KEY não configurada');
    const raw = b64decode(keyB64);
    const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64decode(ivB64) }, key, b64decode(ctB64));
    return new TextDecoder().decode(pt);
  } catch (e) {
    console.error('[decryptToken] falha ao decriptar token:', e.message);
    return '';
  }
}

/**
 * powerDialer3CPlus
 *
 * Discador automático (power dialer). Pode ser:
 *   - Acionado manualmente pelo SDR ("Iniciar discagem automática")
 *   - Agendado via cron do base44
 *
 * Lógica de seleção de lead:
 *   Exclui leads que tenham:
 *     - is_locked_for_call = true (outra ligação em andamento)
 *     - cadencia_id preenchido (respeita cadência)
 *     - ultima_ligacao_em < 30 minutos atrás
 *     - status em: desqualificado, sem_interesse, reuniao_agendada, reuniao_realizada
 *
 *   Prioriza leads:
 *     1. status = "novo" (nunca contatados)
 *     2. status = "em_cadencia" sem cadencia_id (cadência não ativa)
 *     3. total_ligacoes menor primeiro
 *
 * Retorna o resultado de cada tentativa para o frontend poder exibir.
 *
 * IMPORTANTE: Esta função inicia UMA chamada por execução (power dialer = 1:1).
 * Para discagem em lote, chame repetidamente com intervalo.
 */

const INTERVALO_MINIMO_MINUTOS = 30;
const LOCK_TIMEOUT_MINUTOS = 15;

// Status que impedem discagem automática
const STATUS_BLOQUEADOS = new Set([
  'desqualificado',
  'sem_interesse',
  'reuniao_agendada',
  'reuniao_realizada',
  'qualificado',
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    let body;

    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Corpo da requisição inválido' }, { status: 400 });
    }

    if (!body.empresaId) {
      return Response.json({ error: 'empresaId é obrigatório' }, { status: 400 });
    }

    const quantidade = Math.min(body.quantidade ?? 1, 10); // máximo 10 por execução
    const agora = new Date();
    const limiteIntervalo = new Date(agora.getTime() - INTERVALO_MINIMO_MINUTOS * 60 * 1000);
    const limiteLock = new Date(agora.getTime() - LOCK_TIMEOUT_MINUTOS * 60 * 1000);

    // -------------------------------------------------------
    // 1. Buscar leads candidatos
    // -------------------------------------------------------
    const filtroBase = { empresaId: body.empresaId };
    if (body.sdr_email) filtroBase.sdr_responsavel = body.sdr_email;
    if (body.campanha)  filtroBase.campanha = body.campanha;

    const todosLeads = await base44.asServiceRole.entities.Lead.filter(filtroBase);

    // -------------------------------------------------------
    // 2. Aplicar filtros de elegibilidade
    // -------------------------------------------------------
    const leadsElegiveis = todosLeads.filter((lead) => {
      // Status bloqueado
      if (STATUS_BLOQUEADOS.has(lead.status)) return false;

      // Em cadência ativa (tem cadencia_id)
      if (lead.cadencia_id) return false;

      // Lock ativo (não expirado)
      if (lead.is_locked_for_call) {
        const lockAt = lead.lock_at ? new Date(lead.lock_at) : null;
        if (lockAt && lockAt > limiteLock) return false;
        // Lock expirado — elegível, mas vamos limpar o lock
      }

      // Ligação recente (< 30 min)
      if (lead.ultima_ligacao_em) {
        const ultLig = new Date(lead.ultima_ligacao_em);
        if (ultLig > limiteIntervalo) return false;
      }

      return true;
    });

    // -------------------------------------------------------
    // 3. Ordenar por prioridade
    // -------------------------------------------------------
    leadsElegiveis.sort((a, b) => {
      // Novos primeiro
      if (a.status === 'novo' && b.status !== 'novo') return -1;
      if (b.status === 'novo' && a.status !== 'novo') return 1;

      // Menos ligações primeiro
      return (a.total_ligacoes || 0) - (b.total_ligacoes || 0);
    });

    const leadsParaDiscar = leadsElegiveis.slice(0, quantidade);

    // -------------------------------------------------------
    // 4. Modo preview — retorna sem discar
    // -------------------------------------------------------
    if (body.modo === 'preview') {
      return Response.json(
        {
          success: true,
          modo: 'preview',
          total_elegiveis: leadsElegiveis.length,
          total_bloqueados: todosLeads.length - leadsElegiveis.length,
          leads_que_seriam_discados: leadsParaDiscar.map((l) => ({
            id: l.id,
            nome: l.nome,
            telefone: l.telefone,
            status: l.status,
            total_ligacoes: l.total_ligacoes || 0,
            ultima_ligacao_em: l.ultima_ligacao_em || null,
          })),
        },
        { headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // -------------------------------------------------------
    // 5. Executar discagem
    // -------------------------------------------------------
    if (leadsParaDiscar.length === 0) {
      return Response.json(
        {
          success: true,
          discados: 0,
          mensagem: 'Nenhum lead elegível para discagem no momento.',
          total_na_fila: leadsElegiveis.length,
          motivos_bloqueio: {
            status_bloqueado: todosLeads.filter((l) => STATUS_BLOQUEADOS.has(l.status)).length,
            em_cadencia: todosLeads.filter((l) => l.cadencia_id).length,
            ligacao_recente: todosLeads.filter((l) => {
              if (!l.ultima_ligacao_em) return false;
              return new Date(l.ultima_ligacao_em) > limiteIntervalo;
            }).length,
            com_lock: todosLeads.filter((l) => {
              if (!l.is_locked_for_call) return false;
              const lockAt = l.lock_at ? new Date(l.lock_at) : null;
              return lockAt && lockAt > limiteLock;
            }).length,
          },
        },
        { headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Buscar integração 3C Plus
    const integracoes = await base44.asServiceRole.entities.Integracao.filter({
      empresaId: body.empresaId,
      tipo: 'telefonia',
      ativa: true,
    });

    const integracao = integracoes.find(
      (i) => i.configuracao?.fornecedor === '3cplus'
    );

    if (!integracao) {
      return Response.json(
        { error: 'Integração 3C Plus não configurada ou inativa' },
        { status: 424 }
      );
    }

    const cfg = integracao.configuracao;
    const BASE_URL_3C = cfg.dominio ? `https://${cfg.dominio}.3c.plus/api/v1` : 'https://3c.fluxoti.com/api/v1';
    const emailLower  = (user.email || '').toLowerCase();

    // ── Buscar UserProfile UMA vez (token + ramal) ────────────────────────
    let userProfile3C = null;
    try {
      const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
      userProfile3C = profiles[0] || null;
    } catch (e) {
      console.warn('[powerDialer3CPlus] erro ao buscar UserProfile:', e.message);
    }

    // ── Token do agente (click2call requer role agent via api_token) ───────
    const mapeamentoPD = cfg.mapeamento_agentes || {};
    const tokenRaw = userProfile3C?.token_3cplus || null;
    const tokenDecrypted = tokenRaw ? await decryptToken(tokenRaw) : null;
    const tokenAgentePD = tokenDecrypted
      || mapeamentoPD[emailLower]
      || mapeamentoPD[user.email]
      || cfg.token_agente
      || null;

    if (!tokenAgentePD) {
      return Response.json(
        { error: 'Token do agente não encontrado', codigo: 'TOKEN_NOT_FOUND',
          mensagem: `O usuário ${user.email} não possui token 3C Plus configurado. Configure em Perfil → Telefonia 3C Plus.` },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // ── Ramal do agente ────────────────────────────────────────────────────
    const mapeamentoRamais = cfg.mapeamento_ramais || {};
    const ramalAgente = userProfile3C?.ramal_3cplus
      || mapeamentoRamais[emailLower]
      || mapeamentoRamais[user.email]
      || cfg.ramal_padrao
      || null;

    if (!ramalAgente) {
      return Response.json(
        { error: 'Ramal do agente não configurado', codigo: 'RAMAL_NOT_FOUND',
          mensagem: `O usuário ${user.email} não possui ramal configurado. Configure em Perfil → Telefonia 3C Plus.` },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    console.log(`[powerDialer3CPlus] agente=${user.email} | ramal=${ramalAgente} | leads=${leadsParaDiscar.length}`);

    const resultados = [];

    for (const lead of leadsParaDiscar) {
      const resultadoLead = {
        lead_id: lead.id,
        lead_nome: lead.nome,
        lead_telefone: lead.telefone,
        sucesso: false,
      };

      try {
        // Aplicar lock
        await base44.asServiceRole.entities.Lead.update(lead.id, {
          is_locked_for_call: true,
          lock_agent_email: user.email,
          lock_at: agora.toISOString(),
        });

        // Criar CallSession
        const sessao = await base44.asServiceRole.entities.CallSession.create({
          empresaId: body.empresaId,
          lead_id: lead.id,
          lead_nome: lead.nome,
          lead_telefone: lead.telefone,
          sdr_email: user.email,
          campanha_id_3cplus: cfg.campanha_id_padrao || '',
          status: 'iniciando',
          origem: 'power_dialer',
          iniciada_em: agora.toISOString(),
          spin_preenchido: false,
          gravacao_processada: false,
        });

        await base44.asServiceRole.entities.Lead.update(lead.id, {
          call_session_id: sessao.id,
        });

        // ── T6: click2call — usa token do MANAGER via api_token query param ──
        // Swagger: POST /click2call requer role "manager", autenticação por api_token (query)
        const telefoneFormatado = String(lead.telefone).replace(/\D/g, '');
        const formBody = `extension=${parseInt(ramalAgente, 10)}&phone=${parseInt(telefoneFormatado, 10)}`;

        const resp3C = await fetch(`${BASE_URL_3C}/click2call?api_token=${encodeURIComponent(cfg.token_gestor)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'accept': 'application/json',
          },
          body: formBody,
          signal: AbortSignal.timeout(10000),
        });

        console.log(`[powerDialer3CPlus] click2call lead=${lead.id} status=${resp3C.status}`);

        // T8: 200/201/204 = sucesso
        if (resp3C.status === 200 || resp3C.status === 201 || resp3C.status === 204) {
          resultadoLead.sucesso = true;
          resultadoLead.call_session_id = sessao.id;
          await base44.asServiceRole.entities.CallSession.update(sessao.id, {
            status: 'ringing',
          });
        } else {
          // T9: erro específico sem quebrar o loop
          const errBody = await resp3C.text().catch(() => '');
          let errMsg = `click2call ${resp3C.status}`;
          if (resp3C.status === 422) errMsg = `Agente não logado na campanha (422): ${errBody.substring(0, 150)}`;
          throw new Error(errMsg);
        }

      } catch (e) {
        // Reverter lock em caso de erro
        try {
          await base44.asServiceRole.entities.Lead.update(lead.id, {
            is_locked_for_call: false,
            lock_agent_email: null,
            lock_at: null,
            call_session_id: null,
          });
        } catch { /* melhor esforço */ }

        resultadoLead.erro = e.message;
      }

      resultados.push(resultadoLead);

      // Intervalo entre chamadas para não sobrecarregar a API
      if (leadsParaDiscar.length > 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    const totalSucesso = resultados.filter(r => r.sucesso).length;

    return Response.json(
      {
        success: true,
        modo: 'executar',
        discados: totalSucesso,
        com_erro: resultados.length - totalSucesso,
        total_elegiveis_restantes: leadsElegiveis.length - leadsParaDiscar.length,
        resultados,
      },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );

  } catch (error) {
    console.error('[powerDialer3CPlus]', error.message);
    return Response.json(
      { error: error.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
});