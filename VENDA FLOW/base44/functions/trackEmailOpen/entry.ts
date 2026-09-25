import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const envioId = url.searchParams.get('envio_id');
    const leadId = url.searchParams.get('lead_id');

    if (!envioId) {
      return new Response('Missing envio_id', { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // Buscar o envio
    const envios = await base44.asServiceRole.entities.EmailEnvio.filter({ id: envioId });
    const envio = envios[0];

    if (envio) {
      const atualizacao = {
        abriu: true,
        quantidade_aberturas: (envio.quantidade_aberturas || 0) + 1,
      };

      // Primeira abertura
      if (!envio.data_abertura) {
        atualizacao.data_abertura = new Date().toISOString();
      }

      await base44.asServiceRole.entities.EmailEnvio.update(envioId, atualizacao);
    }

    // Retornar pixel transparente 1x1
    const pixel = atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
    const buffer = new Uint8Array(pixel.length);
    for (let i = 0; i < pixel.length; i++) {
      buffer[i] = pixel.charCodeAt(i);
    }

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Erro ao rastrear abertura:', error);
    // Retornar pixel mesmo em caso de erro
    const pixel = atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
    const buffer = new Uint8Array(pixel.length);
    for (let i = 0; i < pixel.length; i++) {
      buffer[i] = pixel.charCodeAt(i);
    }
    return new Response(buffer, {
      status: 200,
      headers: { 'Content-Type': 'image/gif' },
    });
  }
});