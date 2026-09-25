/**
 * getTelefonia3CPlus
 *
 * Utilitário compartilhado para resolver credenciais de telefonia 3C Plus.
 * Implementa a prioridade: UserProfile > mapeamento legado
 * Tokens armazenados com AES-256-GCM são decriptados automaticamente.
 */

function b64decode(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }

async function decryptToken(value) {
  if (!value) return '';
  if (!value.startsWith('enc:')) return value;
  try {
    const [, ivB64, ctB64] = value.split(':');
    const keyB64 = Deno.env.get('TOKEN_ENCRYPTION_KEY');
    if (!keyB64) throw new Error('TOKEN_ENCRYPTION_KEY não configurada');
    const raw = b64decode(keyB64);
    const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64decode(ivB64) }, key, b64decode(ctB64));
    return new TextDecoder().decode(pt);
  } catch (e) {
    console.error('[decryptToken] falha ao decriptar token:', e.message);
    return '';
  }
}

export async function getTokenAgente(api, empresaId, userEmail) {
  const emailLower = (userEmail || '').toLowerCase();

  // 1. UserProfile (auto-serviço)
  let tokenProfile = null;
  let ramalProfile = null;
  try {
    const profiles = await api.asServiceRole.entities.UserProfile.filter({
      user_email: userEmail,
    });
    const raw = profiles[0]?.token_3cplus || null;
    tokenProfile = raw ? await decryptToken(raw) : null;
    ramalProfile = profiles[0]?.ramal_3cplus || null;
  } catch (e) {
    console.warn('[getTokenAgente] erro ao buscar UserProfile:', e.message);
  }

  // 2. Integração (legado)
  let cfg = {};
  try {
    const integracoes = await api.asServiceRole.entities.Integracao.filter({
      empresaId,
      tipo: 'telefonia',
      ativa: true,
    });
    cfg = integracoes.find(i => i.configuracao?.fornecedor === '3cplus')
      ?.configuracao || {};
  } catch (e) {
    console.warn('[getTokenAgente] erro ao buscar Integracao:', e.message);
  }

  const mapeamentoAgentes = cfg.mapeamento_agentes || {};
  const mapeamentoRamais = cfg.mapeamento_ramais || {};

  const tokenLegado = mapeamentoAgentes[emailLower] || cfg.token_agente || null;
  const ramalLegado = mapeamentoRamais[emailLower] || null;

  return {
    tokenAgente: tokenProfile || tokenLegado,
    tokenGestor: cfg.token_gestor || null,
    dominio: cfg.dominio || null,
    ramal: ramalProfile || ramalLegado || null,
    campanhaId: cfg.campanha_id_padrao || null,
  };
}