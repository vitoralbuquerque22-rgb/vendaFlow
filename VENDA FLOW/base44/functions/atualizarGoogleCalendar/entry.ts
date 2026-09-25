import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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
    if (!tarefa.length || !tarefa[0].google_calendar_event_id) {
      return Response.json({ error: 'Tarefa ou evento do Google Calendar não encontrado' }, { status: 404 });
    }

    const tarefaData = tarefa[0];
    const eventId = tarefaData.google_calendar_event_id;

    // Obter token de acesso
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlecalendar');

    // Buscar evento atual
    const getResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!getResponse.ok) {
      return Response.json({ error: 'Evento não encontrado no Google Calendar' }, { status: 404 });
    }

    const eventoAtual = await getResponse.json();

    // Atualizar dados do evento
    const eventoAtualizado = {
      ...eventoAtual,
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

    // Atualizar evento no Google Calendar
    const updateResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventoAtualizado)
      }
    );

    if (!updateResponse.ok) {
      const error = await updateResponse.json();
      return Response.json({ error: error.error.message }, { status: 400 });
    }

    return Response.json({
      success: true,
      message: 'Evento atualizado no Google Calendar com sucesso'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});