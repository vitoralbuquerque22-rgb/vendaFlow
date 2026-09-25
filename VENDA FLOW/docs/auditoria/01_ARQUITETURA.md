# VendaFlow — Arquitetura (estado em 25/09/2026)

Descrição factual do sistema como está no repositório (commit `1601bba`,
https://github.com/vitoralbuquerque22-rgb/vendaFlow, pasta `VENDA FLOW/`). Não é um documento de intenção:
onde algo não existe, está dito.

## Origem

CRM criado no Base44 (plataforma no-code), exportado e migrado em 25/09/2026 para backend próprio.
O código de negócio (telas React e 81 funções de backend) veio do Base44; a infraestrutura (servidor, banco,
autenticação, regras de acesso, tempo real, IA) foi reescrita. Não há migração de dados: o banco começa vazio.

## Componentes

| Componente | Tecnologia | Onde |
|---|---|---|
| Frontend | React 18 + Vite + TanStack Query v5 + Tailwind/shadcn | `frontend/` |
| API | Deno 2.5 (servidor HTTP próprio, sem framework) | `backend/src/main.ts` |
| Banco | PostgreSQL 16 | `backend/src/db.ts` |
| Tempo real | Socket.IO (servidor em Deno) | `backend/src/realtime.ts` |
| Funções de negócio | 81 funções Deno, uma por pasta | `backend/functions/<nome>/entry.ts` |
| Telefonia | 3C Plus (API REST + socket + SIP/WebRTC) | `backend/src/telefonia3c.ts`, `backend/src/ponte3c.ts` |
| IA | Claude (Anthropic) — geração de texto e agente "Assistente de Vendas" | `backend/src/llm.ts`, `backend/src/agents.ts` |
| E-mail | SMTP (Mailpit em desenvolvimento) | `backend/src/mailer.ts` |
| Arquivos | Disco local do servidor | `backend/src/files.ts` |
| Infra local | Docker Compose (db, mailpit, api); frontend via `npm run dev` | `docker-compose.yml` |

Produção (planejado, não feito): VPS Hostinger KVM4, Debian 12, Portainer, HTTPS.

## Banco de dados

Uma tabela genérica para todas as entidades (modelo herdado do Base44):

```sql
records(id text pk, entity text, data jsonb, created_date, updated_date, created_by, created_by_id)
```

- 57 entidades definidas em `backend/entities/*.jsonc` (campos, tipos, `default`, regras `rls`).
  O schema JSON **não é validado** na gravação: só `default` é aplicado; campos fora do schema são aceitos.
- Tabelas próprias: `users` (login), `auth_codes` (OTP), `conversations` (agente de IA), `files` (uploads).
- Índices: `(entity, created_date)`, `(entity, updated_date)`, `(entity, data->>'empresaId')`, GIN em `data`.
- **Não existem:** migrations versionadas (o schema é criado por `create table if not exists` na subida),
  triggers, funções SQL, RLS do Postgres, chaves estrangeiras, constraints de unicidade além de `users.email`.
- Consultas: filtros estilo MongoDB traduzidos para SQL (`backend/src/query.ts`): igualdade (inclui "array contém"),
  `$in`, `$nin`, `$ne`, `$gt/$gte/$lt/$lte`, `$exists`, `$regex`, `$or`, `$and`, `$nor`, `$all`, `$size`, `$elemMatch`.
- Atualização = merge raso (`data || novo`): campos objeto são substituídos inteiros.

## Autenticação e autorização

- Login próprio: e-mail + senha (bcrypt), cadastro com código por e-mail (OTP), redefinição e convite por link
  (JWT de uso único). Sessão = JWT HS256 (`JWT_SECRET`), 30 dias, no header `Authorization: Bearer`.
- Papéis: `users.role` (`admin`, `super_admin`, `user`...) + papéis de negócio em `VinculoEmpresa.papel`
  e `UserProfile.role` (resolvidos no frontend em `components/hooks/usePermissions.jsx`).
- **Isolamento por empresa (tenant = `empresaId`)** é aplicado em código, em `backend/src/entities.ts`, a partir do
  campo `rls` de cada entidade (ver `04_BANCO/REGRAS_DE_ACESSO.md`). Só 9 das 57 entidades têm regra; nas demais,
  qualquer usuário logado lê e grava qualquer registro (comportamento herdado do Base44).
- Funções do backend podem usar `api.asServiceRole`, que ignora as regras de acesso.
- Campos secretos (tokens do 3C em `Integracao.configuracao` e `UserProfile.token_3cplus`) saem mascarados
  (`••••••••`) em toda resposta ao navegador; gravar a máscara mantém o valor.

## Funções de backend

- 81 funções em `backend/functions/<nome>/entry.ts`, `export default async (req) => Response`.
- Chamadas por `POST /api/functions/<nome>` (navegador, com JWT) ou por sistemas externos (webhooks).
- Dentro delas, `createClientFromRequest(req)` (`backend/src/sdk.ts`) dá acesso ao banco no mesmo processo:
  `api.entities.X` (com as regras do usuário) e `api.asServiceRole.entities.X` (sem regras).
- Uma função pode chamar outra (`api.functions.invoke`), no mesmo processo.
- Carregadas na subida do servidor; erro de carga de uma função não derruba as outras.

### Funções públicas (sem login do CRM)

Levantamento **heurístico** (busca por palavras-chave no código; confirmar lendo cada função):

| Função | Autenticação encontrada |
|---|---|
| `webhookReceberLead` | login **ou** `X-Internal-Secret` / `X-Bridge-Secret` / segredo por formulário |
| `receberEvento3CPlus` | `X-Bridge-Secret` |
| `autoAssignProfile` | `X-Internal-Secret` |
| `capturarLead` | nenhuma autenticação encontrada (menciona limite) |
| `receberLeadExterno`, `processarLeadLandingPage`, `registrarVisitaLandingPage`, `trackEmailOpen`, `trackEmailClick`, `buscarLandingPagePublica` | nenhuma autenticação encontrada |

## Eventos e processamento assíncrono

**Não existe arquitetura orientada a eventos com barramento.** Não há fila, broker, workers, outbox, event log,
retry automático, dead-letter nem idempotência genérica. O que existe:

1. **Eventos do 3C Plus (Socket.IO):** o backend (`backend/src/ponte3c.ts`) abre o socket do 3C e repassa cada evento
   ao navegador pelas salas `telefonia:agente:<userId>` e `telefonia:gestor:<empresaId>`. Quem reage é o **navegador**
   (`frontend/src/contexts/TelefoniaContext.jsx`), que grava CallSession, Lead, Atividade. Se o navegador não estiver
   aberto, o evento não é processado por ninguém (não há consumidor no servidor). Eventos não são persistidos.
2. **Webhooks de entrada** (leads de formulários/landing pages) — funções públicas acima.
3. **Webhooks do 3C Plus:** o 3C só oferece `call-was-connected` e `call-history-was-created`; **não estão configurados**.
   `receberEvento3CPlus` recebia de uma ponte Node.js antiga que **não existe mais**.
4. **Tarefas agendadas:** as do Base44 **não foram migradas** (plano: n8n). Funções que dependiam de cron
   (`processarAutomacoes`, `verificarAlertas`, `enviarCampanhasAgendadas`, `redistribuirLeadsVencidos`,
   `processarDistribuicaoProgramada`, `sincronizarTelefonia3CPlus`, `retryGravacoes3CPlus`, `purgeGravacoes`,
   `cleanupSystemMetrics`...) só rodam se alguém as chamar.
5. **Tempo real do CRM:** `entities.X.subscribe` (salas `entities:<Entidade>`, só admin) e conversas do agente de IA
   (`conversation:<id>`).

Controles pontuais existem dentro de algumas funções (ex.: lock de lead `Lead.is_locked_for_call`, tentativas de
registro SIP, saída do TPA tentando dois endpoints) — ver `05_FLUXOS_CRITICOS.md`.

## Integração 3C Plus (resumo)

- Autenticação por **tokens de serviço** (`3cs_...`): gestor e agente, em `Integracao.configuracao`; ações do SDR
  com `X-Agent-Id` = `UserProfile.id_3cplus` (resolvido pelo ramal). Token pessoal descontinuado em 01/10/2026.
- Todo acesso à API do 3C passa por `backend/src/telefonia3c.ts` (22 funções `*3CPlus` usam só esse módulo).
- Ramal WebRTC registrado pelo próprio CRM com JsSIP (`frontend/src/components/telefonia/RamalWebRTC.jsx`), com
  credencial SIP obtida pelo backend (`get-ramal-webrtc`), em uma única aba por navegador.
- Validado com ligação real em 25/09/2026 (ramal 909, campanha de teste): registro SIP, login confirmado por
  `agent-is-idle`, discagem manual, `manual-call-was-answered`, `call-was-finished`, TPA e logout.
- Detalhes: pasta `02_INTEGRACAO_3CPLUS/`.

## Configuração (variáveis de ambiente)

`.env` na raiz (modelo em `.env.example`): `JWT_SECRET`, `PUBLIC_URL`, `DATABASE_URL`/`POSTGRES_PASSWORD`,
`ADMIN_EMAIL`/`ADMIN_PASSWORD`, `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, `SMTP_*`, `TOKEN_ENCRYPTION_KEY`,
`BRIDGE_WEBHOOK_SECRET`, `INTERNAL_API_SECRET`, `OPENAI_API_KEY` (transcrição), `THREEC_SOCKET_URL`,
`VITE_API_PROXY`, `VITE_3CPLUS_SOCKET_URL`.

## Testes

- Frontend: Vitest, 140 testes (`frontend/src/**/__tests__`), foco em telefonia (roteamento de eventos, socket,
  login na campanha, contexto).
- API: `backend/tests/smoke-test.mjs` (22 verificações: login, regras de acesso, filtros, funções, upload, e-mail).
- Não há testes das 81 funções de negócio nem testes de ponta a ponta automatizados.
