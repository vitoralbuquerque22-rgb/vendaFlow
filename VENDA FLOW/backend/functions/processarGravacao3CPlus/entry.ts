import { createClientFromRequest } from "../../src/sdk.ts";

/**
 * processarGravacao3CPlus
 *
 * Pipeline completo: gravação → transcrição → análise IA.
 *
 * Pode ser chamada de duas formas:
 *   a) Automaticamente pela finalizarLigacao3CPlus (fire-and-forget)
 *   b) Manualmente pelo gestor para reprocessar uma gravação
 *   c) Pela sincronizarTelefonia3CPlus quando detecta gravacao_url nova
 *
 * Pipeline:
 *   1. Baixar áudio da URL do 3C Plus
 *   2. Enviar ao Whisper (OpenAI) → transcrição em PT-BR
 *   3. Enviar transcrição ao GPT-4o → análise comercial estruturada
 *   4. Salvar tudo na CallSession
 *   5. Atualizar Atividade com gravacao_url e insights
 *
 * Tolerância a falhas:
 *   - Se Whisper falhar: salva gravacao_url e marca erro, não perde a gravação
 *   - Se análise IA falhar: salva transcrição pura, análise pode ser refeita
 *   - Idempotente: pode ser chamada novamente sem duplicar dados
 */

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const api = createClientFromRequest(req);
    const user = await api.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    let body;

    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Corpo da requisição inválido' }, { status: 400 });
    }

    if (!body.empresaId || !body.call_session_id || !body.gravacao_url) {
      return Response.json(
        { error: 'empresaId, call_session_id e gravacao_url são obrigatórios' },
        { status: 400 }
      );
    }

    // JUSTIFICATIVA: Pipeline de processamento assíncrono de gravações — chamado em fire-and-forget
    // pelo finalizarLigacao3CPlus após encerramento da chamada. O usuário (SDR) já encerrou sua
    // sessão; não há token de usuário disponível neste contexto. Nunca exposto ao frontend.
    const sessoes = await api.asServiceRole.entities.CallSession.filter({
      id: body.call_session_id,
      empresaId: body.empresaId,
    });

    if (sessoes.length === 0) {
      return Response.json({ error: 'Sessão não encontrada' }, { status: 404 });
    }

    const sessao = sessoes[0];

    // Idempotência: se já processou com sucesso, não reprocessar
    if (sessao.gravacao_processada && sessao.transcricao) {
      return Response.json(
        {
          success: true,
          ja_processada: true,
          call_session_id: body.call_session_id,
          mensagem: 'Gravação já processada anteriormente.',
        },
        { headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return Response.json({ error: 'OPENAI_API_KEY não configurada' }, { status: 500 });
    }

    // Salvar gravacao_url imediatamente (não perder mesmo se pipeline falhar)
    await api.asServiceRole.entities.CallSession.update(body.call_session_id, {
      gravacao_url: body.gravacao_url,
    });

    // -------------------------------------------------------
    // 2. Baixar áudio
    // -------------------------------------------------------
    let audioBlob;
    let extensao = 'mp3';

    // Validação SSRF — bloqueia IPs privados e domínios não autorizados
    function isUrlSafe(url) {
      try {
        const u = new URL(url);
        if (u.protocol !== 'https:') return false;
        const host = u.hostname;
        if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return false;
        const ALLOWED = [/\.3c\.plus$/, /\.s3\.amazonaws\.com$/, /\.cloudfront\.net$/, /\.twilio\.com$/, /\.googleapis\.com$/];
        return ALLOWED.some(r => r.test(host));
      } catch { return false; }
    }

    if (!isUrlSafe(body.gravacao_url)) {
      return Response.json({ error: 'URL de gravação não permitida' }, { status: 400 });
    }

    try {
      const respAudio = await fetch(body.gravacao_url);
      if (!respAudio.ok) {
        throw new Error(`HTTP ${respAudio.status} ao baixar gravação`);
      }

      audioBlob = await respAudio.blob();

      // Detectar extensão pela URL ou Content-Type
      const ct = respAudio.headers.get('content-type') || '';
      if (ct.includes('wav'))  extensao = 'wav';
      else if (ct.includes('mp4') || ct.includes('m4a')) extensao = 'm4a';
      else if (ct.includes('ogg')) extensao = 'ogg';

      const urlPath = new URL(body.gravacao_url).pathname;
      const urlExt = urlPath.split('.').pop()?.toLowerCase();
      if (urlExt && ['mp3','wav','m4a','ogg','mp4'].includes(urlExt)) {
        extensao = urlExt;
      }

      // Limite Whisper: 25MB
      const maxSize = 25 * 1024 * 1024;
      if (audioBlob.size > maxSize) {
        throw new Error(`Arquivo muito grande: ${(audioBlob.size / 1024 / 1024).toFixed(1)}MB (limite 25MB)`);
      }
    } catch (e) {
      await api.asServiceRole.entities.CallSession.update(body.call_session_id, {
        erro_mensagem: `Falha ao baixar gravação: ${e.message}`,
      });
      return Response.json(
        { error: 'Falha ao baixar gravação', detalhe: e.message },
        { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // -------------------------------------------------------
    // 3. Transcrição com OpenAI Whisper
    // -------------------------------------------------------
    let transcricao = '';

    try {
      const mimeTypes = {
        mp3: 'audio/mpeg',
        mp4: 'audio/mp4',
        m4a: 'audio/mp4',
        wav: 'audio/wav',
        ogg: 'audio/ogg',
      };

      const audioFile = new File(
        [audioBlob],
        `gravacao.${extensao}`,
        { type: mimeTypes[extensao] || 'audio/mpeg' }
      );

      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('model', 'whisper-1');
      formData.append('language', 'pt');
      formData.append('response_format', 'json');

      const respWhisper = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}` },
        body: formData,
      });

      if (!respWhisper.ok) {
        const err = await respWhisper.text();
        throw new Error(`Whisper error ${respWhisper.status}: ${err}`);
      }

      const resultWhisper = await respWhisper.json();
      transcricao = resultWhisper.text || '';

      // Salvar transcrição imediatamente (não perder se análise IA falhar)
      await api.asServiceRole.entities.CallSession.update(body.call_session_id, {
        transcricao,
      });
    } catch (e) {
      await api.asServiceRole.entities.CallSession.update(body.call_session_id, {
        erro_mensagem: `Falha na transcrição: ${e.message}`,
        gravacao_processada: false,
      });
      return Response.json(
        {
          success: false,
          gravacao_salva: true,
          transcricao_ok: false,
          erro: e.message,
          mensagem: 'Gravação salva, mas transcrição falhou. Pode ser reprocessada.',
        },
        { status: 206, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // -------------------------------------------------------
    // 4. Análise comercial com GPT-4o
    // -------------------------------------------------------
    let analiseIa = {};

    if (transcricao.trim().length > 50) {
      try {
        const spinRespostas = sessao.spin_respostas || null;
        const contextoSpin = spinRespostas
          ? `\nSPIN preenchido pelo SDR:\n- Situação: ${spinRespostas.situacao || '-'}\n- Problema: ${spinRespostas.problema || '-'}\n- Implicação: ${spinRespostas.implicacao || '-'}\n- Necessidade: ${spinRespostas.necessidade || '-'}\n- Próximo passo: ${spinRespostas.proximo_passo || '-'}`
          : '';

        const prompt = `Você é um especialista em vendas consultivas e análise de ligações comerciais.

Analise a transcrição abaixo de uma ligação de vendas e retorne um JSON estruturado (apenas JSON, sem markdown).${contextoSpin}

TRANSCRIÇÃO:
${transcricao}

Retorne APENAS este JSON (sem \`\`\`json, sem texto antes ou depois):
{
  "resumo": "Resumo objetivo da conversa em 2-3 frases",
  "sentimento": "positivo|neutro|negativo",
  "lead_engajado": true ou false,
  "objecoes": ["lista de objeções levantadas pelo lead"],
  "pontos_positivos": ["aspectos positivos da abordagem do vendedor"],
  "pontos_melhoria": ["sugestões de melhoria para o vendedor"],
  "proximos_passos": "Próximo passo claro que ficou combinado",
  "score_qualificacao": número de 0 a 10,
  "perfil_comprador": "curto descritivo do perfil do lead",
  "palavras_chave": ["palavras ou temas relevantes mencionados"]
}`;

        const respGpt = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            max_tokens: 800,
            temperature: 0.2,
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        if (respGpt.ok) {
          const resultGpt = await respGpt.json();
          const texto = resultGpt.choices?.[0]?.message?.content || '';
          const textoLimpo = texto.replace(/```json|```/g, '').trim();
          analiseIa = JSON.parse(textoLimpo);
        }
      } catch (e) {
        // Análise IA falhou — não crítico, transcrição já está salva
        analiseIa = { erro_analise: e.message };
      }
    }

    // -------------------------------------------------------
    // 5. Salvar tudo na CallSession
    // -------------------------------------------------------
    await api.asServiceRole.entities.CallSession.update(body.call_session_id, {
      gravacao_url: body.gravacao_url,
      gravacao_processada: true,
      transcricao,
      analise_ia: analiseIa,
      erro_mensagem: null,
    });

    // -------------------------------------------------------
    // 6. Atualizar Atividade vinculada com gravação e insights
    // -------------------------------------------------------
    if (sessao.atividade_id) {
      try {
        await api.asServiceRole.entities.Atividade.update(
          sessao.atividade_id,
          {
            gravacao_url: body.gravacao_url,
            observacao: analiseIa.resumo
              ? `[IA] ${analiseIa.resumo}`
              : undefined,
          }
        );
      } catch { /* não crítico */ }
    }

    return Response.json(
      {
        success: true,
        call_session_id: body.call_session_id,
        transcricao_chars: transcricao.length,
        analise_disponivel: Object.keys(analiseIa).length > 0 && !analiseIa.erro_analise,
        score_qualificacao: analiseIa.score_qualificacao ?? null,
        mensagem: 'Gravação processada com sucesso.',
      },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );

  } catch (error) {
    console.error('[processarGravacao3CPlus]', error.message);
    return Response.json(
      { error: error.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
};
