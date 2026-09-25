import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tarefa_id } = await req.json();

    // Buscar tarefa
    const tarefa = await base44.entities.Tarefa.filter({ id: tarefa_id });
    if (!tarefa.length) {
      return Response.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    const tarefaData = tarefa[0];

    // Buscar integração Google Calendar ativa — escopada ao tenant do usuário
    const empresaId = tarefaData.empresaId || user.empresaAtualId;
    if (!empresaId) {
      return Response.json({ error: 'Empresa não identificada' }, { status: 400 });
    }

    const integracoes = await base44.asServiceRole.entities.Integracao.filter({
      tipo: 'google_calendar',
      ativa: true,
      empresaId,
    });

    if (!integracoes.length) {
      return Response.json({ error: 'Google Calendar não conectado' }, { status: 400 });
    }

    // Obter token de acesso
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlecalendar');

    // Preparar dados do evento
    const evento = {
      summary: `${tarefaData.tipo.toUpperCase()}: ${tarefaData.lead_nome}`,
      description: `Lead: ${tarefaData.lead_nome}\nTelefone: ${tarefaData.lead_telefone}\nEmpresa: ${tarefaData.lead_empresa}\nObservações: ${tarefaData.observacao || 'N/A'}`,
      start: {
        dateTime: new Date(tarefaData.data_prevista).toISOString(),
        timeZone: 'America/Sao_Paulo'
      },
      end: {
        dateTime: new Date(new Date(tarefaData.data_prevista).getTime() + 60 * 60 * 1000).toISOString(),
        timeZone: 'America/Sao_Paulo'
      }
    };

    // Criar evento no Google Calendar
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(evento)
    });

    if (!response.ok) {
      const error = await response.json();
      return Response.json({ error: error.error.message }, { status: 400 });
    }

    const eventoData = await response.json();

    // Atualizar tarefa com ID do evento do Google Calendar
    await base44.entities.Tarefa.update(tarefa_id, {
      google_calendar_event_id: eventoData.id
    });

    return Response.json({
      success: true,
      evento_id: eventoData.id,
      message: 'Evento criado no Google Calendar com sucesso'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});