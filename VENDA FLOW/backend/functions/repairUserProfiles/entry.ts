import { createClientFromRequest } from "../../src/sdk.ts";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  try {
    const api = createClientFromRequest(req);
    const user = await api.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });

    // Somente admin global da plataforma — admin de tenant não pode reparar perfis de outros usuários
    if (user.role !== 'admin') {
      return Response.json({ error: 'Sem permissão — somente admin global da plataforma' }, { status: 403 });
    }

    let body;
    try { body = await req.json(); } catch { return Response.json({ error: 'Body inválido' }, { status: 400 }); }
    const { empresaId, confirmar = false } = body;
    if (!empresaId) return Response.json({ error: 'empresaId obrigatório' }, { status: 400 });

    // JUSTIFICATIVA: Ferramenta de manutenção administrativa — cria UserProfiles ausentes para
    // vínculos de empresa. Chamado manualmente por admin global. Requer acesso cross-user
    // para reparar dados de múltiplos usuários. Nunca exposto ao frontend regular.
    const vinculos = await api.asServiceRole.entities.VinculoEmpresa.filter({
      empresaId,
      status: 'ativo',
    });
    console.log(`[repairUserProfiles] vínculos ativos: ${vinculos.length}`);

    // Buscar todos os UserProfiles existentes da empresa
    const profilesExistentes = await api.asServiceRole.entities.UserProfile.filter({ empresaId });
    const emailsComPerfil = new Set(profilesExistentes.map((p) => p.user_email?.toLowerCase()));
    console.log(`[repairUserProfiles] perfis existentes: ${profilesExistentes.length}`);

    // Identificar vínculos sem perfil
    const semPerfil = vinculos.filter((v) =>
      v.userEmail && !emailsComPerfil.has(v.userEmail.toLowerCase())
    );
    console.log(`[repairUserProfiles] sem perfil: ${semPerfil.length}`);

    if (semPerfil.length === 0) {
      return Response.json({
        mensagem: 'Todos os usuários já têm UserProfile.',
        total_vinculos: vinculos.length,
        ja_tem_perfil: profilesExistentes.length,
        sem_perfil: 0,
      }, { headers: CORS });
    }

    // Dry-run
    if (!confirmar) {
      return Response.json({
        mensagem: `${semPerfil.length} usuários sem UserProfile. Envie confirmar=true para criar.`,
        total_vinculos: vinculos.length,
        ja_tem_perfil: profilesExistentes.length,
        sem_perfil: semPerfil.length,
        preview: semPerfil.map((v) => ({ email: v.userEmail, papel: v.papel })),
      }, { headers: CORS });
    }

    // Criar perfis
    let criados = 0;
    let erros = 0;
    for (const vinculo of semPerfil) {
      try {
        await api.asServiceRole.entities.UserProfile.create({
          user_email: vinculo.userEmail,
          user_name: vinculo.userName || vinculo.userEmail,
          empresaId,
          role: vinculo.papel || 'sdr',
          is_active: true,
          assigned_by: 'repair',
        });
        criados++;
        console.log(`[repairUserProfiles] criado: ${vinculo.userEmail}`);
      } catch (e) {
        console.error(`[repairUserProfiles] erro ${vinculo.userEmail}:`, e.message);
        erros++;
      }
    }

    return Response.json({
      mensagem: `${criados} UserProfiles criados com sucesso.`,
      criados,
      erros,
      total_vinculos: vinculos.length,
    }, { headers: CORS });

  } catch (e) {
    console.error('[repairUserProfiles] erro crítico:', e.message);
    return Response.json({ error: e.message }, { status: 500, headers: CORS });
  }
};
