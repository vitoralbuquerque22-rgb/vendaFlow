import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Busca vínculos ativos do usuário usando service role
    const vinculos = await base44.asServiceRole.entities.VinculoEmpresa.filter({
      userEmail: user.email,
      status: 'ativo',
    });

    if (vinculos.length === 0) return Response.json({ empresas: [] });

    // Busca as empresas correspondentes usando service role (bypassa RLS)
    // Deduplicar vínculos por empresaId (pegar o primeiro de cada empresa)
    const vinculosUnicos = Object.values(
      vinculos.reduce((acc, v) => { if (!acc[v.empresaId]) acc[v.empresaId] = v; return acc; }, {})
    );

    const todasEmpresas = await Promise.allSettled(
      vinculosUnicos.map(v => base44.asServiceRole.entities.Empresa.get(v.empresaId))
    );

    const empresas = todasEmpresas
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => {
        const empresa = r.value;
        const vinculo = vinculosUnicos.find(v => v.empresaId === empresa.id);
        return {
          id: empresa.id,
          nome: empresa.nome,
          nomeProprietario: empresa.nomeProprietario,
          plano: empresa.plano,
          limiteUsuarios: empresa.limiteUsuarios,
          statusPlano: empresa.statusPlano,
          papel: vinculo?.papel || 'sdr',
        };
      });

    return Response.json({ empresas });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});