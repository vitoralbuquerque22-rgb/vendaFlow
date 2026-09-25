// integrations.Core.* do Base44: InvokeLLM, UploadFile, SendEmail etc.

import { type AuthContext, requireUser } from "./auth.ts";
import { HttpError, readJson } from "./http.ts";
import { saveUpload, signedUrl } from "./files.ts";
import { invokeLLM } from "./llm.ts";
import { sendEmail } from "./mailer.ts";

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.includes("multipart/form-data")) return await readJson(req);
  const form = await req.formData();
  const body: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (value instanceof File) {
      body[key] = value;
    } else {
      try {
        body[key] = JSON.parse(value);
      } catch {
        body[key] = value;
      }
    }
  }
  return body;
}

export async function handleCoreIntegration(name: string, req: Request, auth: AuthContext): Promise<unknown> {
  if (!auth.service) requireUser(auth);
  const body = await readBody(req);

  switch (name) {
    case "InvokeLLM":
      return await invokeLLM(body);

    case "UploadFile": {
      if (!(body.file instanceof File)) throw new HttpError(400, "Envie o arquivo no campo 'file'");
      const saved = await saveUpload(body.file, auth);
      return { file_url: saved.url };
    }

    case "UploadPrivateFile": {
      if (!(body.file instanceof File)) throw new HttpError(400, "Envie o arquivo no campo 'file'");
      const saved = await saveUpload(body.file, auth, true);
      return { file_uri: `private/${saved.id}` };
    }

    case "CreateFileSignedUrl":
      return { signed_url: await signedUrl(String(body.file_uri ?? ""), Number(body.expires_in) || 300) };

    case "SendEmail": {
      const to = String(body.to ?? "");
      if (!to) throw new HttpError(400, "Campo 'to' é obrigatório");
      await sendEmail({
        to,
        subject: String(body.subject ?? ""),
        html: String(body.body ?? ""),
        fromName: body.from_name ? String(body.from_name) : undefined,
      });
      return { success: true };
    }

    default:
      throw new HttpError(501, `Integração ainda não disponível: ${name}`);
  }
}
