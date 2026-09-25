import { createClientFromRequest } from "../../src/sdk.ts";
import { chamar3C, type Credencial3C, credencialAgente, credencialGestor, decryptToken, Erro3C, respostaErro3C } from "../../src/telefonia3c.ts";

const CORS = { 'Access-Control-Allow-Origin': '*' };

/**
 * Credencial do PRÓPRIO agente do gestor (usada em retomar/spy/whisper/stop_spy).
 * Ordem: token de serviço de agente + X-Agent-Id (ou token pessoal do usuário, via credencialAgente)
 *   → token pessoal legado `configuracao.token_agente_gestor` (até 01/10/2026)
 *   → token de gestor (mesmo fallback que a função já fazia quando não havia token de agente do gestor).
 */
async function credencialAgenteDoGestor(api, empresaId: string, email: string): Promise<Credencial3C> {
  try {
    return await credencialAgente(api, empresaId, email);
  } catch (e) {
    if (!(e instanceof Erro3C)) throw e;
    const gestor = await credencialGestor(api, empresaId);
    const legado = await decryptToken(gestor.config.token_agente_gestor).catch(() => '');
    if (legado) return { ...gestor, papel: 'agente', token: legado, origem: 'pessoal' } as Credencial3C;
    console.warn('[acaoAgente3CPlus] credencial de agente indisponível, usando token de gestor:', e.message);
    return gestor;
  }
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  }
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const api = createClientFromRequest(req);
  const user = await api.auth.me();
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Body inválido' }, { status: 400 }); }

  const { empresaId, acao, agent_id, work_break_id, campanha_id } = body;
  if (!empresaId || !acao) return Response.json({ error: 'empresaId e acao são obrigatórios' }, { status: 400 });

  // Credenciais resolvidas sob demanda pelo módulo central (telefonia3c.ts):
  //   - ações sobre QUALQUER agente (intervalos, pausar, deslogar) → token de gestor
  //   - ações em que o gestor age como o PRÓPRIO agente (retomar, spy, whisper, stop_spy) → credencial de agente
  const credGestor = () => credencialGestor(api, empresaId);
  const credAgenteGestor = () => credencialAgenteDoGestor(api, empresaId, user.email);

  try {
    let resposta;

    switch (acao) {

      case 'listar_intervalos': {
        const cred = await credGestor();
        const campanhaId = campanha_id || cred.config.campanha_id_padrao;
        if (!campanhaId) return Response.json({ error: 'campanha_id obrigatório para listar_intervalos' }, { status: 400 });
        resposta = await chamar3C(cred, `/campaigns/${campanhaId}/intervals`, { method: 'GET', timeoutMs: 8000 });
        const data = await resposta.json().catch(() => []);
        const intervalos = (Array.isArray(data) ? data : data?.data || []).map(i => ({
          id: i.id, nome: i.name, minutos: i.minutes, cor: i.color,
        }));
        return Response.json({ success: true, intervalos }, { headers: { 'Access-Control-Allow-Origin': '*' } });
      }

      case 'pausar': {
        if (!agent_id || !work_break_id) return Response.json({ error: 'agent_id e work_break_id são obrigatórios para pausar' }, { status: 400 });
        const cred = await credGestor();
        resposta = await chamar3C(cred, `/agents/${agent_id}/work_break`, {
          method: 'PUT',
          form: { work_break_id: String(work_break_id) },
          timeoutMs: 8000,
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
        // Como acaoAgente3CPlus é chamado pelo gestor, usamos a credencial de agente do gestor
        const cred = await credAgenteGestor();
        resposta = await chamar3C(cred, '/agent/work_break/exit', { method: 'POST', timeoutMs: 8000 });
        const status = resposta.status;
        if (status === 204 || status === 200) return Response.json({ success: true, acao: 'retomar' }, { headers: { 'Access-Control-Allow-Origin': '*' } });
        const err2 = await resposta.json().catch(() => ({}));
        return Response.json({ success: false, error: `Erro ao retomar: HTTP ${status}`, detalhe: err2?.detail }, { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } });
      }

      case 'deslogar': {
        if (!agent_id) return Response.json({ error: 'agent_id é obrigatório para deslogar' }, { status: 400 });
        const cred = await credGestor();
        resposta = await chamar3C(cred, `/agents/${agent_id}/logout`, { method: 'POST', json: {}, timeoutMs: 8000 });
        const status = resposta.status;
        if (status === 204 || status === 200) return Response.json({ success: true, acao: 'deslogar' }, { headers: { 'Access-Control-Allow-Origin': '*' } });
        const err = await resposta.json().catch(() => ({}));
        return Response.json({ success: false, error: `Erro ao deslogar: HTTP ${status}`, detalhe: err?.detail }, { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } });
      }

      case 'spy': {
       if (!agent_id) return Response.json({ error: 'agent_id obrigatório para spy' }, { status: 400 });
       const cred = await credAgenteGestor();
       resposta = await chamar3C(cred, `/spy/${agent_id}/start`, { method: 'POST', timeoutMs: 8000 });
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
       const cred = await credAgenteGestor();
       resposta = await chamar3C(cred, `/spy/${agent_id}/start`, { method: 'POST', query: { whisper: 'true' }, timeoutMs: 8000 });
       const statusWh = resposta.status;
        if (statusWh === 204) return Response.json({ success: true, acao: 'whisper' }, { headers: { 'Access-Control-Allow-Origin': '*' } });
        if (statusWh === 409) return Response.json({ success: false, error: 'Já está escutando outro agente' }, { status: 409, headers: { 'Access-Control-Allow-Origin': '*' } });
        if (statusWh === 404) return Response.json({ success: false, error: 'Agente não está logado' }, { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
        const errWh = await resposta.json().catch(() => ({}));
        return Response.json({ success: false, error: `Erro ao iniciar whisper: HTTP ${statusWh}`, detalhe: errWh?.detail }, { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } });
      }

      case 'stop_spy': {
        // Erro de credencial (Erro3C) sai deste bloco e cai no catch externo
        const cred = await credAgenteGestor();
        try {
          const r = await chamar3C(cred, '/spy/stop', { method: 'DELETE', timeoutMs: 5000 });
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
    return respostaErro3C(e, CORS);
  }
};
