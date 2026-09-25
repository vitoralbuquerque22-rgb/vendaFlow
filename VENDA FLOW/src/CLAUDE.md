# VendaFlow CRM — Guia para Claude

## Stack
- Frontend: React 18 + Vite + TailwindCSS + shadcn/ui + TanStack Query v5
- Backend: Deno serverless functions (Base44 platform)
- Auth: Base44 SDK (createClientFromRequest)
- Telefonia: 3C Plus REST API + Socket.IO (new-socket.3c.plus)

## Regras críticas

### 3C Plus API
- Autenticação SEMPRE via query param: `?api_token=TOKEN` — NUNCA Bearer header
- Socket events usam prefixo `-was-`: `call-was-answered`, `call-was-finished`
- Token gestor: operações de gestão/monitoramento
- Token agente: operações do próprio agente

### Multi-tenant
- SEMPRE incluir `empresaId` em todos os filtros de banco
- NUNCA usar `.list()` sem filtro de tenant — use `.filter({ empresaId })`
- Funções backend usam `base44.asServiceRole` com justificativa comentada

### React Query v5
- `invalidateQueries({ queryKey: ["key"] })` — sem `.exact`
- staleTime via STALE_TIMES de src/lib/query-client.js

### Tokens sensíveis
- Tokens 3C Plus de agentes ficam em UserProfile.token_3cplus
- Formato encriptado: `enc:<iv_b64>:<ct_b64>` via AES-256-GCM
- Env var: TOKEN_ENCRYPTION_KEY (Base44 Secrets)

## Estrutura principal
- src/pages/ — páginas (lazy loaded exceto Dashboard, Leads, Tarefas)
- src/components/ — componentes reutilizáveis
- src/contexts/TelefoniaContext.jsx — contexto de telefonia (singleton socket)
- src/lib/ — utilitários, query-client, sanitize, services
- base44/functions/ — funções serverless Deno

## Comandos
- `npm run dev` — desenvolvimento
- `npm run build` — build de produção
- `npx vite build` — verifica erros de compilação