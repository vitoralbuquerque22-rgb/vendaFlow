import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });

    let body;
    try { body = await req.json(); } catch { return Response.json({ error: 'Body inválido' }, { status: 400 }); }

    const { empresaId, confirmar = false } = body;
    if (!empresaId) return Response.json({ error: 'empresaId obrigatório' }, { status: 400 });

    // Somente gestor/admin
    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
    const userProfile = profiles[0] || null;
    const isGestorAdmin = user.role === 'admin' || userProfile?.role === 'admin' || userProfile?.role === 'gestor';
    if (!isGestorAdmin) return Response.json({ error: 'Sem permissão' }, { status: 403 });

    // Buscar todos os registros
    const todas = await base44.asServiceRole.entities.GravacaoLigacao.filter({ empresaId });

    // Inválidos: sem sdr_email, sem lead_nome e sem lead_telefone (dados nunca foram preenchidos)
    const invalidos = todas.filter((g) =>
      !g.purged_at &&
      (!g.sdr_email || g.sdr_email.trim() === '') &&
      (!g.lead_nome || g.lead_nome.trim() === '') &&
      (!g.lead_telefone || g.lead_telefone.trim() === '')
    );

    console.log(`[limparGravacoesInvalidas] total: ${todas.length} | inválidos: ${invalidos.length}`);

    // Modo dry-run: apenas contar sem deletar
    if (!confirmar) {
      return Response.json({
        total_registros: todas.length,
        invalidos_encontrados: invalidos.length,
        validos: todas.length - invalidos.length,
        mensagem: `Encontrados ${invalidos.length} registros inválidos. Para deletar, envie confirmar=true no payload.`,
        preview: invalidos.slice(0, 5).map((g) => ({
          id: g.id,
          call_id: g.call_id_3cplus,
          data: g.data_gravacao,
          sdr: g.sdr_email,
          lead: g.lead_nome,
        })),
      }, { headers: CORS });
    }

    // Deletar
    let deletados = 0;
    let erros = 0;
    for (const g of invalidos) {
      try {
        await base44.asServiceRole.entities.GravacaoLigacao.delete(g.id);
        deletados++;
      } catch (e) {
        console.error(`[limparGravacoesInvalidas] erro ao deletar ${g.id}:`, e.message);
        erros++;
      }
      if (deletados % 50 === 0) {
        console.log(`[limparGravacoesInvalidas] deletados: ${deletados}/${invalidos.length}`);
      }
    }

    return Response.json({
      total_registros: todas.length,
      deletados,
      erros,
      restantes: todas.length - deletados,
      mensagem: `${deletados} registros inválidos deletados com sucesso.`,
    }, { headers: CORS });

  } catch (e) {
    console.error('[limparGravacoesInvalidas] erro crítico:', e.message);
    return Response.json({ error: e.message }, { status: 500, headers: CORS });
  }
});