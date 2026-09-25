// Upload e download de arquivos, guardados em disco (pasta UPLOAD_DIR).

import { config } from "./config.ts";
import { newId, sql } from "./db.ts";
import { CORS_HEADERS, HttpError } from "./http.ts";
import type { AuthContext } from "./auth.ts";

export async function ensureUploadDir() {
  await Deno.mkdir(config.uploadDir, { recursive: true });
}

function safeName(name: string): string {
  const cleaned = name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_");
  return cleaned.slice(-120) || "arquivo";
}

export async function saveUpload(file: File, auth: AuthContext, isPrivate = false) {
  if (file.size > config.maxUploadMb * 1024 * 1024) {
    throw new HttpError(413, `Arquivo muito grande. Limite: ${config.maxUploadMb}MB`);
  }
  const id = newId();
  const name = safeName(file.name || "arquivo");
  await Deno.writeFile(`${config.uploadDir}/${id}`, new Uint8Array(await file.arrayBuffer()));
  await sql`
    insert into files (id, name, mime, size, is_private, created_by)
    values (${id}, ${name}, ${file.type || "application/octet-stream"}, ${file.size}, ${isPrivate}, ${auth.user?.email ?? null})`;
  return { id, name, url: `${config.publicUrl}/api/files/${id}/${encodeURIComponent(name)}` };
}

export async function serveFile(id: string, req: Request): Promise<Response> {
  if (!/^[a-f0-9]{24}$/.test(id)) throw new HttpError(404, "Arquivo não encontrado");
  const [meta] = await sql`select * from files where id = ${id}`;
  if (!meta) throw new HttpError(404, "Arquivo não encontrado");
  if (meta.is_private) {
    const sig = new URL(req.url).searchParams.get("sig");
    const exp = Number(new URL(req.url).searchParams.get("exp"));
    if (!sig || !exp || exp < Date.now() / 1000 || sig !== (await signFile(id, exp))) {
      throw new HttpError(403, "Link do arquivo expirado ou inválido");
    }
  }
  const file = await Deno.open(`${config.uploadDir}/${id}`, { read: true });
  return new Response(file.readable, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": meta.mime ?? "application/octet-stream",
      "Content-Length": String(meta.size),
      "Content-Disposition": `inline; filename="${meta.name}"`,
      "Cache-Control": meta.is_private ? "private, no-store" : "public, max-age=31536000, immutable",
    },
  });
}

async function signFile(id: string, exp: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(config.jwtSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${exp}`));
  return Array.from(new Uint8Array(sig).slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signedUrl(fileUri: string, expiresIn = 300) {
  const id = fileUri.match(/([a-f0-9]{24})/)?.[1];
  if (!id) throw new HttpError(400, "file_uri inválido");
  const [meta] = await sql`select name from files where id = ${id}`;
  if (!meta) throw new HttpError(404, "Arquivo não encontrado");
  const exp = Math.floor(Date.now() / 1000) + expiresIn;
  return `${config.publicUrl}/api/files/${id}/${encodeURIComponent(meta.name)}?exp=${exp}&sig=${await signFile(id, exp)}`;
}

// Lê um arquivo nosso a partir da URL (usado para mandar anexos ao Claude)
export async function readLocalFile(url: string): Promise<{ bytes: Uint8Array; mime: string; name: string } | null> {
  const id = url.match(/\/api\/files\/([a-f0-9]{24})/)?.[1];
  if (!id) return null;
  const [meta] = await sql`select * from files where id = ${id}`;
  if (!meta) return null;
  return { bytes: await Deno.readFile(`${config.uploadDir}/${id}`), mime: meta.mime, name: meta.name };
}
