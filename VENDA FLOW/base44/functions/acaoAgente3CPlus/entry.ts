import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  }
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Body inválido' }, { status: 400 }); }

  const { empresaId, acao, agent_id, work_break_id, campanha_id } = body;
  if (!empresaId || !acao) return Response.json({ error: 'empresaId e acao são obrigatórios' }, { status: 400 });

  const integracoes = await base44.asServiceRole.entities.Integracao.filter({ empresaId, tipo: 'telefonia', ativa: true });
  const integracao = integracoes.find(i => i.configuracao?.fornecedor === '3cplus');
  if (!integracao) return Response.json({ error: 'Integração 3C Plus não configurada' }, { status: 424 });

  const cfg = integracao.configuracao;
  const token = String(cfg.token_gestor || '').trim();
  const tokenAgenteGestor = String(cfg.token_agente_gestor || '').trim();
  const baseUrl = cfg.dominio ? `https://${cfg.dominio}.3c.plus/api/v1` : 'https://3c.fluxoti.com/api/v1';
  if (!token) return Response.json({ error: 'token_gestor não configurado' }, { status: 424 });

  const qGestor       = `?api_token=${encodeURIComponent(token)}`;
  const qAgenteGestor = `?api_token=${encodeURIComponent(tokenAgenteGestor || token)}`;
  const hJson = { 'accept': 'application/json', 'Content-Type': 'application/json' };
  const hForm = { 'accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' };

  try {
    let resposta;

    switch (acao) {

      case 'listar_intervalos': {
        const campanhaId = campanha_id || cfg.campanha_id_padrao;
        if (!campanhaId) return Response.json({ error: 'campanha_id obrigatório para listar_intervalos' }, { status: 400 });
        resposta = await fetch(`${baseUrl}/campaigns/${campanhaId}/intervals${qGestor}`, {
          method: 'GET', headers: hJson, signal: AbortSignal.timeout(8000),
        });
        const data = await resposta.json().catch(() => []);
        const intervalos = (Array.isArray(data) ? data : data?.data || []).map(i => ({
          id: i.id, nome: i.name, minutos: i.minutes, cor: i.color,
        }));
        return Response.json({ success: true, intervalos }, { headers: { 'Access-Control-Allow-Origin': '*' } });
      }

      case 'pausar': {
        if (!agent_id || !work_break_id) return Response.json({ error: 'agent_id e work_break_id são obrigatórios para pausar' }, { status: 400 });
        resposta = await fetch(`${baseUrl}/agents/${agent_id}/work_break${qGestor}`, {
          method: 'PUT',
          headers: hForm,
          body: `work_break_id=${encodeURIComponent(work_break_id)}`,
          signal: AbortSignal.timeout(8000),
        });
        const status = resposta.status;
        if (status === 204) return Response.json({ success: true, acao: 'pausar' }, { headers: { 'Access-Control-Allow-Origin': '*' } });
        if (status === 422) {
          const err = await resposta.json().catch(() => ({}));
          return Response.json({ success: false, error: 'Agente não está disponível para pausar', detalhe: err?.detail }, { status: 422, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        return Response.json({ success: false, error: `Erro HTTP ${status}` }, { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } });
      }

      case 'retomar': {
        // POST /agent/work_break/exit — endpoint correto para sair da pausa (usa token do agente)
        // O agente_id aqui é o agent_id do gestor, mas o exit usa o token do próprio agente
        // Como acaoAgente3CPlus é chamado pelo gestor, usamos qAgenteGestor para simular o agente
        resposta = await fetch(`${baseUrl}/agent/work_break/exit${qAgenteGestor}`, {
          method: 'POST',
          headers: hJson,
          signal: AbortSignal.timeout(8000),
        });
        const status = resposta.status;
        if (status === 204 || status === 200) return Response.json({ success: true, acao: 'retomar' }, { headers: { 'Access-Control-Allow-Origin': '*' } });
        const err2 = await resposta.json().catch(() => ({}));
        return Response.json({ success: false, error: `Erro ao retomar: HTTP ${status}`, detalhe: err2?.detail }, { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } });
      }

      case 'deslogar': {
        if (!agent_id) return Response.json({ error: 'agent_id é obrigatório para deslogar' }, { status: 400 });
        resposta = await fetch(`${baseUrl}/agents/${agent_id}/logout${qGestor}`, {
          method: 'POST', headers: hJson, body: '{}', signal: AbortSignal.timeout(8000),
        });
        const status = resposta.status;
        if (status === 204 || status === 200) return Response.json({ success: true, acao: 'deslogar' }, { headers: { 'Access-Control-Allow-Origin': '*' } });
        const err = await resposta.json().catch(() => ({}));
        return Response.json({ success: false, error: `Erro ao deslogar: HTTP ${status}`, detalhe: err?.detail }, { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } });
      }

      case 'spy': {
       if (!agent_id) return Response.json({ error: 'agent_id obrigatório para spy' }, { status: 400 });
       resposta = await fetch(`${baseUrl}/spy/${agent_id}/start${qAgenteGestor}`, {
         method: 'POST', headers: hJson, signal: AbortSignal.timeout(8000),
       });
       const statusSpy = resposta.status;
        if (statusSpy === 204) return Response.json({ success: true, acao: 'spy' }, { headers: { 'Access-Control-Allow-Origin': '*' } });
        if (statusSpy === 409) return Response.json({ success: false, error: 'Já está escutando outro agente' }, { status: 409, headers: { 'Access-Control-Allow-Origin': '*' } });
        if (statusSpy === 404) return Response.json({ success: false, error: 'Agente não está logado' }, { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
        const errSpy = await resposta.json().catch(() => ({}));
        return Response.json({ success: false, error: `Erro ao iniciar spy: HTTP ${statusSpy}`, detalhe: errSpy?.detail }, { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } });
      }

      case 'whisper': {
       if (!agent_id) return Response.json({ error: 'agent_id obrigatório para whisper' }, { status: 400 });
       // AVISO: ?whisper=true não é documentado no Swagger oficial do 3C Plus.
       // Funciona como comportamento não documentado — pode parar de funcionar em updates da API.
       // Se o whisper parar de funcionar, verificar com o suporte 3C Plus se há endpoint alternativo.
       resposta = await fetch(`${baseUrl}/spy/${agent_id}/start${qAgenteGestor}&whisper=true`, {
         method: 'POST', headers: hJson, signal: AbortSignal.timeout(8000),
       });
       const statusWh = resposta.status;
        if (statusWh === 204) return Response.json({ success: true, acao: 'whisper' }, { headers: { 'Access-Control-Allow-Origin': '*' } });
        if (statusWh === 409) return Response.json({ success: false, error: 'Já está escutando outro agente' }, { status: 409, headers: { 'Access-Control-Allow-Origin': '*' } });
        if (statusWh === 404) return Response.json({ success: false, error: 'Agente não está logado' }, { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
        const errWh = await resposta.json().catch(() => ({}));
        return Response.json({ success: false, error: `Erro ao iniciar whisper: HTTP ${statusWh}`, detalhe: errWh?.detail }, { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } });
      }

      case 'stop_spy': {
        const stopUrl = `${baseUrl}/spy/stop${qAgenteGestor}`;
        try {
          const r = await fetch(stopUrl, {
            method: 'DELETE',
            headers: hJson,
            signal: AbortSignal.timeout(5000),
          });
          if (r.status === 204 || r.status === 200) {
            return Response.json({ success: true, acao: 'stop_spy' }, { headers: { 'Access-Control-Allow-Origin': '*' } });
          }
          const errBody = await r.text().catch(() => '');
          console.warn('[acaoAgente3CPlus] stop_spy DELETE falhou:', r.status, errBody.substring(0, 200));
          return Response.json({ success: false, error: `Erro ao parar spy: HTTP ${r.status}` }, { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } });
        } catch (e) {
          console.error('[acaoAgente3CPlus] stop_spy erro:', e.message);
          return Response.json({ success: false, error: e.message }, { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
      }

      default:
        return Response.json({ error: `Ação desconhecida: ${acao}` }, { status: 400 });
    }

  } catch (e) {
    console.error('[acaoAgente3CPlus]', e.message);
    return Response.json({ error: e.message }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
});