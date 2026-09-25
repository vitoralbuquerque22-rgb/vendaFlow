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
  try { body = await req.json(); } catch { body = {}; }

  if (!body.empresaId) return Response.json({ error: 'empresaId obrigatório' }, { status: 400 });

  const agora = new Date();
  const trintaDiasAtras = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const resultado = {
    soft_deleted: 0,
    purged: 0,
    erros: [],
    executado_em: agora.toISOString(),
  };

  try {
    // JUSTIFICATIVA: Pipeline de lifecycle LGPD — aplica soft-delete, purge de PII e repair
    // de TranscriptionJobs travados. Opera sobre todos os registros da empresa sem filtro de SDR.
    // Nunca exposto ao frontend como ação direta de usuário.
    const gravacoes = await base44.asServiceRole.entities.GravacaoLigacao.filter({
      empresaId: body.empresaId,
    });

    for (const g of gravacoes) {
      if (g.retention_policy === 'legal_hold' || g.retention_policy === 'permanent') continue;
      if (g.deleted_at) continue;
      if (!g.expires_at) continue;
      if (new Date(g.expires_at) < agora) {
        try {
          await base44.asServiceRole.entities.GravacaoLigacao.update(g.id, {
            deleted_at: agora.toISOString(),
            purge_scheduled_at: new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          });
          resultado.soft_deleted++;
        } catch (e) {
          resultado.erros.push({ id: g.id, fase: 'soft_delete', erro: e.message });
        }
      }
    }

    // ── FASE 2: Purge definitivo — deleted_at há mais de 30 dias ────────
    for (const g of gravacoes) {
      if (!g.deleted_at) continue;
      if (g.retention_policy === 'legal_hold' || g.retention_policy === 'permanent') continue;
      if (new Date(g.deleted_at) > new Date(trintaDiasAtras)) continue;

      try {
        await base44.asServiceRole.entities.GravacaoLigacao.update(g.id, {
          lead_nome: '[DADO REMOVIDO]',
          lead_nome_original: '[DADO REMOVIDO — LGPD]',
          lead_telefone: '[DADO REMOVIDO]',
          lead_telefone_original: '[DADO REMOVIDO — LGPD]',
          transcricao: null,
          transcricao_anonimizada: null,
          analise_ia: null,
          purged_at: agora.toISOString(),
        });
        resultado.purged++;
      } catch (e) {
        resultado.erros.push({ id: g.id, fase: 'purge', erro: e.message });
      }
    }

    // ── FASE 3: Repair stuck TranscriptionJobs ───────────────────────────
    const cincoMinutosAtras = new Date(agora.getTime() - 5 * 60 * 1000).toISOString();
    const jobs = await base44.asServiceRole.entities.TranscriptionJob.filter({
      empresaId: body.empresaId,
      status: 'processing',
    });
    let stuck_reset = 0;
    for (const job of jobs) {
      if (job.iniciado_em && job.iniciado_em < cincoMinutosAtras) {
        await base44.asServiceRole.entities.TranscriptionJob.update(job.id, {
          status: 'stuck',
          stuck_detected_at: agora.toISOString(),
        }).catch(() => {});
        if (job.gravacao_id) {
          await base44.asServiceRole.entities.GravacaoLigacao.update(job.gravacao_id, {
            transcricao_status: 'stuck',
          }).catch(() => {});
        }
        stuck_reset++;
      }
    }
    resultado.stuck_reset = stuck_reset;

    console.log('[purgeGravacoes] resultado:', JSON.stringify(resultado));
    return Response.json(resultado, { headers: { 'Access-Control-Allow-Origin': '*' } });

  } catch (e) {
    console.error('[purgeGravacoes] erro crítico:', e.message);
    return Response.json({ error: e.message, resultado }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
});