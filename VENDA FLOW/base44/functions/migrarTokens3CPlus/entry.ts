import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function b64decode(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
function b64encode(bytes) { return btoa(String.fromCharCode(...bytes)); }

async function getKey() {
  const keyB64 = Deno.env.get('TOKEN_ENCRYPTION_KEY');
  if (!keyB64) throw new Error('TOKEN_ENCRYPTION_KEY não configurada');
  const cleaned = keyB64.trim().replace(/\s+/g, '');
  const raw = b64decode(cleaned);
  if (raw.length !== 32) throw new Error(`TOKEN_ENCRYPTION_KEY deve ter 32 bytes — recebido ${raw.length} bytes`);
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encryptToken(plain) {
  if (!plain) return '';
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain));
  return `enc:${b64encode(iv)}:${b64encode(new Uint8Array(ct))}`;
}

Deno.serve(async (req) => {
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
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Acesso restrito a admin' }, { status: 403 });

    const perfis = await base44.asServiceRole.entities.UserProfile.list();

    let migrados = 0;
    let jaEncriptados = 0;
    const erros = [];

    for (const perfil of perfis) {
      const tokenAtual = perfil.token_3cplus;
      if (!tokenAtual) continue;

      if (tokenAtual.startsWith('enc:')) {
        jaEncriptados++;
        continue;
      }

      try {
        const tokenEnc = await encryptToken(tokenAtual);
        await base44.asServiceRole.entities.UserProfile.update(perfil.id, { token_3cplus: tokenEnc });
        migrados++;
      } catch (e) {
        erros.push(`${perfil.user_email}: ${e.message}`);
      }
    }

    return Response.json(
      { success: true, migrados, ja_encriptados: jaEncriptados, erros, total_processados: perfis.length },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (error) {
    console.error('[migrarTokens3CPlus]', error.message);
    return Response.json({ error: error.message }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
});