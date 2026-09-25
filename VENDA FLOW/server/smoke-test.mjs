// Teste rápido da API usando o SDK oficial do Base44 (o mesmo que o frontend usa).
// Uso: node server/smoke-test.mjs   (com o docker compose rodando)
import { createClient } from "@base44/sdk";

const serverUrl = process.env.API_URL ?? "http://localhost:8000";
const appId = "vendaflow";
const adminEmail = process.env.ADMIN_EMAIL ?? "oficinasmaster@gmail.com";
const adminPassword = process.env.ADMIN_PASSWORD ?? "VendaFlow@2026";

let failures = 0;
async function check(name, fn) {
  try {
    const out = await fn();
    console.log(`OK   ${name}${out !== undefined ? ` -> ${JSON.stringify(out).slice(0, 140)}` : ""}`);
  } catch (err) {
    failures++;
    console.log(`FAIL ${name}: ${err?.status ?? ""} ${err?.message ?? err}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const admin = createClient({ serverUrl, appId });
let empresaA, empresaB, lead;

await check("login admin", async () => {
  const r = await admin.auth.loginViaEmailPassword(adminEmail, adminPassword);
  assert(r.access_token, "sem token");
  admin.setToken(r.access_token);
  return r.user.role;
});
await check("auth.me", async () => (await admin.auth.me()).email);
await check("criar empresas", async () => {
  empresaA = await admin.entities.Empresa.create({ nome: "Empresa A", ownerEmail: adminEmail });
  empresaB = await admin.entities.Empresa.create({ nome: "Empresa B", ownerEmail: "outro@x.com" });
  return [empresaA.id, empresaB.id];
});
await check("updateMe empresaAtualId", async () => {
  const me = await admin.auth.updateMe({ empresaAtualId: empresaA.id, apelido: "Admin" });
  assert(me.empresaAtualId === empresaA.id, "não salvou");
  return me.apelido;
});
await check("criar lead na empresa A", async () => {
  lead = await admin.entities.Lead.create({ empresaId: empresaA.id, nome: "João", telefone: "11999999999", tags: ["quente", "sp"], valor: 1500 });
  return lead.id;
});
await check("RLS: não cria tarefa em outra empresa", async () => {
  try {
    await admin.entities.Tarefa.create({ empresaId: empresaB.id, titulo: "Intrusa" });
  } catch (e) {
    assert(e.status === 403, `status ${e.status}`);
    return "bloqueado (403)";
  }
  throw new Error("deveria bloquear");
});
await check("filter simples", async () => {
  const r = await admin.entities.Lead.filter({ nome: "João" });
  assert(r.length === 1, `achou ${r.length}`);
});
await check("filter array contém", async () => (await admin.entities.Lead.filter({ tags: "quente" })).length);
await check("filter $in / $gte / $exists", async () => {
  const a = await admin.entities.Lead.filter({ nome: { $in: ["João", "Maria"] } });
  const b = await admin.entities.Lead.filter({ valor: { $gte: 1000 } });
  const c = await admin.entities.Lead.filter({ email: { $exists: false } });
  assert(a.length === 1 && b.length === 1 && c.length === 1, `${a.length}/${b.length}/${c.length}`);
});
await check("filter $or e ordenação", async () => {
  const r = await admin.entities.Lead.filter({ $or: [{ nome: "X" }, { valor: { $lt: 2000 } }] }, "-created_date", 10);
  assert(r.length === 1, `achou ${r.length}`);
});
await check("update parcial", async () => {
  const r = await admin.entities.Lead.update(lead.id, { status: "contatado" });
  assert(r.nome === "João" && r.status === "contatado", "merge falhou");
});
await check("list User", async () => (await admin.entities.User.list()).length);
await check("função buscarEmpresasDoUsuario", async () => {
  const r = await admin.functions.invoke("buscarEmpresasDoUsuario", {});
  return r.status;
});
await check("função contarLeadsEmpresa", async () => {
  const r = await admin.functions.invoke("contarLeadsEmpresa", { empresaId: empresaA.id });
  return r.data;
});
await check("upload de arquivo", async () => {
  const file = new File(["olá mundo"], "teste.txt", { type: "text/plain" });
  const r = await admin.integrations.Core.UploadFile({ file });
  const res = await fetch(r.file_url.replace(/^https?:\/\/[^/]+/, serverUrl));
  assert((await res.text()) === "olá mundo", "conteúdo diferente");
  return r.file_url;
});
await check("SendEmail (Mailpit)", async () => {
  await admin.integrations.Core.SendEmail({ to: "teste@exemplo.com", subject: "Teste", body: "<b>ok</b>" });
});

// Segundo usuário: cadastro com código por e-mail
const email2 = `vendedor${Date.now()}@teste.com`;
const user2 = createClient({ serverUrl, appId });
await check("cadastro + OTP", async () => {
  await user2.auth.register({ email: email2, password: "senha12345" });
  const msgs = await (await fetch(`http://localhost:8025/api/v1/search?query=to:${email2}`)).json();
  const code = msgs.messages?.[0]?.Subject?.match(/(\d{6})/)?.[1];
  assert(code, "código não chegou no Mailpit");
  const r = await user2.auth.verifyOtp({ email: email2, otpCode: code });
  user2.auth.setToken(r.access_token);
  return (await user2.auth.me()).role;
});
await check("RLS: usuário sem empresa não vê leads", async () => {
  const r = await user2.entities.Lead.list();
  assert(r.length === 0, `viu ${r.length}`);
});
await check("RLS: usuário comum só vê a si mesmo em User", async () => {
  const r = await user2.entities.User.list();
  assert(r.length === 1 && r[0].email === email2, `viu ${r.length}`);
});
await check("RLS: usuário comum não exclui lead", async () => {
  await user2.auth.updateMe({ empresaAtualId: empresaA.id });
  assert((await user2.entities.Lead.list()).length === 1, "deveria ver o lead da empresa A");
  try {
    await user2.entities.Lead.delete(lead.id);
  } catch (e) {
    assert(e.status === 403, `status ${e.status}`);
    return "bloqueado (403)";
  }
  throw new Error("deveria bloquear");
});
await check("sem login é bloqueado", async () => {
  const anon = createClient({ serverUrl, appId });
  try {
    await anon.entities.Lead.list();
  } catch (e) {
    assert(e.status === 401, `status ${e.status}`);
    return "401";
  }
  throw new Error("deveria bloquear");
});
await check("limpeza", async () => {
  await admin.entities.Lead.delete(lead.id);
  await admin.entities.Empresa.delete(empresaA.id);
  await admin.entities.Empresa.delete(empresaB.id);
});

console.log(failures ? `\n${failures} teste(s) falharam` : "\nTodos os testes passaram");
process.exit(failures ? 1 : 0);
