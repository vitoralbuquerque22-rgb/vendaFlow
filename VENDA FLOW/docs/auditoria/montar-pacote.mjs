// Monta o pacote de materiais para auditoria externa (cópias; não altera o projeto).
// Uso, a partir da pasta acima de "VENDA FLOW":
//   node "VENDA FLOW/docs/auditoria/montar-pacote.mjs" "$PWD/VENDA FLOW" "$PWD/pacote-auditoria-vendaflow"
// Os documentos escritos à mão (00_LEIA-ME, 01_ARQUITETURA, 05_FLUXOS_CRITICOS) ficam nesta pasta e são
// copiados para o pacote separadamente.
import fs from "node:fs";
import path from "node:path";

const RAIZ = process.argv[2];                       // .../VENDA FLOW
const SAIDA = process.argv[3];                      // .../pacote-auditoria-vendaflow
const rel = (p) => path.relative(RAIZ, p).replaceAll("\\", "/");
const ler = (p) => fs.readFileSync(p, "utf8");
const lang = (f) => ({ ".ts": "ts", ".js": "js", ".jsx": "jsx", ".jsonc": "jsonc", ".json": "json", ".md": "md" }[path.extname(f)] ?? "");

function copiar(origem, destinoDir) {
  const destino = path.join(SAIDA, destinoDir, rel(origem));
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.copyFileSync(origem, destino);
  return destino;
}

function juntar(arquivos, titulo, destino, intro = "") {
  let md = `# ${titulo}\n\n${intro}\n`;
  md += `\n## Índice\n\n${arquivos.map((f) => `- \`${rel(f)}\` (${ler(f).split("\n").length} linhas)`).join("\n")}\n`;
  for (const f of arquivos) md += `\n---\n\n## \`${rel(f)}\`\n\n\`\`\`${lang(f)}\n${ler(f).trimEnd()}\n\`\`\`\n`;
  fs.writeFileSync(path.join(SAIDA, destino), md);
  return md.length;
}

const existe = (p) => fs.existsSync(p);
const J = (...p) => path.join(RAIZ, ...p);

// ── 02: documentação da integração 3C Plus ──
const docs3c = fs.readdirSync(J("docs/3cplus")).filter((f) => f.endsWith(".md")).map((f) => J("docs/3cplus", f));
const docsTelefonia = ["TELEFONIA_CONTRATO.md", "RUNBOOK_TELEFONIA_3CPLUS.md", "CRIPTOGRAFIA_TOKENS.md"].map((f) => J("docs", f));
for (const f of [...docs3c, ...docsTelefonia]) copiar(f, "02_INTEGRACAO_3CPLUS");
copiar(J("docs/3cplus/swagger.json"), "02_INTEGRACAO_3CPLUS");

// ── 03: código da integração ──
const backendSrc = fs.readdirSync(J("backend/src")).filter((f) => f.endsWith(".ts")).map((f) => J("backend/src", f));
const funcoes = fs.readdirSync(J("backend/functions")).filter((n) =>
  /3CPlus$/.test(n) || ["webhookReceberLead", "receberLeadExterno", "capturarLead", "processarLeadLandingPage", "distribuirLead",
    "processarDistribuicaoProgramada", "redistribuirLeadsVencidos", "importarLeadsCSV", "processarAutomacoes", "verificarAlertas",
    "enviarCampanhasAgendadas", "calcularLeadScore", "retryGravacoes3CPlus", "purgeGravacoes", "transcreverAudio",
    "excluirLeadCascata", "vincularEmpresaLeads"].includes(n))
  .map((n) => J("backend/functions", n, "entry.ts")).filter(existe).sort();
const shared = fs.readdirSync(J("backend/functions/_shared")).map((n) => J("backend/functions/_shared", n, "entry.ts")).filter(existe);
const frontTel = [
  "frontend/src/api/client.js",
  "frontend/src/contexts/TelefoniaContext.jsx",
  ...fs.readdirSync(J("frontend/src/contexts/telefonia")).map((f) => `frontend/src/contexts/telefonia/${f}`),
  "frontend/src/components/telefonia/RamalWebRTC.jsx",
  "frontend/src/components/telefonia/Softphone3CPlus.jsx",
  "frontend/src/components/telefonia/SeletorCampanha.jsx",
  "frontend/src/components/telefonia/ModalAtendimentoManual.jsx",
  "frontend/src/hooks/useRamalStatus.js",
  "frontend/src/hooks/useExtensaoChrome.js",
  "frontend/src/hooks/useMonitoramentoRealTime.js",
  "frontend/src/lib/telefonia3cDados.js",
  "frontend/src/lib/services/telefoniaService.js",
  "frontend/src/lib/services/leadService.js",
  "frontend/src/components/hooks/usePermissions.jsx",
  "frontend/src/components/hooks/useEmpresaAtual.jsx",
].map((p) => J(p)).filter(existe);
const extra = ["docker-compose.yml", ".env.example", "backend/deno.json", "CLAUDE.md"].map((p) => J(p));

for (const f of [...backendSrc, ...funcoes, ...shared, ...frontTel, ...extra]) copiar(f, "03_CODIGO");
const tamBack = juntar([...backendSrc], "Código — backend/src (servidor, banco, regras de acesso, 3C)", "03_CODIGO_BACKEND_SRC.md",
  "Núcleo do servidor. `telefonia3c.ts` = único acesso à API do 3C; `ponte3c.ts` = socket do 3C repassado ao navegador; `entities.ts` = CRUD + regras de acesso + segredos mascarados.");
const tamFn = juntar([...funcoes, ...shared], "Código — funções de backend (3C Plus, leads, distribuição, automações)", "03_CODIGO_FUNCOES.md",
  "Cada função é `backend/functions/<nome>/entry.ts` e responde em `POST /api/functions/<nome>`.");
const tamFront = juntar(frontTel, "Código — frontend de telefonia", "03_CODIGO_FRONTEND_TELEFONIA.md",
  "Quem reage aos eventos do 3C é o navegador (`TelefoniaContext.jsx`). Roteamento de eventos em `TELEFONIA_ENGINE.js`.");

// ── 04: banco ──
const entidades = fs.readdirSync(J("backend/entities")).filter((f) => f.endsWith(".jsonc")).map((f) => J("backend/entities", f)).sort();
for (const f of [J("backend/src/db.ts"), ...entidades]) copiar(f, "04_BANCO");
const tamEnt = juntar([J("backend/src/db.ts"), ...entidades], "Banco — schema SQL e definição das 57 entidades", "04_BANCO_ENTIDADES.md",
  "Todas as entidades ficam na tabela `records` (`data` jsonb). Os `.jsonc` definem campos, `default` e regras `rls`. O schema não é validado na gravação.");

// Tabela das regras de acesso
const semComentario = (t) => t.replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (_m, s) => s ?? "");
let rls = `# Regras de acesso por entidade (campo \`rls\`)

Geradas de \`backend/entities/*.jsonc\`. Aplicadas em \`backend/src/entities.ts\` (\`accessFilter\`, \`ruleToFilter\`).
Semântica implementada: sem regra para a operação → qualquer usuário **logado** pode; sem login só passa regra
\`{ "allow": true }\`; \`api.asServiceRole\` (funções) ignora as regras. Templates: \`{{user.email}}\`, \`{{user.id}}\`,
\`{{user.data.<campo>}}\`. \`user_condition\` compara campos do usuário (ex.: \`role\`).

| Entidade | Campos | read | create | update | delete |
|---|---|---|---|---|---|
`;
let comRegra = 0;
for (const f of entidades) {
  const s = JSON.parse(semComentario(ler(f)));
  const r = s.rls ?? {};
  if (Object.keys(r).length) comRegra++;
  const fmt = (o) => (o ? "`" + JSON.stringify(o).replaceAll("|", "\\|") + "`" : "— (qualquer logado)");
  rls += `| ${s.name ?? path.basename(f, ".jsonc")} | ${Object.keys(s.properties ?? {}).length} | ${fmt(r.read)} | ${fmt(r.create)} | ${fmt(r.update)} | ${fmt(r.delete)} |\n`;
}
rls += `\n**${comRegra} de ${entidades.length} entidades têm alguma regra.** A entidade \`User\` tem regras próprias no código: admin vê todos; demais só a si mesmos.\n`;
fs.writeFileSync(path.join(SAIDA, "04_BANCO_REGRAS_DE_ACESSO.md"), rls);

// ── Verificação de segredos ──
const vazamentos = [];
function varrer(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) varrer(p);
    else if (/3cs_[A-Za-z0-9]{12,}|sk-ant-[A-Za-z0-9]|JWT_SECRET=[a-f0-9]{32,}/.test(ler(p))) vazamentos.push(p);
  }
}
varrer(SAIDA);

console.log(`docs 3C: ${docs3c.length + docsTelefonia.length} | backend/src: ${backendSrc.length} | funções: ${funcoes.length} (+${shared.length} shared) | frontend: ${frontTel.length} | entidades: ${entidades.length} (${comRegra} com regra)`);
console.log(`tamanhos (caracteres): backend ${tamBack} | funções ${tamFn} | frontend ${tamFront} | entidades ${tamEnt}`);
console.log(vazamentos.length ? `SEGREDOS ENCONTRADOS: ${vazamentos.join(", ")}` : "nenhum segredo no pacote");
