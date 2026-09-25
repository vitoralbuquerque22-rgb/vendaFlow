import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Converte YYYY-MM-DD para timestamp UTC considerando o timezone local
function dateToTimestampTZ(dateStr, endOfDay, timezone) {
  const time = endOfDay ? 'T23:59:59' : 'T00:00:00';
  const referenceDate = new Date(`${dateStr}${time}Z`);

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(referenceDate);

  const p = {};
  parts.forEach(({ type, value }) => { p[type] = value; });

  const hour = p.hour === '24' ? '00' : p.hour;
  const tzInterpretedMs = new Date(`${p.year}-${p.month}-${p.day}T${hour}:${p.minute}:${p.second}Z`).getTime();
  const offsetMs = referenceDate.getTime() - tzInterpretedMs;
  return new Date(`${dateStr}${time}Z`).getTime() + offsetMs;
}

const LOTE = 500;
const DELAY_MS = 300; // delay entre lotes para evitar rate limit
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { empresaId, dataInicio, dataFim, timezone = 'America/Sao_Paulo' } = await req.json();
    if (!empresaId) return Response.json({ error: 'empresaId obrigatório' }, { status: 400 });

    const dataInicioTs = dataInicio ? dateToTimestampTZ(dataInicio, false, timezone) : null;
    const dataFimTs = dataFim ? dateToTimestampTZ(dataFim, true, timezone) : null;
    const temFiltroData = !!(dataInicioTs || dataFimTs);

    let total = 0;
    let skip = 0;
    let podeParar = false;
    const origemContagem = {};

    while (!podeParar) {
      let lote;
      try {
        lote = await base44.entities.Lead.filter({ empresaId }, '-created_date', LOTE, skip);
      } catch (err) {
        if (err?.message?.includes('429') || err?.message?.includes('Rate limit')) {
          await sleep(1500);
          lote = await base44.entities.Lead.filter({ empresaId }, '-created_date', LOTE, skip);
        } else {
          throw err;
        }
      }

      if (!lote || lote.length === 0) break;

      for (const lead of lote) {
        const ts = lead.created_date ? new Date(lead.created_date).getTime() : 0;

        if (temFiltroData && dataInicioTs && ts < dataInicioTs) {
          podeParar = true;
          break;
        }

        if (temFiltroData) {
          if (dataFimTs && ts > dataFimTs) continue;
        }
        total++;
        let origem;
        if (lead.origem) {
          origem = lead.origem;
        } else if (lead.fonte_externa) {
          origem = 'webhook';
        } else {
          origem = 'manual';
        }
        origemContagem[origem] = (origemContagem[origem] || 0) + 1;
      }

      if (lote.length < LOTE) break;
      skip += LOTE;

      if (!podeParar) await sleep(DELAY_MS);
    }

    return Response.json({ total, origens: origemContagem, atualizadoEm: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});