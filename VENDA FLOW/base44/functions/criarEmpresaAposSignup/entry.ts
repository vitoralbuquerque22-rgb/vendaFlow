import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verificar se o usuário está autenticado
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // JUSTIFICATIVA: Fluxo pós-signup — cria automaticamente Empresa, VinculoEmpresa e UserProfile
    // para o novo usuário. A entidade Empresa tem RLS de criação restrita a admin, portanto
    // asServiceRole é necessário para que qualquer usuário recém-cadastrado possa criar a sua.
    const empresasExistentes = await base44.asServiceRole.entities.Empresa.filter({
      ownerEmail: user.email
    });

    if (empresasExistentes.length > 0) {
      return Response.json({ 
        success: true, 
        empresa: empresasExistentes[0],
        jaExistia: true,
        message: 'Empresa já existe'
      });
    }

    // Criar nome padrão para a empresa
    const nomeEmpresa = `Empresa de ${user.full_name || user.email.split('@')[0]}`;

    // Criar a empresa com plano básico
    const empresa = await base44.asServiceRole.entities.Empresa.create({
      nome: nomeEmpresa,
      cnpj: '',
      nomeProprietario: user.full_name || user.email,
      whatsappProprietario: '',
      telefonePropietario: '',
      plano: 'starter',
      limiteUsuarios: 5,
      statusPlano: 'ativo',
      ownerEmail: user.email,
    });

    // Criar vínculo automático (admin)
    await base44.asServiceRole.entities.VinculoEmpresa.create({
      empresaId: empresa.id,
      userEmail: user.email,
      papel: 'admin',
      status: 'ativo',
    });

    // Criar perfil de usuário
    await base44.asServiceRole.entities.UserProfile.create({
      user_email: user.email,
      user_name: user.full_name || user.email,
      role: 'admin',
      is_active: true,
      assigned_by: 'system',
    });

    return Response.json({
      success: true,
      empresa,
      message: 'Empresa criada automaticamente após signup!'
    });
  } catch (error) {
    console.error('Erro ao criar empresa:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});