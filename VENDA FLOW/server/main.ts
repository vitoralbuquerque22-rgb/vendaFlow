// Servidor do VendaFlow: responde nos mesmos endereços da API do Base44,
// para o frontend e as funções continuarem usando o SDK oficial sem mudanças.

import { config } from "./config.ts";
import { migrate } from "./db.ts";
import { CORS_HEADERS, errorResponse, HttpError, json, readJson, redirect } from "./http.ts";
import * as auth from "./auth.ts";
import * as entities from "./entities.ts";
import { ensureUploadDir, serveFile } from "./files.ts";
import { handleCoreIntegration } from "./integrations.ts";
import { functionStatus, invokeFunction, loadFunctions } from "./functions.ts";
import * as agents from "./agents.ts";
import { io, setRoomGuard } from "./realtime.ts";

type Params = Record<string, string>;
type Route = { method: string; pattern: URLPattern; handler: (req: Request, p: Params) => Promise<Response> };

const routes: Route[] = [];
function route(method: string, path: string, handler: Route["handler"]) {
  routes.push({ method, pattern: new URLPattern({ pathname: path }), handler });
}

const ok = (data: unknown) => json(data);

// ---------- Saúde ----------
route("GET", "/api/health", async () => ok({ status: "ok", functions: functionStatus() }));

// ---------- Configuração pública do app ----------
route("GET", "/api/apps/public/prod/public-settings/by-id/:appId", async (_req, p) =>
  ok({ id: p.appId, public_settings: { auth_config: { enable_username_password: true, enable_google_login: !!config.google.clientId } } })
);

// ---------- Login e cadastro ----------
route("POST", "/api/apps/:appId/auth/login", async (req) => ok(await auth.login(await readJson(req))));
route("POST", "/api/apps/:appId/auth/register", async (req) => ok(await auth.register(await readJson(req))));
route("POST", "/api/apps/:appId/auth/verify-otp", async (req) => ok(await auth.verifyOtp(await readJson(req))));
route("POST", "/api/apps/:appId/auth/resend-otp", async (req) => ok(await auth.resendOtp(await readJson(req))));
route("POST", "/api/apps/:appId/auth/reset-password-request", async (req) => ok(await auth.resetPasswordRequest(await readJson(req))));
route("POST", "/api/apps/:appId/auth/reset-password", async (req) => ok(await auth.resetPassword(await readJson(req))));
route("POST", "/api/apps/:appId/auth/change-password", async (req) => ok(await auth.changePassword(await auth.getAuth(req), await readJson(req))));
route("GET", "/api/apps/auth/logout", async (req) => {
  const from = new URL(req.url).searchParams.get("from_url");
  return redirect(from && from.startsWith(config.publicUrl) ? from : `${config.publicUrl}/login`);
});
route("GET", "/api/apps/auth/login", async (req) => {
  // Login com Google ainda não configurado: volta para a tela de login
  const from = new URL(req.url).searchParams.get("from_url") ?? "/";
  return redirect(`${config.publicUrl}/login?error=google_nao_configurado&from_url=${encodeURIComponent(from)}`);
});
route("POST", "/api/apps/:appId/users/invite-user", async (req) => ok(await auth.inviteUser(await auth.getAuth(req), await readJson(req))));
route("POST", "/api/apps/:appId/runtime/users/invite-user", async (req) => ok(await auth.inviteUser(await auth.getAuth(req), await readJson(req))));

// ---------- Usuário atual ----------
route("GET", "/api/apps/:appId/entities/User/me", async (req) => {
  const user = auth.requireUser(await auth.getAuth(req));
  return ok(auth.publicUser(user));
});
route("PUT", "/api/apps/:appId/entities/User/me", async (req) => {
  const user = auth.requireUser(await auth.getAuth(req));
  return ok(auth.publicUser(await auth.updateUser(user.id, await readJson(req), { allowRole: false })));
});

// ---------- Entidades ----------
function listOptions(url: URL): entities.ListOptions {
  const s = url.searchParams;
  let query: Record<string, unknown> | undefined;
  if (s.get("q")) {
    try {
      query = JSON.parse(s.get("q")!);
    } catch {
      throw new HttpError(400, "Parâmetro q inválido");
    }
  }
  return {
    query,
    sort: s.get("sort") ?? undefined,
    limit: s.get("limit") ? Number(s.get("limit")) : undefined,
    skip: s.get("skip") ? Number(s.get("skip")) : undefined,
    fields: s.get("fields")?.split(",").filter(Boolean),
  };
}

route("GET", "/api/apps/:appId/entities/:entity", async (req, p) =>
  ok(await entities.listRecords(p.entity, await auth.getAuth(req), listOptions(new URL(req.url))))
);
route("POST", "/api/apps/:appId/entities/:entity", async (req, p) =>
  ok(await entities.createRecord(p.entity, await readJson(req), await auth.getAuth(req)))
);
route("DELETE", "/api/apps/:appId/entities/:entity", async (req, p) =>
  ok(await entities.deleteMany(p.entity, await readJson(req), await auth.getAuth(req)))
);
route("POST", "/api/apps/:appId/entities/:entity/bulk", async (req, p) =>
  ok(await entities.bulkCreate(p.entity, await readJson(req), await auth.getAuth(req)))
);
route("PUT", "/api/apps/:appId/entities/:entity/bulk", async (req, p) =>
  ok(await entities.bulkUpdate(p.entity, await readJson(req), await auth.getAuth(req)))
);
route("PATCH", "/api/apps/:appId/entities/:entity/update-many", async (req, p) =>
  ok(await entities.updateMany(p.entity, await readJson(req), await auth.getAuth(req)))
);
route("GET", "/api/apps/:appId/entities/:entity/:id", async (req, p) =>
  ok(await entities.getRecord(p.entity, p.id, await auth.getAuth(req)))
);
route("PUT", "/api/apps/:appId/entities/:entity/:id", async (req, p) =>
  ok(await entities.updateRecord(p.entity, p.id, await readJson(req), await auth.getAuth(req)))
);
route("DELETE", "/api/apps/:appId/entities/:entity/:id", async (req, p) =>
  ok(await entities.deleteRecord(p.entity, p.id, await auth.getAuth(req)))
);

// ---------- Funções ----------
route("*", "/api/apps/:appId/functions/:name", async (req, p) => await invokeFunction(p.name, req));
route("*", "/api/functions/:name{/*}?", async (req, p) => await invokeFunction(p.name, req, p[0] ? `/${p[0]}` : ""));

// ---------- Integrações ----------
route("POST", "/api/apps/:appId/integration-endpoints/Core/:name", async (req, p) =>
  ok(await handleCoreIntegration(p.name, req, await auth.getAuth(req)))
);
route("GET", "/api/files/:id{/:name}?", async (req, p) => await serveFile(p.id, req));

// ---------- Agentes ----------
route("POST", "/api/apps/:appId/agents/conversations", async (req) =>
  ok(await agents.createConversation(await readJson(req), await auth.getAuth(req)))
);
route("GET", "/api/apps/:appId/agents/conversations", async (req) =>
  ok(await agents.listConversations(await auth.getAuth(req), new URL(req.url).searchParams))
);
route("GET", "/api/apps/:appId/agents/conversations/:id", async (req, p) =>
  ok(await agents.getConversation(p.id, await auth.getAuth(req)))
);
route("POST", "/api/apps/:appId/agents/conversations/v2/:id/messages", async (req, p) =>
  ok(await agents.addMessage(p.id, await readJson(req), await auth.getAuth(req)))
);

// ---------- Conectores (Google Agenda etc.) ----------
route("GET", "/api/apps/:appId/external-auth/tokens/:type", async (_req, p) => {
  throw new HttpError(404, `Conector não configurado: ${p.type}`, "CONNECTOR_NOT_CONFIGURED");
});

// ---------- Telemetria do Base44 (ignorada) ----------
route("POST", "/api/apps/:appId/analytics/track/batch", async () => new Response(null, { status: 204, headers: CORS_HEADERS }));
route("POST", "/api/app-logs/:appId/log-user-in-app/:page", async () => new Response(null, { status: 204, headers: CORS_HEADERS }));

// ---------- Roteamento ----------
async function handleApi(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  const url = new URL(req.url);
  let pathMatched = false;
  for (const r of routes) {
    const m = r.pattern.exec({ pathname: url.pathname });
    if (!m) continue;
    pathMatched = true;
    if (r.method !== "*" && r.method !== req.method) continue;
    const params: Params = {};
    for (const [k, v] of Object.entries(m.pathname.groups)) if (v !== undefined) params[k] = decodeURIComponent(v);
    try {
      return await r.handler(req, params);
    } catch (err) {
      return errorResponse(err);
    }
  }
  return errorResponse(new HttpError(pathMatched ? 405 : 404, pathMatched ? "Método não permitido" : `Rota não encontrada: ${url.pathname}`));
}

// Quem pode entrar em cada sala de tempo real
setRoomGuard(async (room, token) => {
  let ctx: auth.AuthContext = auth.ANONYMOUS;
  if (token) {
    const fake = new Request("http://local", { headers: { Authorization: `Bearer ${token}` } });
    ctx = await auth.getAuth(fake).catch(() => auth.ANONYMOUS);
  }
  const conv = room.match(/^\/agent-conversations\/([a-f0-9]+)$/);
  if (conv) return !!ctx.user && (await agents.canJoinConversation(conv[1], ctx.user.id));
  if (room.startsWith("entities:")) return auth.isAdmin(ctx.user);
  return false;
});

// ---------- Inicialização ----------
await migrate();
await ensureUploadDir();
await auth.ensureBootstrapAdmin();
await entities.loadSchemas();
await agents.loadAgents();
await loadFunctions();

const socketHandler = io.handler(async (req: Request) => {
  const path = new URL(req.url).pathname;
  if (path.startsWith("/api/")) return await handleApi(req);
  return json({ message: "VendaFlow API" }, path === "/" ? 200 : 404);
});

Deno.serve({ port: config.port, hostname: "0.0.0.0" }, (req, info) => socketHandler(req, info as any));
console.log(`[servidor] VendaFlow API rodando na porta ${config.port}`);
