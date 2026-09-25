import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * retryGravacoes3CPlus
 *
 * Alerta 4 — Resiliência de gravações.
 *
 * Problema: se processarGravacao3CPlus falhar (Whisper offline, timeout,
 * rede instável), a gravação fica com gravacao_processada=false mas
 * gravacao_url preenchida — dados perdidos silenciosamente.
 *
 * Solução: esta função varre todas as CallSessions finalizadas que têm
 * gravacao_url mas gravacao_processada=false e dispara o pipeline
 * novamente.
 */

const MAX_TENTATIVAS = 3;
const JANELA_HORAS   = 48;

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

  try {
    const base44 = createClientFromRequest(req);
    const user   = await base44.auth.me();

    // Permite cron (sem user) ou admin/gestor
    const isAutorizado = !user || user.role === 'admin' || user.role === 'gestor';
    if (!isAutorizado) {
      return Response.json({ error: 'Acesso restrito' }, { status: 403 });
    }

    let body = {};
    try { body = await req.json(); } catch { /* cron sem body */ }

    const agora        = new Date();
    const limiteJanela = new Date(agora.getTime() - JANELA_HORAS * 60 * 60 * 1000);

    const resultado = {
      sessoes_verificadas: 0,
      reprocessadas:       0,
      sucesso:             0,
      falha:               0,
      ignoradas:           0,
      detalhes:            [],
    };

    // 1. Buscar CallSessions com gravação pendente
    const filtro = {
      status:              'finished',
      gravacao_processada: false,
    };
    if (body.empresaId) filtro.empresaId = body.empresaId;

    const sessoesPendentes = await base44.asServiceRole.entities.CallSession.filter(filtro);

    // Filtrar janela de tempo e sessões com URL de gravação
    const sessoesParaReprocessar = sessoesPendentes.filter((s) => {
      if (!s.gravacao_url) return false;
      if (!body.forcar) {
        const finalizadaEm = s.finalizada_em ? new Date(s.finalizada_em) : null;
        if (!finalizadaEm || finalizadaEm < limiteJanela) return false;
      }
      return true;
    });

    resultado.sessoes_verificadas = sessoesParaReprocessar.length;

    // 2. Reprocessar cada sessão
    for (const sessao of sessoesParaReprocessar) {
      const detalhe = {
        call_session_id: sessao.id,
        lead_nome:       sessao.lead_nome,
        empresaId:       sessao.empresaId,
        gravacao_url:    sessao.gravacao_url,
      };

      const tentativas = sessao.tentativas_processamento || 0;
      if (tentativas >= MAX_TENTATIVAS) {
        detalhe.status  = 'ignorada';
        detalhe.motivo  = `Máximo de ${MAX_TENTATIVAS} tentativas atingido`;
        resultado.ignoradas++;
        resultado.detalhes.push(detalhe);

        await base44.asServiceRole.entities.CallSession.update(sessao.id, {
          erro_mensagem: `Falha definitiva após ${MAX_TENTATIVAS} tentativas de processamento`,
        }).catch(() => {});
        continue;
      }

      try {
        await base44.asServiceRole.entities.CallSession.update(sessao.id, {
          tentativas_processamento: tentativas + 1,
        });

        const urlSelf    = new URL(req.url);
        const baseUrl    = `${urlSelf.protocol}//${urlSelf.host}`;
        const authHeader = req.headers.get('Authorization') || '';

        const resposta = await fetch(`${baseUrl}/functions/processarGravacao3CPlus`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          },
          body: JSON.stringify({
            empresaId:       sessao.empresaId,
            call_session_id: sessao.id,
            gravacao_url:    sessao.gravacao_url,
          }),
        });

        const resultadoProcessamento = await resposta.json().catch(() => ({}));

        if (resposta.ok && resultadoProcessamento.success) {
          detalhe.status = 'reprocessada';
          resultado.reprocessadas++;
          resultado.sucesso++;
        } else if (resposta.status === 206) {
          detalhe.status = 'parcial';
          detalhe.motivo = 'Gravação salva, transcrição falhou';
          resultado.reprocessadas++;
          resultado.sucesso++;
        } else {
          detalhe.status = 'falha';
          detalhe.erro   = resultadoProcessamento.error || `HTTP ${resposta.status}`;
          resultado.falha++;
        }
      } catch (e) {
        detalhe.status = 'falha';
        detalhe.erro   = e.message;
        resultado.falha++;
      }

      resultado.detalhes.push(detalhe);

      // Delay entre chamadas para não sobrecarregar Whisper
      if (sessoesParaReprocessar.length > 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // 3. Registrar log de auditoria
    if (resultado.sessoes_verificadas > 0) {
      try {
        await base44.asServiceRole.entities.LogAutomacao.create({
          tipo:         'retry_gravacoes_3cplus',
          status:       resultado.falha === 0 ? 'sucesso' : 'parcial',
          detalhes:     resultado,
          executado_em: agora.toISOString(),
        });
      } catch { /* log não bloqueia */ }
    }

    return Response.json(
      {
        success: true,
        ...resultado,
        mensagem: resultado.sessoes_verificadas === 0
          ? 'Nenhuma gravação pendente encontrada.'
          : `${resultado.sucesso} de ${resultado.sessoes_verificadas} gravação(ões) reprocessada(s).`,
      },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );

  } catch (error) {
    console.error('[retryGravacoes3CPlus]', error.message);
    return Response.json(
      { error: error.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
});