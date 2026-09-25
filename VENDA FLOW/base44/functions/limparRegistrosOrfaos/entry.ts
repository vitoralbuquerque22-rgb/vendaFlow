import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Apenas admin pode limpar
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // JUSTIFICATIVA: Ferramenta de manutenção — remove vínculos e convites órfãos (empresa excluída).
    // Requer varredura cross-tenant de todas as entidades. Restrito a admin global.
    // Nunca exposto ao frontend regular.
    const empresas = await base44.asServiceRole.entities.Empresa.list();
    const idsEmpresas = new Set(empresas.map(e => e.id));

    // Buscar todos os vínculos
    const vinculos = await base44.asServiceRole.entities.VinculoEmpresa.list();
    const vinculosOrfaos = vinculos.filter(v => !idsEmpresas.has(v.empresaId));

    // Buscar todos os convites
    const convites = await base44.asServiceRole.entities.ConviteEmpresa.list();
    const convitesOrfaos = convites.filter(c => !idsEmpresas.has(c.empresaId));

    // Deletar vínculos órfãos
    let vinculosDeletados = 0;
    for (const vinculo of vinculosOrfaos) {
      await base44.asServiceRole.entities.VinculoEmpresa.delete(vinculo.id);
      vinculosDeletados++;
    }

    // Deletar convites órfãos
    let convitesDeletados = 0;
    for (const convite of convitesOrfaos) {
      await base44.asServiceRole.entities.ConviteEmpresa.delete(convite.id);
      convitesDeletados++;
    }

    return Response.json({
      success: true,
      message: `Limpeza concluída! ${vinculosDeletados} vínculos e ${convitesDeletados} convites removidos.`,
      vinculosDeletados,
      convitesDeletados,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});