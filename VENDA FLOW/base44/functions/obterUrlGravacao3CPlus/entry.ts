import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });

    let body;
    try { body = await req.json(); } catch { return Response.json({ error: 'Body inválido' }, { status: 400 }); }

    const { empresaId, gravacao_id, call_id_3cplus } = body;
    if (!empresaId || (!gravacao_id && !call_id_3cplus)) {
      return Response.json({ error: 'empresaId e (gravacao_id ou call_id_3cplus) são obrigatórios' }, { status: 400 });
    }

    // Buscar GravacaoLigacao para validar permissão
    let gravacao = null;
    if (gravacao_id) {
      const gravacoes = await base44.asServiceRole.entities.GravacaoLigacao.filter({ id: gravacao_id, empresaId });
      gravacao = gravacoes[0] || null;
    }

    // Verificar permissão — SDR só acessa próprias gravações
    const userProfile = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email, empresaId }).then(r => r[0] || null);
    const isGestorAdmin = user.role === 'admin' || userProfile?.role === 'admin' || userProfile?.role === 'gestor';

    if (gravacao && !isGestorAdmin && gravacao.sdr_email !== user.email) {
      return Response.json({ error: 'Sem permissão para acessar esta gravação' }, { status: 403, headers: CORS });
    }

    // Verificar se está purgada
    if (gravacao?.purged_at) {
      return Response.json({ error: 'Gravação purgada — dados removidos por política de retenção LGPD' }, { status: 410, headers: CORS });
    }

    // Usar backup URL se disponível (treinamentos — não dependem do 3C Plus)
    if (gravacao?.gravacao_url_backup) {
      return Response.json({
        fonte: 'backup',
        content_type: 'audio/mpeg',
        url_disponivel: true,
        usar_backup: true,
        backup_url: gravacao.gravacao_url_backup,
      }, { headers: CORS });
    }

    // Buscar integração 3C Plus
    const integracoes = await base44.asServiceRole.entities.Integracao.filter({ empresaId, tipo: 'telefonia', ativa: true });
    const integracao = integracoes.find(i => i.configuracao?.fornecedor === '3cplus');
    if (!integracao) return Response.json({ error: 'Integração 3C Plus não configurada' }, { status: 424, headers: CORS });

    const cfg = integracao.configuracao;
    const token = String(cfg.token_gestor || '').trim();
    if (!token) return Response.json({ error: 'token_gestor não configurado' }, { status: 424, headers: CORS });

    const callId = call_id_3cplus || gravacao?.call_id_3cplus;
    if (!callId) return Response.json({ error: 'call_id_3cplus não encontrado' }, { status: 400, headers: CORS });

    // Baixar áudio do 3C Plus como proxy seguro
    const baseUrl = cfg.dominio ? `https://${cfg.dominio}.3c.plus/api/v1` : 'https://3c.fluxoti.com/api/v1';
    const urlGravacao = `${baseUrl}/calls/${encodeURIComponent(callId)}/recording?api_token=${encodeURIComponent(token)}`;

    const respAudio = await fetch(urlGravacao, { signal: AbortSignal.timeout(30000) });

    if (!respAudio.ok) {
      if (respAudio.status === 404) {
        return Response.json({ error: 'Gravação não encontrada no 3C Plus — pode ter expirado', expirada: true }, { status: 404, headers: CORS });
      }
      return Response.json({ error: `Erro ao buscar gravação: HTTP ${respAudio.status}` }, { status: 502, headers: CORS });
    }

    const contentType = respAudio.headers.get('content-type') || 'audio/mpeg';
    const audioBuffer = await respAudio.arrayBuffer();

    // Gerar checksum dos primeiros 64KB para deduplicação (se ainda não calculado)
    if (gravacao && !gravacao.checksum_audio) {
      try {
        const primeiros64KB = audioBuffer.slice(0, 65536);
        const hashBuffer = await crypto.subtle.digest('SHA-256', primeiros64KB);
        const checksum = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        await base44.asServiceRole.entities.GravacaoLigacao.update(gravacao.id, {
          checksum_audio: checksum,
        }).catch(() => {});
      } catch (e) { console.warn('[obterUrlGravacao3CPlus] checksum:', e.message); }
    }

    // Converter para base64 — frontend cria blob URL local e revoga após uso
    const audioBytes = new Uint8Array(audioBuffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < audioBytes.length; i += chunkSize) {
      binary += String.fromCharCode(...audioBytes.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);

    return Response.json({
      audio_base64: base64,
      content_type: contentType,
      tamanho_bytes: audioBuffer.byteLength,
      fonte: '3cplus',
      call_id: callId,
    }, { headers: CORS });

  } catch (e) {
    console.error('[obterUrlGravacao3CPlus] erro:', e.message);
    return Response.json({ error: e.message }, { status: 500, headers: CORS });
  }
});