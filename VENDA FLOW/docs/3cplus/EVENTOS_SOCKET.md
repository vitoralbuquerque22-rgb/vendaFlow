# 3C Plus — Eventos em tempo real (Socket.IO)

Fontes: seção "Realtime Events" do swagger oficial, artigo "Eventos do Socket 3C Plus" da central de ajuda,
e escuta real do socket da organização em 25/09/2026.

## Conexão

```js
import { io } from "socket.io-client";
const socket = io("https://socket.3c.plus", { transports: ["websocket"], query: { token: "3cs_..." } });
socket.on("agent-is-idle", (evento) => console.log(evento));
```

- Endereço documentado: `https://socket.3c.plus` (desde 02/03/2025). `new-socket.3c.plus` e o antigo
  `socket.3c.fluxoti.com` ainda respondem; `new-socket` entrega exatamente os mesmos eventos.
- `transports: ["websocket"]` é obrigatório.
- **Token de gestor:** recebe os eventos de todos os agentes da organização.
- **Token de serviço de agente:** exige também `agent_id` na query (`query: { token, agent_id }`); só com `token` a
  conexão é recusada (comportamento observado, não documentado).
- Muitos endpoints respondem `204`: **a confirmação real de sucesso ou falha chega por evento**.

## Formato

Todo evento é um JSON com `type` (nome do evento) e `company`, mais os campos do grupo:

| Grupo | Campos | Modelo |
|---|---|---|
| Agente | `agent` | `AgentEvent` |
| Chamada | `call` (`id`, `phone`, `mode`, `agent`, `campaign`) | `CallEvent` |
| Histórico | `call` (histórico completo) — **na prática chega em `callHistory`** | `CallHistoryEvent` |
| Espionagem | `spy`, `spied` | `SpyEvent` |
| Lista | `list` (`id`, `name`, `total`, `dialed`, `completed`...) | `ListEvent` |
| Consulta/transferência | `call`, `agent`, `consultant`, `consultedQueue` | `CallTransferEvent` |

Detalhe dos campos: [API_MODELOS.md](API_MODELOS.md).

## Lista oficial (swagger) — 40 eventos

### Agente
| Evento | Quando |
|---|---|
| `agent-is-idle` | Agente ocioso (login confirmado, saiu do TPA, voltou do intervalo ou do modo manual) |
| `agent-in-acw` | Agente em pós-atendimento (TPA): desligou sem qualificar |
| `agent-login-failed` | Falha no login do agente |
| `agent-was-logged-out` | Agente saiu da campanha |
| `agent-entered-manual` | Entrou no modo de ligação manual |
| `agent-failed-to-enter-manual` | Falha ao entrar no modo manual |
| `agent-left-manual-mode` | Saiu do modo manual |
| `agent-failed-to-leave-manual-mode` | Falha ao sair do modo manual |
| `agent-entered-manual-acw` | Entrou no modo manual durante o TPA |
| `agent-left-manual-acw` | Saiu do modo manual em TPA |
| `agent-entered-work-break` | Intervalo iniciado |
| `agent-enter-work-break-failed` | Intervalo falhou ao iniciar |
| `agent-left-work-break` | Intervalo finalizado |
| `agent-leave-work-break-failed` | Intervalo falhou ao finalizar |
| `agent-schedule` | Notificação de agendamento (retorno) |

### Chamadas
| Evento | Quando |
|---|---|
| `call-was-created` | Chamada criada pelo discador |
| `call-was-answered` | Cliente atendeu |
| `call-was-connected` | Chamada conectada ao agente |
| `call-was-ended` | Chamada desligada |
| `call-was-finished` | Chamada finalizada |
| `call-was-abandoned` | Cliente atendeu e desligou sem agente disponível |
| `call-was-abandoned-due-amd` | Abandonada pela detecção automática de caixa postal |
| `call-was-not-answered` | Não atendida |
| `call-was-failed` | Falha (recusada pela operadora) |
| `call-history-was-created` | Histórico da chamada criado (gravação, qualificação, tempos) |
| `manual-call-acw-connected` | Chamada manual em TPA conectada |
| `manual-call-acw-disconnected` | Chamada manual em TPA desconectada |
| `hold-call` | Chamada em espera |

### Espionagem, lista, limite, consulta
| Evento | Quando |
|---|---|
| `spy-started` / `spy-ended` / `spy-failed` | Escuta de ligação iniciada / finalizada / falhou |
| `list-empty` | A lista de contatos (mailing) da campanha acabou |
| `reached-max-online-agents` | Limite de agentes logados da organização atingido |
| `consult-hold`, `consult-exit`, `consult-transfer`, `consult-cancel-hold`, `consult-connected`, `consult-failed`, `consult-transfer-failed` | Consulta e transferência entre agentes/filas |

## Central de ajuda — 43 eventos (nomes em português)

A central lista também eventos que o swagger não documenta, **sem publicar o nome técnico**:
chamadas manuais (criada, conectada ao agente, atendida, desligada, finalizada, não atendida, com falha, histórico
criado, TPA conectada/desconectada) e receptivo (entrou na fila, conectado com agente, abandonado, finalizado).
Nome técnico já observado: `manual-call-was-answered`.

## Observado em produção (25/09/2026)

| Evento | Situação |
|---|---|
| `call-is-trying` | Emitido, **fora do swagger**: o discador está tentando o número |
| `call-was-amd` | Emitido, **fora do swagger**: caixa postal detectada |
| `call-history-was-created` | Histórico em `callHistory` (o swagger diz `call`) |
| Eventos do discador | `call.id` no formato `call:{empresa}:{campanha}:{telephony_id}` |
| Eventos com agente | trazem `agent.agent_status` (`status`, `logged_campaign`, `call`, `connected_time`...) |

## Códigos de status (biblioteca de dados)

### Status do agente (`agent_status.status`)
| Id | Constante | Situação |
|---|---|---|
| 0 | `STATUS_OFFLINE` | Offline |
| 1 | `STATUS_IDLE` | Ocioso |
| 2 | `STATUS_ON_CALL` | Em chamada |
| 3 | `STATUS_ACW` | Pós-atendimento |
| 4 | `STATUS_ON_MANUAL_CALL` | Realizando chamada manual |
| 5 | `STATUS_ON_MANUAL_CALL_CONNECTED` | Em chamada manual |
| 6 | `STATUS_ON_WORK_BREAK` | Em intervalo |
| 21 | `STATUS_ON_MANUAL_CALL_ACW` | Chamada manual em pós-atendimento |
| 22 | `STATUS_MANUAL_CALL_CONNECTED` | Chamada manual em pós-atendimento conectada |

### Status da chamada (`status_id`)
| Id | Status | Final? | Descrição |
|---|---|---|---|
| 1 | Discando | não | Tentando completar a chamada |
| 2 | Atendida | não | Atendida, ainda sem agente |
| 3 | Conectada | não | Conectada ao cliente, sem finalizar |
| 4 | Encerrada | não | Encerrada sem seguir o fluxo completo |
| 5 | Não atendida | sim | Tempo máximo sem atendimento |
| 6 | Abandonada | sim | Cliente atendeu e desligou sem agente |
| 7 | Finalizada | sim | Conectada a agente com conversa |
| 8 | Falha | sim | Recusada pela operadora |
| 9 | Caixa Postal | sim | Caixa postal detectada |
| 10 | Consulta em espera | não | Consulta/transferência em andamento |
| 11 | Consulta conectada | sim | Consulta/transferência conectada |
| 12 | Consulta | sim | Chamada de consulta ou transferência interna |
| 13 | Transferência | sim | Transferência interna entre agentes |
| 14 | Fora de Horário | sim | Receptiva recusada pelo horário |
| 15 | Caixa Postal Pré | sim | Cancelada ao identificar caixa postal |

### Comportamento da qualificação (`behavior`)
| Id | Comportamento |
|---|---|
| 1 | Não discar novamente para este telefone |
| 2 | Não discar novamente para este cliente |
| 3 | Repetir |

## Como o VendaFlow recebe os eventos

O navegador **não** conecta no socket do 3C: o token de serviço não pode sair do servidor. O backend
(`backend/src/ponte3c.ts`) abre a conexão e repassa cada evento pelo Socket.IO do VendaFlow:

| Sala | Credencial | Quem entra |
|---|---|---|
| `telefonia:agente:<userId>` | token de agente + `agent_id` do SDR | só o próprio usuário |
| `telefonia:gestor:<empresaId>` | token de gestor | supervisor, gerente, gestor, admin da empresa |

No navegador, `frontend/src/contexts/telefonia/socketPonte.js` imita a interface do socket.io-client. O roteamento
evento → tela fica em `TELEFONIA_ENGINE.js` (`rotaDoEvento`, `acaoCicloDeVida`), coberto por testes:

| Rota | Eventos | Efeito no CRM |
|---|---|---|
| Atendida | `call-was-connected`, `call-was-answered` | abre o atendimento |
| Manual atendida | `manual-call-was-answered` | atendimento de ligação manual |
| Não atendida | `call-was-not-answered`, `call-was-failed` | encerra a tentativa |
| Encerrada | `call-was-finished`, `call-was-abandoned` | inicia o TPA |
| Agente | eventos de estado `agent-*` | atualiza status e cronômetro |
| Falha de ação | `agent-failed-to-enter-manual`, `agent-failed-to-leave-manual-mode`, `agent-enter-work-break-failed`, `agent-leave-work-break-failed` | avisa o agente |
| Aviso operacional | `agent-schedule`, `list-empty`, `reached-max-online-agents` | avisa o agente e o gestor |
| Login | `agent-is-idle`/`agent-entered-manual` confirmam; `agent-login-failed`/`reached-max-online-agents` recusam | |

Ignorados de propósito: eventos informativos do discador (`call-was-created`, `call-is-trying`, `call-was-amd`,
`call-was-ended`) e recursos que o CRM não usa (consulta/transferência, espera, espionagem).
