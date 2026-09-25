export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(data === undefined ? null : JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS, ...headers },
  });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return json({ message: err.message, detail: err.message, code: err.code, ...err.extra }, err.status);
  }
  console.error("[erro interno]", err);
  const message = err instanceof Error ? err.message : String(err);
  return json({ message: "Erro interno do servidor", detail: message }, 500);
}

export async function readJson(req: Request): Promise<any> {
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "JSON inválido no corpo da requisição");
  }
}

export function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { Location: location, ...CORS_HEADERS } });
}
