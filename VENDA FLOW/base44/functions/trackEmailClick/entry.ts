import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const url = new URL(req.url);
    const envio_id = url.searchParams.get('envio_id');
    const lead_id = url.searchParams.get('lead_id');
    
    if (!envio_id) {
      return Response.json({ error: 'envio_id não fornecido' }, { status: 400 });
    }

    // Buscar o envio usando service role
    const envios = await base44.asServiceRole.entities.EmailEnvio.filter({ id: envio_id });
    const envio = envios[0];

    if (!envio) {
      return Response.json({ error: 'Envio não encontrado' }, { status: 404 });
    }

    // Atualizar registro de clique
    const dataClique = new Date().toISOString();
    await base44.asServiceRole.entities.EmailEnvio.update(envio_id, {
      clicou: true,
      data_clique: envio.data_clique || dataClique, // Mantém o primeiro clique
      quantidade_cliques: (envio.quantidade_cliques || 0) + 1,
    });

    // Se houver lead_id, registrar atividade
    if (lead_id) {
      try {
        const leads = await base44.asServiceRole.entities.Lead.filter({ id: lead_id });
        const lead = leads[0];
        
        if (lead) {
          await base44.asServiceRole.entities.Atividade.create({
            lead_id: lead_id,
            lead_nome: lead.nome,
            sdr_email: envio.enviado_por,
            tipo: 'email',
            resultado: 'respondeu',
            observacao: `Clicou no link do e-mail: ${envio.template_nome}`,
            campanha: lead.campanha,
            equipe: lead.equipe,
          });
        }
      } catch (error) {
        console.error('Erro ao registrar atividade:', error);
      }
    }

    // Recalcular score do lead após clique
    if (lead_id) {
      try {
        await base44.asServiceRole.functions.invoke('calcularLeadScore', { lead_id });
      } catch (err) {
        console.error('Erro ao calcular score:', err);
      }
    }

    return Response.json({ 
      success: true,
      message: 'Clique registrado com sucesso' 
    });
  } catch (error) {
    console.error('Erro ao processar clique:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});