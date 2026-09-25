// Login, cadastro, tokens e usuários — substitui a autenticação do Base44.

import { jwtVerify, SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { ADMIN_ROLES, config } from "./config.ts";
import { newId, sql } from "./db.ts";
import { HttpError } from "./http.ts";
import { emailLayout, sendEmail } from "./mailer.ts";

const secret = new TextEncoder().encode(config.jwtSecret);

export interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  password_hash: string | null;
  is_verified: boolean;
  disabled: boolean;
  data: Record<string, unknown>;
  created_date: string;
  updated_date: string;
}

export interface AuthContext {
  user: UserRow | null;
  service: boolean;
}

export const ANONYMOUS: AuthContext = { user: null, service: false };

// ---------- Tokens ----------
async function sign(payload: Record<string, unknown>, expiresIn: string): Promise<string> {
  return await new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(expiresIn).sign(secret);
}

async function verify(token: string): Promise<Record<string, unknown> | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function userToken(user: UserRow) {
  return sign({ sub: user.id, typ: "user" }, "30d");
}

let serviceTokenCache: string | null = null;
export async function serviceToken(): Promise<string> {
  serviceTokenCache ??= await sign({ typ: "service" }, "3650d");
  return serviceTokenCache;
}

async function passwordFingerprint(user: UserRow): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(user.password_hash ?? "sem-senha"));
  return Array.from(new Uint8Array(digest).slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function resetToken(user: UserRow, expiresIn: string) {
  return sign({ sub: user.id, typ: "reset", fp: await passwordFingerprint(user) }, expiresIn);
}

function bearer(value: string | null): string | null {
  if (!value) return null;
  const m = value.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

async function userFromToken(token: string): Promise<UserRow> {
  const payload = await verify(token);
  if (!payload || payload.typ !== "user") throw new HttpError(401, "Token inválido ou expirado", "UNAUTHORIZED");
  const user = await findUserById(String(payload.sub));
  if (!user) throw new HttpError(401, "Usuário não encontrado", "UNAUTHORIZED");
  if (user.disabled) throw new HttpError(403, "Usuário desativado", "USER_DISABLED");
  return user;
}

export async function getAuth(req: Request): Promise<AuthContext> {
  const token = bearer(req.headers.get("Authorization"));
  if (!token) return ANONYMOUS;
  const payload = await verify(token);
  if (payload?.typ === "service") {
    const onBehalf = bearer(req.headers.get("on-behalf-of"));
    const user = onBehalf ? await userFromToken(onBehalf).catch(() => null) : null;
    return { user, service: true };
  }
  return { user: await userFromToken(token), service: false };
}

export function requireUser(auth: AuthContext): UserRow {
  if (!auth.user) throw new HttpError(401, "Você precisa estar logado", "UNAUTHORIZED", { extra_data: { reason: "auth_required" } });
  return auth.user;
}

export function isAdmin(user: UserRow | null): boolean {
  return !!user && ADMIN_ROLES.has(user.role);
}

// ---------- Usuários ----------
export async function findUserById(id: string): Promise<UserRow | null> {
  const [row] = await sql<UserRow[]>`select * from users where id = ${id}`;
  return row ?? null;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const [row] = await sql<UserRow[]>`select * from users where email = ${normalizeEmail(email)}`;
  return row ?? null;
}

export function normalizeEmail(email: unknown): string {
  const e = String(email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new HttpError(400, "E-mail inválido");
  return e;
}

// Formato que o frontend espera (igual ao Base44): campos personalizados ficam na raiz
export function publicUser(u: UserRow) {
  return {
    ...u.data,
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    role: u.role,
    is_verified: u.is_verified,
    disabled: u.disabled,
    app_id: config.appId,
    created_date: u.created_date,
    updated_date: u.updated_date,
  };
}

const USER_COLUMN_FIELDS = new Set(["id", "email", "role", "is_verified", "disabled", "app_id", "created_date", "updated_date", "password_hash", "password"]);

export async function updateUser(id: string, patch: Record<string, unknown>, { allowRole }: { allowRole: boolean }) {
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === "full_name" || USER_COLUMN_FIELDS.has(k)) continue;
    data[k] = v;
  }
  const fullName = typeof patch.full_name === "string" ? patch.full_name : null;
  const role = allowRole && typeof patch.role === "string" ? patch.role : null;
  const disabled = allowRole && typeof patch.disabled === "boolean" ? patch.disabled : null;
  const [row] = await sql<UserRow[]>`
    update users set
      data = data || ${sql.json(data as any)},
      full_name = coalesce(${fullName}, full_name),
      role = coalesce(${role}, role),
      disabled = coalesce(${disabled}, disabled),
      updated_date = now()
    where id = ${id}
    returning *`;
  if (!row) throw new HttpError(404, "Usuário não encontrado");
  return row;
}

async function createUser(opts: { email: string; password?: string; fullName?: string; role?: string; verified: boolean }) {
  const [{ count }] = await sql`select count(*)::int as count from users`;
  const isFirst = count === 0;
  const role = opts.role ?? (isFirst || config.adminEmails.includes(opts.email) ? "admin" : "user");
  const hash = opts.password ? await bcrypt.hash(opts.password, 10) : null;
  const [row] = await sql<UserRow[]>`
    insert into users (id, email, full_name, role, password_hash, is_verified)
    values (${newId()}, ${opts.email}, ${opts.fullName ?? null}, ${role}, ${hash}, ${opts.verified})
    returning *`;
  return row;
}

function validatePassword(password: unknown): string {
  const p = String(password ?? "");
  if (p.length < 8) throw new HttpError(400, "A senha precisa ter pelo menos 8 caracteres");
  return p;
}

// ---------- Códigos de verificação (OTP) ----------
async function hashCode(code: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code + config.jwtSecret));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sendOtp(email: string) {
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
  await sql`
    insert into auth_codes (email, kind, code_hash, expires_at, attempts)
    values (${email}, 'otp', ${await hashCode(code)}, now() + interval '15 minutes', 0)
    on conflict (email, kind) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0`;
  await sendEmail({
    to: email,
    subject: `Seu código de verificação: ${code}`,
    html: emailLayout("Confirme seu e-mail", `<p>Use o código abaixo para confirmar seu cadastro:</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:6px">${code}</p>
      <p>O código vale por 15 minutos.</p>`),
  });
}

async function checkOtp(email: string, code: string) {
  const [row] = await sql`select * from auth_codes where email = ${email} and kind = 'otp'`;
  if (!row || new Date(row.expires_at) < new Date()) throw new HttpError(400, "Código expirado. Peça um novo código.");
  if (row.attempts >= 5) throw new HttpError(429, "Muitas tentativas. Peça um novo código.");
  if (row.code_hash !== (await hashCode(String(code).trim()))) {
    await sql`update auth_codes set attempts = attempts + 1 where email = ${email} and kind = 'otp'`;
    throw new HttpError(400, "Código inválido");
  }
  await sql`delete from auth_codes where email = ${email} and kind = 'otp'`;
}

// ---------- Endpoints ----------
export async function login(body: any) {
  const email = normalizeEmail(body.email);
  const user = await findUserByEmail(email);
  const ok = user?.password_hash ? await bcrypt.compare(String(body.password ?? ""), user.password_hash) : false;
  if (!user || !ok) throw new HttpError(401, "E-mail ou senha incorretos", "INVALID_CREDENTIALS");
  if (user.disabled) throw new HttpError(403, "Usuário desativado", "USER_DISABLED");
  if (!user.is_verified) {
    await sendOtp(email);
    throw new HttpError(403, "E-mail ainda não confirmado. Enviamos um novo código.", "EMAIL_NOT_VERIFIED");
  }
  return { access_token: await userToken(user), user: publicUser(user) };
}

export async function register(body: any) {
  if (!config.allowSignup) throw new HttpError(403, "Cadastro desativado. Peça um convite ao administrador.");
  const email = normalizeEmail(body.email);
  const password = validatePassword(body.password);
  const existing = await findUserByEmail(email);
  if (existing?.is_verified && existing.password_hash) throw new HttpError(409, "Já existe uma conta com este e-mail");
  if (existing) {
    await sql`update users set password_hash = ${await bcrypt.hash(password, 10)}, updated_date = now() where id = ${existing.id}`;
  } else {
    await createUser({ email, password, fullName: body.full_name, verified: false });
  }
  await sendOtp(email);
  return { message: "Enviamos um código de verificação para o seu e-mail" };
}

export async function verifyOtp(body: any) {
  const email = normalizeEmail(body.email);
  await checkOtp(email, body.otp_code);
  const [user] = await sql<UserRow[]>`update users set is_verified = true, updated_date = now() where email = ${email} returning *`;
  if (!user) throw new HttpError(404, "Usuário não encontrado");
  return { access_token: await userToken(user), user: publicUser(user) };
}

export async function resendOtp(body: any) {
  const email = normalizeEmail(body.email);
  if (await findUserByEmail(email)) await sendOtp(email);
  return { message: "Se o e-mail existir, um novo código foi enviado" };
}

export async function resetPasswordRequest(body: any) {
  const email = normalizeEmail(body.email);
  const user = await findUserByEmail(email);
  if (user && !user.disabled) {
    const link = `${config.publicUrl}/reset-password?token=${await resetToken(user, "2h")}`;
    await sendEmail({
      to: email,
      subject: "Redefinição de senha",
      html: emailLayout("Redefinir senha", `<p>Clique no botão para criar uma nova senha. O link vale por 2 horas.</p>
        <p><a href="${link}" style="background:#111;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">Criar nova senha</a></p>
        <p style="font-size:12px;color:#666">Se você não pediu, ignore este e-mail.</p>`),
    });
  }
  return { message: "Se o e-mail existir, enviamos um link de redefinição" };
}

export async function resetPassword(body: any) {
  const payload = await verify(String(body.reset_token ?? ""));
  if (!payload || payload.typ !== "reset") throw new HttpError(400, "Link inválido ou expirado");
  const user = await findUserById(String(payload.sub));
  if (!user || payload.fp !== (await passwordFingerprint(user))) throw new HttpError(400, "Link inválido ou já utilizado");
  const password = validatePassword(body.new_password);
  await sql`update users set password_hash = ${await bcrypt.hash(password, 10)}, is_verified = true, updated_date = now() where id = ${user.id}`;
  return { message: "Senha alterada com sucesso" };
}

export async function changePassword(auth: AuthContext, body: any) {
  const user = requireUser(auth);
  if (user.password_hash && !(await bcrypt.compare(String(body.current_password ?? ""), user.password_hash))) {
    throw new HttpError(400, "Senha atual incorreta");
  }
  const password = validatePassword(body.new_password);
  await sql`update users set password_hash = ${await bcrypt.hash(password, 10)}, updated_date = now() where id = ${user.id}`;
  return { message: "Senha alterada com sucesso" };
}

export async function inviteUser(auth: AuthContext, body: any) {
  if (!auth.service) {
    const inviter = requireUser(auth);
    if (!isAdmin(inviter) && body.role === "admin") throw new HttpError(403, "Só administradores podem convidar administradores");
  }
  const email = normalizeEmail(body.user_email);
  const role = body.role === "admin" ? "admin" : "user";
  let user = await findUserByEmail(email);
  if (!user) user = await createUser({ email, role, verified: true });
  const link = `${config.publicUrl}/reset-password?token=${await resetToken(user, "7d")}`;
  await sendEmail({
    to: email,
    subject: "Você foi convidado para o VendaFlow",
    html: emailLayout("Bem-vindo ao VendaFlow", `<p>Você recebeu um convite para acessar o VendaFlow CRM.</p>
      <p>Clique no botão para criar sua senha. O link vale por 7 dias.</p>
      <p><a href="${link}" style="background:#111;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">Criar minha senha</a></p>`),
  });
  return { message: "Convite enviado", user_id: user.id };
}

// Cria o primeiro administrador a partir do .env, se ainda não existir nenhum usuário
export async function ensureBootstrapAdmin() {
  const email = Deno.env.get("ADMIN_EMAIL");
  const password = Deno.env.get("ADMIN_PASSWORD");
  if (!email || !password) return;
  const [{ count }] = await sql`select count(*)::int as count from users`;
  if (count > 0) return;
  await createUser({ email: normalizeEmail(email), password, fullName: "Administrador", role: "admin", verified: true });
  console.log(`[auth] Administrador inicial criado: ${email}`);
}
