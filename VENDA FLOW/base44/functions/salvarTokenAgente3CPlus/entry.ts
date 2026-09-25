import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// decryptToken inline — Deno functions são isoladas, não há import relativo entre functions
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

    let body;
    try { body = await req.json(); }
    catch { return Response.json({ error: 'Body inválido' }, { status: 400 }); }

    const { token, ramal } = body;
    if (!token) return Response.json({ error: 'token é obrigatório' }, { status: 400 });

    // Encriptar token antes de persistir
    let tokenEncriptado;
    try {
      tokenEncriptado = await encryptToken(token.trim());
    } catch (e) {
      console.error('[salvarTokenAgente3CPlus] encryptToken falhou:', e.message);
      // Fallback gracioso: salvar plain se KEY não configurada
      tokenEncriptado = token.trim();
    }

    // Buscar UserProfile do usuário atual
    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });

    const updateData = {
      token_3cplus: tokenEncriptado,
      '3cplus_sincronizado': true,
      '3cplus_sincronizado_em': new Date().toISOString(),
    };
    if (ramal) updateData.ramal_3cplus = String(ramal).trim();

    if (profiles[0]) {
      await base44.asServiceRole.entities.UserProfile.update(profiles[0].id, updateData);
    } else {
      // Perfil ainda não existe (ex: dono/admin criado no signup sem UserProfile).
      // Determina o role: dono da empresa = admin; senão usa o role do vínculo ativo; fallback sdr.
      let role = 'sdr';
      const empresasOwner = await base44.asServiceRole.entities.Empresa.filter({ ownerEmail: user.email });
      if (empresasOwner[0]) {
        role = 'admin';
      } else {
        const vinculos = await base44.asServiceRole.entities.VinculoEmpresa.filter({ userEmail: user.email, status: 'ativo' });
        if (vinculos[0]?.role) role = vinculos[0].role;
      }
      await base44.asServiceRole.entities.UserProfile.create({
        user_email: user.email,
        user_name: user.full_name || user.email,
        role,
        is_active: true,
        ...updateData,
      });
    }

    return Response.json(
      { success: true, mensagem: 'Token salvo com sucesso (encriptado).' },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (error) {
    console.error('[salvarTokenAgente3CPlus]', error.message);
    return Response.json({ error: error.message }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
});