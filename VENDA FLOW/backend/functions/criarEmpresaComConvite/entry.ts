import { createClientFromRequest } from "../../src/sdk.ts";

export default async (req) => {
  try {
    const api = createClientFromRequest(req);
    const user = await api.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const dados = await req.json();
    const { nome, cnpj, nomeProprietario, whatsappProprietario, telefonePropietario, plano, limiteUsuarios, statusPlano, dataRenovacao, ownerEmail } = dados;

    // JUSTIFICATIVA: Operação administrativa — cria Empresa, ConviteEmpresa e VinculoEmpresa
    // em nome do admin global, que pode não ser o futuro owner. Requer escrita cross-tenant.
    // Nunca exposto ao frontend como ação de usuário comum.
    const empresa = await api.asServiceRole.entities.Empresa.create({
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

    // 2. Convidar o usuário (envia o e-mail de convite)
    console.log('Convidando usuário:', ownerEmail);
    try {
      await api.users.inviteUser(ownerEmail, 'user');
      console.log('✓ Usuário convidado com sucesso');
    } catch (inviteError) {
      console.error('✗ ERRO ao convidar:', inviteError.message, inviteError);
      throw inviteError;
    }

    // 3. Gerar código de convite
    const codigo = Math.random().toString(36).substring(2, 12).toUpperCase();

    // 4. Criar convite da empresa
    await api.asServiceRole.entities.ConviteEmpresa.create({
      empresaId: empresa.id,
      email: ownerEmail,
      papel: 'admin',
      codigo,
      expiraEm: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'pendente',
    });

    // 5. Criar vínculo automaticamente para o owner (admin)
    await api.asServiceRole.entities.VinculoEmpresa.create({
      empresaId: empresa.id,
      userEmail: ownerEmail,
      papel: 'admin',
      status: 'ativo',
    });

    // 5b. Criar UserProfile para o owner se ainda não existir
    const ownerProfiles = await api.asServiceRole.entities.UserProfile.filter({ user_email: ownerEmail });
    if (ownerProfiles.length === 0) {
      await api.asServiceRole.entities.UserProfile.create({
        user_email: ownerEmail,
        user_name: nomeProprietario || ownerEmail,
        role: 'admin',
        is_active: true,
        assigned_by: 'system',
      });
    }

    // 6. Preparar link de onboarding (o e-mail é enviado pelo sistema de convites)
    const onboardingUrl = `${Deno.env.get("PUBLIC_URL")}/Onboarding?convite=${codigo}&empresaId=${empresa.id}`;

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
};
