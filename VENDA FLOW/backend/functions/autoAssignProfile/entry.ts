import { createClientFromRequest } from "../../src/sdk.ts";

export default async (req) => {
  try {
    const api = createClientFromRequest(req);

    // Validar secret interno — endpoint chamado apenas por automações backend
    const secret = req.headers.get('X-Internal-Secret');
    const expectedSecret = Deno.env.get('INTERNAL_API_SECRET');
    if (!expectedSecret || secret !== expectedSecret) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user_email, user_name, empresaId, role } = await req.json();
    // Allowlist de roles permitidos; qualquer valor fora da lista vira 'sdr'
    const ROLES_PERMITIDOS = ['admin', 'gestor', 'gestor_empresa', 'gerente_empresa', 'gerente_filial', 'supervisor', 'sdr', 'closer', 'cs', 'social_seller', 'marketing'];
    const roleAtribuido = ROLES_PERMITIDOS.includes(role) ? role : 'sdr';

    if (!user_email) {
      return Response.json({ error: 'Email é obrigatório' }, { status: 400 });
    }

    const existingProfiles = await api.asServiceRole.entities.UserProfile.filter({
      user_email
    });

    if (existingProfiles.length > 0) {
      return Response.json({
        message: 'Usuário já possui perfil',
        profile: existingProfiles[0]
      });
    }

    const templates = await api.asServiceRole.entities.ProfileTemplate.filter({
      role: 'sdr',
      is_default: true,
      is_active: true
    });

    const defaultTemplate = templates[0];

    const newProfile = await api.asServiceRole.entities.UserProfile.create({
      user_email,
      user_name: user_name || user_email,
      empresaId: empresaId || null,
      role: roleAtribuido,
      permissions: defaultTemplate?.permissions || { pages: {}, features: {} },
      is_active: true,
      assigned_by: 'system'
    });

    await api.asServiceRole.entities.RBACLog.create({
      action_type: 'profile_created',
      user_email,
      performed_by: 'system',
      details: { role: roleAtribuido, auto_assigned: true }
    });

    return Response.json({
      success: true,
      profile: newProfile,
      message: 'Perfil SDR atribuído automaticamente'
    });

  } catch (error) {
    console.error('Erro ao atribuir perfil:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
};
