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
 * executarComando3CPlus
 *
 * Proxy seguro entre o frontend e a API do 3C Plus.
 * O frontend nunca fala diretamente com o 3C Plus — as credenciais
 * ficam no backend (entidade Integracao). O frontend envia o
 * comando desejado e este endpoint executa na API do 3C Plus
 * usando o token correto (gestor para admin/gestor, agente para SDR).
 *
 * Comandos disponíveis:
 *   agent-login       → loga o agente em uma campanha
 *   agent-logout      → desloga o agente
 *   agent-pause       → coloca agente em intervalo
 *   agent-resume      → retira agente do intervalo
 *   manual-dial       → disca manualmente para um número
 *   qualify-call      → qualifica a chamada corrente
 *   end-call          → encerra a chamada corrente
 *   get-agent-status  → retorna status atual do agente
 *   get-qualifications → lista qualificações da campanha
 */

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

    if (!body.empresaId || !body.comando) {
      return Response.json({ error: 'empresaId e comando são obrigatórios' }, { status: 400 });
    }

    // Buscar integração de telefonia da empresa
    const integracoes = await base44.asServiceRole.entities.Integracao.filter({
      empresaId: body.empresaId,
      tipo: 'telefonia',
      ativa: true,
    });

    const integracao = integracoes.find(
      (i) => i.configuracao?.fornecedor === '3cplus'
    );

    if (!integracao) {
      return Response.json({ error: 'Integração 3C Plus não encontrada ou inativa' }, { status: 404 });
    }

    const cfg = integracao.configuracao;

    // URL sempre fixa — cfg.dominio era o painel web, não a API REST

    // Comandos de MONITORAMENTO (operam sobre todos os agentes) usam o token_gestor.
    // Comandos de OPERAÇÃO DO PRÓPRIO AGENTE (login, discar, qualificar, status do
    // próprio ramal, token do próprio agente) usam SEMPRE o token individual do
    // UserProfile — inclusive para admin/gestor, que também é um agente no 3C Plus.
    // Isso evita que o gestor opere sob o token de outro agente (ex: puxar ligações
    // de outra pessoa) só porque seu role global do Base44 é 'admin'.
    const comandosMonitoramento = new Set(['get-agent-status', 'get-all-campaigns']);
    const usaTokenGestor = comandosMonitoramento.has(body.comando);
    const emailLower = (user.email || '').toLowerCase();

    let token = null;
    if (usaTokenGestor) {
      token = cfg.token_gestor || null;
    } else {
      // 1. Buscar token individual no UserProfile (auto-serviço) — vale para qualquer role
      try {
        const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
        const tokenPlain = await decryptToken(profiles[0]?.token_3cplus || '');
        token = tokenPlain || null;
      } catch (e) {
        console.warn('[executarComando3CPlus] erro ao buscar UserProfile:', e.message);
      }
      // 2. Fallback: mapeamento legado
      if (!token) {
        const mapeamento = cfg.mapeamento_agentes || {};
        token = mapeamento[emailLower] || mapeamento[user.email] || cfg.token_agente || null;
      }
    }
    const isGestor = usaTokenGestor;

    if (!token) {
      return Response.json(
        {
          error: 'Token não encontrado',
          mensagem: usaTokenGestor
            ? 'token_gestor não configurado na integração'
            : `O usuário ${user.email} não possui token 3C Plus configurado. Configure em Perfil → Telefonia 3C Plus.`,
        },
        { status: 400 }
      );
    }

    if (!cfg.dominio) {
      return Response.json(
        { error: 'Domínio 3C Plus não configurado na integração. Configure o campo "dominio" (ex: minha-empresa).' },
        { status: 400 }
      );
    }
    const baseUrl = `https://${cfg.dominio}.3c.plus/api/v1`;
    const hJson = {
      'Content-Type':  'application/json',
      'accept':        'application/json',
    };
    const hBearer = {
      'Content-Type':  'application/json',
      'accept':        'application/json',
      'Authorization': `Bearer ${token}`,
    };
    const hForm = {
      'Content-Type':  'application/x-www-form-urlencoded',
      'accept':        'application/json',
    };
    const queryToken = `?api_token=${encodeURIComponent(token)}`;

    // -------------------------------------------------------
    // Executar comando — endpoints conforme Swagger oficial
    // -------------------------------------------------------
    const t0 = Date.now();
    const mascarar = (t) => t ? `${t.substring(0, 6)}...${t.substring(t.length - 4)}` : '(vazio)';

    let resposta3C;

    switch (body.comando) {

      case 'agent-connect':
        resposta3C = await fetch(`${baseUrl}/agent/connect${queryToken}`, {
          method: 'POST', headers: hForm, body: '',
        });
        break;

      // POST /agent/login (Bearer + JSON; mode configurável via body.mode, padrão 'dialer' → entra ocioso)
      case 'agent-login':
        if (!body.campanha_id) {
          return Response.json({ error: 'campanha_id é obrigatório para agent-login' }, { status: 400 });
        }
        resposta3C = await fetch(`${baseUrl}/agent/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ campaign: Number(body.campanha_id), mode: body.mode || 'dialer' }),
        });
        break;

      // POST /agent/logout
      case 'agent-logout':
        resposta3C = await fetch(`${baseUrl}/agent/logout`, {
          method: 'POST', headers: hBearer, body: '{}',
        });
        break;

      // POST /agent/work_break/{id}/enter
      case 'agent-pause':
        if (!body.intervalo_id) {
          return Response.json({ error: 'intervalo_id é obrigatório para agent-pause' }, { status: 400 });
        }
        resposta3C = await fetch(`${baseUrl}/agent/work_break/${body.intervalo_id}/enter${queryToken}`, {
          method: 'POST', headers: hJson, body: '{}',
        });
        break;

      // POST /agent/work_break/exit
      case 'agent-resume':
        resposta3C = await fetch(`${baseUrl}/agent/work_break/exit${queryToken}`, {
          method: 'POST', headers: hJson, body: '{}',
        });
        break;

      // POST /agent/manual_call/enter + /dial
      case 'manual-dial':
        if (!body.numero) {
          return Response.json({ error: 'numero é obrigatório para manual-dial' }, { status: 400 });
        }
        // Garantir modo manual ativo
        await fetch(`${baseUrl}/agent/manual_call/enter${queryToken}`, { method: 'POST', headers: hJson, body: '{}' }).catch(() => {});
        resposta3C = await fetch(`${baseUrl}/agent/manual_call/dial${queryToken}`, {
          method: 'POST', headers: hJson,
          body: JSON.stringify({ phone: String(body.numero).replace(/\D/g, '') }),
        });
        break;

      // POST /agent/call/{id}/qualify  (discadora/preditiva)
      // POST /agent/manual_call/{id}/qualify  (ligação manual — body.manual = true)
      case 'qualify-call':
        if (!body.qualificacao_id || !body.chamada_id) {
          return Response.json({ error: 'qualificacao_id e chamada_id são obrigatórios' }, { status: 400 });
        }
        {
          const qualifPath = body.manual
            ? `/agent/manual_call/${body.chamada_id}/qualify`
            : `/agent/call/${body.chamada_id}/qualify`;
          resposta3C = await fetch(`${baseUrl}${qualifPath}${queryToken}`, {
            method: 'POST', headers: hJson,
            body: JSON.stringify({ qualification_id: Number(body.qualificacao_id), qualification_note: body.nota || '' }),
          });
        }
        break;

      // POST /agent/call/{id}/hangup
      case 'end-call':
        if (!body.chamada_id) {
          return Response.json({ error: 'chamada_id é obrigatório para end-call' }, { status: 400 });
        }
        resposta3C = await fetch(`${baseUrl}/agent/call/${body.chamada_id}/hangup${queryToken}`, {
          method: 'POST', headers: hJson, body: '{}',
        });
        break;

      // Sair do pós-atendimento (ACW). O agente está OU em ACW manual OU em ACW
      // normal — nunca nos dois. Então tentamos ambos os endpoints e consideramos
      // SUCESSO se QUALQUER um sair do ACW (204/200). Um 404 no outro é esperado
      // (aquele tipo de ACW não estava ativo) e NÃO deve virar erro para o cliente,
      // senão o frontend reprocessa o hangup e o TPA fica preso no 3C.
      case 'acw-exit': {
        const acwEndpoints = [
          `${baseUrl}/agent/manual_call_acw/exit${queryToken}`,
          `${baseUrl}/agent/acw/exit${queryToken}`,
        ];
        let acwSaiu = false;
        let ultimoStatus = 0;
        for (const url of acwEndpoints) {
          try {
            const r = await fetch(url, {
              method: 'POST', headers: hJson, body: '{}',
              signal: AbortSignal.timeout(8000),
            });
            ultimoStatus = r.status;
            if (r.status === 204 || r.status === 200) acwSaiu = true;
          } catch { /* timeout/rede — tenta o próximo */ }
        }
        console.log('[3CPlus:CMD:OK]', JSON.stringify({
          ts: new Date().toISOString(), cmd: 'acw-exit', user: user.email,
          empresa: body.empresaId, saiu: acwSaiu, ultimo_status: ultimoStatus,
          elapsed_ms: Date.now() - t0, token_preview: mascarar(token),
        }));
        // Sempre sucesso: se nenhum saiu explicitamente, o agente provavelmente já
        // não estava em ACW (404 nos dois) — o objetivo (não estar em TPA) foi atingido.
        return Response.json(
          { success: true, acw_saiu: acwSaiu, ultimo_status: ultimoStatus },
          { headers: { 'Access-Control-Allow-Origin': '*' } }
        );
      }

      // POST /agent/manual_call/enter (entrar em modo manual — pausa campanha)
      case 'manual-call-enter':
        resposta3C = await fetch(`${baseUrl}/agent/manual_call/enter${queryToken}`, {
          method: 'POST', headers: hJson, body: '{}',
          signal: AbortSignal.timeout(8000),
        });
        break;

      // POST /agent/manual_call/exit (sair do modo manual — retoma campanha)
      case 'manual-call-exit':
        resposta3C = await fetch(`${baseUrl}/agent/manual_call/exit${queryToken}`, {
          method: 'POST', headers: hJson, body: '{}',
          signal: AbortSignal.timeout(8000),
        });
        break;

      // GET /agent/loggedCampaign — Bearer; 422/404 = agente sem campanha (não é erro)
      case 'get-logged-campaign': {
        const rLogged = await fetch(`${baseUrl}/agent/loggedCampaign`, { headers: hBearer });
        if (rLogged.status === 422 || rLogged.status === 404) {
          console.log('[3CPlus:CMD]', JSON.stringify({ ts: new Date().toISOString(), cmd: 'get-logged-campaign', user: user.email, empresa: body.empresaId, status: rLogged.status, elapsed_ms: Date.now() - t0, result: 'nao_logado', token_preview: mascarar(token) }));
          return Response.json(
            { success: true, dados: null, nao_logado: true },
            { headers: { 'Access-Control-Allow-Origin': '*' } }
          );
        }
        resposta3C = rLogged;
        break;
      }

      // GET /campaigns (todas — requer token gestor, usado pelo painel admin)
      case 'get-all-campaigns':
        resposta3C = await fetch(`${baseUrl}/campaigns?per_page=200`, { headers: hBearer });
        break;

      // GET /agents/status (token gestor)
      case 'get-agent-status':
        resposta3C = await fetch(`${baseUrl}/agents/status${queryToken}`, { headers: hJson });
        break;

      // GET /qualification_lists/{id}/qualifications
      case 'get-qualifications':
        if (!body.qualification_list_id) {
          return Response.json({ error: 'qualification_list_id é obrigatório para get-qualifications' }, { status: 400 });
        }
        resposta3C = await fetch(`${baseUrl}/qualification_lists/${body.qualification_list_id}/qualifications${queryToken}`, { headers: hJson });
        break;

      // GET /agent/campaigns
      case 'get-campaigns':
        resposta3C = await fetch(`${baseUrl}/agent/campaigns${queryToken}`, { headers: hJson });
        break;

      // GET /campaigns/{id}/intervals
      case 'get-work-breaks':
        const campanhaId = body.campanha_id || cfg.campanha_id_padrao;
        if (!campanhaId) {
          return Response.json({ error: 'campanha_id é obrigatório para get-work-breaks' }, { status: 400 });
        }
        resposta3C = await fetch(`${baseUrl}/campaigns/${campanhaId}/intervals${queryToken}`, { headers: hJson });
        break;

      // Retorna o token descriptografado do próprio agente autenticado.
      // Necessário para a extensão Chrome registrar o ramal SIP/WebRTC
      // (a extensão roda client-side e precisa do token em texto puro).
      // `dados.token` mantido por compatibilidade com consumidores existentes.
      case 'get-agent-token':
        console.log('[3CPlus:CMD]', JSON.stringify({ ts: new Date().toISOString(), cmd: 'get-agent-token', user: user.email, empresa: body.empresaId, status: 200, elapsed_ms: Date.now() - t0, result: 'token_returned', token_preview: mascarar(token) }));
        return Response.json(
          { success: true, token, dominio: cfg.dominio || '', dados: { token } },
          { headers: { 'Access-Control-Allow-Origin': '*' } }
        );

      default:
        return Response.json({ error: `Comando desconhecido: ${body.comando}` }, { status: 400 });
    }

    // ── Instrumentação: log estruturado de cada comando ──
    const elapsed = Date.now() - t0;
    const logEntry = {
      ts: new Date().toISOString(),
      cmd: body.comando,
      user: user.email,
      empresa: body.empresaId,
      endpoint: resposta3C?.url || '(interno)',
      method: resposta3C?.type === 'basic' ? 'fetch' : (body.comando.startsWith('get-') ? 'GET' : 'POST'),
      status: resposta3C?.status || 0,
      elapsed_ms: elapsed,
      token_preview: mascarar(token),
    };
    if (resposta3C?.ok) {
      console.log('[3CPlus:CMD]', JSON.stringify(logEntry));
    } else {
      console.warn('[3CPlus:CMD:FAIL]', JSON.stringify(logEntry));
    }

    // A API do 3C Plus retorna 204 para muitos comandos assíncronos.
    // Nesses casos, retornamos success=true sem body da 3C Plus.
    if (resposta3C.status === 204) {
      console.log('[3CPlus:CMD]', JSON.stringify({ ...logEntry, status: 204, async: true }));
      return Response.json(
        { success: true, async: true, mensagem: 'Comando enviado — aguarde evento de confirmação' },
        { headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    let dados3C = null;
    try {
      dados3C = await resposta3C.json();
    } catch {
      // Resposta sem body (ex: 200 sem JSON)
    }

    if (!resposta3C.ok) {
      console.warn('[3CPlus:CMD:FAIL]', JSON.stringify({ ...logEntry, detalhe: dados3C }));
      return Response.json(
        { error: 'Erro na API 3C Plus', status: resposta3C.status, detalhe: dados3C },
        { status: resposta3C.status, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    console.log('[3CPlus:CMD:OK]', JSON.stringify(logEntry));
    return Response.json(
      { success: true, dados: dados3C },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );

  } catch (error) {
    console.error('[executarComando3CPlus]', error.message);
    return Response.json(
      { error: error.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
});