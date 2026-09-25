// Teste rápido da API. Uso (com o docker compose rodando):
//   node backend/tests/smoke-test.mjs
const API = process.env.API_URL ?? "http://localhost:8000";
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";
const adminEmail = process.env.ADMIN_EMAIL ?? "oficinasmaster@gmail.com";
const adminPassword = process.env.ADMIN_PASSWORD ?? "VendaFlow@2026";

function client(token) {
  async function call(method, path, body, params) {
    const url = new URL(`/api${path}`, API);
    for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined) url.searchParams.set(k, v);
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    const res = await fetch(url, { method, headers, body: payload });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw Object.assign(new Error(data?.message ?? res.statusText), { status: res.status, data });
    return data;
  }
  const entity = (name) => ({
    list: (params) => call("GET", `/entities/${name}`, undefined, params),
    filter: (q, sort, limit) => call("GET", `/entities/${name}`, undefined, { q: JSON.stringify(q), sort, limit }),
    create: (data) => call("POST", `/entities/${name}`, data),
    update: (id, data) => call("PUT", `/entities/${name}/${id}`, data),
    delete: (id) => call("DELETE", `/entities/${name}/${id}`),
  });
  return { call, entity, setToken: (t) => (token = t) };
}

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
async function expectStatus(status, fn) {
  try {
    await fn();
  } catch (e) {
    assert(e.status === status, `status ${e.status}, esperado ${status}`);
    return `bloqueado (${status})`;
  }
  throw new Error(`deveria bloquear com ${status}`);
}

const admin = client();
let empresaA, empresaB, lead;

await check("login admin", async () => {
  const r = await admin.call("POST", "/auth/login", { email: adminEmail, password: adminPassword });
  admin.setToken(r.access_token);
  return r.user.role;
});
await check("auth/me", async () => (await admin.call("GET", "/auth/me")).email);
await check("criar empresas", async () => {
  empresaA = await admin.entity("Empresa").create({ nome: "Empresa A", ownerEmail: adminEmail });
  empresaB = await admin.entity("Empresa").create({ nome: "Empresa B", ownerEmail: "outro@x.com" });
  return [empresaA.id, empresaB.id];
});
await check("atualizar empresa atual do usuário", async () => {
  const me = await admin.call("PUT", "/auth/me", { empresaAtualId: empresaA.id, apelido: "Admin" });
  assert(me.empresaAtualId === empresaA.id, "não salvou");
});
await check("criar lead na empresa A", async () => {
  lead = await admin.entity("Lead").create({ empresaId: empresaA.id, nome: "João", tags: ["quente", "sp"], valor: 1500 });
  return lead.id;
});
await check("RLS: não cria tarefa em outra empresa", () =>
  expectStatus(403, () => admin.entity("Tarefa").create({ empresaId: empresaB.id, titulo: "Intrusa" }))
);
await check("filtro simples", async () => assert((await admin.entity("Lead").filter({ nome: "João" })).length === 1, "não achou"));
await check("filtro: array contém", async () => assert((await admin.entity("Lead").filter({ tags: "quente" })).length === 1, "não achou"));
await check("filtro: $in / $gte / $exists", async () => {
  const a = await admin.entity("Lead").filter({ nome: { $in: ["João", "Maria"] } });
  const b = await admin.entity("Lead").filter({ valor: { $gte: 1000 } });
  const c = await admin.entity("Lead").filter({ email: { $exists: false } });
  assert(a.length === 1 && b.length === 1 && c.length === 1, `${a.length}/${b.length}/${c.length}`);
});
await check("filtro: $or e ordenação", async () => {
  const r = await admin.entity("Lead").filter({ $or: [{ nome: "X" }, { valor: { $lt: 2000 } }] }, "-created_date", 10);
  assert(r.length === 1, `achou ${r.length}`);
});
await check("update parcial", async () => {
  const r = await admin.entity("Lead").update(lead.id, { status: "contatado" });
  assert(r.nome === "João" && r.status === "contatado", "merge falhou");
});
await check("listar usuários (admin)", async () => (await admin.entity("User").list()).length);
await check("função buscarEmpresasDoUsuario", async () => {
  const r = await admin.call("POST", "/functions/buscarEmpresasDoUsuario", {});
  return Object.keys(r ?? {});
});
await check("função contarLeadsEmpresa (usa o cliente interno)", async () => {
  const r = await admin.call("POST", "/functions/contarLeadsEmpresa", { empresaId: empresaA.id });
  assert(r.total === 1, `total ${r.total}`);
  return r;
});
await check("upload de arquivo", async () => {
  const form = new FormData();
  form.append("file", new File(["olá mundo"], "teste.txt", { type: "text/plain" }));
  const r = await admin.call("POST", "/integrations/UploadFile", form);
  const res = await fetch(r.file_url.replace(/^https?:\/\/[^/]+/, API));
  assert((await res.text()) === "olá mundo", "conteúdo diferente");
  return r.file_url;
});
await check("SendEmail (Mailpit)", () =>
  admin.call("POST", "/integrations/SendEmail", { to: "teste@exemplo.com", subject: "Teste", body: "<b>ok</b>" })
);

const email2 = `vendedor${Date.now()}@teste.com`;
const user2 = client();
await check("cadastro + código por e-mail", async () => {
  await user2.call("POST", "/auth/register", { email: email2, password: "senha12345" });
  const msgs = await (await fetch(`${MAILPIT}/api/v1/search?query=to:${email2}`)).json();
  const code = msgs.messages?.[0]?.Subject?.match(/(\d{6})/)?.[1];
  assert(code, "código não chegou no Mailpit");
  const r = await user2.call("POST", "/auth/verify-otp", { email: email2, otp_code: code });
  user2.setToken(r.access_token);
  return (await user2.call("GET", "/auth/me")).role;
});
await check("RLS: usuário sem empresa não vê leads", async () => assert((await user2.entity("Lead").list()).length === 0, "viu leads"));
await check("RLS: usuário comum só vê a si mesmo em User", async () => {
  const r = await user2.entity("User").list();
  assert(r.length === 1 && r[0].email === email2, `viu ${r.length}`);
});
await check("RLS: usuário comum não exclui lead", async () => {
  await user2.call("PUT", "/auth/me", { empresaAtualId: empresaA.id });
  assert((await user2.entity("Lead").list()).length === 1, "deveria ver o lead da empresa A");
  return await expectStatus(403, () => user2.entity("Lead").delete(lead.id));
});
await check("sem login é bloqueado", () => expectStatus(401, () => client().entity("Lead").list()));
await check("limpeza", async () => {
  await admin.entity("Lead").delete(lead.id);
  await admin.entity("Empresa").delete(empresaA.id);
  await admin.entity("Empresa").delete(empresaB.id);
});

console.log(failures ? `\n${failures} teste(s) falharam` : "\nTodos os testes passaram");
process.exit(failures ? 1 : 0);
