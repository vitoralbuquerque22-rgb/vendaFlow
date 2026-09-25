import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Somente admin global da plataforma (role='admin' no token de auth) pode excluir empresas
    // Admin de tenant (role via UserProfile) não tem acesso — verificação é no token, não no perfil
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Requer admin global da plataforma' }, { status: 403 });
    }

    const { empresaId } = await req.json();

    if (!empresaId) {
      return Response.json({ error: 'empresaId é obrigatório' }, { status: 400 });
    }

    console.log('Excluindo empresa:', empresaId);

    // JUSTIFICATIVA: Operação administrativa destrutiva — excluí empresa e todos os dados
    // associados (vínculos, perfis, convites). Requer acesso cross-tenant para apagar
    // registros de múltiplos usuários. Restrito a admin global. Nunca exposto ao frontend regular.
    const vinculos = await base44.asServiceRole.entities.VinculoEmpresa.filter({ empresaId });
    console.log(`Encontrados ${vinculos.length} vínculos`);

    // 2. Excluir todos os vínculos
    for (const vinculo of vinculos) {
      await base44.asServiceRole.entities.VinculoEmpresa.delete(vinculo.id);
    }

    // 3. Buscar perfis APENAS desta empresa — nunca deletar perfis de outros tenants.
    // Filtra por user_email E empresaId para não atingir usuários que pertencem a múltiplas empresas.
    const emailsUsuarios = vinculos.map(v => v.userEmail);
    const perfisParaExcluir = [];
    for (const email of emailsUsuarios) {
      const p = await base44.asServiceRole.entities.UserProfile.filter({
        user_email: email,
        empresaId,
      });
      perfisParaExcluir.push(...p);
    }
    
    console.log(`Encontrados ${perfisParaExcluir.length} perfis para excluir`);

    for (const perfil of perfisParaExcluir) {
      await base44.asServiceRole.entities.UserProfile.delete(perfil.id);
    }

    // 4. Excluir todos os convites pendentes
    const convites = await base44.asServiceRole.entities.ConviteEmpresa.filter({ empresaId });
    for (const convite of convites) {
      await base44.asServiceRole.entities.ConviteEmpresa.delete(convite.id);
    }

    // 5. Excluir a empresa
    await base44.asServiceRole.entities.Empresa.delete(empresaId);

    // 6. Registrar log
    await base44.asServiceRole.entities.RBACLog.create({
      action_type: 'profile_deleted',
      performed_by: user.email,
      details: {
        empresaId,
        vinculos_excluidos: vinculos.length,
        perfis_excluidos: perfisParaExcluir.length,
        convites_excluidos: convites.length,
        deleted_at: new Date().toISOString()
      }
    });

    return Response.json({ 
      sucesso: true,
      message: 'Empresa e todos os acessos excluídos com sucesso',
      detalhes: {
        vinculos_excluidos: vinculos.length,
        perfis_excluidos: perfisParaExcluir.length,
        convites_excluidos: convites.length
      }
    });

  } catch (error) {
    console.error('Erro ao excluir empresa:', error);
    return Response.json({ 
      error: error.message || 'Erro ao excluir empresa' 
    }, { status: 500 });
  }
});