import { createClientFromRequest } from "../../src/sdk.ts";

export default async (req) => {
  try {
    const api = createClientFromRequest(req);
    const user = await api.auth.me();
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { empresaId, userEmail, userName, papel } = await req.json();

    // Admin global pode vincular em qualquer empresa; admin de tenant só na própria empresa
    if (user.role !== 'admin') {
      const adminVinculo = await api.asServiceRole.entities.VinculoEmpresa.filter({
        userEmail: user.email, empresaId, papel: 'admin',
      });
      if (adminVinculo.length === 0) {
        return Response.json({ error: 'Forbidden: Sem permissão de admin nesta empresa' }, { status: 403 });
      }
    }

    if (!empresaId || !userEmail || !papel) {
      return Response.json({ error: 'empresaId, userEmail e papel são obrigatórios' }, { status: 400 });
    }

    // 1. Criar ou atualizar VinculoEmpresa via service role
    const vinculos = await api.asServiceRole.entities.VinculoEmpresa.filter({ empresaId, userEmail });
    let vinculo;
    if (vinculos.length > 0) {
      vinculo = await api.asServiceRole.entities.VinculoEmpresa.update(vinculos[0].id, { papel, status: 'ativo', userName });
    } else {
      vinculo = await api.asServiceRole.entities.VinculoEmpresa.create({ empresaId, userEmail, userName: userName || userEmail, papel, status: 'ativo' });
    }

    // 2. Atualizar UserProfile com empresaAtualId
    const profiles = await api.asServiceRole.entities.UserProfile.filter({ user_email: userEmail });
    let perfil = null;
    if (profiles.length > 0) {
      perfil = await api.asServiceRole.entities.UserProfile.update(profiles[0].id, { empresaAtualId: empresaId });
    }

    // 3. Atualizar o User (auth) com empresaAtualId via updateMe não é possível para outros users,
    //    mas o campo data.empresaAtualId é lido de UserProfile, então o passo 2 é suficiente.

    return Response.json({ success: true, vinculo_id: vinculo.id, perfil_id: perfil?.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
};
