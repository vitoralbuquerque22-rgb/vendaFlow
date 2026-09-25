import nodemailer from "nodemailer";
import { config } from "./config.ts";

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
});

export async function sendEmail(opts: { to: string; subject: string; html: string; fromName?: string }) {
  let from = config.smtp.from;
  if (opts.fromName) {
    const address = from.match(/<([^>]+)>/)?.[1] ?? from;
    from = `${opts.fromName.replace(/[<>"]/g, "")} <${address}>`;
  }
  await transporter.sendMail({ from, to: opts.to, subject: opts.subject, html: opts.html });
}

export function emailLayout(title: string, body: string): string {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f4f4f5;padding:24px">
  <div style="max-width:520px;margin:auto;background:#fff;border-radius:8px;padding:32px">
    <h2 style="margin-top:0;color:#111">${title}</h2>
    ${body}
    <p style="color:#888;font-size:12px;margin-top:32px">VendaFlow CRM</p>
  </div></body></html>`;
}
