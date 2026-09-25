// Converte filtros no formato do Base44 (estilo MongoDB) para SQL do PostgreSQL.
// Os registros ficam na tabela `records`, com os campos dentro da coluna jsonb `data`.

import { HttpError } from "./http.ts";

type Filter = Record<string, unknown>;

const DATE_COLUMNS = new Set(["created_date", "updated_date"]);
const TEXT_COLUMNS = new Set(["id", "created_by", "created_by_id"]);

export class SqlBuilder {
  params: unknown[] = [];
  constructor(private tableAlias = "") {}

  // Valores usados com ::jsonb vão crus: o postgres.js já faz o JSON.stringify pelo tipo do parâmetro
  p(value: unknown): string {
    this.params.push(value);
    return `$${this.params.length}`;
  }

  col(name: string) {
    return this.tableAlias ? `${this.tableAlias}.${name}` : name;
  }

  jsonPath(field: string): string {
    return `(${this.col("data")} #> ${this.p(field.split("."))}::text[])`;
  }

  // ---------- WHERE ----------
  where(filter: Filter | undefined | null): string {
    if (!filter || typeof filter !== "object") return "true";
    const parts: string[] = [];
    for (const [key, value] of Object.entries(filter)) {
      parts.push(this.clause(key, value));
    }
    return parts.length ? parts.map((p) => `(${p})`).join(" and ") : "true";
  }

  private clause(key: string, value: unknown): string {
    switch (key) {
      case "$or":
      case "$and":
      case "$nor": {
        if (!Array.isArray(value)) throw new HttpError(400, `${key} precisa ser uma lista`);
        if (value.length === 0) return key === "$or" ? "false" : "true";
        const sub = value.map((v) => `(${this.where(v as Filter)})`);
        if (key === "$or") return sub.join(" or ");
        if (key === "$and") return sub.join(" and ");
        return `not (${sub.join(" or ")})`;
      }
      case "$const": // usado internamente pelas regras de acesso
        return value ? "true" : "false";
    }
    if (key.startsWith("$")) throw new HttpError(400, `Operador nÃ£o suportado: ${key}`);

    if (isOperatorObject(value)) {
      const parts = Object.entries(value as Filter).map(([op, v]) => this.op(key, op, v, value as Filter));
      return parts.map((p) => `(${p})`).join(" and ") || "true";
    }
    return this.op(key, "$eq", value, {});
  }

  private op(field: string, op: string, value: unknown, all: Filter): string {
    if (DATE_COLUMNS.has(field)) return this.dateOp(this.col(field), op, value);
    if (TEXT_COLUMNS.has(field)) return this.textOp(this.col(field), op, value);

    const e = this.jsonPath(field);
    switch (op) {
      case "$eq":
        return this.jsonEq(e, value);
      case "$ne":
        return `not coalesce(${this.jsonEq(e, value)}, false)`;
      case "$in":
        return this.jsonIn(e, asArray(value, op));
      case "$nin":
        return `not coalesce(${this.jsonIn(e, asArray(value, op))}, false)`;
      case "$gt":
      case "$gte":
      case "$lt":
      case "$lte":
        return `${e} ${CMP[op]} ${this.p(value)}::jsonb`;
      case "$exists":
        return value ? `${e} is not null and ${e} <> 'null'::jsonb` : `(${e} is null or ${e} = 'null'::jsonb)`;
      case "$regex": {
        const flags = typeof all.$options === "string" ? all.$options : "";
        const pattern = value instanceof RegExp ? value.source : String(value);
        return `(${e} #>> '{}') ${flags.includes("i") ? "~*" : "~"} ${this.p(pattern)}`;
      }
      case "$options":
        return "true";
      case "$all":
        return `${e} @> ${this.p(asArray(value, op))}::jsonb`;
      case "$size":
        return `jsonb_typeof(${e}) = 'array' and jsonb_array_length(${e}) = ${this.p(Number(value))}`;
      case "$not":
        return `not coalesce((${this.where({ [field]: value })}), false)`;
      case "$elemMatch": {
        const inner = new SqlBuilder();
        inner.params = this.params;
        // cada elemento do array Ã© tratado como um "registro" com os campos na raiz
        const cond = inner.whereElement(value as Filter);
        return `jsonb_typeof(${e}) = 'array' and exists (select 1 from jsonb_array_elements(${e}) as el(data) where ${cond})`;
      }
      default:
        throw new HttpError(400, `Operador nÃ£o suportado: ${op}`);
    }
  }

  private whereElement(filter: Filter): string {
    const saved = this.tableAlias;
    this.tableAlias = "el";
    try {
      return this.where(filter);
    } finally {
      this.tableAlias = saved;
    }
  }

  private jsonEq(e: string, value: unknown): string {
    if (value === null || value === undefined) return `(${e} is null or ${e} = 'null'::jsonb)`;
    const v = this.p(value);
    if (Array.isArray(value) || typeof value === "object") return `${e} = ${v}::jsonb`;
    // Como no MongoDB: {tags: "x"} tambÃ©m casa com tags = ["x", "y"]
    return `(${e} = ${v}::jsonb or (jsonb_typeof(${e}) = 'array' and ${e} @> jsonb_build_array(${v}::jsonb)))`;
  }

  private jsonIn(e: string, values: unknown[]): string {
    const nonNull = values.filter((v) => v !== null && v !== undefined);
    const hasNull = nonNull.length !== values.length;
    const parts: string[] = [];
    if (nonNull.length) {
      const arr = this.p(nonNull);
      parts.push(
        `exists (select 1 from jsonb_array_elements(${arr}::jsonb) as v(x) where v.x = ${e} or (jsonb_typeof(${e}) = 'array' and ${e} @> jsonb_build_array(v.x)))`,
      );
    }
    if (hasNull) parts.push(`(${e} is null or ${e} = 'null'::jsonb)`);
    return parts.length ? parts.join(" or ") : "false";
  }

  private textOp(c: string, op: string, value: unknown): string {
    switch (op) {
      case "$eq":
        return value == null ? `${c} is null` : `${c} = ${this.p(String(value))}`;
      case "$ne":
        return value == null ? `${c} is not null` : `${c} is distinct from ${this.p(String(value))}`;
      case "$in":
        return `${c} = any(${this.p(asArray(value, op).map(String))}::text[])`;
      case "$nin":
        return `not (${c} = any(${this.p(asArray(value, op).map(String))}::text[]))`;
      case "$exists":
        return value ? `${c} is not null` : `${c} is null`;
      case "$gt":
      case "$gte":
      case "$lt":
      case "$lte":
        return `${c} ${CMP[op]} ${this.p(String(value))}`;
      default:
        throw new HttpError(400, `Operador nÃ£o suportado em ${c}: ${op}`);
    }
  }

  private dateOp(c: string, op: string, value: unknown): string {
    switch (op) {
      case "$eq":
        return value == null ? `${c} is null` : `${c} = ${this.p(String(value))}::timestamptz`;
      case "$ne":
        return value == null ? `${c} is not null` : `${c} is distinct from ${this.p(String(value))}::timestamptz`;
      case "$gt":
      case "$gte":
      case "$lt":
      case "$lte":
        return `${c} ${CMP[op]} ${this.p(String(value))}::timestamptz`;
      case "$in":
        return `${c} = any(${this.p(asArray(value, op).map(String))}::timestamptz[])`;
      case "$exists":
        return value ? `${c} is not null` : `${c} is null`;
      default:
        throw new HttpError(400, `Operador nÃ£o suportado em ${c}: ${op}`);
    }
  }

  // ---------- ORDER BY ----------
  orderBy(sort: string | undefined | null): string {
    const parts: string[] = [];
    for (const raw of String(sort || "-created_date").split(",")) {
      const s = raw.trim();
      if (!s) continue;
      const desc = s.startsWith("-");
      const field = s.replace(/^[-+]/, "");
      const expr = DATE_COLUMNS.has(field) || TEXT_COLUMNS.has(field) ? this.col(field) : this.jsonPath(field);
      parts.push(`${expr} ${desc ? "desc" : "asc"} nulls last`);
    }
    parts.push(`${this.col("id")} asc`);
    return parts.join(", ");
  }
}

const CMP: Record<string, string> = { $gt: ">", $gte: ">=", $lt: "<", $lte: "<=" };

function isOperatorObject(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((k) => k.startsWith("$"));
}

function asArray(value: unknown, op: string): unknown[] {
  if (!Array.isArray(value)) throw new HttpError(400, `${op} precisa ser uma lista`);
  return value;
}

// ---------- AvaliaÃ§Ã£o em memÃ³ria (usada nas regras de acesso ao criar registros) ----------
export function matches(record: Record<string, unknown>, filter: Filter): boolean {
  for (const [key, value] of Object.entries(filter)) {
    if (key === "$const") {
      if (!value) return false;
      continue;
    }
    if (key === "$or") {
      if (!(value as Filter[]).some((f) => matches(record, f))) return false;
      continue;
    }
    if (key === "$and") {
      if (!(value as Filter[]).every((f) => matches(record, f))) return false;
      continue;
    }
    const actual = getPath(record, key);
    if (isOperatorObject(value)) {
      for (const [op, v] of Object.entries(value as Filter)) {
        if (op === "$in" && !(v as unknown[]).some((x) => looseEq(actual, x))) return false;
        if (op === "$nin" && (v as unknown[]).some((x) => looseEq(actual, x))) return false;
        if (op === "$ne" && looseEq(actual, v)) return false;
        if (op === "$eq" && !looseEq(actual, v)) return false;
        if (op === "$exists" && (actual != null) !== Boolean(v)) return false;
      }
    } else if (!looseEq(actual, value)) {
      return false;
    }
  }
  return true;
}

function looseEq(actual: unknown, expected: unknown): boolean {
  if (expected == null) return actual == null;
  if (Array.isArray(actual) && !Array.isArray(expected)) return actual.some((a) => looseEq(a, expected));
  if (typeof expected === "object") return JSON.stringify(actual) === JSON.stringify(expected);
  return actual === expected;
}

export function getPath(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}
