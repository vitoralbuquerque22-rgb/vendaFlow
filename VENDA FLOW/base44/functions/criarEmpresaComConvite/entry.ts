import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const dados = await req.json();
    const { nome, cnpj, nomeProprietario, whatsappProprietario, telefonePropietario, plano, limiteUsuarios, statusPlano, dataRenovacao, ownerEmail } = dados;

    // JUSTIFICATIVA: Operação administrativa — cria Empresa, ConviteEmpresa e VinculoEmpresa
    // em nome do admin global, que pode não ser o futuro owner. Requer escrita cross-tenant.
    // Nunca exposto ao frontend como ação de usuário comum.
    const empresa = await base44.asServiceRole.entities.Empresa.create({
      nome,
      cnpj,
      nomeProprietario,
      whatsappProprietario,
      telefonePropietario,
      plano: plano || 'starter',
      limiteUsuarios: limiteUsuarios || 5,
      statusPlano: statusPlano || 'ativo',
      dataRenovacao,
      ownerEmail,
    });

    // 2. Convidar o usuário no Base44 (essencial para enviar email)
    console.log('Convidando usuário:', ownerEmail);
    try {
      await base44.users.inviteUser(ownerEmail, 'user');
      console.log('✓ Usuário convidado com sucesso');
    } catch (inviteError) {
      console.error('✗ ERRO ao convidar:', inviteError.message, inviteError);
      throw inviteError;
    }

    // 3. Gerar código de convite
    const codigo = Math.random().toString(36).substring(2, 12).toUpperCase();

    // 4. Criar convite da empresa
    await base44.asServiceRole.entities.ConviteEmpresa.create({
      empresaId: empresa.id,
      email: ownerEmail,
      papel: 'admin',
      codigo,
      expiraEm: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'pendente',
    });

    // 5. Criar vínculo automaticamente para o owner (admin)
    await base44.asServiceRole.entities.VinculoEmpresa.create({
      empresaId: empresa.id,
      userEmail: ownerEmail,
      papel: 'admin',
      status: 'ativo',
    });

    // 5b. Criar UserProfile para o owner se ainda não existir
    const ownerProfiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: ownerEmail });
    if (ownerProfiles.length === 0) {
      await base44.asServiceRole.entities.UserProfile.create({
        user_email: ownerEmail,
        user_name: nomeProprietario || ownerEmail,
        role: 'admin',
        is_active: true,
        assigned_by: 'system',
      });
    }

    // 6. Preparar link de onboarding (email será enviado via sistema de convites do Base44)
    const onboardingUrl = `https://venda-flow-crm-84acadf3.base44.app/Onboarding?convite=${codigo}&empresaId=${empresa.id}`;

    return Response.json({
      success: true,
      empresa,
      codigo,
      message: 'Empresa criada e email enviado com sucesso!',
    });
  } catch (error) {
    console.error('Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});