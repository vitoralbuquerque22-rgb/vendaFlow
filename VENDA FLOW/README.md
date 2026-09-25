# VendaFlow CRM

CRM da Oficinas Master com integração 3C Plus. Originalmente criado no Base44, agora roda com backend próprio.

## Como funciona

- **Frontend** (`src/`): React + Vite. Continua usando o SDK `@base44/sdk`, mas apontado para a nossa API.
- **API** (`server/`): Deno + PostgreSQL. Responde nos mesmos endereços da API do Base44:
  - entidades (tabelas definidas em `base44/entities`, com as regras de acesso por empresa)
  - login, cadastro com código por e-mail, recuperação de senha e convites
  - as funções de `base44/functions`, que rodam sem alteração
  - IA com Claude (`InvokeLLM` e o agente de `base44/agents`), upload de arquivos e envio de e-mail
- **Mailpit**: captura os e-mails enviados em desenvolvimento.

## Rodando localmente

Pré-requisitos: Docker Desktop e Node.js.

```bash
cp .env.example .env        # depois preencha JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, ANTHROPIC_API_KEY...
docker compose up -d --build
npm install
npm run dev
```

- Sistema: http://localhost:5173 (entre com `ADMIN_EMAIL` / `ADMIN_PASSWORD`)
- E-mails de teste: http://localhost:8025
- API: http://localhost:8000/api/health

Depois de alterar arquivos em `server/` ou `base44/`, rode `docker compose restart api`.
No Windows o Docker não percebe mudanças na pasta montada, então o servidor não reinicia sozinho.

## Testes da API

Com o `docker compose` rodando:

```bash
node server/smoke-test.mjs
```

## Ainda não implementado

- Login com Google e sincronização com o Google Agenda (conector `googlecalendar`)
- Tarefas agendadas do Base44: as automações vão para o n8n
- Links de download da extensão do Chrome ainda apontam para o Base44 (`ExtensaoStatus.jsx`, `ExtensaoVendaFlow.jsx`)
