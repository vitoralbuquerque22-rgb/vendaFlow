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

  const { empresaId, nome, descricao, start_time, end_time, qualification_list, teams, allows_manual, is_predictive, wait_time, call_time, recalls, leads, fonte } = body;

  if (!empresaId || !nome || !start_time || !end_time || !qualification_list) {
    return Response.json({ error: 'Campos obrigatórios: empresaId, nome, start_time, end_time, qualification_list' }, { status: 400 });
  }

  if (!leads || !Array.isArray(leads) || leads.length === 0) {
    return Response.json({ error: 'leads é obrigatório e deve ser um array não vazio' }, { status: 400 });
  }

  const integracoes = await base44.asServiceRole.entities.Integracao.filter({ empresaId, tipo: 'telefonia', ativa: true });
  const integracao = integracoes.find(i => i.configuracao?.fornecedor === '3cplus');
  if (!integracao) return Response.json({ error: 'Integração 3C Plus não configurada' }, { status: 424 });

  const cfg = integracao.configuracao;
  const token = String(cfg.token_gestor || '').trim();
  const BASE_URL_3C = 'https://3c.fluxoti.com/api/v1';
  if (!token) return Response.json({ error: 'token_gestor não configurado' }, { status: 424 });

  const baseUrl = BASE_URL_3C;
  const apiToken = `?api_token=${encodeURIComponent(token)}`;
  const headers = { 'Content-Type': 'application/json', 'accept': 'application/json' };

  const campanhaCRM = await base44.asServiceRole.entities.CampanhaVendaFlow.create({
    empresaId,
    nome,
    descricao: descricao || '',
    status: 'rascunho',
    fonte: fonte || 'manual',
    total_leads: leads.length,
    criada_por: user.email,
    data_criacao: new Date().toISOString(),
    config_3cplus: { start_time, end_time, qualification_list, allows_manual, is_predictive, teams, wait_time, call_time, recalls },
  });

  let campanhaId3C = null;
  let listaId3C = null;

  try {
    // PASSO 1 — Criar campanha no 3C Plus
    const payload3C = {
      name: nome,
      start_time,
      end_time,
      qualification_list: Number(qualification_list),
      allows_manual: allows_manual !== false,
      is_predictive: is_predictive === true,
      distribution_type: 'teams_and_agents',
      teams: Array.isArray(teams) ? teams.map(Number) : [],
      dialer_settings: {
        wait_time: Number(wait_time || 3),
        call_time: Number(call_time || 30),
        recalls: Number(recalls || 3),
      },
    };

    const respCampanha = await fetch(`${baseUrl}/campaigns${apiToken}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload3C),
      signal: AbortSignal.timeout(15000),
    });

    const dadosCampanha = await respCampanha.json().catch(() => ({}));

    if (!respCampanha.ok) {
      const erroMsg = dadosCampanha?.errors ? JSON.stringify(dadosCampanha.errors) : dadosCampanha?.detail || `HTTP ${respCampanha.status}`;
      throw new Error(`Passo 1 falhou — criar campanha: ${erroMsg}`);
    }

    campanhaId3C = dadosCampanha?.data?.data?.id || dadosCampanha?.data?.id || dadosCampanha?.id;
    if (!campanhaId3C) throw new Error('Passo 1 falhou — id da campanha não retornado');

    console.log('[criarCampanha3CPlus] Passo 1 OK — campanha_id:', campanhaId3C);

    await base44.asServiceRole.entities.CampanhaVendaFlow.update(campanhaCRM.id, {
      campanha_id_3cplus: campanhaId3C,
    });

    // PASSO 2 — Criar lista de mailing
    const respLista = await fetch(`${baseUrl}/campaigns/${campanhaId3C}/lists${apiToken}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: `Lista - ${nome}` }),
      signal: AbortSignal.timeout(10000),
    });

    const dadosLista = await respLista.json().catch(() => ({}));

    if (!respLista.ok) {
      throw new Error(`Passo 2 falhou — criar lista: HTTP ${respLista.status}`);
    }

    listaId3C = dadosLista?.data?.data?.id || dadosLista?.data?.id || dadosLista?.id;
    if (!listaId3C) throw new Error('Passo 2 falhou — id da lista não retornado');

    console.log('[criarCampanha3CPlus] Passo 2 OK — lista_id:', listaId3C);

    await base44.asServiceRole.entities.CampanhaVendaFlow.update(campanhaCRM.id, {
      lista_id_3cplus: listaId3C,
    });

    // PASSO 3 — Upload dos leads
    // Normalizar, validar e remover duplicatas de telefone
    const phonesVistos = new Set();
    const leadsFormatados = leads
      .map(l => ({
        identifier: String(l.identifier || l.nome || l.name || l.phone || '').trim(),
        phone: String(l.phone || l.telefone || '').replace(/\D/g, ''),
      }))
      .filter(l => {
        if (l.phone.length < 8) return false;
        if (phonesVistos.has(l.phone)) return false;
        phonesVistos.add(l.phone);
        return true;
      });

    if (leadsFormatados.length === 0) {
      throw new Error('Passo 3 falhou — nenhum lead com telefone válido após normalização');
    }

    console.log('[criarCampanha3CPlus] leads após dedup:', { total_original: leads.length, total_validos: leadsFormatados.length });

    const respMailing = await fetch(`${baseUrl}/campaigns/${campanhaId3C}/lists/${listaId3C}/mailing.json${apiToken}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(leadsFormatados),
      signal: AbortSignal.timeout(30000),
    });

    const dadosMailing = await respMailing.json().catch(() => ({}));

    if (!respMailing.ok) {
      throw new Error(`Passo 3 falhou — upload mailing: HTTP ${respMailing.status}: ${JSON.stringify(dadosMailing).substring(0, 200)}`);
    }

    console.log('[criarCampanha3CPlus] Passo 3 OK — leads enviados:', leadsFormatados.length);

    await base44.asServiceRole.entities.CampanhaVendaFlow.update(campanhaCRM.id, {
      status: 'ativa',
      total_leads: leadsFormatados.length,
    });

    // Auto-habilitar a campanha para que fique visível nos SDRs
    try {
      const cfgAtual = integracao.configuracao || {};
      const habilitadas = cfgAtual.campanhas_habilitadas || [];
      const novoId = String(campanhaId3C);
      if (!habilitadas.includes(novoId)) {
        await base44.asServiceRole.entities.Integracao.update(integracao.id, {
          configuracao: { ...cfgAtual, campanhas_habilitadas: [...habilitadas, novoId] },
        });
        console.log('[criarCampanha3CPlus] Campanha auto-habilitada:', novoId);
      }
    } catch (e) { console.warn('[criarCampanha3CPlus] Erro ao auto-habilitar:', e.message); }

    return Response.json(
      {
        success: true,
        campanha_crm_id: campanhaCRM.id,
        campanha_id_3cplus: campanhaId3C,
        lista_id_3cplus: listaId3C,
        total_leads: leadsFormatados.length,
        mensagem: `Campanha "${nome}" criada com sucesso no 3C Plus com ${leadsFormatados.length} leads.`,
      },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );

  } catch (erro) {
    console.error('[criarCampanha3CPlus] ERRO:', erro.message);

    await base44.asServiceRole.entities.CampanhaVendaFlow.update(campanhaCRM.id, {
      status: 'erro',
      erro_mensagem: erro.message,
      ...(campanhaId3C ? { campanha_id_3cplus: campanhaId3C } : {}),
      ...(listaId3C ? { lista_id_3cplus: listaId3C } : {}),
    });

    return Response.json(
      {
        error: 'Falha ao criar campanha',
        detalhe: erro.message,
        campanha_crm_id: campanhaCRM.id,
        passo_falhou: !campanhaId3C ? 1 : !listaId3C ? 2 : 3,
      },
      { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
});