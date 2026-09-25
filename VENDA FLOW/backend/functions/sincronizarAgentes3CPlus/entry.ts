import { createClientFromRequest } from "../../src/sdk.ts";
import { chamar3C, credencialGestor, decryptToken, listarAgentes, respostaErro3C } from "../../src/telefonia3c.ts";

// Usado só para CRIPTOGRAFAR o token pessoal legado antes de gravar no perfil
function b64decode(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
async function encryptToken(plain) {
  if (!plain) return '';
  try {
    const keyB64 = Deno.env.get('TOKEN_ENCRYPTION_KEY');
    if (!keyB64) return plain; // fallback gracioso
    const raw = b64decode(keyB64);
    const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain));
    return `enc:${btoa(String.fromCharCode(...iv))}:${btoa(String.fromCharCode(...new Uint8Array(ct)))}`;
  } catch (e) {
    console.error('[encryptToken] falha:', e.message);
    return plain;
  }
}

/**
 * sincronizarAgentes3CPlus
 *
 * Vincula automaticamente usuários do CRM com agentes do 3C Plus.
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

  try {
    const api = createClientFromRequest(req);
    const user = await api.auth.me();

    if (!user || (user.role !== 'admin' && user.role !== 'gestor')) {
      return Response.json({ error: 'Acesso restrito a admin ou gestor' }, { status: 403 });
    }

    let body = {};
    try { body = await req.json(); } catch { /* cron sem body */ }

    const resultado = {
      perfis_verificados: 0,
      agentes_vinculados: 0,
      agentes_nao_encontrados: [],
      erros: [],
    };

    // 1. Buscar integração 3C Plus
    const filtroIntegracao = { tipo: 'telefonia', ativa: true };
    if (body.empresaId) filtroIntegracao.empresaId = body.empresaId;

    const integracoes = await api.asServiceRole.entities.Integracao.filter(filtroIntegracao);
    const integracao = integracoes.find(i => i.configuracao?.fornecedor === '3cplus');

    if (!integracao) {
      return Response.json({ error: 'Integração 3C Plus não encontrada' }, { status: 404 });
    }

    const cfg = integracao.configuracao;

    // Credencial de gestor da empresa dona da integração (token de serviço 3cs_ ou pessoal legado)
    let cred;
    try {
      cred = await credencialGestor(api, String(integracao.empresaId));
    } catch (e) {
      return respostaErro3C(e, { 'Access-Control-Allow-Origin': '*' });
    }

    // Com token de serviço de agente, o X-Agent-Id (UserProfile.id_3cplus) basta: não buscamos
    // nem mantemos tokens pessoais. O mapeamento de tokens pessoais é legado (até 01/10/2026).
    const temTokenServicoAgente = String(cfg.token_servico_agente ?? '').trim() !== '';

    // 2. Buscar todos os agentes do 3C Plus
    let agentes3C = [];
    try {
      agentes3C = await listarAgentes(cred); // todas as páginas (a API pagina em 25)
    } catch (e) {
      return Response.json(
        { error: `Falha ao buscar agentes do 3C Plus: ${e.message}` },
        { status: 502 }
      );
    }

    // Montar índice ramal → agente
    const agentePorRamal = {};
    for (const agente of agentes3C) {
      const ext = agente.extension || {};
      const ramal = String(ext.extension_number || '');
      if (ramal && ramal !== '0') {
        agentePorRamal[ramal] = agente;
      }
    }

    // 3. Buscar tokens individuais dos agentes via API (somente modo legado de token pessoal)
    async function buscarTokenAgente(agentId) {
      try {
        const resp = await chamar3C(cred, `/agents/${agentId}`);
        if (!resp.ok) return null;
        const dados = await resp.json();
        const tokenPessoal = dados.data?.api_token || null;
        // Nunca tratar token de serviço como token pessoal
        return tokenPessoal && !String(tokenPessoal).startsWith('3cs_') ? tokenPessoal : null;
      } catch {
        return null;
      }
    }

    // 4. Buscar UserProfiles com ramal preenchido
    const filtroProfile = {};
    if (!body.forcar_todos) {
      filtroProfile['3cplus_sincronizado'] = false;
    }

    const perfis = await api.asServiceRole.entities.UserProfile.filter(filtroProfile);
    const perfisComRamal = perfis.filter(
      p => p.ramal_3cplus && String(p.ramal_3cplus).trim() !== ''
    );

    resultado.perfis_verificados = perfisComRamal.length;

    // 5. Vincular cada perfil ao agente 3C Plus pelo ramal
    const mapeamentoAtualizado = cfg.mapeamento_agentes || {};
    const mapeamentoIds = cfg.mapeamento_ids_3cplus || {};
    const mapeamentoRamais = cfg.mapeamento_ramais || {};

    for (const perfil of perfisComRamal) {
      const ramal = String(perfil.ramal_3cplus).trim();
      const agente = agentePorRamal[ramal];

      if (!agente) {
        resultado.agentes_nao_encontrados.push(
          `${perfil.user_email} (ramal ${ramal} não encontrado no 3C Plus)`
        );
        continue;
      }

      try {
        const agentId = agente.id;

        // id_3cplus é o que vai no header X-Agent-Id — sempre gravado
        const updateData = {
          id_3cplus: agentId,
          '3cplus_sincronizado': true,
          '3cplus_sincronizado_em': new Date().toISOString(),
        };

        if (!temTokenServicoAgente) {
          const tokenAgente = await buscarTokenAgente(agentId);
          if (tokenAgente) {
            const tokenEnc = await encryptToken(tokenAgente);
            updateData.token_3cplus = tokenEnc;
            mapeamentoAtualizado[perfil.user_email] = tokenAgente; // mapeamento legado usa plain
          } else if (perfil.token_3cplus) {
            // mapeamento legado usa texto puro: decripta o token salvo no perfil
            const tokenPerfil = await decryptToken(perfil.token_3cplus).catch(() => '');
            if (tokenPerfil && !tokenPerfil.startsWith('3cs_')) mapeamentoAtualizado[perfil.user_email] = tokenPerfil;
          }
        }

        await api.asServiceRole.entities.UserProfile.update(perfil.id, updateData);

        mapeamentoIds[perfil.user_email] = agentId;
        mapeamentoRamais[perfil.user_email] = ramal;

        resultado.agentes_vinculados++;
      } catch (e) {
        resultado.erros.push(`${perfil.user_email}: ${e.message}`);
      }
    }

    // 6. Atualizar mapeamento na entidade Integracao
    if (resultado.agentes_vinculados > 0) {
      await api.asServiceRole.entities.Integracao.update(integracao.id, {
        // mapeamento de tokens pessoais só é mantido sem token de serviço de agente (legado)
        ...(temTokenServicoAgente ? {} : { 'configuracao.mapeamento_agentes': mapeamentoAtualizado }),
        'configuracao.mapeamento_ids_3cplus': mapeamentoIds,
        'configuracao.mapeamento_ramais': mapeamentoRamais,
        ultima_sincronizacao: new Date().toISOString(),
      });
    }

    return Response.json(
      {
        success: true,
        ...resultado,
        mensagem: resultado.agentes_vinculados > 0
          ? `${resultado.agentes_vinculados} agente(s) vinculado(s) com sucesso.`
          : 'Nenhum agente novo para vincular.',
      },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );

  } catch (error) {
    console.error('[sincronizarAgentes3CPlus]', error.message);
    return Response.json(
      { error: error.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
};
