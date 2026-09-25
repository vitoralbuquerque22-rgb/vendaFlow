# 3C Plus API v2 — Documentação de Referência VendaFLOW

> **Fonte:** Swagger oficial FluxoTI · Atualizado: 2026-06-05  
> **Base URL:** `https://{dominio}.3c.plus/api/v1`  
> **Autenticação:** token de serviço `3cs_...` em `Authorization: Bearer` (+ `X-Agent-Id` no papel agente) — ver `docs/3cplus/TOKENS_DE_SERVICO.md`.
> Documentação completa e atualizada do 3C Plus: `docs/3cplus/README.md`.

---

## Sumário
1. [Autenticação](#autenticação)
2. [Estrutura de Resposta](#estrutura-de-resposta)
3. [Agentes — Endpoints](#agentes--endpoints)
4. [Chamadas — Endpoints](#chamadas--endpoints)
5. [Campanhas — Endpoints](#campanhas--endpoints)
6. [Qualificações — Endpoints](#qualificações--endpoints)
7. [Monitoramento / Spy](#monitoramento--spy)
8. [Eventos Realtime (Socket.IO)](#eventos-realtime-socketio)
9. [Mapeamento CRM → 3C Plus](#mapeamento-crm--3c-plus)
10. [Erros Comuns](#erros-comuns)
11. [Dados de Produção (Oficinas Master)](#dados-de-produção-oficinas-master)

---

## Autenticação

```
Authorization: Bearer {api_token}
```

Todo request exige autenticação. Desde a migração para **tokens de serviço** (o token pessoal deixa de funcionar em
01/10/2026): gestor usa o token de serviço de gestor (`Integracao.configuracao.token_gestor`); ações do SDR usam o
token de serviço de agente (`Integracao.configuracao.token_servico_agente`) + header `X-Agent-Id` com o id 3C do SDR
(`UserProfile.id_3cplus`). Tudo passa por `backend/src/telefonia3c.ts`; nenhum token vai para o navegador.

---

## Estrutura de Resposta

```json
{
  "status": 200,
  "title": "OK",
  "detail": "A requisição foi processada com sucesso.",
  "transaction_id": "uuid-aqui",
  "data": { ... }
}
```

**Status 204** = sucesso assíncrono (sem body). Muito comum em comandos de agente.  
**Status 422** = erro de validação de estado (agente não está no estado esperado).

---

## Agentes — Endpoints

### GET `/agent/campaigns`
Lista as campanhas disponíveis para o agente autenticado.  
**Response 200:** array de campanhas `{ id, name, dialer_type, ... }`

### POST `/agent/connect`
Registra o ramal WebRTC do agente. **Idempotente** — chamar sempre antes de login.  
**Response 204**

### POST `/agent/login`
Loga o agente em uma campanha.
```
Content-Type: application/x-www-form-urlencoded
campaign={campaign_id}
mode=dialer|manual  (opcional)
```
**Response 204**  
> ⚠️ Exige que `/agent/connect` tenha sido chamado antes.

### POST `/agent/logout`
Desloga o agente da campanha atual.  
**Response 204** | 422 "O agente já está desconectado"

### GET `/agent/loggedCampaign`
Retorna a campanha ativa do agente logado.  
**Response 200:** `{ data: { id, name, ... } }`  
**Response 422:** "O agente não está online"

### POST `/agent/work_break/{work-break-id}/enter`
Coloca o agente em pausa/intervalo.  
**Path:** `work-break-id` = ID do intervalo  
**Response 204**

### POST `/agent/work_break/exit`
Retira o agente da pausa.  
**Response 204**

### GET `/agent/calls`
Histórico de chamadas do agente.  
**Query params:** `start_date` (obrigatório, formato `Y-m-d H:i:s`), `end_date`, `limit`, `offset`

---

## Chamadas — Endpoints

### POST `/agent/manual_call/enter`
Entra em modo de discagem manual.  
**Pré-requisito:** agente deve estar **ocioso** (idle) — não em campanha.  
**Response 204** | 422 "Agente não está ocioso"

### POST `/agent/manual_call/dial`
Disca um número no modo manual.
```
Content-Type: application/x-www-form-urlencoded
phone={numero_com_ddd}
```
**Response 204** | 422 "Agente não está em modo manual"

### POST `/agent/manual_call/exit`
Sai do modo manual.  
**Response 204** | 422 "Agente não está em modo manual"

### POST `/agent/manual_call_acw/enter`
Entra em modo TPA (pós-atendimento) manual.  
**Pré-requisito:** agente deve estar em TPA (after call work).  
**Response 204** | 422 "Agente não está em TPA"

### POST `/agent/manual_call_acw/dial`
Disca durante o TPA manual.  
**Response 204**

### POST `/agent/call/{call-id}/hangup`
Encerra a chamada específica.  
**Response 204**

### POST `/agent/call/{call-id}/qualify`
Qualifica a chamada.
```json
{
  "qualification_id": 163878,
  "note": "Observação opcional",
  "date": "2026-06-05T10:00:00",  // opcional — para agendamento
  "phone": "44999999999"           // opcional — para reagendamento em outro número
}
```
**Response 204**

### GET `/agent/call/{call-id}/qualify`
Lista as qualificações disponíveis para a chamada.

---

## Campanhas — Endpoints

### GET `/campaigns`
Lista todas as campanhas (token gestor).  
**Response 200:** array paginado

### GET `/campaigns/{id}`
Detalhe de uma campanha.

### GET `/campaigns/{id}/intervals`
Lista os intervalos/pausas de uma campanha.  
**Response 200:** `{ data: [{ id, name, minutes, color }] }`

### GET `/campaigns/{id}/qualifications`
Lista as qualificações de uma campanha específica.

### POST `/campaigns`
Cria nova campanha.

### PUT `/campaigns/{id}`
Atualiza campanha existente.

---

## Qualificações — Endpoints

### GET `/qualification_lists`
Lista todas as listas de qualificação.  
**Response 200:** `{ data: [{ id, name, type, qualification_count }] }`

### GET `/qualification_lists/{id}/qualifications`
Lista as qualificações de uma lista específica.  
**Response 200:** `{ data: [{ id, name, color, behavior, is_positive, impact }] }`

---

## Monitoramento / Spy

### POST `/spy/{agent-id}/start`
Inicia monitoramento silencioso (spy) de um agente.  
**Query:** `?whisper=true` para modo whisper (agente ouve o monitor).  
**Response 204** | 409 "Já está escutando outro agente" | 404 "Agente não logado"

### DELETE `/spy/stop` _(ou POST — verificar)_
Para o monitoramento atual.  
**Response 204**

---

## Agentes (Gestor) — Endpoints

### GET `/agents/status`
Lista status de todos os agentes (token gestor).  
**Response 200:** `{ data: [{ id, extension, name, status, status_start_time }] }`

| Status | Significado |
|--------|-------------|
| 0 | Offline |
| 1 | Idle (disponível) |
| 2 | Em ligação |
| 3 | Em pausa |
| 4 | TPA (after call work) |

### POST `/agents/{agent-id}/logout`
Desloga um agente específico (ação de gestor).  
**Response 204**

### PUT `/agents/{agent-id}/work_break`
Pausa um agente específico.  
```
work_break_id={id}
```
**Response 204**

---

## Eventos Realtime (Socket.IO)

**Conexão:**
```js
const socket = io("wss://3c.fluxoti.com", {
  transports: ['websocket'],
  query: { token: "API_TOKEN_DO_AGENTE" }
});
```

### Eventos de Agente
| Evento | Descrição |
|--------|-----------|
| `agent-is-idle` | Agente ficou ocioso |
| `agent-in-acw` | Agente em pós-atendimento (TPA) |
| `agent-was-logged-out` | Agente deslogado |
| `agent-entered-manual` | Entrou em modo manual |
| `agent-left-manual-mode` | Saiu do modo manual |
| `agent-entered-work-break` | Entrou em pausa |
| `agent-left-work-break` | Saiu da pausa |
| `agent-login-failed` | Falha no login |

### Eventos de Chamada
| Evento | Descrição |
|--------|-----------|
| `call-was-created` | Chamada criada |
| `call-was-answered` | Chamada atendida pelo lead |
| `call-was-connected` | Chamada conectada ao agente |
| `call-was-ended` | Chamada encerrada |
| `call-was-finished` | Chamada finalizada (após qualificação) |
| `call-was-abandoned` | Chamada abandonada |
| `call-was-not-answered` | Lead não atendeu |
| `call-was-failed` | Chamada falhou |
| `call-history-was-created` | Histórico criado (gravação disponível) |
| `manual-call-acw-connected` | TPA manual conectado |

### Eventos de Spy
| Evento | Descrição |
|--------|-----------|
| `spy-started` | Spy iniciado |
| `spy-ended` | Spy encerrado |
| `spy-failed` | Spy falhou |

### Payload dos Eventos (CallEvent)
```json
{
  "call_id": 123456,
  "agent_id": 172252,
  "campaign_id": 264353,
  "phone": "44999328592",
  "direction": "outbound",
  "status": "answered",
  "duration": 45,
  "recording_url": "https://..."
}
```

---

## Mapeamento CRM → 3C Plus

### Resultado CRM → Qualificação 3C Plus (Lista "Qualificações do CRM" — id: 22257)

| Resultado CRM | Qualificação 3C Plus | ID |
|---------------|---------------------|----|
| `nao_atendeu` | Sem retorno | 163880 |
| `ocupado` | Sem retorno | 163880 |
| `caixa_postal` | Sem retorno | 163880 |
| `numero_invalido` | Contato incorreto | 163879 |
| `atendeu` | Em negociação | 163881 |
| `reuniao_agendada` | Reunião agendada | 163882 |
| `qualificado` | Ganho | 163878 |
| `sem_interesse` | Sem interesse | 163883 |
| `desqualificado` | Perdido | 163884 |

### Listas de Qualificação Disponíveis

| ID | Nome | Tipo | Qtd Qualificações |
|----|------|------|------------------|
| 22257 | Qualificações do CRM | 4 (CRM) | 8 |
| 22256 | Padrão | 1 | 8 |
| 22539 | CS | 1 | 3 |

---

## Fluxo de Discagem Manual (Sem Campanha)

```
1. POST /agent/logout          → forçar idle (idempotente)
2. POST /agent/connect         → registrar ramal WebRTC
3. aguardar 800ms
4. POST /agent/manual_call/enter
5. POST /agent/manual_call/dial  (phone=NUMERO)
6. [chamada em andamento — aguardar socket events]
7. POST /agent/call/{id}/hangup
8. POST /agent/call/{id}/qualify
9. POST /agent/manual_call/exit  (ou automático pelo 3C Plus)
```

## Fluxo de Login em Campanha

```
1. POST /agent/connect
2. POST /agent/login  (campaign={id})
3. [aguardar call-was-connected via socket]
4. POST /agent/call/{id}/hangup  (quando finalizar)
5. POST /agent/call/{id}/qualify
6. POST /agent/logout  (ao final do expediente)
```

---

## Erros Comuns

| Status | Mensagem | Causa | Solução |
|--------|----------|-------|---------|
| 422 | "Agente não está ocioso" | `manual_call/enter` chamado enquanto em campanha | Chamar `/agent/logout` antes |
| 422 | "Agente não está em modo manual" | `manual_call/dial` sem ter feito enter | Checar fluxo — fazer enter primeiro |
| 422 | "O agente não está online" | `loggedCampaign` sem ramal registrado | Verificar o ramal WebRTC (selo "webrtc ✓", microfone) |
| 422 | "Agente já está desconectado" | `/agent/logout` já foi chamado | Ignorar — estado correto |
| 403 | "Sem permissão" | Token de agente tentando endpoint de gestor | Usar token correto para cada operação |
| 404 | Endpoint não encontrado | URL errada | Verificar base URL: `{dominio}.3c.plus` (não `3c.fluxoti.com`) |

> ⚠️ **CRÍTICO:** A base URL correta é `https://{dominio}.3c.plus/api/v1`  
> Não usar `https://3c.fluxoti.com/api/v1` — esse host é o painel web, **não** a API REST de agente.

---

## Dados de Produção (Oficinas Master)

| Recurso | Valor |
|---------|-------|
| Domínio | `oficinasmaster` |
| Base URL | `https://oficinasmaster.3c.plus/api/v1` |
| Campanha Principal | `264353` |
| Lista Qualificações CRM | `22257` |
| Agente Juliano (extension 13) | id `172252` |
| Agente Mateus (extension 1001) | id `170297` |
| Admin CRM (extension 909) | id `223885` |

---

## Registro do Ramal WebRTC

O ramal é registrado pelo próprio CRM com JsSIP (`frontend/src/components/telefonia/RamalWebRTC.jsx`), com as
credenciais SIP obtidas pelo backend (comando `get-ramal-webrtc`), numa única aba por navegador.
A extensão do Chrome e a página `/extension` do 3C não funcionam com tokens de serviço.
Detalhes, motivo e checklist de teste: `docs/3cplus/RAMAL_WEBRTC.md`.

### Diagnóstico rápido

| Situação | `/agent/loggedCampaign` | Áudio | Causa |
|----------|------------------------|-------|-------|
| Selo "webrtc ✓" e login confirmado | 200 (online) | ✅ | Ramal registrado pelo CRM |
| Navegador sem permissão de microfone | 422 "não está online" | ❌ | Ramal não registra sem microfone |
| SDR sem ramal no perfil | 422 "não está online" | ❌ | Backend não identifica o agente (`id_3cplus`) |

---

## Notas de Implementação VendaFLOW

- **Agente:** token de serviço de agente + `X-Agent-Id` (`UserProfile.id_3cplus`, resolvido pelo ramal)
- **Token gestor:** usado apenas para operações admin (`/agents/*`, `/spy/*`)
- **Ramal WebRTC:** `RamalWebRTC.jsx` (JsSIP), uma aba por navegador
- **Eventos:** socket do 3C aberto pelo backend (`backend/src/ponte3c.ts`) e repassado ao navegador
- **Polling de status:** `processarEventos3CPlus` faz polling via Socket.IO nos eventos de chamada
- **Gravações:** evento `call-history-was-created` dispara `processarGravacao3CPlus`
- **SPIN:** obrigatório para resultados onde o lead atendeu — mínimo 3 dos 5 campos