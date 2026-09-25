# VendaFlow CRM

CRM comercial multi-tenant para equipes de vendas (SDR, Closer, Gestor), com telefonia integrada via 3C Plus,
e-mail marketing, funis de vendas e inteligência comercial por IA.

## Estrutura

```
VENDA FLOW/
├── frontend/          React 18 + Vite + TailwindCSS + shadcn/ui + TanStack Query v5
│   └── src/api/client.js   cliente da API (import { api } from "@/api/client")
├── backend/           Deno + PostgreSQL
│   ├── src/           servidor: rotas, banco, login, regras de acesso, IA, tempo real
│   ├── entities/      definição das tabelas (campos + regras de acesso)
│   ├── functions/     funções do backend (uma por pasta)
│   ├── agents/        agentes de IA (Assistente de Vendas)
│   └── tests/         testes da API
├── extension/         extensão do Chrome (registro do ramal WebRTC do 3C Plus)
├── docs/              telefonia, criptografia de tokens, referência da API 3C Plus
└── docker-compose.yml banco, e-mail de teste e API
```

## Rodando localmente

Pré-requisitos: Docker Desktop e Node.js.

```bash
cp .env.example .env        # preencha JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, ANTHROPIC_API_KEY...
docker compose up -d --build
cd frontend
npm install
npm run dev
```

- Sistema: http://localhost:5173 (entre com `ADMIN_EMAIL` / `ADMIN_PASSWORD`)
- E-mails de teste: http://localhost:8025
- API: http://localhost:8000/api/health

Depois de alterar arquivos em `backend/`, rode `docker compose restart api`.
No Windows o Docker não percebe mudanças na pasta montada, então o servidor não reinicia sozinho.

## API

| Rota | Uso |
|---|---|
| `POST /api/auth/login`, `/register`, `/verify-otp`, `/reset-password-request`, `/reset-password`, `/invite` | login e cadastro |
| `GET/PUT /api/auth/me` | usuário logado |
| `GET/POST /api/entities/<Entidade>`, `GET/PUT/DELETE /api/entities/<Entidade>/<id>` | dados (filtro em `?q=<json>&sort=-created_date&limit=50`) |
| `POST /api/functions/<nome>` | funções do backend (também usadas como webhooks) |
| `POST /api/integrations/<nome>` | `InvokeLLM`, `UploadFile`, `SendEmail`... |
| `/api/agents/conversations` | conversas com agentes de IA |
| `/socket.io/` | tempo real (salas `conversation:<id>` e `entities:<Entidade>`) |

## Multi-tenancy

Cada empresa é um tenant isolado. **Toda query deve incluir `empresaId`:**

```js
// ✅ Correto
api.entities.Lead.filter({ empresaId })

// ❌ Errado — sem filtro de empresa
api.entities.Lead.list()
```

As regras de acesso ficam no campo `rls` de cada arquivo em `backend/entities/` e são aplicadas pelo servidor.

## Telefonia 3C Plus

- Auth por **token de serviço** (`3cs_...`) em `Authorization: Bearer`; ações do SDR levam `X-Agent-Id`
- Tokens em `Integracao.configuracao` (gestor e agente), nunca enviados ao navegador; id 3C do SDR em `UserProfile.id_3cplus`
- Token pessoal do 3C deixa de funcionar em **01/10/2026**
- Socket events: prefixo `-was-` (ex: `call-was-answered`, `call-was-finished`)
- Documentação completa do 3C Plus: `docs/3cplus/README.md` (API, eventos, tokens, ramal, guias)
- Operação: `docs/TELEFONIA_CONTRATO.md` e `docs/RUNBOOK_TELEFONIA_3CPLUS.md`

## Ramal WebRTC (áudio das ligações)

O ramal do 3C Plus é registrado **pelo próprio CRM** com JsSIP (`frontend/src/components/telefonia/RamalWebRTC.jsx`),
com as credenciais SIP que o backend obtém como o agente do usuário. Só uma aba registra o ramal; as outras consultam
o status. No primeiro uso o navegador pede permissão de microfone.

A extensão do Chrome (`extension/`) e a página `/extension` do 3C não funcionam com tokens de serviço e não são
mais usadas. Produção precisa de **HTTPS** (microfone). Detalhes: `docs/3cplus/RAMAL_WEBRTC.md`.

## Segurança

- CSP configurada em `frontend/index.html`
- Input do usuário sanitizado via `frontend/src/lib/sanitize.js` (DOMPurify)
- Senhas com bcrypt; sessões com JWT (`JWT_SECRET`)
- Tokens de agente encriptados com AES-256-GCM via `TOKEN_ENCRYPTION_KEY`

## Testes da API

Com o `docker compose` rodando:

```bash
node backend/tests/smoke-test.mjs
```

## Ainda não implementado

- Login com Google e sincronização com o Google Agenda
- Tarefas agendadas: as automações vão para o n8n (chamando `POST /api/functions/<nome>`)
