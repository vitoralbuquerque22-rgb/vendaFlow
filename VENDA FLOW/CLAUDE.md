# VendaFlow CRM — Guia para Claude

## Stack
- Frontend (`frontend/`): React 18 + Vite + TailwindCSS + shadcn/ui + TanStack Query v5
- Backend (`backend/`): Deno + PostgreSQL + Socket.IO
- Cliente da API no frontend: `import { api } from "@/api/client"`
- Cliente nas funções do backend: `createClientFromRequest(req)` de `backend/src/sdk.ts`
- Telefonia: 3C Plus REST API + Socket.IO (new-socket.3c.plus)
- IA: Claude (`api.integrations.Core.InvokeLLM` e agentes em `backend/agents/`)

## Regras críticas

### 3C Plus API
- Referência completa: `docs/3cplus/INTEGRACAO_3CPLUS.md`
- Autenticação por token de serviço (`3cs_...`): header `Authorization: Bearer` (recomendado) ou `?api_token=`
- Token de papel agente exige o header `X-Agent-Id` com o id 3C do agente em toda requisição
- Token pessoal de usuário deixa de funcionar em 01/10/2026
- Tokens do 3C nunca no repositório. O token de serviço de agente age por QUALQUER agente: não pode ir para o
  navegador (hoje socket e ramal ainda recebem o token — ver pendências em docs/3cplus/INTEGRACAO_3CPLUS.md)
- Eventos do socket: use as constantes e o roteamento de `TELEFONIA_ENGINE.js`, nunca strings soltas
- Socket events usam prefixo `-was-`: `call-was-answered`, `call-was-finished`
- Token gestor: operações de gestão/monitoramento
- Token agente: operações do próprio agente

### Multi-tenant
- SEMPRE incluir `empresaId` em todos os filtros de banco
- NUNCA usar `.list()` sem filtro de tenant — use `.filter({ empresaId })`
- Regras de acesso por registro ficam no campo `rls` de cada `backend/entities/*.jsonc`
- Funções backend usam `api.asServiceRole` (ignora as regras) com justificativa comentada

### Funções do backend
- Uma por pasta: `backend/functions/<nome>/entry.ts`, com `export default async (req) => Response`
- Chamadas pelo frontend com `api.functions.invoke("<nome>", dados)` → `POST /api/functions/<nome>`
- Depois de alterar, rode `docker compose restart api`

### React Query v5
- `invalidateQueries({ queryKey: ["key"] })` — sem `.exact`
- staleTime via STALE_TIMES de frontend/src/lib/query-client.js

### Tokens sensíveis
- Tokens de serviço em Integracao.configuracao (token_gestor, token_servico_agente); id 3C do SDR em UserProfile.id_3cplus
- Acesso à API do 3C só por backend/src/telefonia3c.ts (chamar3C / credencialAgente / credencialGestor)
- Formato encriptado: `enc:<iv_b64>:<ct_b64>` via AES-256-GCM
- Env var: TOKEN_ENCRYPTION_KEY (arquivo `.env` da raiz)

## Estrutura principal
- frontend/src/pages/ — páginas (lazy loaded exceto Dashboard, Leads, Tarefas)
- frontend/src/components/ — componentes reutilizáveis
- frontend/src/contexts/TelefoniaContext.jsx — contexto de telefonia (singleton socket)
- frontend/src/lib/ — utilitários, query-client, sanitize, services
- backend/src/ — servidor (rotas, banco, login, regras de acesso, IA)
- backend/entities/ — definição das tabelas
- backend/functions/ — funções do backend
- extension/ — extensão do Chrome (registro do ramal WebRTC)
- docs/ — documentação de telefonia e segurança

## Comandos
- `docker compose up -d` — banco, e-mail de teste (Mailpit) e API
- `cd frontend && npm run dev` — frontend em http://localhost:5173
- `cd frontend && npx vite build` — verifica erros de compilação
- `cd frontend && npm test` — testes (Vitest)
- `node backend/tests/smoke-test.mjs` — testes da API
