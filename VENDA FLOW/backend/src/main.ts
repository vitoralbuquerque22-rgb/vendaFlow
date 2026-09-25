// Servidor do VendaFlow: API REST + tempo real (Socket.IO).

import { config } from "./config.ts";
import { migrate } from "./db.ts";
import { CORS_HEADERS, errorResponse, HttpError, json, readJson, redirect } from "./http.ts";
import * as auth from "./auth.ts";
import * as entities from "./entities.ts";
import { ensureUploadDir, serveFile } from "./files.ts";
import { readIntegrationBody, runIntegration } from "./integrations.ts";
import { functionStatus, invokeFunction, loadFunctions } from "./functions.ts";
import * as agents from "./agents.ts";
import { io, setRoomGuard, setRoomHooks } from "./realtime.ts";
import * as ponte3c from "./ponte3c.ts";

type Params = Record<string, string>;
type Route = { method: string; pattern: URLPattern; handler: (req: Request, p: Params) => Promise<Response> };

const routes: Route[] = [];
function route(method: string, path: string, handler: Route["handler"]) {
  routes.push({ method, pattern: new URLPattern({ pathname: path }), handler });
}

const ok = (data: unknown) => json(data);

// ---------- Saúde ----------
route("GET", "/api/health", async () => ok({ status: "ok", functions: functionStatus(), pontes3c: ponte3c.statusPontes().filter((p) => p.conectada).length }));

// ---------- Login e cadastro ----------
route("POST", "/api/auth/login", async (req) => ok(await auth.login(await readJson(req))));
route("POST", "/api/auth/register", async (req) => ok(await auth.register(await readJson(req))));
route("POST", "/api/auth/verify-otp", async (req) => ok(await auth.verifyOtp(await readJson(req))));
route("POST", "/api/auth/resend-otp", async (req) => ok(await auth.resendOtp(await readJson(req))));
route("POST", "/api/auth/reset-password-request", async (req) => ok(await auth.resetPasswordRequest(await readJson(req))));
route("POST", "/api/auth/reset-password", async (req) => ok(await auth.resetPassword(await readJson(req))));
route("POST", "/api/auth/change-password", async (req) => ok(await auth.changePassword(await auth.getAuth(req), await readJson(req))));
route("POST", "/api/auth/invite", async (req) => ok(await auth.inviteUser(await auth.getAuth(req), await readJson(req))));
route("GET", "/api/auth/google", async (req) => {
  // Login com Google ainda não configurado: volta para a tela de login
  const from = new URL(req.url).searchParams.get("from_url") ?? "/";
  return redirect(`${config.publicUrl}/login?error=google_nao_configurado&from_url=${encodeURIComponent(from)}`);
});

// ---------- Usuário atual ----------
route("GET", "/api/auth/me", async (req) => {
  const user = auth.requireUser(await auth.getAuth(req));
  return ok(auth.publicUser(user));
});
route("PUT", "/api/auth/me", async (req) => {
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

route("GET", "/api/entities/:entity", async (req, p) =>
  ok(await entities.listRecords(p.entity, await auth.getAuth(req), listOptions(new URL(req.url))))
);
route("POST", "/api/entities/:entity", async (req, p) =>
  ok(await entities.createRecord(p.entity, await readJson(req), await auth.getAuth(req)))
);
route("DELETE", "/api/entities/:entity", async (req, p) =>
  ok(await entities.deleteMany(p.entity, await readJson(req), await auth.getAuth(req)))
);
route("POST", "/api/entities/:entity/bulk", async (req, p) =>
  ok(await entities.bulkCreate(p.entity, await readJson(req), await auth.getAuth(req)))
);
route("PUT", "/api/entities/:entity/bulk", async (req, p) =>
  ok(await entities.bulkUpdate(p.entity, await readJson(req), await auth.getAuth(req)))
);
route("PATCH", "/api/entities/:entity/update-many", async (req, p) =>
  ok(await entities.updateMany(p.entity, await readJson(req), await auth.getAuth(req)))
);
route("GET", "/api/entities/:entity/:id", async (req, p) =>
  ok(await entities.getRecord(p.entity, p.id, await auth.getAuth(req)))
);
route("PUT", "/api/entities/:entity/:id", async (req, p) =>
  ok(await entities.updateRecord(p.entity, p.id, await readJson(req), await auth.getAuth(req)))
);
route("DELETE", "/api/entities/:entity/:id", async (req, p) =>
  ok(await entities.deleteRecord(p.entity, p.id, await auth.getAuth(req)))
);

// ---------- Funções ----------
route("*", "/api/functions/:name{/*}?", async (req, p) => await invokeFunction(p.name, req, p[0] ? `/${p[0]}` : ""));

// ---------- Integrações e arquivos ----------
route("POST", "/api/integrations/:name", async (req, p) =>
  ok(await runIntegration(p.name, await readIntegrationBody(req), await auth.getAuth(req)))
);
route("GET", "/api/files/:id{/:name}?", async (req, p) => await serveFile(p.id, req));

// ---------- Agentes de IA ----------
route("POST", "/api/agents/conversations", async (req) =>
  ok(await agents.createConversation(await readJson(req), await auth.getAuth(req)))
);
route("GET", "/api/agents/conversations", async (req) =>
  ok(await agents.listConversations(await auth.getAuth(req), new URL(req.url).searchParams))
);
route("GET", "/api/agents/conversations/:id", async (req, p) =>
  ok(await agents.getConversation(p.id, await auth.getAuth(req)))
);
route("POST", "/api/agents/conversations/:id/messages", async (req, p) =>
  ok(await agents.addMessage(p.id, await readJson(req), await auth.getAuth(req)))
);

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
  const conv = room.match(/^conversation:([a-f0-9]+)$/);
  if (conv) return !!ctx.user && (await agents.canJoinConversation(conv[1], ctx.user.id));
  if (room.startsWith("entities:")) return auth.isAdmin(ctx.user);
  if (room.startsWith("telefonia:")) return await ponte3c.podeEntrar(room, ctx.user);
  return false;
});

// Salas de telefonia abrem (e fecham) a conexão com o socket do 3C Plus no servidor
setRoomHooks({
  aoEntrar: async (room, token) => {
    if (!room.startsWith("telefonia:")) return;
    await ponte3c.aoEntrarNaSala(room, await ponte3c.usuarioDaSala(token, auth.getAuth));
  },
  aoEsvaziar: (room) => {
    if (room.startsWith("telefonia:")) ponte3c.aoEsvaziarSala(room);
  },
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
