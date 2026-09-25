import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const { empresaId, tipo_evento, pagina, campanha_id, campanha_nome, duracao_segundos, session_id } = body;

    await base44.asServiceRole.entities.LogAcesso.create({
      user_email: user.email,
      user_nome: user.full_name || user.email,
      empresaId: empresaId || null,
      tipo_evento: tipo_evento || "login",
      pagina: pagina || null,
      campanha_id: campanha_id || null,
      campanha_nome: campanha_nome || null,
      duracao_segundos: duracao_segundos || null,
      session_id: session_id || null,
      user_agent: req.headers.get("user-agent") || null,
      registrado_em: new Date().toISOString()
    });

    // Limpar logs com mais de 7 dias (expiry)
    const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const logsAntigos = await base44.asServiceRole.entities.LogAcesso.filter({
      registrado_em: { $lt: seteDiasAtras }
    }, "registrado_em", 100);
    if (logsAntigos.length > 0) {
      await Promise.all(logsAntigos.map(l => base44.asServiceRole.entities.LogAcesso.delete(l.id)));
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});