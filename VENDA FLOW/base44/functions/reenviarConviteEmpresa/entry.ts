import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { empresaId, email } = await req.json();

    // Buscar empresa
    const empresa = await base44.asServiceRole.entities.Empresa.get(empresaId);
    if (!empresa) {
      return Response.json({ error: 'Empresa não encontrada' }, { status: 404 });
    }

    // Convidar o usuário no Base44 (essencial)
    console.log('Convidando/verificando usuário:', email);
    try {
      await base44.users.inviteUser(email, 'user');
      console.log('✓ Usuário convidado/verificado');
    } catch (err) {
      console.error('✗ ERRO ao convidar:', err.message, err);
      throw err;
    }

    // Gerar novo código de convite
    const codigo = Math.random().toString(36).substring(2, 12).toUpperCase();

    // Atualizar ou criar novo convite
    const convites = await base44.asServiceRole.entities.ConviteEmpresa.filter({
      empresaId,
      email,
    });

    if (convites.length > 0) {
      await base44.asServiceRole.entities.ConviteEmpresa.update(convites[0].id, {
        codigo,
        expiraEm: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pendente',
      });
    } else {
      await base44.asServiceRole.entities.ConviteEmpresa.create({
        empresaId,
        email,
        papel: 'admin',
        codigo,
        expiraEm: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pendente',
      });
    }

    // Nota: Email será enviado por uma função separada APÓS o usuário fazer login
    // Retorna o link para o usuário copiar manualmente se necessário
    const onboardingUrl = `https://venda-flow-crm-84acadf3.base44.app/Onboarding?convite=${codigo}&empresaId=${empresaId}`;

    return Response.json({
      success: true,
      message: 'Usuário convidado! Ele receberá um email de confirmação.',
      codigo,
      onboardingUrl,
    });
  } catch (error) {
    console.error('Erro ao reenviar convite:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});