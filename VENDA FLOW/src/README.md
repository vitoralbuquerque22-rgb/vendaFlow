# VendaFlow CRM

CRM comercial multi-tenant para equipes de vendas (SDR, Closer, Gestor), com telefonia integrada via 3C Plus, e-mail marketing, funis de vendas e inteligência comercial por IA.

## Stack

- **Frontend:** React 18 + Vite + TailwindCSS + shadcn/ui + TanStack Query v5
- **Backend:** Deno serverless functions (Base44 platform)
- **Auth:** Base44 SDK (tokens gerenciados pela plataforma)
- **Telefonia:** 3C Plus REST API + Socket.IO (`socket.3c.plus`)
- **IA:** OpenAI (transcrição + análise de ligações)

## Setup local

```bash
npm install
npm run dev        # inicia em http://localhost:5173
npm run build      # build de produção
npx vite build     # verifica erros de compilação
```

## Variáveis de ambiente (Base44 Secrets)

| Variável               | Descrição                                         | Obrigatória |
|------------------------|---------------------------------------------------|-------------|
| `OPENAI_API_KEY`       | Chave da API OpenAI (transcrição e análise IA)    | Sim         |
| `TOKEN_ENCRYPTION_KEY` | Chave AES-256-GCM para encriptar tokens de agente | Sim         |
| `BRIDGE_URL`           | URL do bridge de telefonia (se usar bridge)       | Não         |
| `BRIDGE_WEBHOOK_SECRET`| Segredo para validar webhooks do bridge           | Não         |

## Arquitetura

```
src/
├── pages/          # Páginas React (lazy-loaded, exceto Dashboard/Leads/Tarefas)
├── components/
│   ├── crm/        # Modais e cards de CRM (Lead, Tarefa, Pipeline)
│   ├── telefonia/  # Softphone, modais de atendimento, seletor de campanha
│   ├── hooks/      # usePermissions, useEmpresaAtual, useTelefonia3CPlus
│   └── ui/         # shadcn/ui components
├── contexts/
│   └── TelefoniaContext.jsx   # Contexto global de telefonia (singleton socket)
├── lib/
│   ├── services/   # Camada de acesso a dados (leadService, tarefaService…)
│   ├── sanitize.js # Utilitários DOMPurify (sanitizeHTML, sanitizeText)
│   └── query-client.js  # TanStack Query config + STALE_TIMES
└── functions/      # Funções serverless Deno (deploy na Base44)
```

## Multi-tenancy

Cada empresa é um tenant isolado. **Toda query deve incluir `empresaId`:**

```js
// ✅ Correto
base44.entities.Lead.filter({ empresaId })

// ❌ Errado — retorna dados de todos os tenants
base44.entities.Lead.list()
```

## Telefonia 3C Plus

- Auth SEMPRE via query param: `?api_token=TOKEN` (nunca Bearer header)
- Token do agente: armazenado encriptado em `UserProfile.token_3cplus` (formato `enc:<iv>:<ct>`)
- Socket events: prefixo `-was-` (ex: `call-was-answered`, `call-was-finished`)
- Token gestor: operações de monitoramento/gestão
- Token agente: operações do próprio agente

## Segurança

- CSP configurada em `index.html`
- Input do usuário sanitizado via `lib/sanitize.js` (DOMPurify) antes de exibição com `dangerouslySetInnerHTML`
- Impersonação de empresa protegida por HMAC em `sessionStorage`
- Tokens de agente encriptados com AES-256-GCM via `TOKEN_ENCRYPTION_KEY