// Integração com o Claude (substitui o InvokeLLM do Base44).

import Anthropic from "@anthropic-ai/sdk";
import { encodeBase64 } from "@std/encoding/base64";
import { config } from "./config.ts";
import { HttpError } from "./http.ts";
import { readLocalFile } from "./files.ts";

let client: Anthropic | null = null;
export function claude(): Anthropic {
  if (!Deno.env.get("ANTHROPIC_API_KEY")) {
    throw new HttpError(503, "IA não configurada: defina ANTHROPIC_API_KEY no arquivo .env");
  }
  client ??= new Anthropic();
  return client;
}

// Parâmetros comuns a todas as chamadas: modelo, raciocínio adaptativo e fallback em caso de recusa
export function baseParams() {
  const params: Record<string, unknown> = {
    model: config.claude.model,
    thinking: { type: "adaptive" },
  };
  const betas: string[] = [];
  if (config.claude.fallbacks === "default") {
    params.fallbacks = "default";
    betas.push("server-side-fallback-2026-07-01");
  }
  if (betas.length) params.betas = betas;
  return params;
}

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

// Transforma URLs de arquivos em blocos de conteúdo que o Claude entende
export async function fileBlocks(fileUrls: unknown): Promise<Anthropic.Beta.BetaContentBlockParam[]> {
  const urls = Array.isArray(fileUrls) ? fileUrls : fileUrls ? [fileUrls] : [];
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const raw of urls) {
    const url = String(raw);
    const local = await readLocalFile(url);
    if (local) {
      const mime = local.mime.split(";")[0];
      if (IMAGE_TYPES.has(mime)) {
        blocks.push({ type: "image", source: { type: "base64", media_type: mime as any, data: encodeBase64(local.bytes) } });
      } else if (mime === "application/pdf") {
        blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: encodeBase64(local.bytes) }, title: local.name });
      } else {
        const text = new TextDecoder().decode(local.bytes);
        blocks.push({ type: "document", source: { type: "text", media_type: "text/plain", data: text }, title: local.name });
      }
      continue;
    }
    if (/\.(png|jpe?g|gif|webp)(\?|$)/i.test(url)) {
      blocks.push({ type: "image", source: { type: "url", url } });
    } else if (/\.pdf(\?|$)/i.test(url)) {
      blocks.push({ type: "document", source: { type: "url", url } });
    } else {
      blocks.push({ type: "text", text: `Arquivo anexado: ${url}` });
    }
  }
  return blocks;
}

export function textOf(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

// Structured outputs exige additionalProperties: false em todos os objetos
function strictSchema(schema: any): any {
  if (!schema || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) return schema.map(strictSchema);
  const out: any = {};
  for (const [k, v] of Object.entries(schema)) out[k] = strictSchema(v);
  if (out.type === "object" || out.properties) {
    out.type ??= "object";
    out.properties ??= {};
    out.additionalProperties = false;
  }
  return out;
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (m) return JSON.parse(m[0]);
    throw new HttpError(502, "A IA não devolveu um JSON válido");
  }
}

async function createMessage(params: Record<string, unknown>) {
  const client = claude();
  let messages = params.messages as Anthropic.Beta.BetaMessageParam[];
  // Continua enquanto a busca na internet pedir mais uma rodada (pause_turn)
  for (let i = 0; i < 5; i++) {
    const response = await client.beta.messages.create({ ...params, messages } as any) as Anthropic.Beta.BetaMessage;
    if (response.stop_reason === "refusal") {
      throw new HttpError(422, "A IA recusou este pedido. Tente reformular.", "LLM_REFUSAL");
    }
    if (response.stop_reason !== "pause_turn") return response;
    messages = [...messages, { role: "assistant", content: response.content as any }];
  }
  throw new HttpError(504, "A IA demorou demais para responder");
}

export async function invokeLLM(body: any): Promise<unknown> {
  const prompt = String(body.prompt ?? "");
  if (!prompt) throw new HttpError(400, "prompt é obrigatório");

  const content: Anthropic.Beta.BetaContentBlockParam[] = [...(await fileBlocks(body.file_urls)), { type: "text", text: prompt }];
  const params: Record<string, unknown> = {
    ...baseParams(),
    max_tokens: 16000,
    messages: [{ role: "user", content }],
  };
  if (body.add_context_from_internet) {
    params.tools = [{ type: "web_search_20260209", name: "web_search" }];
  }

  const schema = body.response_json_schema;
  if (!schema) return textOf((await createMessage(params)).content);

  try {
    const response = await createMessage({
      ...params,
      output_config: { format: { type: "json_schema", schema: strictSchema(schema) } },
    });
    return extractJson(textOf(response.content));
  } catch (err) {
    // Se o esquema não for aceito pelo modo estruturado, pede o JSON pelo próprio prompt
    if (!(err instanceof Anthropic.BadRequestError)) throw err;
    console.warn("[llm] esquema não aceito no modo estruturado, usando instrução no prompt:", err.message);
    const fallbackContent = [...content];
    fallbackContent[fallbackContent.length - 1] = {
      type: "text",
      text: `${prompt}\n\nResponda APENAS com um JSON válido, sem texto extra, seguindo este JSON Schema:\n${JSON.stringify(schema)}`,
    };
    const response = await createMessage({ ...params, messages: [{ role: "user", content: fallbackContent }] });
    return extractJson(textOf(response.content));
  }
}
