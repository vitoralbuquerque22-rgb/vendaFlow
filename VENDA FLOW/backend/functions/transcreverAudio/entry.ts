import { createClientFromRequest } from "../../src/sdk.ts";

export default async (req) => {
    try {
        const api = createClientFromRequest(req);
        const user = await api.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const fileUrl = body.file_url;

        if (!fileUrl) {
            return Response.json({ error: 'file_url é obrigatório' }, { status: 400 });
        }

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

        if (!isUrlSafe(fileUrl)) {
            return Response.json({ error: 'URL de arquivo não permitida' }, { status: 400 });
        }

        // Baixar o arquivo
        const fileResponse = await fetch(fileUrl);
        if (!fileResponse.ok) {
            return Response.json({ 
                error: 'Erro ao baixar arquivo',
                detalhes: `Status: ${fileResponse.status} ${fileResponse.statusText}` 
            }, { status: 400 });
        }

        const audioBlob = await fileResponse.blob();
        
        // Verificar tamanho (limite de 25MB da OpenAI)
        const maxSize = 25 * 1024 * 1024; // 25MB
        if (audioBlob.size > maxSize) {
            return Response.json({ 
                error: 'Arquivo muito grande. Limite: 25MB',
                tamanho: `${(audioBlob.size / 1024 / 1024).toFixed(2)}MB`
            }, { status: 400 });
        }

        // Detectar tipo de arquivo pela extensão
        const extension = fileUrl.split('.').pop().toLowerCase();
        const mimeTypes = {
            'mp3': 'audio/mpeg',
            'mp4': 'audio/mp4',
            'm4a': 'audio/mp4',
            'wav': 'audio/wav',
            'ogg': 'audio/ogg',
        };
        const mimeType = mimeTypes[extension] || 'audio/mpeg';
        
        const audioFile = new File([audioBlob], `audio.${extension}`, { type: mimeType });

        // Transcrever com OpenAI Whisper
        const openaiFormData = new FormData();
        openaiFormData.append('file', audioFile);
        openaiFormData.append('model', 'whisper-1');
        openaiFormData.append('language', 'pt');
        openaiFormData.append('response_format', 'json');

        const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
            },
            body: openaiFormData,
        });

        if (!transcriptionResponse.ok) {
            const error = await transcriptionResponse.text();
            console.error('OpenAI error:', error);
            return Response.json({ 
                error: 'Erro na transcrição do áudio',
                detalhes: 'Verifique se o arquivo é um áudio válido (MP3, MP4, M4A, WAV) e não excede 25MB'
            }, { status: 500 });
        }

        const transcription = await transcriptionResponse.json();

        return Response.json({ 
            transcricao: transcription.text,
            sucesso: true 
        });
    } catch (error) {
        console.error('Erro:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
};
