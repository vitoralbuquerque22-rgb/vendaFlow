import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    const { action_type, user_email, details, page } = await req.json();

    if (!action_type) {
      return Response.json({ error: 'action_type é obrigatório' }, { status: 400 });
    }

    await base44.asServiceRole.entities.RBACLog.create({
      action_type,
      user_email: user_email || null,
      performed_by: user?.email || 'system',
      details: details || {},
      page: page || null,
      ip_address: req.headers.get('x-forwarded-for') || 'unknown'
    });

    return Response.json({
      success: true,
      message: 'Log registrado'
    });

  } catch (error) {
    console.error('Erro ao registrar log:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});