import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const agora = new Date();
    
    // JUSTIFICATIVA: Job sistêmico agendado — envia e-mails em massa para leads conforme
    // campanhas agendadas. Requer acesso cross-SDR a Lead, EmailEnvio e CampanhaAgendada.
    // Nunca exposto ao frontend como ação de usuário individual.
    const campanhasPendentes = await base44.asServiceRole.entities.CampanhaAgendada.filter({
      status: 'pendente'
    });

    const campanhasParaEnviar = campanhasPendentes.filter(c => 
      new Date(c.data_envio) <= agora
    );

    let totalProcessadas = 0;
    let totalSucesso = 0;
    let totalErro = 0;

    for (const campanha of campanhasParaEnviar) {
      try {
        totalProcessadas++;

        // Buscar template
        const template = await base44.asServiceRole.entities.EmailTemplate.read(campanha.template_id);
        
        if (!template) {
          await base44.asServiceRole.entities.CampanhaAgendada.update(campanha.id, {
            status: 'erro',
            erro_mensagem: 'Template não encontrado',
            data_execucao: agora.toISOString()
          });
          totalErro++;
          continue;
        }

        // Buscar leads elegíveis — SEMPRE filtrado por empresaId da campanha (nunca cross-tenant)
        const empresaId = campanha.empresaId;
        if (!empresaId) {
          await base44.asServiceRole.entities.CampanhaAgendada.update(campanha.id, {
            status: 'erro',
            erro_mensagem: 'Campanha sem empresaId — abortado por segurança',
            data_execucao: agora.toISOString()
          });
          totalErro++;
          continue;
        }

        const leadsQuery = { empresaId };
        if (campanha.filtro_status && campanha.filtro_status !== 'todos') leadsQuery.status = campanha.filtro_status;
        if (campanha.filtro_origem && campanha.filtro_origem !== 'todas') leadsQuery.origem = campanha.filtro_origem;

        const leads = await base44.asServiceRole.entities.Lead.filter(leadsQuery);
        const leadsElegiveis = leads.filter(lead => !!lead.email);

        let sucessos = 0;
        let falhas = 0;

        // Enviar para cada lead
        for (const lead of leadsElegiveis) {
          try {
            // Criar registro de envio
            const envio = await base44.asServiceRole.entities.EmailEnvio.create({
              template_id: template.id,
              template_nome: template.nome,
              destinatario_email: lead.email,
              destinatario_nome: lead.nome,
              lead_id: lead.id,
              assunto: template.assunto,
              status: 'enviado',
              enviado_por: campanha.enviado_por,
            });

            // Personalizar corpo
            let corpoPersonalizado = template.corpo
              .replace(/\{nome\}/g, lead.nome || '')
              .replace(/\{empresa\}/g, lead.empresa || '')
              .replace(/\{dores_mapeadas\}/g, lead.respostas_formulario || '');

            // Tornar TODOS os links rastreáveis
            if (envio.id && lead.id) {
              const baseUrl = 'https://' + req.headers.get('host');
              
              // 1. Substituir padrão URL_DESTINO=
              corpoPersonalizado = corpoPersonalizado.replace(
                /URL_DESTINO=([^\s<]+)/g,
                (match, url) => `${baseUrl}/EmailRedirect?envio_id=${envio.id}&lead_id=${lead.id}&destino=${encodeURIComponent(url)}`
              );
              
              // 2. Tornar todos os links HTML rastreáveis
              corpoPersonalizado = corpoPersonalizado.replace(
                /<a\s+([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi,
                (match, before, url, after) => {
                  if (url.includes('/EmailRedirect')) {
                    return match;
                  }
                  const linkRastreavel = `${baseUrl}/EmailRedirect?envio_id=${envio.id}&lead_id=${lead.id}&destino=${encodeURIComponent(url)}`;
                  return `<a ${before}href="${linkRastreavel}"${after}>`;
                }
              );
            }

            // Enviar email
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: lead.email,
              subject: template.assunto,
              body: corpoPersonalizado,
              from_name: campanha.enviado_por?.split('@')[0] || 'CRM',
            });

            sucessos++;
          } catch (error) {
            falhas++;
            console.error('Erro ao enviar para', lead.email, error);
          }
        }

        // Atualizar campanha
        await base44.asServiceRole.entities.CampanhaAgendada.update(campanha.id, {
          status: 'enviado',
          total_enviados: sucessos,
          total_falhas: falhas,
          data_execucao: agora.toISOString()
        });

        // Se faz parte de uma sequência, agendar a próxima
        if (campanha.sequencia_id) {
          const proximaCampanha = await base44.asServiceRole.entities.CampanhaAgendada.filter({
            sequencia_id: campanha.sequencia_id,
            ordem_sequencia: (campanha.ordem_sequencia || 0) + 1,
            status: 'pendente'
          });

          if (proximaCampanha.length > 0) {
            const proxima = proximaCampanha[0];
            if (proxima.dias_apos_anterior) {
              const novaData = new Date(agora);
              novaData.setDate(novaData.getDate() + proxima.dias_apos_anterior);
              
              await base44.asServiceRole.entities.CampanhaAgendada.update(proxima.id, {
                data_envio: novaData.toISOString()
              });
            }
          }
        }

        totalSucesso++;
      } catch (error) {
        totalErro++;
        console.error('Erro ao processar campanha', campanha.id, error);
        
        await base44.asServiceRole.entities.CampanhaAgendada.update(campanha.id, {
          status: 'erro',
          erro_mensagem: error.message,
          data_execucao: agora.toISOString()
        });
      }
    }

    return Response.json({
      success: true,
      processadas: totalProcessadas,
      sucesso: totalSucesso,
      erro: totalErro
    });

  } catch (error) {
    console.error('Erro geral:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});