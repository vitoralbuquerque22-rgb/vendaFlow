import { createClientFromRequest } from "../../src/sdk.ts";

export default async (req) => {
  try {
    const api = createClientFromRequest(req);
    
    // Verificar se o usuário está autenticado
    const user = await api.auth.me();
    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // JUSTIFICATIVA: Fluxo pós-signup — cria automaticamente Empresa, VinculoEmpresa e UserProfile
    // para o novo usuário. A entidade Empresa tem RLS de criação restrita a admin, portanto
    // asServiceRole é necessário para que qualquer usuário recém-cadastrado possa criar a sua.
    const empresasExistentes = await api.asServiceRole.entities.Empresa.filter({
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
    const empresa = await api.asServiceRole.entities.Empresa.create({
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
    await api.asServiceRole.entities.VinculoEmpresa.create({
      empresaId: empresa.id,
      userEmail: user.email,
      papel: 'admin',
      status: 'ativo',
    });

    // Criar perfil de usuário
    await api.asServiceRole.entities.UserProfile.create({
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
};
