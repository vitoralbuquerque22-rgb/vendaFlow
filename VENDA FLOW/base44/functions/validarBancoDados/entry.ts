import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Somente admin global (super_admin) pode ver dados de todos os tenants
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Apenas administradores globais podem validar o banco' }, { status: 403 });
    }

    const erros = [];
    const avisos = [];

    // 1. Buscar todas as empresas
    const empresas = await base44.asServiceRole.entities.Empresa.list();
    
    console.log('=== VALIDANDO EMPRESAS ===');
    console.log(`Total de empresas: ${empresas.length}`);
    
    if (empresas.length === 0) {
      avisos.push('⚠️ Nenhuma empresa encontrada no banco');
    }

    const empresasIds = new Set();
    empresas.forEach((empresa, index) => {
      console.log(`Empresa ${index + 1}:`, {
        id: empresa.id,
        nome: empresa.nome,
        ownerEmail: empresa.ownerEmail
      });

      if (!empresa.id) {
        erros.push(`❌ Empresa "${empresa.nome}" sem ID!`);
      } else {
        empresasIds.add(empresa.id);
      }

      if (!empresa.ownerEmail) {
        erros.push(`❌ Empresa "${empresa.nome}" (${empresa.id}) sem ownerEmail!`);
      }
    });

    // 2. Buscar todos os vínculos
    const vinculos = await base44.asServiceRole.entities.VinculoEmpresa.list();
    
    console.log('=== VALIDANDO VÍNCULOS ===');
    console.log(`Total de vínculos: ${vinculos.length}`);
    
    vinculos.forEach((vinculo, index) => {
      console.log(`Vínculo ${index + 1}:`, {
        id: vinculo.id,
        empresaId: vinculo.empresaId,
        userEmail: vinculo.userEmail,
        papel: vinculo.papel
      });

      if (!vinculo.empresaId) {
        erros.push(`❌ Vínculo ID ${vinculo.id} sem empresaId!`);
      } else if (!empresasIds.has(vinculo.empresaId)) {
        erros.push(`❌ Vínculo ID ${vinculo.id} aponta para empresa inexistente: ${vinculo.empresaId}`);
      }

      if (!vinculo.userEmail) {
        erros.push(`❌ Vínculo ID ${vinculo.id} sem userEmail!`);
      }
    });

    // 3. Buscar todos os convites
    const convites = await base44.asServiceRole.entities.ConviteEmpresa.list();
    
    console.log('=== VALIDANDO CONVITES ===');
    console.log(`Total de convites: ${convites.length}`);
    
    convites.forEach((convite, index) => {
      console.log(`Convite ${index + 1}:`, {
        id: convite.id,
        empresaId: convite.empresaId,
        email: convite.email,
        status: convite.status,
        codigo: convite.codigo
      });

      if (!convite.empresaId) {
        erros.push(`❌ Convite ID ${convite.id} sem empresaId!`);
      } else if (!empresasIds.has(convite.empresaId)) {
        erros.push(`❌ Convite ID ${convite.id} aponta para empresa inexistente: ${convite.empresaId}`);
      }

      if (!convite.email) {
        erros.push(`❌ Convite ID ${convite.id} sem email!`);
      }

      if (!convite.codigo) {
        erros.push(`❌ Convite ID ${convite.id} sem código!`);
      }
    });

    // 4. Verificar vínculos duplicados
    const vinculosMap = new Map();
    vinculos.forEach(vinculo => {
      const chave = `${vinculo.empresaId}-${vinculo.userEmail}`;
      if (vinculosMap.has(chave)) {
        avisos.push(`⚠️ Vínculo duplicado: ${vinculo.userEmail} na empresa ${vinculo.empresaId}`);
      }
      vinculosMap.set(chave, vinculo);
    });

    // 5. Verificar convites expirados ainda pendentes
    const hoje = new Date();
    convites.forEach(convite => {
      if (convite.status === 'pendente' && convite.expiraEm) {
        const expira = new Date(convite.expiraEm);
        if (expira < hoje) {
          avisos.push(`⚠️ Convite ${convite.codigo} (${convite.email}) expirado mas ainda marcado como pendente`);
        }
      }
    });

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      estatisticas: {
        total_empresas: empresas.length,
        total_vinculos: vinculos.length,
        total_convites: convites.length,
        convites_pendentes: convites.filter(c => c.status === 'pendente').length,
        convites_aceitos: convites.filter(c => c.status === 'aceito').length,
      },
      empresas: empresas.map(e => ({
        id: e.id,
        nome: e.nome,
        ownerEmail: e.ownerEmail,
        created_date: e.created_date
      })),
      erros,
      avisos,
      status: erros.length === 0 ? '✅ Banco de dados OK' : '❌ Erros encontrados'
    });

  } catch (error) {
    console.error('Erro ao validar banco:', error);
    return Response.json({ 
      success: false,
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});