import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { format, addDays, differenceInDays, differenceInHours } from 'npm:date-fns@3.6.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Acesso restrito a administradores' }, { status: 403 });
    }

    const hoje = new Date();
    const logs = [];
    let automacoesExecutadas = 0;

    // JUSTIFICATIVA: Job sistêmico agendado — varre todas as empresas/tenants para executar
    // automações de CRM (criar tarefas, enviar alertas, escalar leads). Nunca exposto ao frontend.
    // Requer acesso cross-tenant que o token de usuário não provê.
    const empresas = await base44.asServiceRole.entities.Empresa.filter({ statusPlano: 'ativo' });

    // 2. Processar empresa por empresa — isolamento de tenant
    for (const empresa of empresas) {
      const automacoes = await base44.asServiceRole.entities.AutomacaoRegra.filter({
        ativa: true,
        empresaId: empresa.id,
      });
      if (automacoes.length === 0) continue;

      automacoes.sort((a, b) => (a.prioridade || 1) - (b.prioridade || 1));

      const [leads, tarefas, atividades] = await Promise.all([
        base44.asServiceRole.entities.Lead.filter({ empresaId: empresa.id }),
        base44.asServiceRole.entities.Tarefa.filter({ empresaId: empresa.id }),
        base44.asServiceRole.entities.Atividade.filter({ empresaId: empresa.id }, "-created_date"),
      ]);

      for (const automacao of automacoes) {
        try {
          let leadsAfetados = [];

          switch (automacao.trigger) {
            case "mudanca_status_lead":
              if (automacao.condicoes?.status_lead?.length > 0) {
                leadsAfetados = leads.filter(l =>
                  automacao.condicoes.status_lead.includes(l.status)
                );
              }
              break;

            case "sem_atividade": {
              const diasSemAtividade = automacao.condicoes?.dias_sem_atividade || 3;
              leadsAfetados = leads.filter(l => {
                const atividadesLead = atividades.filter(a => a.lead_id === l.id);
                if (atividadesLead.length === 0) {
                  return differenceInDays(hoje, new Date(l.created_date)) >= diasSemAtividade;
                }
                return differenceInDays(hoje, new Date(atividadesLead[0].created_date)) >= diasSemAtividade;
              });
              break;
            }

            case "tarefa_atrasada": {
              const diasAtraso = automacao.condicoes?.dias_atraso || 1;
              const tarefasAtrasadas = tarefas.filter(t => {
                if (t.status !== "pendente") return false;
                return differenceInDays(hoje, new Date(t.data_prevista)) >= diasAtraso;
              });
              const leadIdsAtrasados = [...new Set(tarefasAtrasadas.map(t => t.lead_id))];
              leadsAfetados = leads.filter(l => leadIdsAtrasados.includes(l.id));
              break;
            }

            case "reuniao_proxima": {
              const horasAntes = automacao.condicoes?.horas_antes_reuniao || 24;
              leadsAfetados = leads.filter(l => {
                if (!l.data_reuniao) return false;
                const horasAteReuniao = differenceInHours(new Date(l.data_reuniao), hoje);
                return horasAteReuniao > 0 && horasAteReuniao <= horasAntes;
              });
              break;
            }

            case "novo_lead":
              leadsAfetados = leads.filter(l =>
                differenceInHours(hoje, new Date(l.created_date)) <= 2
              );
              break;
          }

          if (automacao.condicoes?.origem_lead?.length > 0) {
            leadsAfetados = leadsAfetados.filter(l =>
              automacao.condicoes.origem_lead.includes(l.origem)
            );
          }

          for (const lead of leadsAfetados) {
            const acoes = automacao.acoes || {};
            let acaoExecutada = "";

            if (automacao.tipo === "criar_tarefa" && acoes.criar_tarefa) {
              const diasFuturo = acoes.criar_tarefa.dias_futuro || 1;
              const novaTarefa = await base44.asServiceRole.entities.Tarefa.create({
                empresaId: empresa.id,
                lead_id: lead.id,
                lead_nome: lead.nome,
                lead_telefone: lead.telefone,
                lead_empresa: lead.empresa,
                sdr_email: lead.sdr_responsavel || lead.closer_responsavel,
                tipo: acoes.criar_tarefa.tipo_tarefa || "ligacao",
                data_prevista: format(addDays(hoje, diasFuturo), 'yyyy-MM-dd'),
                periodo: acoes.criar_tarefa.periodo || "manha",
                status: "pendente",
                observacao: `Tarefa criada automaticamente pela automação: ${automacao.nome}`,
              });
              acaoExecutada = `Tarefa criada: ${novaTarefa.id}`;
              automacoesExecutadas++;
            }

            if (automacao.tipo === "enviar_lembrete") {
              const destinatarios = acoes.destinatarios || [lead.sdr_responsavel];
              const mensagem = acoes.mensagem || `Lembrete: Lead ${lead.nome} precisa de atenção`;

              if (acoes.notificar_app) {
                await base44.asServiceRole.entities.Alerta.create({
                  empresaId: empresa.id,
                  tipo: "anomalia",
                  titulo: `Lembrete: ${automacao.nome}`,
                  mensagem,
                  destinatarios: destinatarios.filter(d => d),
                  prioridade: "media",
                  usuario_referencia: lead.sdr_responsavel,
                });
                acaoExecutada += "Notificação criada. ";
              }

              if (acoes.enviar_email) {
                for (const destinatario of destinatarios) {
                  if (destinatario) {
                    await base44.asServiceRole.integrations.Core.SendEmail({
                      to: destinatario,
                      subject: `Lembrete: ${automacao.nome}`,
                      body: `${mensagem}\n\nLead: ${lead.nome}\nTelefone: ${lead.telefone}\nStatus: ${lead.status}`,
                    });
                  }
                }
                acaoExecutada += "E-mails enviados. ";
              }
              automacoesExecutadas++;
            }

            if (automacao.tipo === "escalar_lead" && acoes.escalar_para) {
              await base44.asServiceRole.entities.Lead.update(lead.id, {
                closer_responsavel: acoes.escalar_para,
              });
              await base44.asServiceRole.entities.Alerta.create({
                empresaId: empresa.id,
                tipo: "anomalia",
                titulo: "Lead Escalado",
                mensagem: `O lead ${lead.nome} foi escalado para você.`,
                destinatarios: [acoes.escalar_para],
                prioridade: "alta",
              });
              acaoExecutada = `Lead escalado para ${acoes.escalar_para}`;
              automacoesExecutadas++;
            }

            if (automacao.tipo === "notificar_reuniao") {
              const destinatarios = [lead.closer_responsavel, lead.sdr_responsavel].filter(d => d);
              await base44.asServiceRole.entities.Alerta.create({
                empresaId: empresa.id,
                tipo: "anomalia",
                titulo: "Reunião Próxima",
                mensagem: `Reunião com ${lead.nome} em ${format(new Date(lead.data_reuniao), 'dd/MM/yyyy HH:mm')}`,
                destinatarios,
                prioridade: "alta",
              });
              if (acoes.enviar_email) {
                for (const destinatario of destinatarios) {
                  await base44.asServiceRole.integrations.Core.SendEmail({
                    to: destinatario,
                    subject: "Lembrete de Reunião",
                    body: `Você tem uma reunião agendada com ${lead.nome} em ${format(new Date(lead.data_reuniao), 'dd/MM/yyyy HH:mm')}.\n\nTelefone: ${lead.telefone}\nEmpresa: ${lead.empresa}`,
                  });
                }
              }
              acaoExecutada = "Notificações de reunião enviadas";
              automacoesExecutadas++;
            }

            if (acaoExecutada) {
              await base44.asServiceRole.entities.LogAutomacao.create({
                automacao_regra_id: automacao.id,
                automacao_nome: automacao.nome,
                lead_id: lead.id,
                lead_nome: lead.nome,
                acao_executada: acaoExecutada,
                status: "sucesso",
                detalhes: `Trigger: ${automacao.trigger}`,
              });
              logs.push({ automacao: automacao.nome, lead: lead.nome, acao: acaoExecutada });
            }
          }
        } catch (error) {
          await base44.asServiceRole.entities.LogAutomacao.create({
            automacao_regra_id: automacao.id,
            automacao_nome: automacao.nome,
            acao_executada: "Erro na execução",
            status: "erro",
            detalhes: error.message,
          });
        }
      } // fim for automacao
    } // fim for empresa

    return Response.json({ success: true, automacoes_executadas: automacoesExecutadas, logs });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});