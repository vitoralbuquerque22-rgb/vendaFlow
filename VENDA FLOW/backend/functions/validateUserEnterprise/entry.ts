import { createClientFromRequest } from "../../src/sdk.ts";

export default async (req) => {
  try {
    const api = createClientFromRequest(req);
    const user = await api.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar empresa atual do usuário
    const userProfile = await api.auth.me();
    
    if (!userProfile.empresaAtualId) {
      return Response.json({ needsSelection: true });
    }

    // Validar se o usuário tem acesso a essa empresa
    const vinculos = await api.asServiceRole.entities.VinculoEmpresa.filter({
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
};
