// Agentes de IA (base44/agents) rodando com o Claude.
// Mantém o mesmo contrato do SDK: conversas, mensagens e atualizações em tempo real.

import type Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.ts";
import { newId, sql } from "./db.ts";
import { HttpError } from "./http.ts";
import { type AuthContext, publicUser, requireUser } from "./auth.ts";
import { createRecord, entityProperties, listRecords, stripJsonComments, updateRecord, deleteRecord, getRecord } from "./entities.ts";
import { baseParams, claude, fileBlocks, textOf } from "./llm.ts";
import { emitToRoom } from "./realtime.ts";

interface AgentConfig {
  name: string;
  description?: string;
  instructions: string;
  tool_configs?: { entity_name: string; allowed_operations: string[] }[];
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  file_urls?: string[];
  tool_calls?: { id: string; name: string; arguments_string: string; status: string; results?: string }[];
  created_date: string;
}

interface Conversation {
  id: string;
  agent_name: string;
  user_id: string | null;
  metadata: Record<string, unknown>;
  messages: Message[];
  created_date: string;
  updated_date: string;
}

const agents = new Map<string, AgentConfig>();

export async function loadAgents() {
  try {
    for await (const entry of Deno.readDir(config.agentsDir)) {
      if (!entry.isFile || !/\.jsonc?$/.test(entry.name)) continue;
      const agent = JSON.parse(stripJsonComments(await Deno.readTextFile(`${config.agentsDir}/${entry.name}`))) as AgentConfig;
      agent.name ??= entry.name.replace(/\.jsonc?$/, "");
      agents.set(agent.name, agent);
    }
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) throw err;
  }
  console.log(`[agentes] ${agents.size} carregado(s)`);
}

// ---------- Conversas ----------
function toConversation(row: any): Conversation {
  return { ...row, created_by: undefined };
}

async function loadConversation(id: string, auth: AuthContext): Promise<Conversation> {
  const [row] = await sql`select * from conversations where id = ${id}`;
  if (!row) throw new HttpError(404, "Conversa não encontrada");
  if (!auth.service && row.user_id !== auth.user?.id) throw new HttpError(404, "Conversa não encontrada");
  return toConversation(row);
}

export async function canJoinConversation(conversationId: string, userId: string | null) {
  const [row] = await sql`select user_id from conversations where id = ${conversationId}`;
  return !!row && row.user_id === userId;
}

export async function createConversation(body: any, auth: AuthContext) {
  const user = requireUser(auth);
  const agentName = String(body.agent_name ?? "");
  if (!agents.has(agentName)) throw new HttpError(404, `Agente não encontrado: ${agentName}`);
  const [row] = await sql`
    insert into conversations (id, agent_name, user_id, metadata)
    values (${newId()}, ${agentName}, ${user.id}, ${sql.json(body.metadata ?? {})})
    returning *`;
  return toConversation(row);
}

export async function listConversations(auth: AuthContext, params: URLSearchParams) {
  const user = requireUser(auth);
  const agentName = params.get("agent_name");
  const rows = agentName
    ? await sql`select * from conversations where user_id = ${user.id} and agent_name = ${agentName} order by created_date desc limit 100`
    : await sql`select * from conversations where user_id = ${user.id} order by created_date desc limit 100`;
  return rows.map(toConversation);
}

export async function getConversation(id: string, auth: AuthContext) {
  return await loadConversation(id, auth);
}

async function saveMessage(conversationId: string, message: Message) {
  // substitui a mensagem se já existir (mesmo id), senão adiciona no fim
  await sql`
    update conversations set
      messages = case
        when exists (select 1 from jsonb_array_elements(messages) m where m->>'id' = ${message.id})
          then (select jsonb_agg(case when m->>'id' = ${message.id} then ${sql.json(message as any)}::jsonb else m end)
                from jsonb_array_elements(messages) m)
        else messages || jsonb_build_array(${sql.json(message as any)}::jsonb)
      end,
      updated_date = now()
    where id = ${conversationId}`;
  emitToRoom(`/agent-conversations/${conversationId}`, { _message: message });
}

export async function addMessage(conversationId: string, body: any, auth: AuthContext) {
  const user = requireUser(auth);
  const conversation = await loadConversation(conversationId, auth);
  const message: Message = {
    id: newId(),
    role: "user",
    content: String(body.content ?? ""),
    file_urls: Array.isArray(body.file_urls) ? body.file_urls : undefined,
    created_date: new Date().toISOString(),
  };
  await saveMessage(conversationId, message);

  // A resposta do agente roda em segundo plano e chega pelo socket
  runAgent({ ...conversation, messages: [...conversation.messages, message] }, auth, user).catch(async (err) => {
    console.error("[agentes] erro:", err);
    await saveMessage(conversationId, {
      id: newId(),
      role: "assistant",
      content: `⚠️ Não consegui responder agora: ${err instanceof Error ? err.message : String(err)}`,
      created_date: new Date().toISOString(),
    });
  });
  return message;
}

// ---------- Ferramentas (acesso às entidades permitido pelo agente) ----------
function describeFields(entity: string): string {
  return Object.entries(entityProperties(entity))
    .map(([name, p]) => `${name} (${p.type ?? "any"}${p.enum ? `: ${p.enum.join("|")}` : ""})`)
    .join(", ");
}

function buildTools(agent: AgentConfig): Anthropic.Tool[] {
  const tools: Anthropic.Tool[] = [];
  for (const tc of agent.tool_configs ?? []) {
    const e = tc.entity_name;
    const ops = new Set(tc.allowed_operations);
    const fields = describeFields(e);
    if (ops.has("read")) {
      tools.push({
        name: `ler_${e}`,
        description: `Busca registros de ${e}. Campos: ${fields}. Também tem id, created_date, updated_date, created_by.`,
        input_schema: {
          type: "object",
          properties: {
            query: { type: "object", description: 'Filtro estilo MongoDB, ex: {"status": "novo"} ou {"id": "..."}. Vazio = todos.' },
            sort: { type: "string", description: 'Campo para ordenar, "-" na frente para decrescente. Ex: "-created_date"' },
            limit: { type: "integer", description: "Máximo de registros (padrão 20, máximo 200)" },
          },
        },
      });
    }
    if (ops.has("create")) {
      tools.push({
        name: `criar_${e}`,
        description: `Cria um registro de ${e}. Campos: ${fields}`,
        input_schema: { type: "object", properties: { data: { type: "object" } }, required: ["data"] },
      });
    }
    if (ops.has("update")) {
      tools.push({
        name: `atualizar_${e}`,
        description: `Atualiza campos de um registro de ${e} (só os campos enviados mudam). Campos: ${fields}`,
        input_schema: { type: "object", properties: { id: { type: "string" }, data: { type: "object" } }, required: ["id", "data"] },
      });
    }
    if (ops.has("delete")) {
      tools.push({
        name: `excluir_${e}`,
        description: `Exclui um registro de ${e}`,
        input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      });
    }
  }
  return tools;
}

async function runTool(name: string, input: any, auth: AuthContext, agent: AgentConfig): Promise<unknown> {
  const [action, entity] = [name.slice(0, name.indexOf("_")), name.slice(name.indexOf("_") + 1)];
  const allowed = agent.tool_configs?.find((t) => t.entity_name === entity)?.allowed_operations ?? [];
  const opMap: Record<string, string> = { ler: "read", criar: "create", atualizar: "update", excluir: "delete" };
  if (!allowed.includes(opMap[action])) throw new Error(`Operação não permitida: ${name}`);
  switch (action) {
    case "ler": {
      const query = input?.query && typeof input.query === "object" ? input.query : {};
      if (typeof query.id === "string" && Object.keys(query).length === 1) return [await getRecord(entity, query.id, auth)];
      return await listRecords(entity, auth, { query, sort: input?.sort, limit: Math.min(Number(input?.limit) || 20, 200) });
    }
    case "criar":
      return await createRecord(entity, input?.data ?? {}, auth);
    case "atualizar":
      return await updateRecord(entity, String(input?.id), input?.data ?? {}, auth);
    case "excluir":
      return await deleteRecord(entity, String(input?.id), auth);
  }
  throw new Error(`Ferramenta desconhecida: ${name}`);
}

// ---------- Execução do agente ----------
async function toClaudeMessages(messages: Message[]): Promise<Anthropic.Beta.BetaMessageParam[]> {
  const out: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of messages) {
    if (!m.content && !m.file_urls?.length) continue;
    const content: Anthropic.Beta.BetaContentBlockParam[] =
      m.role === "user" ? [...(await fileBlocks(m.file_urls)), { type: "text", text: m.content || "(arquivo anexado)" }] : [{ type: "text", text: m.content }];
    const last = out[out.length - 1];
    if (last && last.role === m.role) (last.content as Anthropic.Beta.BetaContentBlockParam[]).push(...content);
    else out.push({ role: m.role, content });
  }
  return out;
}

async function runAgent(conversation: Conversation, auth: AuthContext, user: NonNullable<AuthContext["user"]>) {
  const agent = agents.get(conversation.agent_name);
  if (!agent) throw new Error("Agente não encontrado");

  const u = publicUser(user) as Record<string, unknown>;
  const context = [
    `Data e hora atual: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`,
    `Usuário: ${u.full_name ?? ""} <${u.email}>, papel: ${u.role}.`,
    u.empresaAtualId ? `Empresa atual (empresaId): ${u.empresaAtualId}. Use esse empresaId ao buscar e ao criar registros.` : "",
  ].filter(Boolean).join("\n");

  const tools = buildTools(agent);
  const messages = await toClaudeMessages(conversation.messages);
  const reply: Message = { id: newId(), role: "assistant", content: "", tool_calls: [], created_date: new Date().toISOString() };
  let lastEmit = 0;
  // Salvamentos em fila, para uma atualização parcial nunca sobrescrever a final
  let saving: Promise<void> = Promise.resolve();
  const push = () => {
    const snapshot: Message = { ...reply, tool_calls: reply.tool_calls!.map((c) => ({ ...c })) };
    saving = saving.then(() => saveMessage(conversation.id, snapshot)).catch((err) => console.error("[agentes] erro ao salvar", err));
    return saving;
  };

  for (let turn = 0; turn < 15; turn++) {
    const stream = claude().beta.messages.stream({
      ...baseParams(),
      max_tokens: 32000,
      system: [
        { type: "text", text: agent.instructions, cache_control: { type: "ephemeral" } },
        { type: "text", text: context },
      ],
      tools: tools.length ? tools : undefined,
      messages,
    } as any);

    const before = reply.content;
    stream.on("text", (delta: string) => {
      reply.content += delta;
      if (Date.now() - lastEmit > 400) {
        lastEmit = Date.now();
        push();
      }
    });
    const response = await stream.finalMessage() as Anthropic.Beta.BetaMessage;

    if (response.stop_reason === "refusal") {
      reply.content = before + "\n\nNão posso ajudar com esse pedido.";
      break;
    }
    // Garante o texto final mesmo se algum trecho não passou pelo evento "text"
    const finalText = textOf(response.content);
    if (finalText && !reply.content.endsWith(finalText)) reply.content = before + finalText;

    messages.push({ role: "assistant", content: response.content as any });
    if (response.stop_reason === "pause_turn") continue;
    if (response.stop_reason !== "tool_use") break;

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const call = { id: block.id, name: block.name, arguments_string: JSON.stringify(block.input), status: "running" as string, results: undefined as string | undefined };
      reply.tool_calls!.push(call);
      await push();
      try {
        const result = await runTool(block.name, block.input, auth, agent);
        call.status = "completed";
        call.results = JSON.stringify(result).slice(0, 2000);
        results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
      } catch (err) {
        call.status = "error";
        call.results = err instanceof Error ? err.message : String(err);
        results.push({ type: "tool_result", tool_use_id: block.id, content: call.results, is_error: true });
      }
    }
    messages.push({ role: "user", content: results });
    if (reply.content && !reply.content.endsWith("\n")) reply.content += "\n\n";
  }

  reply.content = reply.content.trim() || "Pronto.";
  await push();
}
