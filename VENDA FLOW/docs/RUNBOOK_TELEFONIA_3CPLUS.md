> **Atualização 25/09/2026 — tokens de serviço.** O token pessoal deixa de funcionar em 01/10/2026. Nos comandos
> abaixo, troque `?api_token={token}` por `-H "Authorization: Bearer 3cs_..."` e, nas rotas `/agent/*`, use o token de
> serviço de **agente** com `-H "X-Agent-Id: {id do agente}"`. Referência: `docs/3cplus/TOKENS_DE_SERVICO.md`.
> Eventos do socket chegam pelo backend (`backend/src/ponte3c.ts`); o ramal é registrado pelo CRM (`docs/3cplus/RAMAL_WEBRTC.md`).

# Runbook Operacional — Telefonia 3C Plus

> VendaFlow CRM · TelefoniaEngine v1.0.0
> Última atualização: 2026-07-02

---

## 1. Nenhum agente consegue logar

**Sintoma:** Botão "Entrar na campanha" fica em "Aguardando 3C Plus..." e dá timeout após 15s.

**Diagnóstico:**
1. Verificar se a campanha está **ativa** (não pausada) no painel 3C Plus
2. Verificar se o domínio está correto em Integrações → Telefonia → campo `dominio`
3. Abrir DevTools → Console → filtrar por `[executarComando3CPlus]` — verificar se retorna 400/401/404
4. Testar token do agente diretamente: `GET https://{dominio}.3c.plus/api/v1/agent/campaigns?api_token={token}`
5. Se retornar 401 → token inválido ou expirado (gestor precisa gerar novo token no painel 3C Plus)

**Resolução:**
- Campanha pausada → gestor resume no painel 3C Plus
- Token expirado → gestor gera novo token em Configurações → Usuários → Opções Avançadas
- Domínio errado → corrigir em Integrações → Telefonia → campo `dominio` (ex: `minha-empresa`, sem `.3c.plus`)
- Erro 500 da 3C Plus → problema no lado da 3C Plus, aguardar ou contactar suporte

---

## 2. Divergência entre CRM e 3C Plus

**Sintoma:** CRM mostra "aguardando" mas agente está em ligação (ou vice-versa).

**Diagnóstico:**
1. Verificar heartbeat: DevTools → Console → filtrar por `[Heartbeat]`
   - Se aparece "divergência detectada" → heartbeat está corrigindo automaticamente
   - Se NÃO aparece nenhum log de heartbeat → heartbeat pode não estar rodando
2. Verificar socket: DevTools → Console → filtrar por `[Socket.IO 3C Plus]`
   - "desconectado" → socket caiu, verificar internet
3. Verificar estado real: `GET https://{dominio}.3c.plus/api/v1/agent/loggedCampaign?api_token={token}`
   - Retorna campanha → agente está logado na 3C Plus
   - Retorna 422 → agente não está online

**Resolução:**
- F5 (recarregar página) → `restoreAgentState` sincroniza automaticamente
- Se persistir → logout + login novamente
- Se heartbeat não roda → verificar se as 4 condições estão ativas (aba visível, logado, campanha ativa, socket conectado)

---

## 3. Sessão presa (agente não consegue sair nem entrar)

**Sintoma:** CRM mostra campanha ativa mas não responde a cliques. Ou botão "Sair" não funciona.

**Diagnóstico:**
1. Verificar se existe guard ativo: Console → `logoutEmAndamentoRef` pode estar `true` por crash anterior
2. Verificar estado na 3C Plus: `GET /agent/loggedCampaign?api_token={token}`
3. Se a 3C Plus diz que está logado mas o CRM não responde → sessão presa no frontend

**Resolução:**
1. **F5** — recarrega e `restoreAgentState` reconcilia
2. Se F5 não resolver → fazer logout direto na API:
   ```
   POST https://{dominio}.3c.plus/api/v1/agent/logout?api_token={token}
   ```
3. Se ainda preso → gestor pode desconectar o agente:
   ```
   POST https://{dominio}.3c.plus/api/v1/agents/{agent-id}/logout?api_token={token_gestor}
   ```
4. Limpar estado local: DevTools → Application → Session Storage → limpar, depois F5

---

## 4. Verificar se o heartbeat está funcionando

**Diagnóstico:**
1. DevTools → Console → filtrar por `[Heartbeat]`
2. Deve aparecer log a cada 60 segundos quando:
   - Aba está visível
   - Usuário logado
   - Campanha ativa
   - Socket conectado
3. Se não aparece → uma das 4 condições está falsa

**Verificação rápida:**
```javascript
// No console do browser:
// Verificar socket
document.querySelector('[data-socket-status]') // se existir
// Ou verificar via window events
window.dispatchEvent(new CustomEvent('vendaflow:reprocessar-agente'));
```

---

## 5. Verificar se o socket está conectado

**Diagnóstico:**
1. DevTools → Console → filtrar por `[Socket.IO 3C Plus]`
2. Mensagens esperadas:
   - `connect` → socket conectado
   - `reconnect` → socket reconectou após queda
   - `desconectado: ...` → socket caiu (ver motivo)
3. Motivos comuns de desconexão:
   - `io server disconnect` → servidor forçou desconexão (token inválido?)
   - `transport close` → rede caiu
   - `ping timeout` → rede instável

**Resolução:**
- `transport close` / `ping timeout` → verificar internet do agente
- `io server disconnect` → token pode ter sido invalidado, gerar novo
- Socket reconecta automaticamente (até 10 tentativas, intervalo 2s)
- Se não reconectar após 10 tentativas → F5

---

## 6. Erros HTTP comuns

### 401 — Não autenticado
- Token inválido ou expirado
- Gestor precisa gerar novo token no painel 3C Plus
- Verificar se o token no UserProfile está correto (Perfil → Telefonia 3C Plus)

### 400 — Domínio não configurado
- Campo `dominio` vazio na integração
- Ir em Integrações → Telefonia → preencher domínio (ex: `minha-empresa`)

### 422 — Validação
- **"Agente já está logado"** → idempotente, pode ignorar
- **"Agente não está online"** → WebRTC/Extension não está ativo
- **"Limite de usuários excedido"** → plano da empresa atingiu máximo de agentes simultâneos

### 500 — Erro interno 3C Plus
- Problema no lado da 3C Plus
- Aguardar 5-10 minutos e tentar novamente
- Se persistir → contactar suporte 3C Plus

### 204 — Sem conteúdo
- **NÃO é erro** — significa "comando recebido, aguarde confirmação via socket"
- Confirmação chega via eventos: `agent-is-idle`, `agent-was-logged-out`, etc.

---

## 7. Fluxo de diagnóstico rápido

```
Problema reportado
│
├─ Agente não consegue logar?
│  ├─ Token válido? → GET /agent/campaigns
│  ├─ Campanha ativa? → verificar painel 3C Plus
│  ├─ Ramal WebRTC registrado? → selo "webrtc ✓", permissão de microfone, ramal no perfil
│  └─ Socket conectado? → Console → [Socket.IO]
│
├─ Estado divergente?
│  ├─ Heartbeat rodando? → Console → [Heartbeat]
│  ├─ F5 resolve? → restoreAgentState
│  └─ Persistir → logout manual via API
│
├─ Sessão presa?
│  ├─ F5 resolve?
│  ├─ POST /agent/logout via DevTools
│  └─ Gestor desconecta via POST /agents/{id}/logout
│
└─ Socket caiu?
   ├─ Internet ok? → verificar rede
   ├─ Reconexão automática (10x, 2s intervalo)
   └─ Após 10 falhas → F5
```

---

## 8. Contatos

- **Suporte 3C Plus:** via painel 3C Plus ou email para suporte
- **Swagger API:** `https://{dominio}.3c.plus/api/v1` (documentação em `/docs`)
- **Socket events:** ver `TELEFONIA_ENGINE.js` para lista completa de eventos