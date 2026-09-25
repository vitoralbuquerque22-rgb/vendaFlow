import { createClientFromRequest } from "../../src/sdk.ts";

export default async (req) => {
  try {
    const api = createClientFromRequest(req);
    const user = await api.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { empresaId } = await req.json();

    if (!empresaId) {
      return Response.json({ error: 'empresaId obrigatório' }, { status: 400 });
    }

    // Buscar empresa pelo ID
    const empresas = await api.asServiceRole.entities.Empresa.filter({ id: empresaId });
    const empresa = empresas[0];

    if (!empresa) {
      return Response.json({ error: 'Empresa não encontrada' }, { status: 404 });
    }

    // Buscar vínculos da empresa
    const vinculos = await api.asServiceRole.entities.VinculoEmpresa.filter({
      empresaId: empresa.id
    });

    // Buscar apenas os usuários vinculados à empresa (emails dos vínculos)
    const emailsVinculados = vinculos.map(v => v.userEmail).filter(Boolean);
    const [usuariosArr, profilesArr] = await Promise.all([
      Promise.all(
        emailsVinculados.map(email =>
          api.asServiceRole.entities.User.filter({ email }).then(r => r[0] || null)
        )
      ),
      Promise.all(
        emailsVinculados.map(email =>
          api.asServiceRole.entities.UserProfile.filter({ user_email: email }).then(r => r[0] || null)
        )
      ),
    ]);
    const usuarios = usuariosArr.filter(Boolean);
    const profiles = profilesArr.filter(Boolean);

    // Mapear colaboradores com dados completos
    // UserProfile.user_name é a fonte de verdade para o nome exibido no sistema
    const colaboradores = vinculos.map(vinculo => {
      const usuario = usuarios.find(u => u.email === vinculo.userEmail);
      const profile = profiles.find(p => p.user_email === vinculo.userEmail);
      return {
        nome: profile?.user_name || usuario?.full_name || 'Nome não disponível',
        email: vinculo.userEmail,
        funcao: vinculo.papel,
        status: vinculo.status,
        ultimoLogin: usuario?.last_sign_in_at || null
      };
    });

    return Response.json({
      empresa: {
        id: empresa.id,
        nome: empresa.nome,
        cnpj: empresa.cnpj
      },
      totalColaboradores: colaboradores.length,
      colaboradores: colaboradores.sort((a, b) => a.nome.localeCompare(b.nome))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
};
