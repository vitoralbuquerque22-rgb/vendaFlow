import { createClientFromRequest } from "../../src/sdk.ts";

export default async (req) => {
  try {
    const api = createClientFromRequest(req);
    const user = await api.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Apenas admins podem excluir usuários
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { user_email, empresaId } = body;

    console.log('Dados recebidos:', { user_email, empresaId });

    if (!user_email || !empresaId) {
      return Response.json({ 
        error: 'user_email e empresaId são obrigatórios',
        received: { user_email, empresaId }
      }, { status: 400 });
    }

    // Admin global pode operar em qualquer empresa; admin de tenant deve pertencer à empresa alvo
    if (user.role !== 'admin') {
      const adminVinculo = await api.asServiceRole.entities.VinculoEmpresa.filter({ userEmail: user.email, empresaId });
      if (adminVinculo.length === 0) {
        return Response.json({ error: 'Forbidden: Você não pertence a esta empresa' }, { status: 403 });
      }
    }

    // 1. Filtrar UserProfile por empresaId
    const perfis = await api.asServiceRole.entities.UserProfile.filter({ user_email, empresaId });
    const perfil = perfis[0];
    
    console.log('Perfil encontrado:', perfil);

    if (perfil) {
      await api.asServiceRole.entities.UserProfile.delete(perfil.id);
      console.log('Perfil excluído:', perfil.id);
    }

    // 2. Buscar e excluir VinculoEmpresa do usuário na empresa
    const vinculos = await api.asServiceRole.entities.VinculoEmpresa.filter({ userEmail: user_email, empresaId });
    
    console.log('Vínculos encontrados:', vinculos.length);
    
    for (const vinculo of vinculos) {
      await api.asServiceRole.entities.VinculoEmpresa.delete(vinculo.id);
      console.log('Vínculo excluído:', vinculo.id);
    }

    // 3. Registrar log da ação
    await api.asServiceRole.entities.RBACLog.create({
      action_type: 'profile_deleted',
      user_email,
      performed_by: user.email,
      details: {
        role: perfil?.role,
        vinculos_excluidos: vinculos.length,
        deleted_at: new Date().toISOString()
      }
    });

    return Response.json({ 
      sucesso: true,
      message: 'Usuário excluído completamente',
      detalhes: {
        perfil_excluido: !!perfil,
        vinculos_excluidos: vinculos.length
      }
    });

  } catch (error) {
    console.error('Erro ao excluir usuário:', error);
    return Response.json({ 
      error: error.message || 'Erro ao excluir usuário' 
    }, { status: 500 });
  }
};
