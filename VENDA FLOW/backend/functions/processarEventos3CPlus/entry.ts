import { createClientFromRequest } from "../../src/sdk.ts";

/**
 * processarEventos3CPlus
 *
 * Endpoint de polling para o frontend obter:
 *   1. Status ao vivo dos agentes (para painel do gestor)
 *   2. Novas atividades criadas desde a última sincronização
 *   3. Status da conexão com o 3C Plus
 *
 * O frontend chama este endpoint a cada ~10s para atualizar
 * o painel de monitoramento, substituindo a necessidade de
 * Socket.io direto no browser.
 *
 * Os dados de agentes ficam em cache na entidade Integracao
 * (campo dados_cache.agentes_ao_vivo), atualizados pela
 * função sincronizarTelefonia3CPlus.
 *
 * Para tempo real mais próximo, o gestor pode acionar
 * sincronizarTelefonia3CPlus manualmente antes de consultar aqui.
 */

function mapearStatusAgente(status) {
  const mapa = {
    idle:       'Disponível',
    in_call:    'Em ligação',
    on_break:   'Em pausa',
    acw:        'Pós-atendimento',
    logged_out: 'Deslogado',
    ringing:    'Recebendo chamada',
  };
  return mapa[status] ?? status;
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const api = createClientFromRequest(req);
    const user = await api.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // empresaId pode vir via query string (GET) ou body (POST)
    let empresaId = new URL(req.url).searchParams.get('empresaId') || '';
    let desde = new URL(req.url).searchParams.get('desde');

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        empresaId = body.empresaId || empresaId;
        desde = body.desde || desde;
      } catch { /* query string já setou */ }
    }

    if (!empresaId) {
      return Response.json({ error: 'empresaId é obrigatório' }, { status: 400 });
    }

    const isGestorOuAdmin = user.role === 'admin' || user.role === 'gestor';

    // -------------------------------------------------------
    // 1. Status da integração e cache dos agentes
    // -------------------------------------------------------
    const integracoes = await api.asServiceRole.entities.Integracao.filter({
      empresaId,
      tipo: 'telefonia',
      ativa: true,
    });

    const integracao = integracoes.find(
      (i) => i.configuracao?.fornecedor === '3cplus'
    );

    if (!integracao) {
      return Response.json({
        conectado: false,
        mensagem: 'Integração 3C Plus não encontrada ou inativa',
      }, { headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const ultimaSinc = integracao.ultima_sincronizacao
      ? new Date(integracao.ultima_sincronizacao)
      : null;

    const segundosDesdeSync = ultimaSinc
      ? Math.floor((Date.now() - ultimaSinc.getTime()) / 1000)
      : null;

    // Cache dos agentes (atualizado pela sincronizarTelefonia3CPlus)
    const agentesCache = integracao.dados_cache?.agentes_ao_vivo || [];

    // -------------------------------------------------------
    // 2. Atividades recentes (para notificar o vendedor)
    // -------------------------------------------------------
    let atividadesRecentes = [];
    try {
      const todasAtividades = await api.asServiceRole.entities.Atividade.filter({
        empresaId,
        tipo: 'ligacao',
        origem_sincronizacao: '3cplus',
      });

      if (desde) {
        const dataDesde = new Date(desde);
        atividadesRecentes = todasAtividades
          .filter((a) => new Date(a.created_date) > dataDesde)
          .slice(0, 20);
      } else {
        atividadesRecentes = todasAtividades
          .sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime())
          .slice(0, 10);
      }

      // Se for SDR, filtrar apenas as atividades dele
      if (!isGestorOuAdmin) {
        atividadesRecentes = atividadesRecentes.filter(
          (a) => a.sdr_email === user.email
        );
      }
    } catch { /* não bloqueia */ }

    // -------------------------------------------------------
    // 3. Resumo de métricas do dia (para o painel)
    // -------------------------------------------------------
    let metricas = {};

    if (isGestorOuAdmin) {
      try {
        const inicioDia = new Date();
        inicioDia.setHours(0, 0, 0, 0);

        const atividadesDia = await api.asServiceRole.entities.Atividade.filter({
          empresaId,
          tipo: 'ligacao',
        });

        const atividadesHoje = atividadesDia.filter(
          (a) => new Date(a.created_date) >= inicioDia
        );

        const totalLigacoes = atividadesHoje.length;
        const atendidas     = atividadesHoje.filter((a) => a.resultado === 'atendeu').length;
        const duracoes      = atividadesHoje.map((a) => Number(a.duracao_segundos || 0));
        const duracaoMedia  = duracoes.length > 0
          ? Math.round(duracoes.reduce((s, v) => s + v, 0) / duracoes.length)
          : 0;

        metricas = {
          ligacoes_hoje: totalLigacoes,
          atendidas_hoje: atendidas,
          taxa_atendimento: totalLigacoes > 0 ? Math.round((atendidas / totalLigacoes) * 100) : 0,
          tma_segundos: duracaoMedia,
          agentes_ativos: agentesCache.filter((a) => a.status === 'in_call' || a.status === 'idle').length,
          agentes_em_ligacao: agentesCache.filter((a) => a.status === 'in_call').length,
          agentes_em_pausa: agentesCache.filter((a) => a.status === 'on_break').length,
        };
      } catch { /* não bloqueia */ }
    }

    // -------------------------------------------------------
    // 4. Formatar agentes para exibição no painel
    // -------------------------------------------------------
    const agentesFormatados = agentesCache.map((agente) => ({
      id:            agente.id,
      nome:          agente.name || agente.username || agente.email,
      email:         agente.email,
      status:        agente.status,
      status_label:  mapearStatusAgente(String(agente.status || '')),
      campanha:      agente.campaign_name || agente.campaign?.name || '',
      duracao_atual: agente.current_call_duration || 0,
    }));

    return Response.json(
      {
        conectado: true,
        ultima_sincronizacao: integracao.ultima_sincronizacao,
        segundos_desde_sync: segundosDesdeSync,
        agentes: isGestorOuAdmin ? agentesFormatados : [],
        atividades_recentes: atividadesRecentes,
        metricas: isGestorOuAdmin ? metricas : {},
      },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );

  } catch (error) {
    console.error('[processarEventos3CPlus]', error.message);
    return Response.json(
      { error: error.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
};
