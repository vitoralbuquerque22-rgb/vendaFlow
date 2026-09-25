// Executa as funções do Base44 (pasta base44/functions) sem alterar o código delas.
//
// Cada função chama `Deno.serve(handler)`. Ao carregar, trocamos essa chamada por um registro
// interno e guardamos o handler. Quando o frontend chama /functions/<nome>, montamos a mesma
// requisição que o Base44 montaria (com os cabeçalhos que o SDK espera) e chamamos o handler.
// O SDK dentro da função continua funcionando: ele conversa com esta própria API.

import { resolve, toFileUrl } from "@std/path";
import { config } from "./config.ts";
import { serviceToken } from "./auth.ts";
import { CORS_HEADERS, HttpError } from "./http.ts";

type Handler = (req: Request) => Response | Promise<Response>;

const handlers = new Map<string, Handler>();
const failed = new Map<string, string>();

// Versão única do SDK usada por todas as funções (as funções originais usam várias versões)
const SDK_SPECIFIER = "npm:@base44/sdk@0.8.37";

(globalThis as any).__vfRegister = (name: string, handler: Handler) => {
  handlers.set(name, handler);
};

function transform(name: string, source: string): string {
  let out = source.replace(/npm:@base44\/sdk(@[\w.\-^~]+)?/g, SDK_SPECIFIER);
  if (!out.includes("Deno.serve(")) throw new Error("a função não chama Deno.serve()");
  out = out.replace("Deno.serve(", `globalThis.__vfRegister(${JSON.stringify(name)}, `);
  return out;
}

export async function loadFunctions() {
  await Deno.mkdir(config.generatedDir, { recursive: true });
  const names: string[] = [];
  for await (const entry of Deno.readDir(config.functionsDir)) {
    if (entry.isDirectory && !entry.name.startsWith("_")) names.push(entry.name);
  }
  names.sort();

  for (const name of names) {
    try {
      const source = await Deno.readTextFile(`${config.functionsDir}/${name}/entry.ts`);
      const target = resolve(config.generatedDir, `${name}.ts`);
      const code = transform(name, source);
      // Só grava se mudou (evita reiniciar o modo --watch em loop)
      const current = await Deno.readTextFile(target).catch(() => null);
      if (current !== code) await Deno.writeTextFile(target, code);
      await import(toFileUrl(target).href);
      if (!handlers.has(name)) throw new Error("a função não registrou um handler");
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

// Cabeçalhos do cliente que repassamos para a função
const FORWARDED_HEADERS = ["authorization", "content-type", "user-agent", "x-forwarded-for", "cf-connecting-ip", "x-origin-url", "origin", "referer"];

export async function invokeFunction(name: string, req: Request, pathSuffix = ""): Promise<Response> {
  const handler = handlers.get(name);
  if (!handler) {
    if (failed.has(name)) throw new HttpError(500, `A função ${name} não pôde ser carregada: ${failed.get(name)}`);
    throw new HttpError(404, `Função não encontrada: ${name}`);
  }

  const headers = new Headers();
  for (const [key, value] of req.headers) {
    const k = key.toLowerCase();
    if (FORWARDED_HEADERS.includes(k) || k.startsWith("x-")) headers.set(key, value);
  }
  headers.set("Base44-App-Id", config.appId);
  headers.set("Base44-Api-Url", config.internalApiUrl);
  headers.set("Base44-Service-Authorization", `Bearer ${await serviceToken()}`);
  if (!headers.has("host")) headers.set("host", new URL(config.publicUrl).host);

  const incoming = new URL(req.url);
  const url = `${config.publicUrl}/functions/${name}${pathSuffix}${incoming.search}`;
  const hasBody = !["GET", "HEAD"].includes(req.method);
  const fnRequest = new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
  });

  let response: Response;
  try {
    response = await handler(fnRequest);
  } catch (err) {
    console.error(`[funções] erro em ${name}:`, err);
    throw new HttpError(500, `Erro na função ${name}: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Garante CORS nas respostas (funções públicas são chamadas por sites externos)
  const outHeaders = new Headers(response.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) if (!outHeaders.has(k)) outHeaders.set(k, v);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: outHeaders });
}
