import { createClientFromRequest } from "../../src/sdk.ts";

export default async (req) => {
  try {
    const api = createClientFromRequest(req);
    const user = await api.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tarefa_id } = await req.json();

    // Buscar tarefa
    const tarefa = await api.entities.Tarefa.filter({ id: tarefa_id });
    if (!tarefa.length || !tarefa[0].google_calendar_event_id) {
      return Response.json({ error: 'Evento do Google Calendar não encontrado' }, { status: 404 });
    }

    const eventId = tarefa[0].google_calendar_event_id;

    // Obter token de acesso
    const accessToken = await api.asServiceRole.connectors.getAccessToken('googlecalendar');

    // Deletar evento no Google Calendar
    const deleteResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!deleteResponse.ok) {
      return Response.json({ error: 'Erro ao deletar evento' }, { status: 400 });
    }

    // Remover ID do evento da tarefa
    await api.entities.Tarefa.update(tarefa_id, {
      google_calendar_event_id: null
    });

    return Response.json({
      success: true,
      message: 'Evento deletado do Google Calendar com sucesso'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
};
