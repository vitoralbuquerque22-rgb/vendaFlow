// Gera a referência da API do 3C Plus em Markdown a partir do swagger oficial.
//
// Uso (na pasta docs/3cplus):
//   curl -o swagger.json https://app.3c.plus/api/v1/swagger.json   # baixa a versão mais nova
//   node gerar-referencia.mjs
// Saída: API_REFERENCIA.md (endpoints) e API_MODELOS.md (modelos de dados).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const swagger = JSON.parse(fs.readFileSync(path.join(aqui, "swagger.json"), "utf8"));
const defs = swagger.definitions ?? {};
const hoje = new Date().toISOString().slice(0, 10);

const METODOS = ["get", "post", "put", "patch", "delete"];
const ancora = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const celula = (s) => String(s ?? "").replace(/\r?\n+/g, " ").replace(/\|/g, "\\|").trim();
const nomeRef = (ref) => ref.split("/").pop();
const linkModelo = (nome) => `[${nome}](API_MODELOS.md#${ancora(nome)})`;

function tipoDe(schema) {
  if (!schema) return "";
  if (schema.$ref) return linkModelo(nomeRef(schema.$ref));
  if (schema.type === "array") return `lista de ${tipoDe(schema.items) || "valores"}`;
  if (schema.allOf) return schema.allOf.map(tipoDe).filter(Boolean).join(" + ");
  let t = schema.type ?? (schema.properties ? "object" : "");
  if (schema.format) t += ` (${schema.format})`;
  if (schema.enum) t += `: ${schema.enum.map((v) => `\`${v}\``).join(", ")}`;
  return t;
}

// ── Endpoints ──
const porTag = new Map();
let total = 0;
for (const [rota, item] of Object.entries(swagger.paths ?? {})) {
  const paramsComuns = item.parameters ?? [];
  for (const metodo of METODOS) {
    const op = item[metodo];
    if (!op) continue;
    total++;
    const tag = op.tags?.[0] ?? "Outros";
    if (!porTag.has(tag)) porTag.set(tag, []);
    porTag.get(tag).push({ rota, metodo, op, params: [...paramsComuns, ...(op.parameters ?? [])] });
  }
}
const tags = [...porTag.keys()].sort((a, b) => a.localeCompare(b));

// O swagger tem tags que só diferem em maiúsculas: título com sufixo para a âncora não colidir
const tituloTag = new Map();
const usadas = new Map();
for (const t of tags) {
  const base = ancora(t);
  const n = (usadas.get(base) ?? 0) + 1;
  usadas.set(base, n);
  tituloTag.set(t, n === 1 ? t : `${t} (${n})`);
}

let md = `# 3C Plus — Referência da API

> Gerado automaticamente de \`swagger.json\` (${swagger.info?.title ?? "3C Plus"} ${swagger.info?.version ?? ""}) em ${hoje}
> por \`gerar-referencia.mjs\`. Não edite à mão: atualize o swagger e rode o gerador de novo.
> Fonte oficial: https://api-docs.3c.plus/ (especificação: https://app.3c.plus/api/v1/swagger.json)

- **Base:** \`https://{dominio}.3c.plus/api/v1\` (domínio da organização — ex.: \`oficinasmaster\`)
- **Autenticação:** token de serviço \`3cs_...\` no header \`Authorization: Bearer\` (recomendado) ou \`?api_token=\`.
  Token de papel **agente** exige o header \`X-Agent-Id\`. Ver [TOKENS_DE_SERVICO.md](TOKENS_DE_SERVICO.md).
- **Respostas:** campos \`status\`, \`title\`, \`detail\`, \`transaction_id\`; recursos dentro de \`data\`.
  \`?fields=id,name\` limita os campos retornados. Muitos comandos respondem \`204\` — o resultado chega pelo socket
  ([EVENTOS_SOCKET.md](EVENTOS_SOCKET.md)).
- **Modelos de dados:** [API_MODELOS.md](API_MODELOS.md)

**${total} operações em ${tags.length} grupos.**

## Índice

${tags.map((t) => `- [${tituloTag.get(t)}](#${ancora(tituloTag.get(t))}) (${porTag.get(t).length})`).join("\n")}
`;

for (const tag of tags) {
  md += `\n## ${tituloTag.get(tag)}\n`;
  const ops = porTag.get(tag).sort((a, b) => a.rota.localeCompare(b.rota) || METODOS.indexOf(a.metodo) - METODOS.indexOf(b.metodo));
  for (const { rota, metodo, op, params } of ops) {
    md += `\n### \`${metodo.toUpperCase()} ${rota}\`\n\n`;
    if (op.summary) md += `**${celula(op.summary)}**\n\n`;
    if (op.description && op.description.trim() !== op.summary?.trim()) md += `${op.description.trim()}\n\n`;

    const visiveis = params.filter((p) => p.name !== "api_token");
    if (visiveis.length) {
      md += `| Parâmetro | Onde | Tipo | Obrigatório | Descrição |\n|---|---|---|---|---|\n`;
      for (const p of visiveis) {
        const tipo = p.schema ? tipoDe(p.schema) : tipoDe(p);
        md += `| \`${p.name}\` | ${p.in} | ${celula(tipo)} | ${p.required ? "sim" : ""} | ${celula(p.description)} |\n`;
      }
      md += "\n";
    }

    const respostas = Object.entries(op.responses ?? {});
    if (respostas.length) {
      md += `| Resposta | Descrição | Corpo |\n|---|---|---|\n`;
      for (const [codigo, r] of respostas) md += `| ${codigo} | ${celula(r.description)} | ${celula(tipoDe(r.schema))} |\n`;
      md += "\n";
    }
  }
}
fs.writeFileSync(path.join(aqui, "API_REFERENCIA.md"), md);

// ── Modelos ──
function propriedades(def, visitados = new Set()) {
  const out = [];
  for (const parte of def.allOf ?? []) {
    if (parte.$ref) {
      const nome = nomeRef(parte.$ref);
      if (!visitados.has(nome) && defs[nome]) {
        visitados.add(nome);
        out.push(...propriedades(defs[nome], visitados).map((p) => ({ ...p, herdado: p.herdado ?? nome })));
      }
    } else {
      out.push(...propriedades(parte, visitados));
    }
  }
  const obrig = new Set(def.required ?? []);
  for (const [nome, p] of Object.entries(def.properties ?? {})) out.push({ nome, tipo: tipoDe(p), descricao: p.description, obrigatorio: obrig.has(nome) });
  return out;
}

const nomes = Object.keys(defs).sort((a, b) => a.localeCompare(b));
let mm = `# 3C Plus — Modelos de dados

> Gerado automaticamente de \`swagger.json\` em ${hoje} por \`gerar-referencia.mjs\`. Não edite à mão.
> Endpoints: [API_REFERENCIA.md](API_REFERENCIA.md)

**${nomes.length} modelos.** Modelos de evento do socket: \`BaseEvent\`, \`AgentEvent\`, \`CallEvent\`, \`CallHistoryEvent\`,
\`SpyEvent\`, \`ListEvent\`, \`CallTransferEvent\`, \`ReachedMaxOnlineAgents\` (ver [EVENTOS_SOCKET.md](EVENTOS_SOCKET.md)).

## Índice

${nomes.map((n) => `[${n}](#${ancora(n)})`).join(" · ")}
`;
for (const nome of nomes) {
  const def = defs[nome];
  mm += `\n## ${nome}\n\n`;
  if (def.description) mm += `${def.description.trim()}\n\n`;
  if (def.type === "array" && def.items) {
    mm += `Lista de ${tipoDe(def.items)}.\n`;
    continue;
  }
  const props = propriedades(def);
  if (!props.length) {
    mm += `_Sem campos declarados._\n`;
    continue;
  }
  mm += `| Campo | Tipo | Descrição |\n|---|---|---|\n`;
  for (const p of props) mm += `| \`${p.nome}\`${p.obrigatorio ? " *" : ""} | ${celula(p.tipo)} | ${celula(p.descricao)}${p.herdado ? ` _(de ${p.herdado})_` : ""} |\n`;
}
fs.writeFileSync(path.join(aqui, "API_MODELOS.md"), mm);

console.log(`API_REFERENCIA.md: ${total} operações em ${tags.length} grupos | API_MODELOS.md: ${nomes.length} modelos`);
