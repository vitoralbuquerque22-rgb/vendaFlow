import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar empresa atual do usuário
    const userProfile = await base44.auth.me();
    
    if (!userProfile.empresaAtualId) {
      return Response.json({ needsSelection: true });
    }

    // Validar se o usuário tem acesso a essa empresa
    const vinculos = await base44.asServiceRole.entities.VinculoEmpresa.filter({
      userEmail: user.email,
      empresaId: userProfile.empresaAtualId,
      status: 'ativo'
    });

    if (vinculos.length === 0) {
      return Response.json({ needsSelection: true });
    }

    return Response.json({ 
      valid: true, 
      empresaId: userProfile.empresaAtualId 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});