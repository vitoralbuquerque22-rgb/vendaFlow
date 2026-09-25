import { createClientFromRequest } from "../../src/sdk.ts";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay } from 'npm:date-fns@3.6.0';

export default async (req) => {
  try {
    const api = createClientFromRequest(req);
    const user = await api.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Acesso restrito a administradores' }, { status: 403 });
    }

    const hoje = new Date();
    const alertasDisparados = [];

    // JUSTIFICATIVA: Job sistêmico agendado — varre todas as empresas/tenants para avaliar
    // configurações de alerta e disparar notificações. Nunca exposto ao frontend.
    // Requer acesso cross-tenant e à tabela global de User que o token de usuário não provê.
    const empresas = await api.asServiceRole.entities.Empresa.filter({ statusPlano: 'ativo' });

    // Usuários buscados uma vez (sem filtro de empresa — tabela global)
    const usuarios = await api.asServiceRole.entities.User.list();

    // 2. Processar empresa por empresa — isolamento de tenant
    for (const empresa of empresas) {
      const configuracoes = await api.asServiceRole.entities.ConfiguracaoAlerta.filter({
        ativo: true,
        empresaId: empresa.id,
      });
      if (configuracoes.length === 0) continue;

      const [leads, atividades, tarefas, configMeta] = await Promise.all([
        api.asServiceRole.entities.Lead.filter({ empresaId: empresa.id }),
        api.asServiceRole.entities.Atividade.filter({ empresaId: empresa.id }),
        api.asServiceRole.entities.Tarefa.filter({ empresaId: empresa.id }),
        api.asServiceRole.entities.ConfiguracaoMeta.filter({ empresaId: empresa.id }),
      ]);

      const metaEmpresa = configMeta[0] || {};

      for (const config of configuracoes) {
        let deveMostrarAlerta = false;
        let valorAtual = 0;
        let valorEsperado = config.valor_threshold;
        let titulo = '';
        let mensagem = '';
        let prioridade = 'media';
        let usuarioRef = null;
        let equipeRef = null;

        let dataInicio, dataFim;
        if (config.periodo_avaliacao === 'diario') {
          dataInicio = startOfDay(hoje);
          dataFim = endOfDay(hoje);
        } else if (config.periodo_avaliacao === 'semanal') {
          dataInicio = startOfWeek(hoje);
          dataFim = endOfWeek(hoje);
        } else {
          dataInicio = startOfMonth(hoje);
          dataFim = endOfMonth(hoje);
        }

        const atividadesPeriodo = atividades.filter(a => {
          const d = new Date(a.created_date);
          return d >= dataInicio && d <= dataFim;
        });
        const leadsPeriodo = leads.filter(l => {
          const d = new Date(l.created_date);
          return d >= dataInicio && d <= dataFim;
        });
        const tarefasPeriodo = tarefas.filter(t => {
          const d = new Date(t.created_date);
          return d >= dataInicio && d <= dataFim;
        });

        if (config.escopo === 'individual' && config.usuario_especifico) {
          usuarioRef = config.usuario_especifico;
          const usuario = usuarios.find(u => u.email === config.usuario_especifico);
          switch (config.metrica) {
            case 'leads':
              valorAtual = leadsPeriodo.filter(l => l.sdr_responsavel === config.usuario_especifico).length;
              valorEsperado = usuario?.meta_mensal?.leads || config.valor_threshold;
              break;
            case 'ligacoes':
              valorAtual = atividadesPeriodo.filter(a => a.tipo === 'ligacao' && a.sdr_email === config.usuario_especifico).length;
              valorEsperado = usuario?.meta_mensal?.ligacoes || config.valor_threshold;
              break;
            case 'reunioes_marcadas':
              valorAtual = atividadesPeriodo.filter(a => a.tipo === 'reuniao_agendada' && a.sdr_email === config.usuario_especifico).length;
              valorEsperado = usuario?.meta_mensal?.reunioes_agendadas || config.valor_threshold;
              break;
            case 'reunioes_realizadas':
              valorAtual = atividadesPeriodo.filter(a => a.tipo === 'reuniao_realizada' && a.sdr_email === config.usuario_especifico).length;
              valorEsperado = usuario?.meta_mensal?.reunioes_realizadas || config.valor_threshold;
              break;
            case 'tarefas_concluidas':
              valorAtual = tarefasPeriodo.filter(t => t.status === 'concluida' && t.sdr_email === config.usuario_especifico).length;
              valorEsperado = usuario?.meta_mensal?.tarefas_concluidas || config.valor_threshold;
              break;
            case 'vendas':
              valorAtual = leadsPeriodo.filter(l => l.status === 'qualificado' && l.closer_responsavel === config.usuario_especifico).length;
              valorEsperado = usuario?.meta_mensal?.vendas || config.valor_threshold;
              break;
          }
        } else if (config.escopo === 'empresa') {
          switch (config.metrica) {
            case 'leads':
              valorAtual = leadsPeriodo.length;
              valorEsperado = metaEmpresa.meta_leads || config.valor_threshold;
              break;
            case 'mql':
              valorAtual = leadsPeriodo.filter(l => l.status !== 'novo' && l.status !== 'desqualificado').length;
              valorEsperado = metaEmpresa.meta_mql || config.valor_threshold;
              break;
            case 'conexoes':
              valorAtual = atividadesPeriodo.filter(a => a.resultado === 'respondeu' || a.resultado === 'atendeu').length;
              valorEsperado = metaEmpresa.meta_conexoes || config.valor_threshold;
              break;
            case 'reunioes_marcadas':
              valorAtual = atividadesPeriodo.filter(a => a.tipo === 'reuniao_agendada').length;
              valorEsperado = metaEmpresa.meta_rm || config.valor_threshold;
              break;
            case 'reunioes_realizadas':
              valorAtual = atividadesPeriodo.filter(a => a.tipo === 'reuniao_realizada').length;
              valorEsperado = metaEmpresa.meta_rr || config.valor_threshold;
              break;
            case 'vendas':
              valorAtual = leadsPeriodo.filter(l => l.status === 'qualificado').length;
              valorEsperado = metaEmpresa.meta_vendas || config.valor_threshold;
              break;
            case 'faturamento':
              valorAtual = leadsPeriodo.filter(l => l.status === 'qualificado').reduce((sum, l) => sum + (l.valor_potencial || 0), 0);
              valorEsperado = metaEmpresa.meta_faturamento_total || config.valor_threshold;
              break;
          }
        }

        if (config.condicao === 'percentual_meta') {
          const percentual = (valorAtual / valorEsperado) * 100;
          if (config.tipo === 'meta_em_risco' && percentual < config.valor_threshold) {
            deveMostrarAlerta = true;
            prioridade = percentual < 50 ? 'critica' : percentual < 70 ? 'alta' : 'media';
          } else if (config.tipo === 'meta_atingida' && percentual >= config.valor_threshold) {
            deveMostrarAlerta = true;
            prioridade = 'baixa';
          }
        } else {
          switch (config.condicao) {
            case 'maior_que':    deveMostrarAlerta = valorAtual > valorEsperado; break;
            case 'menor_que':    deveMostrarAlerta = valorAtual < valorEsperado; prioridade = 'alta'; break;
            case 'igual_a':      deveMostrarAlerta = valorAtual === valorEsperado; break;
            case 'maior_igual':  deveMostrarAlerta = valorAtual >= valorEsperado; break;
            case 'menor_igual':  deveMostrarAlerta = valorAtual <= valorEsperado; break;
          }
        }

        if (deveMostrarAlerta) {
          const metricaNome = {
            leads: 'Leads', mql: 'MQL', conexoes: 'Conexões',
            reunioes_marcadas: 'Reuniões Marcadas', reunioes_realizadas: 'Reuniões Realizadas',
            vendas: 'Vendas', faturamento: 'Faturamento',
            ligacoes: 'Ligações', tarefas_concluidas: 'Tarefas Concluídas',
          }[config.metrica] || config.metrica;

          if (config.tipo === 'meta_atingida') {
            titulo = `🎉 Meta Atingida: ${metricaNome}`;
            mensagem = `Parabéns! A meta de ${metricaNome.toLowerCase()} foi atingida. Valor atual: ${valorAtual}, Meta: ${valorEsperado}`;
          } else if (config.tipo === 'meta_em_risco') {
            titulo = `⚠️ Meta em Risco: ${metricaNome}`;
            mensagem = `Atenção! A meta de ${metricaNome.toLowerCase()} está em risco. Valor atual: ${valorAtual} (${((valorAtual/valorEsperado)*100).toFixed(1)}% da meta)`;
          } else if (config.tipo === 'baixa_performance') {
            titulo = `📉 Baixa Performance: ${metricaNome}`;
            mensagem = `Performance abaixo do esperado em ${metricaNome.toLowerCase()}. Valor atual: ${valorAtual}, Esperado: ${valorEsperado}`;
          } else if (config.tipo === 'alta_performance') {
            titulo = `📈 Alta Performance: ${metricaNome}`;
            mensagem = `Performance excepcional em ${metricaNome.toLowerCase()}! Valor atual: ${valorAtual}, Meta: ${valorEsperado}`;
          }

          const alertasRecentes = await api.asServiceRole.entities.Alerta.filter({
            configuracao_alerta_id: config.id,
            resolvido: false,
          });
          const umDiaAtras = new Date(hoje.getTime() - 24 * 60 * 60 * 1000);
          const jaTemAlertaRecente = alertasRecentes.some(a => new Date(a.created_date) > umDiaAtras);

          if (!jaTemAlertaRecente) {
            const novoAlerta = await api.asServiceRole.entities.Alerta.create({
              empresaId: empresa.id,
              configuracao_alerta_id: config.id,
              tipo: config.tipo,
              titulo,
              mensagem,
              metrica: config.metrica,
              valor_atual: valorAtual,
              valor_esperado: valorEsperado,
              destinatarios: config.destinatarios,
              prioridade,
              usuario_referencia: usuarioRef,
              equipe_referencia: equipeRef,
              periodo_referencia: format(hoje, 'yyyy-MM'),
            });
            alertasDisparados.push(novoAlerta);

            if (config.enviar_email && config.destinatarios?.length > 0) {
              for (const destinatario of config.destinatarios) {
                await api.asServiceRole.integrations.Core.SendEmail({
                  to: destinatario,
                  subject: titulo,
                  body: mensagem,
                });
              }
            }
          }
        }
      } // fim for config
    } // fim for empresa

    return Response.json({ success: true, alertas_disparados: alertasDisparados.length, alertas: alertasDisparados });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
};
