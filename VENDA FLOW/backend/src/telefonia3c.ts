// Acesso à API do 3C Plus com tokens de serviço.
//
// O 3C Plus descontinua o token pessoal de usuário em 01/10/2026. Integrações passam a usar
// tokens de serviço (prefixo 3cs_), que pertencem à organização:
//   - token de gestor:  configuracao.token_gestor         → acesso à organização toda
//   - token de agente:  configuracao.token_servico_agente → age por QUALQUER agente ativo,
//                        identificado em cada requisição pelo header X-Agent-Id
// O id do agente de cada SDR fica em UserProfile.id_3cplus (resolvido pelo ramal quando falta).
//
// Transição: se a empresa ainda não cadastrou o token de serviço de agente, usamos o token
// pessoal do SDR (UserProfile.token_3cplus), que deixa de funcionar em 01/10/2026.
//
// Referência: docs/3cplus/INTEGRACAO_3CPLUS.md

type Api = any;

export class Erro3C extends Error {
  constructor(message: string, public status = 400, public detalhe?: unknown) {
    super(message);
  }
}

export interface Credencial3C {
  papel: "gestor" | "agente";
  dominio: string;
  baseUrl: string;
  token: string;
  /** X-Agent-Id — presente quando o token é de serviço com papel agente */
  agenteId?: number;
  /** "servico" = token de serviço; "pessoal" = token pessoal legado (até 01/10/2026) */
  origem: "servico" | "pessoal";
  config: Record<string, any>;
}

// ── Tokens gravados criptografados (formato enc:<iv>:<ct>, AES-256-GCM) ──
function b64decode(s: string) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export async function decryptToken(value: unknown): Promise<string> {
  const v = String(value ?? "").trim();
  if (!v.startsWith("enc:")) return v;
  const keyB64 = Deno.env.get("TOKEN_ENCRYPTION_KEY");
  if (!keyB64) throw new Erro3C("TOKEN_ENCRYPTION_KEY não configurada", 500);
  const [, ivB64, ctB64] = v.split(":");
  const key = await crypto.subtle.importKey("raw", b64decode(keyB64), "AES-GCM", false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64decode(ivB64) }, key, b64decode(ctB64));
  return new TextDecoder().decode(pt);
}

export function mascarar(token: string) {
  return token ? `${token.slice(0, 6)}…${token.slice(-4)}` : "(vazio)";
}

// ── Configuração da empresa ──
export async function carregarConfig3C(api: Api, empresaId: string) {
  if (!empresaId) throw new Erro3C("empresaId é obrigatório");
  const integracoes = await api.asServiceRole.entities.Integracao.filter({ empresaId, tipo: "telefonia" });
  const integracao = integracoes.find((i: any) => i.configuracao?.fornecedor === "3cplus" && i.ativa !== false);
  if (!integracao) throw new Erro3C("Integração 3C Plus não encontrada ou inativa", 404);
  const config = integracao.configuracao ?? {};
  const dominio = String(config.dominio ?? "").trim().replace(/\.3c\.plus.*$/, "");
  if (!dominio) throw new Erro3C('Domínio 3C Plus não configurado na integração (ex: "minha-empresa").');
  return { integracao, config, dominio, baseUrl: `https://${dominio}.3c.plus/api/v1` };
}

export async function credencialGestor(api: Api, empresaId: string): Promise<Credencial3C> {
  const { config, dominio, baseUrl } = await carregarConfig3C(api, empresaId);
  const token = await decryptToken(config.token_gestor);
  if (!token) throw new Erro3C("Token de gestor do 3C Plus não configurado na integração");
  return { papel: "gestor", dominio, baseUrl, token, origem: token.startsWith("3cs_") ? "servico" : "pessoal", config };
}

/**
 * Credencial para agir como o agente do SDR `email`.
 * Com token de serviço: usa o id 3C do SDR (UserProfile.id_3cplus), resolvendo pelo ramal se faltar.
 */
export async function credencialAgente(api: Api, empresaId: string, email: string): Promise<Credencial3C> {
  const { config, dominio, baseUrl } = await carregarConfig3C(api, empresaId);
  const [perfil] = await api.asServiceRole.entities.UserProfile.filter({ user_email: email });

  const tokenServico = await decryptToken(config.token_servico_agente);
  if (tokenServico) {
    const agenteId = await resolverAgenteId(api, { perfil, empresaId, baseUrl, config });
    return { papel: "agente", dominio, baseUrl, token: tokenServico, agenteId, origem: "servico", config };
  }

  // Transição: token pessoal do SDR (ou mapeamento legado)
  const emailLower = email.toLowerCase();
  const tokenPessoal = (await decryptToken(perfil?.token_3cplus).catch(() => "")) ||
    config.mapeamento_agentes?.[emailLower] || config.mapeamento_agentes?.[email] || "";
  if (!tokenPessoal) {
    throw new Erro3C(
      "Telefonia não configurada para este usuário: cadastre o token de serviço de agente na integração 3C Plus " +
        "e o ramal do SDR em Perfil → Telefonia.",
    );
  }
  return { papel: "agente", dominio, baseUrl, token: tokenPessoal, origem: "pessoal", config };
}

async function resolverAgenteId(
  api: Api,
  { perfil, empresaId, baseUrl, config }: { perfil: any; empresaId: string; baseUrl: string; config: any },
): Promise<number> {
  if (Number(perfil?.id_3cplus) > 0) return Number(perfil.id_3cplus);

  const ramal = String(perfil?.ramal_3cplus ?? "").trim();
  if (!ramal) {
    throw new Erro3C("Agente 3C Plus não identificado: preencha o ramal do SDR em Perfil → Telefonia.");
  }
  const tokenGestor = await decryptToken(config.token_gestor);
  if (!tokenGestor) throw new Erro3C("Token de gestor do 3C Plus não configurado (necessário para localizar o agente pelo ramal).");

  const gestor: Credencial3C = { papel: "gestor", dominio: "", baseUrl, token: tokenGestor, origem: "servico", config };
  const resp = await chamar3C(gestor, "/agents", { query: { per_page: 500 } });
  const dados = await lerJson(resp);
  if (!resp.ok) throw new Erro3C("Não foi possível listar os agentes do 3C Plus", resp.status, dados);
  const agente = (dados?.data ?? []).find((a: any) => String(a?.extension?.extension_number) === ramal && a?.active !== false);
  if (!agente) throw new Erro3C(`Nenhum agente ativo com o ramal ${ramal} no 3C Plus.`, 404);

  // Guarda para as próximas requisições
  if (perfil?.id) await api.asServiceRole.entities.UserProfile.update(perfil.id, { id_3cplus: Number(agente.id) }).catch(() => {});
  console.log(`[3C] agente do ramal ${ramal} resolvido: id ${agente.id} (empresa ${empresaId})`);
  return Number(agente.id);
}

// ── Chamada à API ──
export interface Opcoes3C {
  method?: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  json?: unknown;
  form?: Record<string, string>;
  timeoutMs?: number;
}

export function headers3C(cred: Credencial3C): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${cred.token}`, accept: "application/json" };
  if (cred.agenteId) h["X-Agent-Id"] = String(cred.agenteId);
  return h;
}

/** Chama a API do 3C Plus com Bearer (e X-Agent-Id quando for token de serviço de agente). */
export function chamar3C(cred: Credencial3C, path: string, opcoes: Opcoes3C = {}): Promise<Response> {
  const url = new URL(`${cred.baseUrl}${path.startsWith("/") ? path : `/${path}`}`);
  url.searchParams.delete("api_token");
  for (const [k, v] of Object.entries(opcoes.query ?? {})) if (v !== undefined && v !== null) url.searchParams.set(k, String(v));

  const headers = headers3C(cred);
  let body: BodyInit | undefined;
  if (opcoes.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opcoes.json);
  } else if (opcoes.form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(opcoes.form).toString();
  }
  const method = opcoes.method ?? (body !== undefined ? "POST" : "GET");
  return fetch(url, { method, headers, body, signal: AbortSignal.timeout(opcoes.timeoutMs ?? 15000) });
}

/**
 * Compatível com `fetch(url, init)`: aceita a URL completa já montada pelas funções antigas,
 * remove o `api_token` da URL e troca a autenticação pelos headers corretos.
 */
export function fetch3C(cred: Credencial3C, url: string | URL, init: RequestInit = {}): Promise<Response> {
  const u = new URL(String(url));
  u.searchParams.delete("api_token");
  const headers = new Headers(init.headers);
  headers.delete("authorization");
  // Mantém o accept do chamador (ex: download de gravação em áudio)
  for (const [k, v] of Object.entries(headers3C(cred))) if (k !== "accept" || !headers.has("accept")) headers.set(k, v);
  return fetch(u, { ...init, headers, signal: init.signal ?? AbortSignal.timeout(15000) });
}

export async function lerJson(resp: Response): Promise<any> {
  const text = await resp.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

/** Resposta de erro padronizada para as funções. */
export function respostaErro3C(err: unknown, cors: Record<string, string> = { "Access-Control-Allow-Origin": "*" }) {
  if (err instanceof Erro3C) {
    return Response.json({ error: err.message, detalhe: err.detalhe }, { status: err.status, headers: cors });
  }
  const message = err instanceof Error ? err.message : String(err);
  return Response.json({ error: message }, { status: 500, headers: cors });
}
