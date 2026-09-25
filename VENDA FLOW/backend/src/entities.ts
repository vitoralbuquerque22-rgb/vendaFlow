// CRUD genérico das entidades (pasta entities/) + regras de acesso por registro (RLS).

import { config } from "./config.ts";
import { newId, sql } from "./db.ts";
import { HttpError } from "./http.ts";
import { getPath, matches, SqlBuilder } from "./query.ts";
import { type AuthContext, findUserById, isAdmin, publicUser, updateUser, type UserRow } from "./auth.ts";
import { broadcast } from "./realtime.ts";

type Op = "create" | "read" | "update" | "delete";
type Filter = Record<string, unknown>;
type Rec = Record<string, unknown>;

interface EntitySchema {
  name: string;
  properties: Record<string, { default?: unknown }>;
  rls?: Partial<Record<Op, Filter>>;
}

const schemas = new Map<string, EntitySchema>();

export async function loadSchemas() {
  for await (const entry of Deno.readDir(config.entitiesDir)) {
    if (!entry.isFile || !/\.jsonc?$/.test(entry.name)) continue;
    const text = await Deno.readTextFile(`${config.entitiesDir}/${entry.name}`);
    const schema = JSON.parse(stripJsonComments(text)) as EntitySchema;
    schema.name ??= entry.name.replace(/\.jsonc?$/, "");
    schemas.set(schema.name, schema);
  }
  console.log(`[entidades] ${schemas.size} entidades carregadas`);
}

export function stripJsonComments(text: string): string {
  // remove comentários // e /* */ fora de strings
  return text.replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (_m, str) => str ?? "");
}

export function entityNames(): string[] {
  return [...schemas.keys()];
}

export function entityProperties(entity: string): Record<string, { type?: string; description?: string; enum?: unknown[] }> {
  return (getSchema(entity).properties ?? {}) as Record<string, { type?: string; description?: string; enum?: unknown[] }>;
}

function getSchema(entity: string): EntitySchema {
  const schema = schemas.get(entity);
  if (!schema) throw new HttpError(404, `Entidade não encontrada: ${entity}`);
  return schema;
}

// ---------- Regras de acesso ----------
const NO_VALUE = "__sem_valor__";

function resolveTemplate(value: unknown, user: UserRow | null): unknown {
  if (typeof value !== "string") return value;
  const m = value.match(/^\{\{\s*user\.([\w.]+)\s*\}\}$/);
  if (!m) return value;
  if (!user) return NO_VALUE;
  const u = publicUser(user) as Rec;
  const path = m[1].startsWith("data.") ? m[1].slice(5) : m[1];
  const resolved = getPath(u, path);
  return resolved === undefined || resolved === null || resolved === "" ? NO_VALUE : resolved;
}

function userCondition(cond: Filter, user: UserRow | null): boolean {
  if (!user) return false;
  const u = publicUser(user) as Rec;
  return Object.entries(cond).every(([k, v]) => {
    const key = k.startsWith("data.") ? k.slice(5) : k;
    return getPath(u, key) === resolveTemplate(v, user);
  });
}

// Converte a regra de acesso da entidade para um filtro comum (o mesmo formato das consultas)
function ruleToFilter(rule: unknown, user: UserRow | null): Filter {
  if (!rule || typeof rule !== "object") return { $const: false };
  const out: Filter = {};
  const and: Filter[] = [];
  for (const [key, value] of Object.entries(rule as Filter)) {
    if (key === "allow") {
      and.push({ $const: value === true });
    } else if (key === "user_condition") {
      and.push({ $const: userCondition(value as Filter, user) });
    } else if (key === "$or" || key === "$and") {
      out[key] = (value as unknown[]).map((r) => ruleToFilter(r, user));
    } else {
      const field = key.startsWith("data.") ? key.slice(5) : key;
      out[field] = resolveTemplate(value, user);
    }
  }
  if (and.length) out.$and = [...((out.$and as Filter[]) ?? []), ...and];
  return out;
}

// Devolve o filtro extra que o usuário precisa respeitar, ou null se não houver restrição
function accessFilter(entity: string, op: Op, auth: AuthContext): Filter | null {
  if (auth.service) return null;
  const rule = getSchema(entity).rls?.[op];
  // Sem login só passa quando a regra libera explicitamente (ex: { "allow": true })
  if (!auth.user && (rule as Filter | undefined)?.allow !== true) {
    throw new HttpError(401, "Você precisa estar logado", "UNAUTHORIZED", { extra_data: { reason: "auth_required" } });
  }
  if (!rule) return null;
  return ruleToFilter(rule, auth.user);
}

// ---------- Formatação ----------
interface Row {
  id: string;
  data: Rec;
  created_date: string;
  updated_date: string;
  created_by: string | null;
  created_by_id: string | null;
}

function toRecord(row: Row, fields?: string[]): Rec {
  const rec: Rec = {
    ...row.data,
    id: row.id,
    created_date: row.created_date,
    updated_date: row.updated_date,
    created_by: row.created_by,
    created_by_id: row.created_by_id,
  };
  if (!fields?.length) return rec;
  const out: Rec = { id: rec.id };
  for (const f of fields) if (f in rec) out[f] = rec[f];
  return out;
}

const SYSTEM_FIELDS = ["id", "created_date", "updated_date", "created_by", "created_by_id"];

function cleanData(input: unknown): Rec {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new HttpError(400, "Os dados precisam ser um objeto");
  const data = { ...(input as Rec) };
  for (const f of SYSTEM_FIELDS) delete data[f];
  return data;
}

// ---------- Campos secretos ----------
// Credenciais guardadas nas entidades nunca saem do servidor: para o navegador vão mascaradas.
// Só o backend (service role — funções) enxerga o valor real. Ao salvar, um campo que chega
// mascarado ou ausente mantém o valor guardado, para a tela poder editar o resto sem apagar o token.
const SEGREDOS: Record<string, string[]> = {
  Integracao: [
    "configuracao.token_gestor",
    "configuracao.token_servico_agente",
    "configuracao.token_agente",
    "configuracao.mapeamento_agentes",
  ],
  UserProfile: ["token_3cplus"],
};
export const MASCARA_SEGREDO = "••••••••";

function lerCaminho(obj: Rec, caminho: string[]): unknown {
  return caminho.reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Rec)[k] : undefined), obj);
}

function mascararValor(valor: unknown): unknown {
  if (valor === null || valor === undefined || valor === "") return valor;
  if (typeof valor === "object" && !Array.isArray(valor)) {
    return Object.fromEntries(Object.keys(valor as Rec).map((k) => [k, MASCARA_SEGREDO]));
  }
  return MASCARA_SEGREDO;
}

function ehMascarado(valor: unknown): boolean {
  if (valor === MASCARA_SEGREDO) return true;
  return !!valor && typeof valor === "object" && !Array.isArray(valor) &&
    Object.values(valor as Rec).length > 0 && Object.values(valor as Rec).every((v) => v === MASCARA_SEGREDO);
}

function mascararSegredos(entity: string, rec: Rec, auth: AuthContext): Rec {
  const caminhos = SEGREDOS[entity];
  if (!caminhos || auth.service) return rec;
  const copia = structuredClone(rec);
  for (const caminho of caminhos) {
    const partes = caminho.split(".");
    const pai = lerCaminho(copia, partes.slice(0, -1)) as Rec | undefined;
    const campo = partes[partes.length - 1];
    if (pai && typeof pai === "object" && campo in pai) pai[campo] = mascararValor(pai[campo]);
  }
  return copia;
}

/** Na atualização: segredo ausente ou mascarado dentro de um objeto enviado mantém o valor atual. */
function preservarSegredos(entity: string, data: Rec, atual: Rec, auth: AuthContext) {
  const caminhos = SEGREDOS[entity];
  if (!caminhos || auth.service) return;
  for (const caminho of caminhos) {
    const partes = caminho.split(".");
    const campo = partes[partes.length - 1];
    if (partes.length === 1) {
      if (ehMascarado(data[campo])) data[campo] = atual[campo];
      continue;
    }
    // O objeto pai (ex: configuracao) é substituído inteiro no merge — restaura o segredo dentro dele
    const pai = lerCaminho(data, partes.slice(0, -1)) as Rec | undefined;
    if (!pai || typeof pai !== "object") continue;
    const valorAtual = lerCaminho(atual, partes);
    if (!(campo in pai) || ehMascarado(pai[campo])) {
      if (valorAtual === undefined) delete pai[campo];
      else pai[campo] = valorAtual;
    }
  }
}

function applyDefaults(entity: string, data: Rec): Rec {
  for (const [field, def] of Object.entries(getSchema(entity).properties ?? {})) {
    if (data[field] === undefined && def && "default" in def) data[field] = structuredClone(def.default);
  }
  return data;
}

// ---------- Operações ----------
export interface ListOptions {
  query?: Filter;
  sort?: string;
  limit?: number;
  skip?: number;
  fields?: string[];
}

export async function listRecords(entity: string, auth: AuthContext, opts: ListOptions): Promise<Rec[]> {
  if (entity === "User") return listUsers(auth, opts);
  const extra = accessFilter(entity, "read", auth);
  const b = new SqlBuilder();
  const where = [`entity = ${b.p(entity)}`, b.where(opts.query)];
  if (extra) where.push(b.where(extra));
  const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 10000);
  const skip = Math.max(Number(opts.skip) || 0, 0);
  const text = `select * from records where ${where.map((w) => `(${w})`).join(" and ")}
    order by ${b.orderBy(opts.sort)} limit ${limit} offset ${skip}`;
  const rows = await sql.unsafe<Row[]>(text, b.params as any[]);
  return rows.map((r) => mascararSegredos(entity, toRecord(r, opts.fields), auth));
}

async function findOne(entity: string, id: string, extra: Filter | null): Promise<Row | null> {
  const b = new SqlBuilder();
  const where = [`entity = ${b.p(entity)}`, `id = ${b.p(id)}`];
  if (extra) where.push(b.where(extra));
  const [row] = await sql.unsafe<Row[]>(`select * from records where ${where.map((w) => `(${w})`).join(" and ")}`, b.params as any[]);
  return row ?? null;
}

async function recordExists(entity: string, id: string) {
  const [row] = await sql`select 1 from records where entity = ${entity} and id = ${id}`;
  return !!row;
}

export async function getRecord(entity: string, id: string, auth: AuthContext): Promise<Rec> {
  if (entity === "User") return getUser(id, auth);
  const row = await findOne(entity, id, accessFilter(entity, "read", auth));
  if (!row) throw new HttpError(404, `${entity} não encontrado`);
  return mascararSegredos(entity, toRecord(row), auth);
}

export async function createRecord(entity: string, input: unknown, auth: AuthContext): Promise<Rec> {
  if (entity === "User") throw new HttpError(405, "Usuários são criados por convite ou cadastro");
  const data = applyDefaults(entity, cleanData(input));
  const rule = accessFilter(entity, "create", auth);
  if (rule && !matches(data, rule)) throw new HttpError(403, `Sem permissão para criar ${entity}`, "FORBIDDEN");
  const user = auth.user;
  const [row] = await sql<Row[]>`
    insert into records (id, entity, data, created_by, created_by_id)
    values (${newId()}, ${entity}, ${sql.json(data as any)}, ${user?.email ?? null}, ${user?.id ?? null})
    returning *`;
  const rec = toRecord(row);
  broadcast(entity, "create", mascararSegredos(entity, rec, { user: null, service: false }));
  return mascararSegredos(entity, rec, auth);
}

export async function bulkCreate(entity: string, input: unknown, auth: AuthContext): Promise<Rec[]> {
  if (!Array.isArray(input)) throw new HttpError(400, "bulkCreate espera uma lista");
  const out: Rec[] = [];
  for (const item of input) out.push(await createRecord(entity, item, auth));
  return out;
}

export async function updateRecord(entity: string, id: string, input: unknown, auth: AuthContext): Promise<Rec> {
  if (entity === "User") return updateUserEntity(id, input, auth);
  const data = cleanData(input);
  const extra = accessFilter(entity, "update", auth);
  if (extra && !(await findOne(entity, id, extra))) {
    if (await recordExists(entity, id)) throw new HttpError(403, `Sem permissão para alterar ${entity}`, "FORBIDDEN");
    throw new HttpError(404, `${entity} não encontrado`);
  }
  if (SEGREDOS[entity] && !auth.service) {
    const atual = await findOne(entity, id, null);
    if (atual) preservarSegredos(entity, data, atual.data, auth);
  }
  const [row] = await sql<Row[]>`
    update records set data = data || ${sql.json(data as any)}, updated_date = now()
    where entity = ${entity} and id = ${id}
    returning *`;
  if (!row) throw new HttpError(404, `${entity} não encontrado`);
  const rec = toRecord(row);
  broadcast(entity, "update", mascararSegredos(entity, rec, { user: null, service: false }));
  return mascararSegredos(entity, rec, auth);
}

export async function bulkUpdate(entity: string, input: unknown, auth: AuthContext): Promise<Rec[]> {
  if (!Array.isArray(input)) throw new HttpError(400, "bulkUpdate espera uma lista");
  const out: Rec[] = [];
  for (const item of input as Rec[]) {
    if (!item?.id) throw new HttpError(400, "Cada item do bulkUpdate precisa de id");
    out.push(await updateRecord(entity, String(item.id), item, auth));
  }
  return out;
}

export async function updateMany(entity: string, body: { query?: Filter; data?: Rec }, auth: AuthContext) {
  const targets = await listRecords(entity, auth, { query: body.query ?? {}, limit: 10000 });
  const update = body.data ?? {};
  let count = 0;
  for (const rec of targets) {
    const patch: Rec = {};
    if (Object.keys(update).some((k) => k.startsWith("$"))) {
      Object.assign(patch, (update.$set as Rec) ?? {});
      for (const [k, v] of Object.entries((update.$inc as Rec) ?? {})) patch[k] = (Number(rec[k]) || 0) + Number(v);
      for (const k of Object.keys((update.$unset as Rec) ?? {})) patch[k] = null;
    } else {
      Object.assign(patch, update);
    }
    await updateRecord(entity, String(rec.id), patch, auth);
    count++;
  }
  return { updated: count };
}

export async function deleteRecord(entity: string, id: string, auth: AuthContext) {
  if (entity === "User") return deleteUser(id, auth);
  const extra = accessFilter(entity, "delete", auth);
  const row = await findOne(entity, id, extra);
  if (!row) {
    if (extra && (await recordExists(entity, id))) throw new HttpError(403, `Sem permissão para excluir ${entity}`, "FORBIDDEN");
    throw new HttpError(404, `${entity} não encontrado`);
  }
  await sql`delete from records where entity = ${entity} and id = ${id}`;
  broadcast(entity, "delete", { id });
  return { success: true };
}

export async function deleteMany(entity: string, query: Filter, auth: AuthContext) {
  if (!query || !Object.keys(query).length) throw new HttpError(400, "deleteMany precisa de um filtro");
  const targets = await listRecords(entity, auth, { query, limit: 10000, fields: ["id"] });
  for (const rec of targets) await deleteRecord(entity, String(rec.id), auth);
  return { deleted: targets.length };
}

// ---------- Entidade User (tabela própria) ----------
async function listUsers(auth: AuthContext, opts: ListOptions): Promise<Rec[]> {
  if (!auth.user && !auth.service) throw new HttpError(401, "Você precisa estar logado", "UNAUTHORIZED");
  const rows = await sql<UserRow[]>`select * from users order by created_date asc`;
  let users = rows.map(publicUser) as Rec[];
  if (!auth.service && !isAdmin(auth.user)) users = users.filter((u) => u.id === auth.user!.id);
  if (opts.query && Object.keys(opts.query).length) users = users.filter((u) => matches(u, opts.query!));
  users = sortInMemory(users, opts.sort);
  const skip = Math.max(Number(opts.skip) || 0, 0);
  const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 10000);
  return users.slice(skip, skip + limit).map((u) => (opts.fields?.length ? pick(u, opts.fields) : u));
}

async function getUser(id: string, auth: AuthContext): Promise<Rec> {
  if (!auth.service && !isAdmin(auth.user) && auth.user?.id !== id) throw new HttpError(404, "Usuário não encontrado");
  const user = await findUserById(id);
  if (!user) throw new HttpError(404, "Usuário não encontrado");
  return publicUser(user);
}

async function updateUserEntity(id: string, input: unknown, auth: AuthContext): Promise<Rec> {
  const admin = auth.service || isAdmin(auth.user);
  if (!admin && auth.user?.id !== id) throw new HttpError(403, "Sem permissão para alterar este usuário", "FORBIDDEN");
  return publicUser(await updateUser(id, cleanData(input), { allowRole: admin }));
}

async function deleteUser(id: string, auth: AuthContext) {
  if (!auth.service && !isAdmin(auth.user)) throw new HttpError(403, "Só administradores podem excluir usuários", "FORBIDDEN");
  await sql`delete from users where id = ${id}`;
  return { success: true };
}

function sortInMemory(items: Rec[], sort?: string): Rec[] {
  if (!sort) return items;
  const desc = sort.startsWith("-");
  const field = sort.replace(/^[-+]/, "");
  return [...items].sort((a, b) => {
    const x = a[field] as any, y = b[field] as any;
    if (x == null) return 1;
    if (y == null) return -1;
    return (x < y ? -1 : x > y ? 1 : 0) * (desc ? -1 : 1);
  });
}

function pick(obj: Rec, fields: string[]): Rec {
  const out: Rec = { id: obj.id };
  for (const f of fields) if (f in obj) out[f] = obj[f];
  return out;
}
