import { createClientFromRequest } from "../../src/sdk.ts";
import { chamar3C, credencialAgente, credencialGestor, Erro3C, lerJson, mascarar, respostaErro3C } from "../../src/telefonia3c.ts";

/**
 * executarComando3CPlus
 *
 * Proxy seguro entre o frontend e a API do 3C Plus.
 * O frontend nunca fala diretamente com o 3C Plus — as credenciais
 * ficam no backend (entidade Integracao). O frontend envia o
 * comando desejado e este endpoint executa na API do 3C Plus
 * com a credencial certa (gestor para monitoramento, agente para o SDR).
 *
 * Comandos disponíveis:
 *   agent-connect      → conecta o agente (antes do login)
 *   agent-login        → loga o agente em uma campanha
 *   agent-logout       → desloga o agente
 *   agent-pause        → coloca agente em intervalo
 *   agent-resume       → retira agente do intervalo
 *   manual-dial        → disca manualmente para um número
 *   manual-call-enter  → entra no modo de ligação manual
 *   manual-call-exit   → sai do modo de ligação manual
 *   qualify-call       → qualifica a chamada corrente
 *   end-call           → encerra a chamada corrente
 *   acw-exit           → sai do pós-atendimento (TPA)
 *   get-logged-campaign → campanha em que o agente está logado
 *   get-campaigns      → campanhas do agente
 *   get-work-breaks    → intervalos da campanha
 *   get-qualifications → qualificações de uma lista
 *   get-agent-status   → status de todos os agentes (gestor)
 *   get-all-campaigns  → todas as campanhas (gestor)
 *   get-agent-token    → token para o ramal WebRTC (somente token pessoal legado)
 */

const CORS = { "Access-Control-Allow-Origin": "*" };

// Comandos de MONITORAMENTO (operam sobre todos os agentes) usam o token de gestor.
// Os demais operam como o PRÓPRIO agente do usuário logado — inclusive admin/gestor,
// que também é um agente no 3C Plus. Assim ninguém opera como outro agente.
const COMANDOS_GESTOR = new Set(["get-agent-status", "get-all-campaigns"]);

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...CORS,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });

  try {
    const api = createClientFromRequest(req);
    const user = await api.auth.me();
    if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Corpo da requisição inválido" }, { status: 400 });
    }
    if (!body.empresaId || !body.comando) {
      return Response.json({ error: "empresaId e comando são obrigatórios" }, { status: 400 });
    }

    const cred = COMANDOS_GESTOR.has(body.comando)
      ? await credencialGestor(api, body.empresaId)
      : await credencialAgente(api, body.empresaId, user.email);

    const t0 = Date.now();
    const logBase = () => ({
      ts: new Date().toISOString(),
      cmd: body.comando,
      user: user.email,
      empresa: body.empresaId,
      credencial: `${cred.papel}/${cred.origem}`,
      agente: cred.agenteId,
      token_preview: mascarar(cred.token),
      elapsed_ms: Date.now() - t0,
    });
    const exigir = (campo: string) => {
      if (!body[campo]) throw new Erro3C(`${campo} é obrigatório para ${body.comando}`);
    };

    let resposta3C: Response;

    switch (body.comando) {
      case "agent-connect":
        resposta3C = await chamar3C(cred, "/agent/connect", { method: "POST", form: {} });
        break;

      // mode configurável via body.mode; padrão 'dialer' → agente entra ocioso
      case "agent-login":
        exigir("campanha_id");
        resposta3C = await chamar3C(cred, "/agent/login", {
          json: { campaign: Number(body.campanha_id), mode: body.mode || "dialer" },
        });
        break;

      case "agent-logout":
        resposta3C = await chamar3C(cred, "/agent/logout", { json: {} });
        break;

      case "agent-pause":
        exigir("intervalo_id");
        resposta3C = await chamar3C(cred, `/agent/work_break/${encodeURIComponent(body.intervalo_id)}/enter`, { json: {} });
        break;

      case "agent-resume":
        resposta3C = await chamar3C(cred, "/agent/work_break/exit", { json: {} });
        break;

      case "manual-dial":
        exigir("numero");
        // Garantir modo manual ativo
        await chamar3C(cred, "/agent/manual_call/enter", { json: {} }).catch(() => {});
        resposta3C = await chamar3C(cred, "/agent/manual_call/dial", {
          json: { phone: String(body.numero).replace(/\D/g, "") },
        });
        break;

      // /agent/call/{id}/qualify (discadora) ou /agent/manual_call/{id}/qualify (body.manual = true)
      case "qualify-call": {
        exigir("qualificacao_id");
        exigir("chamada_id");
        const id = encodeURIComponent(body.chamada_id);
        resposta3C = await chamar3C(cred, body.manual ? `/agent/manual_call/${id}/qualify` : `/agent/call/${id}/qualify`, {
          json: { qualification_id: Number(body.qualificacao_id), qualification_note: body.nota || "" },
        });
        break;
      }

      case "end-call":
        exigir("chamada_id");
        resposta3C = await chamar3C(cred, `/agent/call/${encodeURIComponent(body.chamada_id)}/hangup`, { json: {} });
        break;

      // Sair do pós-atendimento (ACW). O agente está OU em ACW manual OU em ACW normal — nunca
      // nos dois. Tentamos ambos e consideramos sucesso se qualquer um sair (204/200). Um 404 no
      // outro é esperado e NÃO vira erro, senão o frontend reprocessa o hangup e o TPA fica preso.
      case "acw-exit": {
        let acwSaiu = false;
        let ultimoStatus = 0;
        for (const path of ["/agent/manual_call_acw/exit", "/agent/acw/exit"]) {
          try {
            const r = await chamar3C(cred, path, { json: {}, timeoutMs: 8000 });
            ultimoStatus = r.status;
            if (r.status === 204 || r.status === 200) acwSaiu = true;
          } catch { /* timeout/rede — tenta o próximo */ }
        }
        console.log("[3CPlus:CMD:OK]", JSON.stringify({ ...logBase(), saiu: acwSaiu, ultimo_status: ultimoStatus }));
        // Se nenhum saiu, o agente provavelmente já não estava em ACW — objetivo atingido.
        return Response.json({ success: true, acw_saiu: acwSaiu, ultimo_status: ultimoStatus }, { headers: CORS });
      }

      case "manual-call-enter":
        resposta3C = await chamar3C(cred, "/agent/manual_call/enter", { json: {}, timeoutMs: 8000 });
        break;

      case "manual-call-exit":
        resposta3C = await chamar3C(cred, "/agent/manual_call/exit", { json: {}, timeoutMs: 8000 });
        break;

      // 422/404 = agente sem campanha (não é erro)
      case "get-logged-campaign": {
        const r = await chamar3C(cred, "/agent/loggedCampaign");
        if (r.status === 422 || r.status === 404) {
          console.log("[3CPlus:CMD]", JSON.stringify({ ...logBase(), status: r.status, result: "nao_logado" }));
          return Response.json({ success: true, dados: null, nao_logado: true }, { headers: CORS });
        }
        resposta3C = r;
        break;
      }

      case "get-all-campaigns":
        resposta3C = await chamar3C(cred, "/campaigns", { query: { per_page: 200 } });
        break;

      case "get-agent-status":
        resposta3C = await chamar3C(cred, "/agents/status");
        break;

      case "get-qualifications":
        exigir("qualification_list_id");
        resposta3C = await chamar3C(cred, `/qualification_lists/${encodeURIComponent(body.qualification_list_id)}/qualifications`);
        break;

      case "get-campaigns":
        resposta3C = await chamar3C(cred, "/agent/campaigns");
        break;

      case "get-work-breaks": {
        const campanhaId = body.campanha_id || cred.config.campanha_id_padrao;
        if (!campanhaId) throw new Erro3C("campanha_id é obrigatório para get-work-breaks");
        resposta3C = await chamar3C(cred, `/campaigns/${encodeURIComponent(campanhaId)}/intervals`);
        break;
      }

      // Credenciais SIP do ramal WebRTC do PRÓPRIO agente do usuário. O navegador registra o
      // ramal com JsSIP (mesmo mecanismo da página /extension do 3C). Vai só a senha SIP deste
      // ramal — nunca o token de serviço, que opera por qualquer agente.
      case "get-ramal-webrtc": {
        const r = await chamar3C(cred, "/me", { query: { include: "company" } });
        const me = (await lerJson(r))?.data;
        if (!r.ok || !me) throw new Erro3C("Não foi possível obter os dados do agente no 3C Plus", r.status);
        if (!me.telephony_id || !me.extension_password) {
          throw new Erro3C("Agente sem ramal WebRTC no 3C Plus (telephony_id/extension_password ausentes)", 409);
        }
        const dominioSip = `${me.company?.domain || cred.dominio}.3c.plus`;
        console.log("[3CPlus:CMD]", JSON.stringify({ ...logBase(), status: 200, result: "ramal_webrtc" }));
        return Response.json({
          success: true,
          ramal: {
            ws: "wss://vox-socket.3c.plus:4443",
            uri: `sip:${me.telephony_id}@${dominioSip}`,
            senha: me.extension_password,
            ramal: me.extension?.extension_number ?? null,
            agente_id: me.id,
          },
        }, { headers: { ...CORS, "Cache-Control": "no-store" } });
      }

      // Token em texto puro para o ramal WebRTC no navegador. Só para token pessoal (legado):
      // o token de serviço de agente age por QUALQUER agente e nunca pode ir para o navegador.
      case "get-agent-token":
        if (cred.origem === "servico") {
          return Response.json(
            { error: "Com token de serviço o token não é enviado ao navegador", codigo: "TOKEN_SERVICO" },
            { status: 409, headers: CORS },
          );
        }
        console.log("[3CPlus:CMD]", JSON.stringify({ ...logBase(), status: 200, result: "token_returned" }));
        return Response.json({ success: true, token: cred.token, dominio: cred.dominio, dados: { token: cred.token } }, { headers: CORS });

      default:
        return Response.json({ error: `Comando desconhecido: ${body.comando}` }, { status: 400 });
    }

    const log = { ...logBase(), endpoint: resposta3C.url.replace(/api_token=[^&]+/, "api_token=***"), status: resposta3C.status };

    // A API do 3C Plus retorna 204 para muitos comandos assíncronos: o resultado chega pelo socket.
    if (resposta3C.status === 204) {
      console.log("[3CPlus:CMD]", JSON.stringify({ ...log, async: true }));
      return Response.json({ success: true, async: true, mensagem: "Comando enviado — aguarde evento de confirmação" }, { headers: CORS });
    }

    const dados3C = await lerJson(resposta3C);
    if (!resposta3C.ok) {
      console.warn("[3CPlus:CMD:FAIL]", JSON.stringify({ ...log, detalhe: dados3C }));
      return Response.json({ error: "Erro na API 3C Plus", status: resposta3C.status, detalhe: dados3C }, { status: resposta3C.status, headers: CORS });
    }

    console.log("[3CPlus:CMD:OK]", JSON.stringify(log));
    return Response.json({ success: true, dados: dados3C }, { headers: CORS });
  } catch (error) {
    console.error("[executarComando3CPlus]", error.message);
    return respostaErro3C(error, CORS);
  }
};
