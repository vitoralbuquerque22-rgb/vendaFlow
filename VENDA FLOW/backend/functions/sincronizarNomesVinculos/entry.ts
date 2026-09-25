import { createClientFromRequest } from "../../src/sdk.ts";

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }});
  }

  const CORS = { 'Access-Control-Allow-Origin': '*' };

  try {
    const api = createClientFromRequest(req);
    const user = await api.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401, headers: CORS });

    const { empresaId } = await req.json();
    if (!empresaId) return Response.json({ error: 'empresaId obrigatório' }, { status: 400, headers: CORS });

    const vinculos = await api.asServiceRole.entities.VinculoEmpresa.filter({ empresaId });

    const emails = vinculos.map(v => v.userEmail).filter(Boolean);
    const profiles = await Promise.all(
      emails.map(email =>
        api.asServiceRole.entities.UserProfile.filter({ user_email: email })
          .then(r => r[0] || null)
          .catch(() => null)
      )
    );

    const profileMap = new Map();
    profiles.filter(Boolean).forEach(p => {
      if (p.user_email && p.user_name?.trim()) {
        profileMap.set(p.user_email.toLowerCase(), p.user_name.trim());
      }
    });

    let atualizados = 0;
    for (const v of vinculos) {
      if (v.userName?.trim()) continue;
      const nome = profileMap.get((v.userEmail || '').toLowerCase());
      if (nome) {
        await api.asServiceRole.entities.VinculoEmpresa.update(v.id, { userName: nome });
        atualizados++;
      }
    }

    return Response.json({
      success: true,
      total_vinculos: vinculos.length,
      atualizados,
      mensagem: `${atualizados} vínculo(s) atualizado(s) com nomes do UserProfile`,
    }, { headers: CORS });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
};
