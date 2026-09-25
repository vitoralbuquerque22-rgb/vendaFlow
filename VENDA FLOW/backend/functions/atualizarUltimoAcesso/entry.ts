import { createClientFromRequest } from "../../src/sdk.ts";

export default async (req) => {
  try {
    const api = createClientFromRequest(req);
    const user = await api.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { empresaId } = await req.json();

    if (!empresaId) {
      return Response.json({ error: 'empresaId é obrigatório' }, { status: 400 });
    }

    // JUSTIFICATIVA: Rastreamento de acesso do usuário autenticado — atualiza ultimoAcesso no
    // VinculoEmpresa e cria LogAcesso. VinculoEmpresa tem RLS restrita; o usuário não pode
    // editar seu próprio vínculo pelo token de usuário (apenas leitura via RLS). Por isso
    // asServiceRole é necessário para a escrita. Operação controlada: só altera o próprio vínculo.
    const vinculos = await api.asServiceRole.entities.VinculoEmpresa.filter({
      empresaId,
      userEmail: user.email,
      status: 'ativo'
    });

    if (vinculos.length === 0) {
      return Response.json({ error: 'Vínculo não encontrado' }, { status: 404 });
    }

    // Atualizar último acesso
    const vinculo = vinculos[0];
    await api.asServiceRole.entities.VinculoEmpresa.update(vinculo.id, {
      ultimoAcesso: new Date().toISOString()
    });

    // Registrar log de acesso
    const { tipo_evento, pagina, campanha_id, campanha_nome, duracao_segundos, session_id } = await req.json().catch(() => ({}));
    
    await api.asServiceRole.entities.LogAcesso.create({
      user_email: user.email,
      user_nome: user.full_name || user.email,
      empresaId,
      tipo_evento: tipo_evento || "login",
      pagina: pagina || null,
      campanha_id: campanha_id || null,
      campanha_nome: campanha_nome || null,
      duracao_segundos: duracao_segundos || null,
      session_id: session_id || null,
      registrado_em: new Date().toISOString()
    });

    return Response.json({ 
      success: true,
      ultimoAcesso: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
};
