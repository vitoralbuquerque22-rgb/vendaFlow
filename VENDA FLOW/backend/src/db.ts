import postgres from "postgres";
import { config } from "./config.ts";

export const sql = postgres(config.databaseUrl, {
  max: 20,
  onnotice: () => {},
  types: {
    // Devolve timestamps como string ISO em vez de Date
    date: {
      to: 1184,
      from: [1082, 1114, 1184],
      serialize: (x: string | Date) => (x instanceof Date ? x.toISOString() : x),
      parse: (x: string) => new Date(x).toISOString(),
    },
  },
});

export async function migrate() {
  await sql.unsafe(`
    create table if not exists records (
      id            text primary key,
      entity        text not null,
      data          jsonb not null default '{}'::jsonb,
      created_date  timestamptz not null default now(),
      updated_date  timestamptz not null default now(),
      created_by    text,
      created_by_id text
    );
    create index if not exists records_entity_created_idx on records (entity, created_date desc);
    create index if not exists records_entity_updated_idx on records (entity, updated_date desc);
    create index if not exists records_empresa_idx on records (entity, (data->>'empresaId'));
    create index if not exists records_data_idx on records using gin (data jsonb_path_ops);

    create table if not exists users (
      id            text primary key,
      email         text not null unique,
      full_name     text,
      role          text not null default 'user',
      password_hash text,
      is_verified   boolean not null default false,
      disabled      boolean not null default false,
      data          jsonb not null default '{}'::jsonb,
      created_date  timestamptz not null default now(),
      updated_date  timestamptz not null default now()
    );

    create table if not exists auth_codes (
      email      text not null,
      kind       text not null,
      code_hash  text not null,
      expires_at timestamptz not null,
      attempts   int not null default 0,
      primary key (email, kind)
    );

    create table if not exists conversations (
      id           text primary key,
      agent_name   text not null,
      user_id      text,
      metadata     jsonb not null default '{}'::jsonb,
      messages     jsonb not null default '[]'::jsonb,
      created_date timestamptz not null default now(),
      updated_date timestamptz not null default now()
    );
    create index if not exists conversations_user_idx on conversations (user_id, created_date desc);

    create table if not exists files (
      id           text primary key,
      name         text not null,
      mime         text,
      size         bigint,
      is_private   boolean not null default false,
      created_by   text,
      created_date timestamptz not null default now()
    );
  `);
}

// IDs de 24 caracteres hexadecimais
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
