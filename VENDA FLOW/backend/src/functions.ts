// Carrega e executa as funções da pasta functions/.
// Cada função é um arquivo functions/<nome>/entry.ts com `export default async (req) => Response`.

import { resolve, toFileUrl } from "@std/path";
import { config } from "./config.ts";
import { type AuthContext, getAuth } from "./auth.ts";
import { CORS_HEADERS, HttpError } from "./http.ts";
import { bindRequestAuth } from "./sdk.ts";

type Handler = (req: Request) => Response | Promise<Response>;

const handlers = new Map<string, Handler>();
const failed = new Map<string, string>();

export async function loadFunctions() {
  const names: string[] = [];
  for await (const entry of Deno.readDir(config.functionsDir)) {
    if (entry.isDirectory && !entry.name.startsWith("_")) names.push(entry.name);
  }
  names.sort();

  for (const name of names) {
    try {
      const mod = await import(toFileUrl(resolve(config.functionsDir, name, "entry.ts")).href);
      if (typeof mod.default !== "function") throw new Error("a função não exporta um handler (export default)");
      handlers.set(name, mod.default);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failed.set(name, message);
      console.error(`[funções] falha ao carregar ${name}: ${message}`);
    }
  }
  console.log(`[funções] ${handlers.size} carregadas, ${failed.size} com erro`);
}

export function functionStatus() {
  return { loaded: [...handlers.keys()], failed: Object.fromEntries(failed) };
}

function getHandler(name: string): Handler {
  const handler = handlers.get(name);
  if (handler) return handler;
  if (failed.has(name)) throw new HttpError(500, `A função ${name} não pôde ser carregada: ${failed.get(name)}`);
  throw new HttpError(404, `Função não encontrada: ${name}`);
}

async function run(name: string, handler: Handler, req: Request): Promise<Response> {
  try {
    return await handler(req);
  } catch (err) {
    console.error(`[funções] erro em ${name}:`, err);
    throw new HttpError(500, `Erro na função ${name}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// Chamada vinda do navegador ou de um webhook externo: /api/functions/<nome>
export async function invokeFunction(name: string, req: Request, pathSuffix = ""): Promise<Response> {
  const handler = getHandler(name);
  const auth = await getAuth(req);

  const incoming = new URL(req.url);
  const hasBody = !["GET", "HEAD"].includes(req.method);
  const fnRequest = new Request(`${config.publicUrl}/api/functions/${name}${pathSuffix}${incoming.search}`, {
    method: req.method,
    headers: req.headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
  });
  bindRequestAuth(fnRequest, auth);

  const response = await run(name, handler, fnRequest);
  // Garante CORS nas respostas (funções públicas são chamadas por sites externos)
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) if (!headers.has(k)) headers.set(k, v);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export class FunctionCallError extends Error {
  response: { status: number; data: unknown };
  constructor(message: string, public status: number, public data: unknown) {
    super(message);
    this.response = { status, data };
  }
}

// Chamada de uma função por outra: api.functions.invoke(nome, dados)
export async function callFunction(name: string, data: Record<string, unknown>, auth: AuthContext) {
  const handler = getHandler(name);
  const req = new Request(`${config.publicUrl}/api/functions/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  bindRequestAuth(req, auth);
  const response = await run(name, handler, req);
  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch { /* resposta não é JSON */ }
  if (!response.ok) {
    const message = (body as any)?.error ?? (body as any)?.message ?? `Função ${name} falhou (${response.status})`;
    throw new FunctionCallError(String(message), response.status, body);
  }
  return { data: body, status: response.status, headers: Object.fromEntries(response.headers) };
}
