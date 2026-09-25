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

  const { empresaId, campanha_id_3cplus, acao, dados } = body;
  if (!empresaId || !campanha_id_3cplus || !acao) {
    return Response.json({ error: 'empresaId, campanha_id_3cplus e acao são obrigatórios' }, { status: 400 });
  }

  const integracoes = await base44.asServiceRole.entities.Integracao.filter({ empresaId, tipo: 'telefonia', ativa: true });
  const integracao = integracoes.find(i => i.configuracao?.fornecedor === '3cplus');
  if (!integracao) return Response.json({ error: 'Integração 3C Plus não configurada' }, { status: 424 });

  const cfg = integracao.configuracao;
  const token = String(cfg.token_gestor || '').trim();
  if (!token) return Response.json({ error: 'token_gestor não configurado' }, { status: 424 });

  const dominioGerenciar = String(cfg.dominio || '').trim();
  const baseUrl = dominioGerenciar ? `https://${dominioGerenciar}.3c.plus/api/v1` : 'https://3c.fluxoti.com/api/v1';
  const apiToken = `?api_token=${encodeURIComponent(token)}`;
  const headers = { 'Content-Type': 'application/json', 'accept': 'application/json' };

  let resposta;

  try {
    switch (acao) {

      case 'pause':
        resposta = await fetch(`${baseUrl}/campaigns/${campanha_id_3cplus}/pause${apiToken}`, {
          method: 'PUT', headers, body: '{}',
          signal: AbortSignal.timeout(10000),
        });
        // Atualizar status no CRM
        if (resposta.ok) {
          try {
            const campanhasCRM = await base44.asServiceRole.entities.CampanhaVendaFlow.filter({
              empresaId, campanha_id_3cplus: Number(campanha_id_3cplus),
            });
            if (campanhasCRM.length > 0) {
              await base44.asServiceRole.entities.CampanhaVendaFlow.update(campanhasCRM[0].id, { status: 'pausada' });
            }
          } catch (e) { console.warn('[pause] erro ao atualizar CRM:', e.message); }
        }
        break;

      case 'resume':
        resposta = await fetch(`${baseUrl}/campaigns/${campanha_id_3cplus}/resume${apiToken}`, {
          method: 'PUT', headers, body: '{}',
          signal: AbortSignal.timeout(10000),
        });
        // Atualizar status no CRM
        if (resposta.ok) {
          try {
            const campanhasCRM = await base44.asServiceRole.entities.CampanhaVendaFlow.filter({
              empresaId, campanha_id_3cplus: Number(campanha_id_3cplus),
            });
            if (campanhasCRM.length > 0) {
              await base44.asServiceRole.entities.CampanhaVendaFlow.update(campanhasCRM[0].id, { status: 'ativa' });
            }
          } catch (e) { console.warn('[resume] erro ao atualizar CRM:', e.message); }
        }
        break;

      case 'delete':
        resposta = await fetch(`${baseUrl}/campaigns/${campanha_id_3cplus}${apiToken}`, {
          method: 'DELETE', headers,
          signal: AbortSignal.timeout(10000),
        });
        // Marcar como encerrada no CRM também
        if (resposta.ok || resposta.status === 204) {
          const campanhasCRM = await base44.asServiceRole.entities.CampanhaVendaFlow.filter({
            empresaId,
            campanha_id_3cplus: Number(campanha_id_3cplus),
          });
          if (campanhasCRM.length > 0) {
            await base44.asServiceRole.entities.CampanhaVendaFlow.update(campanhasCRM[0].id, {
              status: 'encerrada',
            });
          }
        }
        break;

      case 'editar':
        if (!dados) return Response.json({ error: 'dados é obrigatório para acao editar' }, { status: 400 });

        // Buscar dados atuais da campanha para fazer merge (PUT exige payload completo)
        let dadosAtuais = {};
        try {
          const rGet = await fetch(`${baseUrl}/campaigns/${campanha_id_3cplus}${apiToken}`);
          const dGet = await rGet.json().catch(() => ({}));
          const camp = dGet?.data || dGet;
          dadosAtuais = {
            name:                       camp.name                       || '',
            start_time:                 camp.start_time                 || '08:00',
            end_time:                   camp.end_time                   || '18:30',
            qualification_list:         camp.dialer_settings?.qualification_list_id || camp.qualification_list || 1,
            allows_manual:              camp.allows_manual              ?? true,
            is_predictive:              camp.is_predictive              ?? false,
            should_complete_failed_call: camp.should_complete_failed_call ?? true,
            update_mailing_data:        camp.update_mailing_data        ?? false,
            active_list_notify:         camp.active_list_notify         ?? false,
            copy_identifier:            camp.copy_identifier            ?? false,
            check_amd:                  camp.amd_enabled                ?? false,
            filter_calls:               camp.filter_calls               ?? true,
            limit_call_per_agent:       camp.limit_call_per_agent       ?? 0,
            limit_call_time:            camp.limit_call_time            ?? 0,
            exit_manual_mode:           camp.exit_manual_mode           ?? 30,
            acw_timeout:                camp.acw_timeout                ?? 0,
            recalls:                    camp.dialer_settings?.recalls   ?? 3,
            wait_time:                  camp.dialer_settings?.wait_time ?? 3,
            call_time:                  camp.dialer_settings?.call_time ?? 25,
            distribution_type:          camp.distribution_type          || 'teams_and_agents',
            teams:                      Array.isArray(camp.teams) ? camp.teams.map((t) => t.id || t) : [],
          };
        } catch (e) {
          console.warn('[gerenciarCampanha3CPlus] erro ao buscar dados atuais:', e.message);
        }

        // Merge: dados atuais + alterações do usuário
        const payloadFinal = { ...dadosAtuais, ...dados };
        console.log('[gerenciarCampanha3CPlus] editar payload:', JSON.stringify(payloadFinal));

        resposta = await fetch(`${baseUrl}/campaigns/${campanha_id_3cplus}${apiToken}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payloadFinal),
          signal: AbortSignal.timeout(15000),
        });
        break;

      case 'detalhes':
        resposta = await fetch(`${baseUrl}/campaigns/${campanha_id_3cplus}${apiToken}`, {
          method: 'GET', headers,
          signal: AbortSignal.timeout(10000),
        });
        break;

      case 'agentes':
        resposta = await fetch(`${baseUrl}/campaigns/${campanha_id_3cplus}/agents${apiToken}`, {
          method: 'GET', headers,
          signal: AbortSignal.timeout(10000),
        });
        break;

      case 'adicionar_agente':
        if (!dados?.agent_id) return Response.json({ error: 'agent_id é obrigatório para adicionar_agente' }, { status: 400 });
        const formDataAdd = new FormData();
        const agentIds = Array.isArray(dados.agent_id) ? dados.agent_id : [dados.agent_id];
        agentIds.forEach((id) => formDataAdd.append('agents[]', Number(id)));
        resposta = await fetch(`${baseUrl}/campaigns/${campanha_id_3cplus}/agents${apiToken}`, {
          method: 'POST',
          body: formDataAdd,
          signal: AbortSignal.timeout(10000),
        });
        break;

      case 'sincronizar_agentes':
        if (!dados?.agentes_ids || !Array.isArray(dados.agentes_ids)) {
          return Response.json({ error: 'agentes_ids deve ser um array' }, { status: 400 });
        }
        const desejados = dados.agentes_ids.map(Number);
        // 1) Buscar agentes atualmente vinculados
        let atuaisIds = [];
        try {
          const rAtuais = await fetch(`${baseUrl}/campaigns/${campanha_id_3cplus}/agents${apiToken}`, {
            method: 'GET', headers, signal: AbortSignal.timeout(10000),
          });
          const dAtuais = await rAtuais.json().catch(() => ({}));
          const listaAtuais = dAtuais?.data || [];
          atuaisIds = (Array.isArray(listaAtuais) ? listaAtuais : []).map(a => Number(a.id));
        } catch (e) { console.warn('[sincronizar_agentes] erro ao buscar atuais:', e.message); }

        // 2) Calcular diff
        const paraAdicionar = desejados.filter(id => !atuaisIds.includes(id));
        const paraRemover = atuaisIds.filter(id => !desejados.includes(id));
        console.log(`[sincronizar_agentes] campanha=${campanha_id_3cplus} atuais=${atuaisIds.length} desejados=${desejados.length} add=${paraAdicionar.length} remove=${paraRemover.length}`);

        // 3) Remover agentes que foram desmarcados
        for (const id of paraRemover) {
          try {
            await fetch(`${baseUrl}/campaigns/${campanha_id_3cplus}/agents/${id}${apiToken}`, {
              method: 'DELETE', headers, signal: AbortSignal.timeout(8000),
            });
          } catch (e) { console.warn('[sincronizar_agentes] erro remove:', id, e.message); }
        }

        // 4) Adicionar novos agentes
        for (const id of paraAdicionar) {
          try {
            const fd = new FormData();
            fd.append('agents[]', id);
            await fetch(`${baseUrl}/campaigns/${campanha_id_3cplus}/agents${apiToken}`, {
              method: 'POST', body: fd, signal: AbortSignal.timeout(8000),
            });
          } catch (e) { console.warn('[sincronizar_agentes] erro add:', id, e.message); }
        }

        resposta = new Response(JSON.stringify({ success: true, adicionados: paraAdicionar.length, removidos: paraRemover.length }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
        break;

      default:
        return Response.json({ error: `Ação desconhecida: ${acao}` }, { status: 400 });
    }

    const statusCode = resposta.status;
    const resultado = await resposta.json().catch(() => ({}));
    console.log(`[gerenciarCampanha3CPlus] acao=${acao} campanha=${campanha_id_3cplus} status=${statusCode}`);

    if (!resposta.ok && statusCode !== 204) {
      console.error(`[gerenciarCampanha3CPlus] acao=${acao} status=${statusCode} resultado:`, JSON.stringify(resultado));
      return Response.json(
        {
          error: `Falha na ação ${acao}`,
          detalhe: resultado?.detail || resultado?.message || `HTTP ${statusCode}`,
          errors: resultado?.errors || null,
          statusCode,
          payload_enviado: dados,
        },
        { status: statusCode >= 500 ? 502 : statusCode, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    return Response.json(
      { success: true, acao, statusCode, data: resultado },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );

  } catch (e) {
    console.error(`[gerenciarCampanha3CPlus] catch acao=${acao}:`, e.message);
    return Response.json(
      { error: 'Falha ao conectar na API do 3C Plus', detalhe: e.message },
      { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
});