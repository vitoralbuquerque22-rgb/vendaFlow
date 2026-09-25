import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { csvUrl, empresaId, offset = 0, batchSize = 300 } = body;

    if (!csvUrl || !empresaId) {
      return Response.json({ error: 'csvUrl e empresaId são obrigatórios' }, { status: 400 });
    }

    // Baixar o CSV
    const resp = await fetch(csvUrl);
    const text = await resp.text();
    const lines = text.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim());

    // Parse das linhas do lote atual
    const dataLines = lines.slice(1 + offset, 1 + offset + batchSize);
    const leads = dataLines.map(line => {
      const vals = line.split(',');
      const record = {};
      headers.forEach((h, i) => {
        record[h] = (vals[i] || '').trim();
        if (record[h] === 'null') record[h] = null;
      });
      return {
        empresaId,
        nome: record.nome || '',
        telefone: record.telefone || '',
        email: record.email || null,
        status: 'novo',
        origem: 'lista_fria',
        fonte_externa: false
      };
    }).filter(l => l.nome && l.telefone);

    // Inserir em lote
    if (leads.length > 0) {
      await base44.asServiceRole.entities.Lead.bulkCreate(leads);
    }

    const totalLines = lines.length - 1;
    const nextOffset = offset + batchSize;
    const hasMore = nextOffset < totalLines;

    return Response.json({
      success: true,
      inserted: leads.length,
      offset,
      nextOffset: hasMore ? nextOffset : null,
      totalLines,
      hasMore,
      progress: `${Math.min(offset + batchSize, totalLines)}/${totalLines}`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});