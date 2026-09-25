# 3C Plus — Referência da API

> Gerado automaticamente de `swagger.json` (Documentation 3Cplus V2 v1) em 2026-09-25
> por `gerar-referencia.mjs`. Não edite à mão: atualize o swagger e rode o gerador de novo.
> Fonte oficial: https://api-docs.3c.plus/ (especificação: https://app.3c.plus/api/v1/swagger.json)

- **Base:** `https://{dominio}.3c.plus/api/v1` (domínio da organização — ex.: `oficinasmaster`)
- **Autenticação:** token de serviço `3cs_...` no header `Authorization: Bearer` (recomendado) ou `?api_token=`.
  Token de papel **agente** exige o header `X-Agent-Id`. Ver [TOKENS_DE_SERVICO.md](TOKENS_DE_SERVICO.md).
- **Respostas:** campos `status`, `title`, `detail`, `transaction_id`; recursos dentro de `data`.
  `?fields=id,name` limita os campos retornados. Muitos comandos respondem `204` — o resultado chega pelo socket
  ([EVENTOS_SOCKET.md](EVENTOS_SOCKET.md)).
- **Modelos de dados:** [API_MODELOS.md](API_MODELOS.md)

**210 operações em 34 grupos.**

## Índice

- [Agents](#agents) (37)
- [Auth](#auth) (1)
- [Callbacks](#callbacks) (1)
- [Calls](#calls) (11)
- [Campaigns](#campaigns) (43)
- [Companies](#companies) (3)
- [Company Role](#company-role) (1)
- [Criterion](#criterion) (1)
- [Criterion Lists](#criterion-lists) (10)
- [Feedbacks](#feedbacks) (9)
- [Interval](#interval) (4)
- [IVR AFTER CALL](#ivr-after-call) (4)
- [Ivr after call criterion](#ivr-after-call-criterion) (2)
- [IVR AFTER CALL CRITERION (2)](#ivr-after-call-criterion-2) (1)
- [Line Of Work](#line-of-work) (1)
- [Office Hours](#office-hours) (5)
- [Outros](#outros) (1)
- [Profile](#profile) (3)
- [Promoter](#promoter) (1)
- [Qualification](#qualification) (4)
- [Qualification Lists](#qualification-lists) (6)
- [Receptive IVR](#receptive-ivr) (5)
- [Receptive Metrics](#receptive-metrics) (2)
- [Receptive Number Settings](#receptive-number-settings) (4)
- [Receptive queues](#receptive-queues) (12)
- [Route](#route) (1)
- [Routes](#routes) (2)
- [Schedules](#schedules) (4)
- [Status](#status) (1)
- [Teams](#teams) (5)
- [URA](#ura) (6)
- [User Data](#user-data) (3)
- [Users](#users) (11)
- [Work break groups](#work-break-groups) (5)

## Agents

### `POST /agent/call/{call-id}/hangup`

**hangup a call connected to the agent**

Only available for users with the agent or manager roles

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `call-id` | path | string | sim | The call id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No Content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /agent/call/{call-id}/qualify`

**Qualify a call or/and create a scheduled call**

Only available for users with the agent or manager roles

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `call-id` | path | string | sim | The call id |
| `qualification_id` | formData | integer | sim | The qualification id |
| `phone` | formData | integer |  | The phone number (10 ~ 13 numbers) to schedule |
| `note` | formData | integer |  | The schedule note |
| `date` | formData | string |  | The schedule date, date format Y-m-d H:i:s |
| `qualification_note` | formData | string |  | The qualification note |
| `end_mode` | formData | string |  | The mode in which the agent will be put on after the end of the call. This option can be either dialer or manual. |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No Content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /agent/calls`

**Agent call history**

Only available for users with the agent or manager roles

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `start_date` | query | string | sim | The start date to filter in Y-m-d H:i:s format |
| `end_date` | query | string |  | The end date to filter in Y-m-d H:i:s format |
| `limit` | query | integer |  | Limit of items returned |
| `offset` | query | integer |  | An offset to apply. |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | An array of calls. | [CallHistoryReports](API_MODELOS.md#callhistoryreports) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /agent/campaigns`

**Get the campaigns the agent belongs.**

By default, this endpoint lists all campaign that the agent belongs. If you want to show only the paused or the
running campaigns you'll need to pass a parameter to the request. If you want only the paused campaigns, just pass
the `paused` parameter. Otherwise, if you only want the runnnig ones, just pass the `running` parameter.

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | A list of all campaigns the agent belongs | [AgentCampaigns](API_MODELOS.md#agentcampaigns) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /agent/connect`

**Connect an agent**

Only available for users with the agent or manager roles

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No Content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /agent/consult`

**Start a consult.**

Only available for users with the agent or manager roles

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `consultedId` | formData | integer | sim | The consulted agent id. |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No Content |  |
| 400 | The agent or consulted is offline. | [Error](API_MODELOS.md#error) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /agent/consult/cancel`

**Cancel the consult on hold.**

Only available for users with the agent or manager roles

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No Content |  |
| 400 | The agent is offline. | [Error](API_MODELOS.md#error) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /agent/consult/exit`

**Exit the consult.**

Only available for users with the agent or manager roles

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No Content |  |
| 400 | The agent is offline. | [Error](API_MODELOS.md#error) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /agent/consult/queue`

**Start a consult for a receptive queue.**

Only available for users with the agent or manager roles

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `queueId` | formData | integer | sim | The receptive queue id. |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No Content |  |
| 400 | The agent is offline. | [Error](API_MODELOS.md#error) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /agent/consult/transfer`

**Start a transfer.**

Only available for users with the agent or manager roles

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `consultedId` | formData | integer | sim | The consulted agent id. |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No Content |  |
| 400 | The agent is offline. | [Error](API_MODELOS.md#error) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /agent/login`

**Agent login**

Only available for users with the agent or manager roles

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign` | formData | integer | sim | The campaign id to login in |
| `mode` | formData | string |  | The login mode, dialer or manual. |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No Content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /agent/logout`

**Agent logout**

Only available for users with the agent or manager roles

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No Content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /agent/manual_call_acw/dial`

**Start a manual call in acw**

Only available for users with the agent or manager roles

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `phone` | formData | integer | sim | The phone number |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The created manual call | [ManualCall](API_MODELOS.md#manualcall) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /agent/manual_call_acw/enter`

**Enter manual call acw mode**

Only available for users with the agent or manager roles

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No Content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /agent/manual_call_acw/exit`

**Exit manual call acw mode**

Only available for users with the agent or manager roles

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No Content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /agent/manual_call/{call-id}/qualify`

**Qualify a manual call**

Only available for users with the agent or manager roles

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `call-id` | path | string | sim | The call id |
| `qualification_id` | formData | integer | sim | The qualification id |
| `qualification_note` | formData | string |  | The qualification note |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No Content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /agent/manual_call/dial`

**Start a manual call**

Only available for users with the agent or manager roles

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `phone` | formData | integer | sim | The phone number |
| `shedule_id` | formData | string |  | The schedule id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The created manual call | [ManualCall](API_MODELOS.md#manualcall) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /agent/manual_call/enter`

**Enter manual call mode**

Only available for users with the agent or manager roles

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No Content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /agent/manual_call/exit`

**Exit manual call mode**

Only available for users with the agent or manager roles

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No Content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /agent/schedules`

**Get schedules expired and about to expire from logged campaign.**

Only available for users with the agent or manager roles

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | A list of schedules expired and about to expire | [Schedules](API_MODELOS.md#schedules) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /agent/statistics`

**Get connected calls statistics**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `start_date` | query | string | sim | Filter by start date (format Y-m-d) |
| `end_date` | query | string | sim | Filter by end date (format Y-m-d) |
| `campaign_id` | query | string |  | Filter by campaign_id |
| `agent_id` | query | string |  | Filter by agent_id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | A list of all statistics | [AgentStatistics](API_MODELOS.md#agentstatistics) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /agent/webphone/login`

**Agent login in the webphone**

Only available for users with the agent or manager roles and the Webphone permission.

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign` | formData | integer | sim | The campaign id to login in |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No Content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /agent/work_break_intervals`

**Get work break intervals from logged campaign.**

Only available for users with the agent or manager roles

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | A list of all work break intervals | [WorkBreakInterval](API_MODELOS.md#workbreakinterval) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /agent/work_break/{work-break-id}/enter`

**Enter in the work break**

Only available for users with the agent or manager roles

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `work-break-id` | path | string | sim | The work break interval id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No Content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /agent/work_break/exit`

**Exit from work break**

Only available for users with the agent or manager roles

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No Content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /agents`

**List all agents that belongs to the company of the authenticated user**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `status` | query | string |  | The status of the users. Either active or inactive. |
| `search` | query | string |  | A search term to be used. |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | All agents paginated. | [Agents](API_MODELOS.md#agents) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /agents/{agent-id}/logout`

**Agent logout**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `agent-id` | path | string | sim | The agent id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No Content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `PUT /agents/{user-id}/work_break`

**Change the work break interval of an agent.**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `user-id` | path | integer | sim | The agent id that will change the work break interval |
| `work_break_id` | formData | integer | sim | The work break id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No Content |  |
| 422 | The agent is not idle to engage in a work break interval. | [Error](API_MODELOS.md#error) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /agents/login_history`

**Get Login history from agents**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `start_date` | query | string | sim | Filter by start date (format Y-m-d H:i:s) |
| `end_date` | query | string | sim | Filter by end date (format Y-m-d H:i:s) |
| `campaign_id` | query | string |  | Filter by campaign_id |
| `agent_id` | query | string |  | Filter by agent_id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | A list of all agents login history | [LoginHistory](API_MODELOS.md#loginhistory) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /agents/online`

**List User that belongs to the company of the authenticated user and are logged in**

Available for users with the manager and agent role

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | All agents online | [AgentStatus](API_MODELOS.md#agentstatus) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /agents/statistics/by_agent`

**Get statistics by agent**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `start_date` | query | string | sim | Filter by start date |
| `end_date` | query | string | sim | Filter by end date |
| `campaign_id` | query | string | sim | Filter by campaign_id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | A list of all statistics by agent | [AgentStatisticsByAgentList](API_MODELOS.md#agentstatisticsbyagentlist) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /agents/statistics/by_agent/csv`

**Get statistics by agent CSV**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `start_date` | query | string | sim | Filter by start date |
| `end_date` | query | string | sim | Filter by end date |
| `campaign_id` | query | string | sim | Filter by campaign_id |
| `webhook_url` | query | string | sim | A HTTP URL where we can send a POST request to notify about the completion of your report. The body of the request will contain a HTTPS url that you can use to download your report. |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | A generated CSV |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /agents/status`

**Get the actual status of all active agents on the company**

Only available for users with the manager role

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | A list of all agents, with extensions and status | [AgentStatus](API_MODELOS.md#agentstatus) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /click2call`

**Start a manual call if the agent is idle.**

Only available for users with the manager role.

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `extension` | formData | integer | sim | The agent extension. |
| `phone` | formData | integer | sim | The phone number. |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The created manual call | [ManualCall](API_MODELOS.md#manualcall) |
| 422 | The agent is not idle. | [Error](API_MODELOS.md#error) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /qualification/statistics`

**Get qualification statistics**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `start_date` | query | string | sim | Filter by start date (format Y-m-d) |
| `end_date` | query | string | sim | Filter by end date (format Y-m-d) |
| `campaign_id` | query | string |  | Filter by campaign_id |
| `agent_id` | query | string |  | Filter by agent_id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | A list of all statistics | [QualificationStatistics](API_MODELOS.md#qualificationstatistics) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /spy/{agent-id}/start`

**Start spying an agent in call**

Only available for users with the manager and agent role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `agent-id` | path | string | sim | The agent to spy on |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No Content |  |
| 404 | The agent is not logged in | [Error](API_MODELOS.md#error) |
| 409 | The user is already spying another agent | [Error](API_MODELOS.md#error) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `DELETE /spy/stop`

**Stop spying an agent**

Only available for users with the manager and agent role

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No Content |  |
| 404 | The agent web extension was not found | [Error](API_MODELOS.md#error) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


## Auth

### `POST /authenticate`

**Authenticate a user to receive a token. You should specify either the company subdomain in the url, company_domain or company_id.**

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `user` | formData | string | sim | Either the user's email or the extension number |
| `password` | formData | string | sim | The user's password |
| `company_id` | formData | integer |  | The user's company id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The authenticated user | [User](API_MODELOS.md#user) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


## Callbacks

### `GET /callbacks`

**Retrieve all company callbacks.**

Only available for users with the manager role

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | An array of callbacks | [Callbacks](API_MODELOS.md#callbacks) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


## Calls

### `GET /calls`

**Retrieve and filter call reports**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `per_page` | query | string | sim | How many items per page |
| `start_date` | query | string | sim | The start date to filter in Y-m-d H:i:s format |
| `end_date` | query | string |  | The end date to filter in Y-m-d H:i:s format |
| `lists` | query | lista de integer |  | An array of mailing list ids |
| `identifier` | query | string |  | The client identifier. |
| `identifiers` | query | lista de integer |  | An array of identifiers |
| `campaigns` | query | lista de integer |  | An array of campaign ids |
| `agents` | query | lista de integer |  | An array of agent ids |
| `qualifications` | query | lista de integer |  | An array of qualification ids |
| `numbers` | query | lista de string |  | An array of phone numbers |
| `type` | query | string |  | Either mobile or landline |
| `limit` | query | integer |  | Limit of items returned |
| `offset` | query | integer |  | An offset to apply. |
| `with_mailing` | query | boolean | sim | If true include the mailing data in the report. |
| `minimum_duration` | query | integer |  | The minimum duration of the call in seconds. |
| `maximum_duration` | query | integer |  | The maximum duration of the call in seconds. |
| `sid` | query | string |  | The call sid. |
| `is_consult` | query | boolean |  | If the call is a consult (warm transfer). |
| `is_transfer` | query | boolean |  | If the call is a transfer. |
| `is_transferred` | query | boolean |  | If the call was transferred. |
| `simple_paginate` | query | boolean |  | A simple pagination implementation that does not yield the number of pages. Simply follow the links to previous / next page instead. Will be the default paginator in the future. |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | An array of call reports | [CallHistoryReports](API_MODELOS.md#callhistoryreports) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /calls/{call-id}`

**Retrieve a single call report**

Only available for users with the manager and agent role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `call-id` | path | string | sim | The call id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | A call history report | [CallHistoryReport](API_MODELOS.md#callhistoryreport) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /calls/{call-id}/recording`

**Download a recording for the given call**

A call recording

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `call-id` | path | string | sim | The call id |
| `original` | query | boolean |  | Return the original recording without conversion. |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The recording file. |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /calls/{call-id}/recording_amd`

**Download an AMD recording for the given call**

Download AMD recording

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `call-id` | path | string | sim | The call id |
| `original` | query | boolean |  | Return the original recording without conversion. |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The recording file. |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /calls/{call-id}/recording_consult`

**Download a consult recording for the given call**

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `call-id` | path | string | sim | The call id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The recording file, if the call is a transfer. |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /calls/{call-id}/recording_transfer`

**Download a transfer recording for the given call**

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `call-id` | path | string | sim | The call id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The recording file, if the call is a transfer. |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /calls/csv`

**Generate a call history csv report.**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `start_date` | query | string | sim | The start date to filter in Y-m-d H:i:s format |
| `end_date` | query | string |  | The end date to filter in Y-m-d H:i:s format |
| `lists` | query | lista de integer |  | An array of mailing list ids |
| `identifiers` | query | lista de integer |  | An array of identifiers |
| `campaigns` | query | lista de integer |  | An array of campaign ids |
| `agent_ids` | query | lista de integer |  | An array of agent ids |
| `statuses` | query | lista de integer |  | An array of status ids |
| `qualifications` | query | lista de integer |  | An array of qualification ids |
| `numbers` | query | lista de string |  | An array of phone numbers |
| `type` | query | string |  | Either mobile or landline |
| `limit` | query | integer |  | Limit of items returned |
| `offset` | query | integer |  | An offset to apply. |
| `with_mailing` | query | boolean | sim | If true include the mailing data in the report. |
| `webhook_url` | query | string | sim | A HTTP URL where we can send a POST request to notify about the completion of your report. The body of the request will contain a HTTPS url that you can use to download your report. |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No Content. |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /calls/receptive`

**List all active receptive calls group by queue id**

Only available for users with the manager role

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | An array of calls | [Calls](API_MODELOS.md#calls) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /calls/sid/{sid}`

**Retrieve a call report for a specific call string identifier**

Use the [calls/id](#/Calls/get_calls__call_id_) endpoint.
Only available for users with the manager and agent role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `sid` | path | string | sim | The call string identifier. |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | A call history report | [CallHistoryReport](API_MODELOS.md#callhistoryreport) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /calls/total`

**Retrieve and filter total call reports**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `start_date` | query | string | sim | The start date to filter in Y-m-d H:i:s format |
| `end_date` | query | string |  | The end date to filter in Y-m-d H:i:s format |
| `lists` | query | lista de integer |  | An array of mailing list ids |
| `campaigns` | query | lista de integer |  | An array of campaign ids |
| `agents` | query | lista de integer |  | An array of agent ids |
| `qualifications` | query | lista de integer |  | An array of qualification ids |
| `numbers` | query | lista de string |  | An array of phone numbers |
| `type` | query | string |  | Either mobile or landline |
| `limit` | query | integer |  | Limit of items returned |
| `offset` | query | integer |  | An offset to apply. |
| `is_consult` | query | boolean |  | If the call is a consult (warm transfer). |
| `is_transfer` | query | boolean |  | If the call is a transfer. |
| `is_transferred` | query | boolean |  | If the call was transferred. |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The total call report | [TotalCallHistoryReport](API_MODELOS.md#totalcallhistoryreport) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /records/{year}/{month}/{day}`

**Download a zip archive containing all call recordings for the given timestamp. NOTE: Your download will likely get interrupted by network outtage if you choose large timestamps, like months or year. Since we stream this archive on-the-fly from memory, this operation can't be resumed, so we recommend to download only by day.**

Download call recordings for a given timestamp.

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `year` | path | string | sim | The four digit number corresponding to the respective year, e.g. 2019. |
| `month` | path | string | sim | The two digit number corresponding to the respective month, e.g. 09. |
| `day` | path | string | sim | The two digit number corresponding to the respective day, e.g. 05. Optional. |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The zip archive. |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


## Campaigns

### `GET /agent/loggedCampaign`

**Get the agent logged Campaign**

Only available for users with the agent role

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The campaign | [Campaign](API_MODELOS.md#campaign) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /campaigns`

**List all campaigns that belongs to the company of the authenticated user**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `paused` | query | boolean |  | Filter by status (paused or running) |
| `search` | query | string |  | Search term |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | All campaigns Paginated | [Campaigns](API_MODELOS.md#campaigns) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /campaigns`

**Create a new campaign**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `name` | formData | string | sim | The campaign's name |
| `extension_number` | formData | integer | sim | The campaign's extension number |
| `start_time` | formData | string | sim | The time for the start of the campaign. Must be in 09:00 format |
| `qualification_list` | formData | string | sim | The qualification id list |
| `end_time` | formData | string | sim | The time for the end of the campaign. Must be in 09:00 format |
| `allows_manual` | formData | boolean |  | True to enable the manual calls, false disable |
| `url` | formData | string |  | A valid url for the campaign |
| `acw_timeout` | formData | integer |  | The ACW timeout before auto qualification. The number 0 is the default and means unlimited. |
| `caller_id` | formData | string |  | The campaign's caller id |
| `route_landline_id` | formData | string |  | The Route landline id |
| `route_mobile_id` | formData | string |  | The Route mobile id |
| `check_amd` | formData | boolean |  | True to enable the amd, false disable |
| `copy_identifier` | formData | boolean |  | If true, copy the identifier of the connected call |
| `active_list_notify` | formData | boolean |  | True to enable the completed list nofication, false disable |
| `limit_call_per_agent` | formData | integer |  | The call limit per agent |
| `limit_call_time` | formData | integer |  | The limit call time |
| `work_break_group_id` | formData | string |  | The work_break_group_id id list |
| `ivr_after_call_id` | formData | string |  | The ivr_after_call_id id list |
| `recalls` | formData | integer |  | The amount recalls, Within 1 to 10 |
| `call_time` | formData | integer |  | The call time (seconds), Within 20 to 50 seconds |
| `wait_time` | formData | integer |  | The wait time (seconds) Within 3 to 20 seconds |
| `ura_limit` | formData | integer |  | The number of channels that ivr should dial |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The created campaign | [Campaign](API_MODELOS.md#campaign) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /campaigns/{campaign_id}/lists/qualifications`

**List all mailing lists qualification statistic**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign_id` | path | string | sim | The campaign id |
| `start_date` | query | string |  | The start date to filter. Format: Y-m-d |
| `end_date` | query | string |  | The end date to filter. Format: Y-m-d |
| `csv` | query | string |  | Set true to generate the csv |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | An array of mailing lists qualification statistic | [ListQualificationStatistics](API_MODELOS.md#listqualificationstatistics) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /campaigns/{campaign-id}`

**Get a campaign**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The campaign | [Campaign](API_MODELOS.md#campaign) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `PUT /campaigns/{campaign-id}`

**Update a campaign**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |
| `name` | formData | string | sim | The campaign's name |
| `extension_number` | formData | integer | sim | The campaign's extension number |
| `start_time` | formData | string | sim | The time for the start of the campaign. Must be in 09:00 format |
| `end_time` | formData | string | sim | The time for the end of the campaign. Must be in 09:00 format |
| `qualification_list` | formData | string | sim | The qualification id list |
| `ivr_after_call_id` | formData | string |  | The ivr_after_call_id id list |
| `url` | formData | string |  | A valid url for the campaign |
| `allows_manual` | formData | boolean |  | True to enable the manual calls, false disable |
| `acw_timeout` | formData | integer |  | The ACW timeout in seconds before auto qualification. The number 0 means unlimited. |
| `caller_id` | formData | string |  | The campaign's caller id |
| `route_landline_id` | formData | string |  | The Route landline id |
| `route_mobile_id` | formData | string |  | The Route mobile id |
| `check_amd` | formData | boolean |  | True to enable the amd, false disable |
| `copy_identifier` | formData | boolean |  | If true, copy the identifier of the connected call |
| `active_list_notify` | formData | boolean |  | True to enable the completed list nofication, false disable |
| `limit_call_per_agent` | formData | integer |  | The call limit per agent |
| `limit_call_time` | formData | integer |  | The limit call time |
| `work_break_group_id` | formData | string |  | The work_break_group_id id list |
| `recalls` | formData | integer |  | The amount recalls, Within 1 to 10 |
| `call_time` | formData | integer |  | The call time (seconds), Within 20 to 50 seconds |
| `wait_time` | formData | integer |  | The wait time (seconds) Within 3 to 20 seconds |
| `ura_limit` | formData | integer |  | The number of channels that ivr should dial |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The campaign | [Campaign](API_MODELOS.md#campaign) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `PATCH /campaigns/{campaign-id}`

**Partial update a campaign**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |
| `name` | formData | string |  | The campaign's name |
| `start_time` | formData | string |  | The time for the start of the campaign. Must be in 09:00 format |
| `end_time` | formData | string |  | The time for the end of the campaign. Must be in 09:00 format |
| `allows_manual` | formData | boolean |  | True to enable the manual calls, false disable |
| `acw_timeout` | formData | integer |  | The ACW timeout in seconds before auto qualification. The number 0 means unlimited. |
| `route_landline_id` | formData | string |  | The Route landline id |
| `route_mobile_id` | formData | string |  | The Route mobile id |
| `check_amd` | formData | boolean |  | True to enable the amd, false disable |
| `copy_identifier` | formData | boolean |  | If true, copy the identifier of the connected call |
| `active_list_notify` | formData | boolean |  | True to enable the completed list nofication, false disable |
| `limit_call_per_agent` | formData | integer |  | The call limit per agent |
| `work_break_group_id` | formData | string |  | The work_break_group_id id list |
| `is_predictive` | formData | boolean |  | True to enable the productive/predictive, false disable |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The campaign | [Campaign](API_MODELOS.md#campaign) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `DELETE /campaigns/{campaign-id}`

**Delete a campaign on the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No Content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /campaigns/{campaign-id}/agents`

**List all agents in this campaign**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | An array of agents | [Agents](API_MODELOS.md#agents) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /campaigns/{campaign-id}/agents`

**Add agents in a campaign**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |
| `agents[]` | formData | lista de integer | sim | An array of agent ids |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | An array of attached agents | [Agents](API_MODELOS.md#agents) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `DELETE /campaigns/{campaign-id}/agents/{agent-id}`

**Remove an agent from a campaign**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |
| `agent-id` | path | string | sim | The agent id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No Content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /campaigns/{campaign-id}/agents/metrics`

**Agent metrics by hour.**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |
| `startDate` | query | string | sim | Start date |
| `endDate` | query | string | sim | End date |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | Agent metrics | [AgentMetrics](API_MODELOS.md#agentmetrics) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /campaigns/{campaign-id}/agents/metrics/total`

**Agent metrics by total.**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |
| `startDate` | query | string | sim | Start date |
| `endDate` | query | string | sim | End date |
| `orderBy` | query | string |  | Sort the result in ascending order. |
| `orderByDesc` | query | string |  | Sort the result in descending order. |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | Agent metrics | [AgentMetrics](API_MODELOS.md#agentmetrics) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /campaigns/{campaign-id}/agents/metrics/total_per_time`

**Agent metrics by day if time filtered is above 24 hours or by hour if time filtered is below 24 hours.**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |
| `startDate` | query | string | sim | Start date |
| `endDate` | query | string | sim | End date |
| `agent_id` | query | string |  | The agent id. |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | An array of Agent metrics Per time | [AgentMetricsPerTime](API_MODELOS.md#agentmetricspertime) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /campaigns/{campaign-id}/agents/metrics/total/csv`

**Generate a csv with the agent metrics aggregated by totals.**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |
| `startDate` | query | string | sim | Start date |
| `endDate` | query | string | sim | End date |
| `orderBy` | query | string |  | Sort the result in ascending order. |
| `orderByDesc` | query | string |  | Sort the result in descending order. |
| `webhook_url` | query | string | sim | A HTTP URL where we can send a POST request to notify about the completion of your report. The body of the request will contain a HTTPS url that you can use to download your report. |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | A generated CSV |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /campaigns/{campaign-id}/agents/qualifications`

**Filter agent qualifications statistics.**

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |
| `start_date` | query | string |  | The start date to filter. Format: Y-m-d |
| `end_date` | query | string |  | The end date to filter. Format: Y-m-d |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The filtered qualification stats | [TotalQualificationStats](API_MODELOS.md#totalqualificationstats) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /campaigns/{campaign-id}/agents/qualifications/csv`

**Generate a csv with the qualifications count per agent during the specified time interval.**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |
| `startDate` | query | string | sim | Start date |
| `endDate` | query | string | sim | End date |
| `webhook_url` | query | string | sim | A HTTP URL where we can send a POST request to notify about the completion of your report. The body of the request will contain a HTTPS url that you can use to download your report. |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | A generated CSV |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /campaigns/{campaign-id}/agents/status`

**List all agents status in this campaign**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | An array of agents status | [AgentStatus](API_MODELOS.md#agentstatus) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /campaigns/{campaign-id}/callbacks`

**Create a new callback.**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |
| `did` | formData | string | sim | The did phone number. |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The created callback | [Callback](API_MODELOS.md#callback) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `DELETE /campaigns/{campaign-id}/callbacks/{callback-id}`

**Delete a callback in a campaign**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |
| `callback-id` | path | string | sim | The callback id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /campaigns/{campaign-id}/calls`

**List all active calls group by status in this campaign**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |
| `ura` | query | boolean |  | True to return ura lists, false to return dialer lists |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | An array of calls | [Calls](API_MODELOS.md#calls) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /campaigns/{campaign-id}/intervals`

**Get all company's work break intervals**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The company's work break intervals | [WorkBreakIntervals](API_MODELOS.md#workbreakintervals) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /campaigns/{campaign-id}/lists`

**List all mailing lists this campaign**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | An array of mailing lists | [MailingLists](API_MODELOS.md#mailinglists) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /campaigns/{campaign-id}/lists`

**Create a new mailing list**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |
| `name` | formData | string | sim | The mailing list name |
| `file_name` | formData | string |  | Name of uploaded file unsing [`this endpoint`](#post_campaigns_campaign_id_listMailingFile) |
| `original_name` | formData | string |  | The original file name |
| `header` | formData | lista de string |  | Array with header of mailing data. Requires one column with “areacodephone” or  two columns with “phone“ and “areacodephone“. Required if “file_name“ is present |
| `delimiter` | formData | string |  | The character that delimit text. Required if “file_name“ is present |
| `separator` | formData | string |  | The character that separate fields. Required if “file_name“ is present |
| `has_header` | formData | boolean |  | True if first line of file is header. Required if “file_name“ is present |
| `ura_id` | formData | integer |  | The ura id that should play when the phone is called |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The created mailing list | [MailingList](API_MODELOS.md#mailinglist) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `DELETE /campaigns/{campaign-id}/lists`

**Delete all mailing list in a campaign**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `DELETE /campaigns/{campaign-id}/lists/{list-id}`

**Delete a mailing list in a campaign**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |
| `list-id` | path | string | sim | The mailing list id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /campaigns/{campaign-id}/lists/{list-id}/mailing`

**Insert new mailing on the list**

Use the [mailing.json](#/Campaigns/post_campaigns__campaign_id__lists__list_id__mailing_json) endpoint.


This endpoint accepts an array of mailing to insert on the list. Each mailing object has the following schema:

**phone** (required): The phone number
**identifier** (optional): The mailing identifier
**data** (optional): Array of additional fields for the mailing

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |
| `list-id` | path | string | sim | The mailing list id |
| `mailing[]` | formData | lista de string | sim | An array of mailing to insert |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The inserted mailing lists |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `DELETE /campaigns/{campaign-id}/lists/{list-id}/mailing`

**Delete all mailing lines in a list**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |
| `list-id` | path | string | sim | The mailing list id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /campaigns/{campaign-id}/lists/{list-id}/mailing.json`

**Insert new mailings in a list**

This endpoint accepts an array of mailings to insert in a list. Each mailing is a json object with the following fields:

**phone** (required): A phone number
**identifier** (optional): A mailing identifier
**data** (optional): Additional fields for the mailing

Example of a single mailing:

```json
[{"phone": "2012345678", "identifier": "28394", "data": { "name": "John Doe", "address": "xxx" } }]
```

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |
| `list-id` | path | string | sim | The mailing list id |
| `body` | body | lista de [MailingItem](API_MODELOS.md#mailingitem) | sim | An array of mailings to insert |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `PUT /campaigns/{campaign-id}/lists/{list-id}/updateWeight`

**Update a list weight in a campaign.**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |
| `list-id` | path | string | sim | The mailing list id |
| `weight` | formData | integer | sim | The list Weight. |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The created mailing list | [MailingList](API_MODELOS.md#mailinglist) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /campaigns/{campaign-id}/lists/csv`

**Create a new mailing list**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |
| `mailing` | formData | file | sim | The CSV file with mailing list data |
| `name` | formData | string | sim | The mailing list name |
| `header` | formData | lista de string |  | Array with header of mailing data. Requires one column with “areacodephone” or  two columns with “phone“ and “areacodephone“. Required if “file_name“ is present |
| `delimiter` | formData | string |  | The character that delimit text. Required if “file_name“ is present |
| `separator` | formData | string |  | The character that separate fields. Required if “file_name“ is present |
| `has_header` | formData | boolean |  | True if first line of file is header. Required if “file_name“ is present |
| `ura_id` | formData | integer |  | The ura id that should play when the phone is called |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The created mailing list | [MailingList](API_MODELOS.md#mailinglist) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /campaigns/{campaign-id}/lists/metrics`

**List all mailing lists metrics**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |
| `start_date` | query | string |  | The start date to filter. Format: Y-m-d |
| `end_date` | query | string |  | The end date to filter. Format: Y-m-d |
| `csv` | query | string |  | Set true to generate the csv |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | An array of mailing lists | [MailingListsMetrics](API_MODELOS.md#mailinglistsmetrics) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /campaigns/{campaign-id}/lists/total_metrics`

**Get total by mailing lists metrics**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |
| `start_date` | query | string |  | The start date to filter. Format: Y-m-d |
| `end_date` | query | string |  | The end date to filter. Format: Y-m-d |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | Total mailing lists metrics | [MailingListTotalMetrics](API_MODELOS.md#mailinglisttotalmetrics) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /campaigns/{campaign-id}/mailing`

**Upload a csv file containing the mailing lines into a fresh new mailing list**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |
| `mailing` | formData | file | sim | The CSV file with mailing list data |
| `delimiter` | formData | string | sim | The character that delimit text |
| `separator` | formData | string | sim | The character that separate fields |
| `has_header` | formData | boolean | sim | True if first line of file is header |

| Resposta | Descrição | Corpo |
|---|---|---|
| 202 | Info about uploaded file and preview of CSV data (header and 5 first lines) | [MailingFilePreview](API_MODELOS.md#mailingfilepreview) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `DELETE /campaigns/{campaign-id}/mailing/delete`

**Delete mailings in a campaign**

This endpoint accepts an array of mailings to delete. Each mailing is a json object with the following fields:

**phone** (optional): A phone number
**identifier** (optional): A mailing identifier

Example of a mailing to delete:

```json
{"phone": "2012345678", "identifier": "28394" }
```

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |
| `body` | body | lista de [MailingDelete](API_MODELOS.md#mailingdelete) | sim | An array of mailings to delete |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `PUT /campaigns/{campaign-id}/pause`

**Pause a campaign on the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The paused campaign | [Campaign](API_MODELOS.md#campaign) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /campaigns/{campaign-id}/qualifications`

**Filter qualification stats**

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |
| `start_date` | query | string | sim | The start date to filter. Format: Y-m-d |
| `end_date` | query | string | sim | The end date to filter. Format: Y-m-d |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The filtered qualification stats | [MultipleDailyQualificationStats](API_MODELOS.md#multipledailyqualificationstats) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /campaigns/{campaign-id}/qualifications/total`

**Filter qualifications total stats**

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |
| `start_date` | query | string |  | The start date to filter. Format: Y-m-d |
| `end_date` | query | string |  | The end date to filter. Format: Y-m-d |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The filtered qualification stats | [TotalQualificationStats](API_MODELOS.md#totalqualificationstats) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `PUT /campaigns/{campaign-id}/resume`

**Resume a campaign on the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The resumed campaign | [Campaign](API_MODELOS.md#campaign) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /campaigns/{campaign-id}/schedules`

**List all or filter schedules for a given campaign**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |
| `campaign-id` | path | string | sim | The campaign id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The schedules | [Schedules](API_MODELOS.md#schedules) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /campaigns/{campaign-id}/statistics`

**Campaign Statistic of Last**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The campaign id |
| `startDate` | query | string | sim | Start date |
| `endDate` | query | string | sim | End date |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The campaign statistics | [CampaignStatistics](API_MODELOS.md#campaignstatistics) |


### `GET /qualifications/total`

**Filter qualifications total stats**

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `start_date` | query | string |  | The start date to filter. Format: Y-m-d |
| `end_date` | query | string |  | The end date to filter. Format: Y-m-d |
| `campaign_id` | query | integer |  | The campaign id |
| `agent_id` | query | integer |  | The agent id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The filtered qualification stats | [TotalQualificationStats](API_MODELOS.md#totalqualificationstats) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /qualifications/total/csv`

**Filter qualifications total stats**

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `start_date` | query | string |  | The start date to filter. Format: Y-m-d |
| `end_date` | query | string |  | The end date to filter. Format: Y-m-d |
| `campaign_id` | query | integer |  | The campaign id |
| `agent_id` | query | integer |  | The agent id |
| `webhook_url` | query | string | sim | A HTTP URL where we can send a POST request to notify about the completion of your report. The body of the request will contain a HTTPS url that you can use to download your report. |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


## Companies

### `GET /company/calls`

**List all active calls group by status in this company**

Only available for users with the manager role

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | An array of calls | [Calls](API_MODELOS.md#calls) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /company/generate-bill`

**Update the settings on the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `billing_at` | formData | string | sim | The billing date from bill, format Y-m-d, min: 1 day from now, max: 5 days from now |
| `amount` | formData | string | sim | The amount credit, min: 200, max: 2000 |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The updated company | object |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `PUT /company/settings`

**Update the settings on the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `company_name` | formData | string | sim | The company name |
| `username` | formData | string | sim | The default user name |
| `email` | formData | string |  | The email for the default user |
| `password` | formData | string | sim | The password for the default user |
| `domain` | formData | string | sim | The new company domain |
| `logo_name` | formData | string |  | The new company name for the logo |
| `logo_image_link` | formData | string |  | The new company image for the logo |
| `socket_channel` | formData | string |  | A 32 characters string that will be used to listen for events. |
| `language` | formData | string |  | Default to pt-br |
| `timezone` | formData | string |  | The user's timezone. Example: America/Sao_Paulo |
| `caller_id` | formData | string |  | The Caller ID for calls |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The updated company | [Company](API_MODELOS.md#company) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


## Company Role

### `GET /company_role`

**List all company roles with pagination**

Only available for users with the admin/manager role.

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | All company roles Paginated. | [CompanyRole](API_MODELOS.md#companyrole) |
| default | Unexpected error. | [Error](API_MODELOS.md#error) |


## Criterion

### `POST /ivr_after_call/{ivr-after-call-id}/criteria`

**Create a new criterion**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `ivr-after-call-id` | path | integer | sim | The ivr after call |
| `name` | formData | string | sim | The criterion name |
| `audio` | formData | file | sim | The mp3 file with the audio |
| `keys` | formData | lista de boolean | sim | The key to evaluation |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The created criterion | [IvrAfterCallCriterion](API_MODELOS.md#ivraftercallcriterion) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


## Criterion Lists

### `GET /criterion_list/{criterion-list-id}`

**Retrieve a criterion list from the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `criterion-list-id` | path | string | sim | The Criterion List id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The criterion list | [CriterionList](API_MODELOS.md#criterionlist) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /criterion_list/{criterion-list-id}/criteria`

**Retrieve a criterion list with all criteria related**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `criterion-list-id` | path | string | sim | The Criterion List id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The criterion list | [CriterionList](API_MODELOS.md#criterionlist) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /criterion_lists`

**List all criterion lists that belongs to the company of the authenticated user**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `search` | query | string |  | Filter by name |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | All criterion lists paginated | [CriterionLists](API_MODELOS.md#criterionlists) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /criterion_lists`

**Create a new criterion list in the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `name` | formData | string | sim | The criterion list's name |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The created criterion list | [CriterionList](API_MODELOS.md#criterionlist) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `PUT /criterion_lists/{criterion-list-id}`

**Update a criterion list in the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `criterion-list-id` | path | string | sim | The Criterion List id |
| `name` | formData | string | sim | The criterion list's name |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The updated criterion list | [CriterionList](API_MODELOS.md#criterionlist) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `DELETE /criterion_lists/{criterion-list-id}`

**Delete a criterion list in the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `criterion-list-id` | path | string | sim | The Criterion List id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /criterion_lists/{criterion-list-id}/criteria`

**Retrieve all criteria from the criterion list**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `criterion-list-id` | path | string | sim | The Criterion List id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The criteria | [Criterion](API_MODELOS.md#criterion) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /criterion_lists/{criterion-list-id}/criteria`

**Create a new criterion in a criterion list**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `criterion-list-id` | path | string | sim | The Criterion List id |
| `name` | formData | string | sim | The criterion name |
| `description` | formData | string | sim | The description of the criterion |
| `color` | formData | string | sim | The criterion color in hexadecimal format. Example: #3b4151 |
| `emoji` | formData | string |  | The criterion emoji |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The created criterion | [Criterion](API_MODELOS.md#criterion) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `PUT /criterion_lists/{criterion-list-id}/criteria/{criterion-id}`

**Update a criterion in a criterion list**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `criterion-list-id` | path | string | sim | The Criterion List id |
| `criterion-id` | path | string | sim | The Criterion id |
| `name` | formData | string | sim | The criterion name |
| `description` | formData | string | sim | The description of the criterion |
| `color` | formData | string | sim | The criterion color in hexadecimal format. Example: #3b4151 |
| `emoji` | formData | string |  | The criterion emoji |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The created criterion | [Criterion](API_MODELOS.md#criterion) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `DELETE /criterion_lists/{criterion-list-id}/criteria/{criterion-id}`

**Delete a criterion in a criterion list**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `criterion-list-id` | path | string | sim | The Criterion List id |
| `criterion-id` | path | string | sim | The Criterion id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


## Feedbacks

### `POST /feedbacks`

**Create a new feedback for a call history**

Only available for users with the manager role.
This endpoint accepts an array of criterion to insert. Each criterion object has the following schema:
```
{
  "name": "Criterion 1",
  "description": "this criterion is a example behavior for agents",
  "color": "#0000FF",
  "grade": 5
}
```
**all fields are required

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `call_history_id` | formData | string | sim | The call history id |
| `comment` | formData | string |  | The comment for the whole feedback |
| `criterion_json[]` | formData | lista de string |  | The list of criterion for the campaign with the grades |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The created feedback | [Feedback](API_MODELOS.md#feedback) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `PUT /feedbacks`

**Updates a feedback for a call history**

Only available for users with the manager role.
This endpoint accepts an array of criterion to insert. Each criterion object has the following schema:
```
{
  "name": "Criterion 1",
  "description": "this criterion is a example behavior for agents",
  "color": "#0000FF",
  "grade": 5
}
```
**all fields are required

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `id` | formData | string | sim | The feedback id |
| `comment` | formData | string |  | The comment for the whole feedback |
| `criterion_json[]` | formData | lista de string |  | The list of criterion for the campaign with the grades |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The updated feedback | [Feedback](API_MODELOS.md#feedback) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /feedbacks/{campaign-id}/{call-history-id}`

**Get the feedback for a call history, a new feedback instance is provided if there is no feedback for the call history**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The Campaign of the call history |
| `call-history-id` | path | string | sim | The Call History id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The feedback for call history | [Feedback](API_MODELOS.md#feedback) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /feedbacks/{campaign-id}/agent`

**Get the feedbacks for a agent in a campaign, start_date and end_date must be provided on query string**

Only available for users with the manager role.

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The Campaign of the call history |
| `start_date` | query | string | sim | The start date to filter in Y-m-d format |
| `end_date` | query | string | sim | The end date to filter in Y-m-d format |
| `agent_id` | query | integer | sim | The agent id to filter |
| `manager_id` | query | integer |  | The manager id to filter |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The feedbacks for a Agent and Campaign | [Feedbacks](API_MODELOS.md#feedbacks) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /feedbacks/{campaign-id}/agent/stats`

**Get the feedbacks statistics for a agent in a campaign, start_date and end_date must be provided on query string**

Only available for users with the agent or manager role.
This endpoint return an array of statistics based on agent currently authenticated. Each statistics object has the following schema:
```
{
  "agent_id": 2,
  "agent": "Agent 2",
  "criterion_json": [
   "Criterion 1": {
     "name": "Criterion 1",
     "total_grade": 5,
     "total_count": 1,
   },
   "Criterion 2": {
     "name": "Criterion 2",
     "total_grade": 5,
     "total_count": 1,
   },
  ],
 "total_feedbacks": 1,
}
```

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The current Campaign of the Agent |
| `start_date` | query | string | sim | The start date to filter in Y-m-d format |
| `end_date` | query | string | sim | The end date to filter in Y-m-d format |
| `manager_id` | query | integer |  | The manager id to filter |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The feedbacks statistics for a Agent and Campaign | [Feedbacks](API_MODELOS.md#feedbacks) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /feedbacks/{campaign-id}/total`

**Get the statistics for a campaign, start_date and end_date must be provided on query string**

Only available for users with the manager role.
This endpoint return an array of statistics based on agents. Each statistics object has the following schema:
```
{
  "agent_id": 2,
  "agent": "Agent 2",
  "criterion_json": [
   "Criterion 1": {
     "name": "Criterion 1",
     "total_grade": 5,
     "total_count": 1,
   },
   "Criterion 2": {
     "name": "Criterion 2",
     "total_grade": 5,
     "total_count": 1,
   },
  ],
 "total_feedbacks": 1,
}
```

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The Campaign of the call history |
| `start_date` | query | string | sim | The start date to filter in Y-m-d format |
| `end_date` | query | string | sim | The end date to filter in Y-m-d format |
| `manager_id` | query | integer |  | The manager id to filter |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The feedback statistics for Campaign | [Feedback](API_MODELOS.md#feedback) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /feedbacks/{campaign-id}/total/csv`

**Get the statistics for a campaign, start_date and end_date must be provided on query string**

Only available for users with the manager role.

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign-id` | path | string | sim | The current Campaign of the Agent |
| `start_date` | query | string | sim | The start date to filter in Y-m-d format |
| `end_date` | query | string | sim | The end date to filter in Y-m-d format |
| `manager_id` | query | integer |  | The manager id to filter |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | No Content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /feedbacks/{id}`

**Get the feedback for a given id**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `id` | path | integer | sim | The feedback id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The feedback for a given id | [Feedback](API_MODELOS.md#feedback) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /feedbacks/agent/stats`

**Get the feedbacks statistics for the agent agent currently authenticated**

Only available for users with the agent or manager role.
This endpoint return an array of statistics based on agent currently authenticated. Each statistics object has the following schema:
```
{
  "agent_id": 2,
  "agent": "Agent 2",
  "criterion_json": [
   "Criterion 1": {
     "name": "Criterion 1",
     "total_grade": 5,
     "total_count": 1,
   },
   "Criterion 2": {
     "name": "Criterion 2",
     "total_grade": 5,
     "total_count": 1,
   },
  ],
 "total_feedbacks": 1,
}
```

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `start_date` | query | string |  | The start date to filter in Y-m-d format |
| `end_date` | query | string |  | The end date to filter in Y-m-d format |
| `manager_id` | query | integer |  | The manager id to filter |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The feedbacks statistics for a Agent and Campaign | [Feedbacks](API_MODELOS.md#feedbacks) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


## Interval

### `GET /work_break_group/{work-break-id}/intervals`

**Retrieve all intervals from the work break group**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `work-break-id` | path | integer | sim | The work break group id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The intervals | [WorkBreakInterval](API_MODELOS.md#workbreakinterval) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /work_break_group/{work-break-id}/intervals`

**Create a new interval in a work break group**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `work-break-id` | path | integer | sim | The work break group id |
| `name` | formData | integer | sim | The interval name |
| `minutes` | formData | integer | sim | The interval minutes |
| `color` | formData | string | sim | The interval color in hexadecimal format. Example: #3b4151 |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The created interval | [WorkBreakInterval](API_MODELOS.md#workbreakinterval) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `PUT /work_break_group/{work-break-id}/intervals/{interval-id}`

**Update a interval in the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `work-break-id` | path | integer | sim | The work break group id |
| `interval-id` | path | integer | sim | The interval id |
| `name` | formData | integer | sim | The interval name |
| `minutes` | formData | integer | sim | The interval minutes |
| `color` | formData | string | sim | The interval color in hexadecimal format. Example: #3b4151 |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The updated interval | [WorkBreakInterval](API_MODELOS.md#workbreakinterval) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `DELETE /work_break_group/{work-break-id}/intervals/{interval-id}`

**Delete a interval in the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `work-break-id` | path | integer | sim | The work break group id |
| `interval-id` | path | integer | sim | The interval id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


## IVR AFTER CALL

### `GET /ivr_after_call`

**List all ivrs after call with pagination**

Only available for users with the manager role

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | All ivrs after call Paginated | [IvrAfterCall](API_MODELOS.md#ivraftercall) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /ivr_after_call`

**Create a new ivr after call**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `name` | formData | string | sim | The ivrs after call name |
| `audio_start` | formData | file | sim | The mp3 file with the audio start |
| `audio_null_key` | formData | file | sim | The mp3 file with the audio null key |
| `audio_invalid_key` | formData | file | sim | The mp3 file with the audio invalid key |
| `audio_end` | formData | file | sim | The mp3 file with the audio end |
| `max_wait_time` | formData | integer | sim | The key press max wait time |
| `attempt_number` | formData | integer | sim | The attempt number |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The created ivr after call | [IvrAfterCall](API_MODELOS.md#ivraftercall) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /ivr_after_call/{ivr-id}`

**Retrieve a ivr after call**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `ivr-id` | path | string | sim | The ivr after call id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The ivr after call | [IvrAfterCall](API_MODELOS.md#ivraftercall) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `DELETE /ivr_after_call/{ivr-id}`

**Delete a ivr after call**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `ivr-id` | path | string | sim | The ivr after call id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No Content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


## Ivr after call criterion

### `PUT /ivr_after_call/{ivr-after-call-id}/criteria{criterion-id}`

**Update a ivr after call criterion**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `ivr-after-call-id` | path | integer | sim | The ivr after call id |
| `criterion-id` | path | integer | sim | The ivr after call criterion id |
| `name` | formData | string | sim | The criterion name |
| `audio` | formData | file |  | The mp3 file with the audio |
| `keys` | formData | lista de boolean | sim | The key to evaluation |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The created criterion | [IvrAfterCallCriterion](API_MODELOS.md#ivraftercallcriterion) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `DELETE /ivr_after_call/{ivr-after-call-id}/criteria{criterion-id}`

**Delete ivf after call criterion**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `ivr-after-call-id` | path | integer | sim | The ivr after call id |
| `criterion-id` | path | integer | sim | The ivr after call criterion id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


## IVR AFTER CALL CRITERION (2)

### `GET /ivr_after_call/{ivr-after-call-id}/criteria`

**Retrieve a ivr after call criterion**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `ivr-after-call-id` | path | integer | sim | The ivr after call |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The ivr after call criterion | [IvrAfterCallCriterion](API_MODELOS.md#ivraftercallcriterion) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


## Line Of Work

### `GET /line_of_work`

**List lines of works with pagination**

Only available for users with the admin/manager role.

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | All lines of works Paginated. | [LineOfWork](API_MODELOS.md#lineofwork) |
| default | Unexpected error. | [Error](API_MODELOS.md#error) |


## Office Hours

### `GET /office_hours`

**List all office hours**

Office hours only available for with manager role

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | All office hours | [OfficeHours](API_MODELOS.md#officehours) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /office_hours`

**Crate a new office hours**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `name` | formData | string | sim | The office hours name |
| `day_week` | formData | lista de lista de integer | sim | The days of week. Integer 0 to 6 |
| `start_time` | formData | lista de lista de integer | sim | The start time. Example 'H:i' |
| `agents` | formData | lista de lista de integer | sim | The end time. Example 'H:i' |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The created office hours | [OfficeHours](API_MODELOS.md#officehours) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /office_hours/{office-hours-id}`

**Show office hours**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `office-hours-id` | path | string | sim | The office hours id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The office hours | [OfficeHours](API_MODELOS.md#officehours) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `PUT /office_hours/{office-hours-id}`

**Update a office hours**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `office-hours-id` | path | string | sim | The office hours id |
| `name` | formData | string | sim | The office hours name |
| `day_week` | formData | lista de lista de integer | sim | The days of week. Integer 0 to 6 |
| `start_time` | formData | lista de lista de integer | sim | The start time. Example 'H:i' |
| `agents` | formData | lista de lista de integer | sim | The end time. Example 'H:i' |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The update office hours | [OfficeHours](API_MODELOS.md#officehours) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `DELETE /office_hours/{office-hours-id}`

**Delete a office hours**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `office-hours-id` | path | string | sim | The office hours id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


## Outros

### `GET /version`

**Application version**

Returns information about the current application version.

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The app version | [ApplicationVersion](API_MODELOS.md#applicationversion) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


## Profile

### `GET /me`

**Return the authenticated user**

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The user profile | [User](API_MODELOS.md#user) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `PUT /me`

**Edit the user's profile**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `name` | formData | string | sim | The users's name |
| `extension_number` | formData | integer | sim | The users's extension number |
| `email` | formData | string | sim | The users's email |
| `timezone` | formData | string | sim | The users's timezone, e.g America/Sao_Paulo |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The updated user | [User](API_MODELOS.md#user) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `PUT /me/password`

**Edit the user's password**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `password` | formData | string | sim | The new password |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No Content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


## Promoter

### `GET /promoter`

**List promoters with pagination**

Only available for users with the admin/manager role.

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | All promoters Paginated. | [Promoter](API_MODELOS.md#promoter) |
| default | Unexpected error. | [Error](API_MODELOS.md#error) |


## Qualification

### `GET /qualification_lists/{qualification-list-id}/qualifications`

**Retrieve all qualifications from the qualification list**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `qualification-list-id` | path | integer | sim | The qualification list id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The qualifications | [Qualification](API_MODELOS.md#qualification) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /qualification_lists/{qualification-list-id}/qualifications`

**Create a new qualification in a qualification list**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `qualification-list-id` | path | integer | sim | The qualification list id |
| `name` | formData | string | sim | The qualification name |
| `behavior` | formData | integer | sim | The qualification behavior |
| `color` | formData | string | sim | The qualification color in hexadecimal format. Example: #3b4151 |
| `emoji` | formData | string |  | The qualification emoji |
| `conversion` | formData | boolean |  | If the qualification is a conversion |
| `allow_schedule` | formData | boolean |  | If the qualification allow the agent to schedule a call |
| `allow_schedule_to_another_number` | formData | boolean |  | If the qualification allow the agent to schedule a call for a different number of the call |
| `days_limit` | formData | integer |  | Days limit to schedule a call, required if the allow_schedule is true |
| `should_insert_blacklist` | formData | boolean |  | Add number to blacklist |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The created qualification | [Qualification](API_MODELOS.md#qualification) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `PUT /qualification_lists/{qualification-list-id}/qualifications/{qualification-id}`

**Update a qualification in the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `qualification-list-id` | path | integer | sim | The qualification list id |
| `qualification-id` | path | integer | sim | The qualification id |
| `name` | formData | string | sim | The qualification name |
| `behavior` | formData | integer | sim | The qualification behavior |
| `color` | formData | string | sim | The qualification color in hexadecimal format. Example: #3b4151 |
| `emoji` | formData | string |  | The qualification emoji |
| `conversion` | formData | boolean |  | If the qualification is a conversion |
| `allow_schedule` | formData | boolean |  | If the qualification allow the agent to schedule a call |
| `allow_schedule_to_another_number` | formData | boolean |  | If the qualification allow the agent to schedule a call for a different number of the call |
| `days_limit` | formData | integer |  | Days limit to schedule a call, required if the allow_schedule is true |
| `should_insert_blacklist` | formData | boolean |  | Add number to blacklist |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The updated qualification | [Qualification](API_MODELOS.md#qualification) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `DELETE /qualification_lists/{qualification-list-id}/qualifications/{qualification-id}`

**Delete a qualification in the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `qualification-list-id` | path | integer | sim | The qualification list id |
| `qualification-id` | path | integer | sim | The qualification id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


## Qualification Lists

### `GET /qualification_list/{qualification-id}`

**Retrieve a qualification list from the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `qualification-id` | path | string | sim | The qualification id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The qualification list | [QualificationList](API_MODELOS.md#qualificationlist) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /qualification_list/{qualification-id}/campaigns`

**Retrieve the campaigns that has a given qualification list in the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `qualification-id` | path | string | sim | The qualification id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The qualification list | [QualificationList](API_MODELOS.md#qualificationlist) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /qualification_lists`

**List all qualification lists that belongs to the company of the authenticated user**

Only available for users with the manager role

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | All qualification lists paginated | [QualificationLists](API_MODELOS.md#qualificationlists) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /qualification_lists`

**Create a new qualification list in the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `name` | formData | string | sim | The qualification list's name |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The created qualification list | [QualificationList](API_MODELOS.md#qualificationlist) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `PUT /qualification_lists/{qualification-id}`

**Update a qualification list in the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `qualification-id` | path | string | sim | The qualification id |
| `name` | formData | string | sim | The qualification list's name |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The updated qualification list | [QualificationList](API_MODELOS.md#qualificationlist) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `DELETE /qualification_lists/{qualification-id}`

**Delete a qualification list in the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `qualification-id` | path | string | sim | The qualification id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


## Receptive IVR

### `GET /receptive_ivr`

**List receptive IVR that belongs to the company of the authenticated user**

Only available for users with the manager role

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | All receptive IVR paginated | [ReceptiveIVRList](API_MODELOS.md#receptiveivrlist) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /receptive_ivr`

**Create a new receptive IVR in the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `name` | formData | string | sim | The receptive IVR name |
| `timeout` | formData | integer | sim | The receptive IVR wait time |
| `redirect_id` | formData | integer | sim | The receptive IVR default redirect id |
| `redirect_type` | formData | string | sim | The receptive IVR default redirect type. Types: ReceptiveQueue |
| `keys[]` | formData | lista de lista de string | sim | An array of keys |
| `keys[][id]` | formData | integer |  | The redirect id |
| `keys[][type]` | formData | string |  | The redirect type Types: ReceptiveQueue |
| `keys[][key]` | formData | string |  | The key |
| `audio` | formData | file | sim | The mp3 file with the audio |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The created receptive IVR | [ReceptiveIVR](API_MODELOS.md#receptiveivr) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /receptive_ivr/{receptive-IVR-id}`

**Retrieve a receptive IVR from the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `receptive-IVR-id` | path | string | sim | The receptive IVR id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The receptive IVR | [ReceptiveIVR](API_MODELOS.md#receptiveivr) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `PUT /receptive_ivr/{receptive-IVR-id}`

**Update the receptive IVR in the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `receptive-IVR-id` | path | string | sim | The receptive IVR id |
| `name` | formData | string | sim | The receptive IVR name |
| `timeout` | formData | integer | sim | The receptive IVR wait time |
| `redirect_id` | formData | integer | sim | The receptive IVR default redirect id |
| `redirect_type` | formData | string | sim | The receptive IVR default redirect type. Types: ReceptiveQueue |
| `keys[]` | formData | lista de lista de string | sim | An array of keys |
| `keys[][id]` | formData | integer |  | The redirect id |
| `keys[][type]` | formData | string |  | The redirect type Types: ReceptiveQueue |
| `keys[][key]` | formData | string |  | The key |
| `audio` | formData | file |  | The mp3 file with the audio |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The updated receptive IVR | [ReceptiveIVR](API_MODELOS.md#receptiveivr) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `DELETE /receptive_ivr/{receptive-IVR-id}`

**Delete the Receptive IVR in the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `receptive-IVR-id` | path | string | sim | The receptive IVR id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


## Receptive Metrics

### `GET /receptive_metrics`

**The receptive metrics by queue**

Only available for users with the manager role

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | List of metrics for receptive queues | [ReceptiveMetricList](API_MODELOS.md#receptivemetriclist) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /total_receptive_metrics`

**The all receptive metrics**

Only available for users with the manager role

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | List metrics for all receptive queues | [TotalReceptiveMetricList](API_MODELOS.md#totalreceptivemetriclist) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


## Receptive Number Settings

### `GET /receptive_number_settings`

**List receptive Settings that belongs to the company of the authenticated user**

Only available for users with the manager role

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | All receptive Settings paginated | [ReceptiveNumberSettings](API_MODELOS.md#receptivenumbersettings) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /receptive_number_settings`

**Create a new receptive Numbers Settings in the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `receptive_queue_id` | formData | integer | sim | The receptive queue id |
| `receptive_ivr_id` | formData | integer | sim | The receptive ivr id |
| `did` | formData | string | sim | The receptive did |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The created receptive setting | [ReceptiveNumberSetting](API_MODELOS.md#receptivenumbersetting) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `PUT /receptive_number_settings/{did}`

**Update the receptive Number Setting in the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `did` | path | string | sim | The receptive did |
| `receptive_queue_id` | formData | integer | sim | The receptive queue id |
| `receptive_ivr_id` | formData | integer | sim | The receptive ivr id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The updated receptive number setting | [ReceptiveNumberSettings](API_MODELOS.md#receptivenumbersettings) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `DELETE /receptive_number_settings/{did}`

**Delete the Receptive Number Setting in the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `did` | path | string | sim | The receptive did |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


## Receptive queues

### `GET /receptive_queues`

**List receptive queues that belongs to the company of the authenticated user**

Only available for users with the manager role

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | All receptive queues paginated | [ReceptiveQueues](API_MODELOS.md#receptivequeues) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /receptive_queues`

**Create a new receptive queue in the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `name` | formData | string | sim | The receptive queue name |
| `wait_time` | formData | integer | sim | The receptive queue wait time |
| `acw_timeout` | formData | integer |  | The acw timeout from receptive queue |
| `extension_number` | formData | integer | sim | The receptive queue extension number |
| `qualification_list_id` | formData | integer | sim | The qualification id list |
| `limit_call_time` | formData | integer |  | The limit call time |
| `ivr_after_call_id` | formData | integer |  | The ivr after call id |
| `agents[]` | formData | lista de integer | sim | An array of agent ids |
| `audio` | formData | file | sim | The mp3 file with the audio |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The created receptive queue | [ReceptiveQueue](API_MODELOS.md#receptivequeue) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /receptive_queues/{receptive-queue-id}`

**Retrieve a receptive queues from the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `receptive-queue-id` | path | string | sim | The receptive queues id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The receptive queue | [ReceptiveQueue](API_MODELOS.md#receptivequeue) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /receptive_queues/{receptive-queue-id}/agents_status`

**List all agents status in this receptive queue**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `receptive-queue-id` | path | string | sim | The receptive queue id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | An array of agents status | [AgentStatus](API_MODELOS.md#agentstatus) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /receptive_queues/{receptive-queue-id}/calls`

**Retrieve the calls from the receptive queue**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `receptive-queue-id` | path | integer | sim | The receptive queues id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The receptive queue | [Calls](API_MODELOS.md#calls) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /receptive_queues/{receptive-queue-id}/metrics`

**Retrieve a receptive queue metrics**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `receptive-queue-id` | path | string | sim | The receptive queues id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The receptive queue | [ReceptiveMetricList](API_MODELOS.md#receptivemetriclist) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /receptive_queues/{receptive-queue-id}/metrics/qualifications`

**Retrieve a receptive queue qualifications metrics**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `receptive-queue-id` | path | string | sim | The receptive queues id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The receptive queue | [TotalQualificationStats](API_MODELOS.md#totalqualificationstats) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `PUT /receptive_queues/{receptive-queue-id}/metrics/qualifications`

**Update the receptive queue in the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `receptive-queue-id` | path | string | sim | The receptive queues id |
| `name` | formData | string | sim | The receptive queue name |
| `wait_time` | formData | integer | sim | The receptive queue wait time |
| `acw_timeout` | formData | integer |  | The acw timeout from receptive queue |
| `extension_number` | formData | integer | sim | The receptive queue extension number |
| `qualification_list_id` | formData | integer | sim | The qualification id list |
| `limit_call_time` | formData | integer |  | The limit call time |
| `ivr_after_call_id` | formData | integer |  | The ivr after call id |
| `agents[]` | formData | lista de integer |  | An array of agent ids |
| `audio` | formData | file |  | The mp3 file with the audio |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The updated receptive queue | [ReceptiveQueue](API_MODELOS.md#receptivequeue) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `DELETE /receptive_queues/{receptive-queue-id}/metrics/qualifications`

**Delete the Receptive queues in the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `receptive-queue-id` | path | string | sim | The receptive queues id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /receptive_queues/active`

**List active receptive queues that belongs to the company of the authenticated user**

Only available for users with the manager role

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | All active receptive queues | [ReceptiveQueues](API_MODELOS.md#receptivequeues) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /receptive_queues/agents`

**List receptive queues along with their agents that belongs to the company of the authenticated user**

Only available for users with the manager role

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | All receptive queues | [ReceptiveQueues](API_MODELOS.md#receptivequeues) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /receptive_queues/online`

**List receptive queues that belongs to the company of the authenticated user and have at least one agent online**

Available for users with the manager and agent role

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | All receptive queues with agents online | [ReceptiveQueues](API_MODELOS.md#receptivequeues) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


## Route

### `GET /routes/{routeId}/hangupCauseReport`

**Get Hangup Cause statistic grouped by minutes interval**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `routeId` | path | string | sim | The route id |
| `startDate` | query | string | sim | Start date |
| `endDate` | query | string | sim | End date |
| `interval` | query | integer |  | Interval in minutes |
| `phoneType` | query | string |  | Phone type (landline or mobile) |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | Hangup Cause statistics | [HangupCauseStatistics](API_MODELOS.md#hangupcausestatistics) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


## Routes

### `GET /routes`

**List all routes that belongs to the company of the authenticated user**

Only available for users with the manager role

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The routes | [Routes](API_MODELOS.md#routes) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `PUT /routes`

**Update Routes the company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `route_landline_id` | formData | integer | sim | The landline id route |
| `route_mobile_id` | formData | integer | sim | The mobile id route |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | No Content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


## Schedules

### `GET /schedules`

**Schedules**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign` | query | string |  | The campaign id |
| `agent` | query | string |  | The agent id |
| `start_date` | query | string | sim | Start date |
| `end_date` | query | string | sim | End date |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The schedules | [Schedules](API_MODELOS.md#schedules) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `PUT /schedules/{schedule-id}`

**Update a Schedule**

Only available for schedules you own

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `schedule-id` | path | string | sim | The schedule id |
| `date` | formData | string |  | The date that the scheduled call should fire. Must be in 2000-01-30 23:00:00 format |
| `note` | formData | string |  | The note of the scheduled call |
| `phone` | formData | string |  | The phone of the scheduled call |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The updated schedule | [Schedule](API_MODELOS.md#schedule) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `DELETE /schedules/{schedule-id}`

**Delete a schedule**

Only available for schedules you own

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `schedule-id` | path | string | sim | The schedule id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No Content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /schedules/csv`

**Generate Schedules CSV file**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `campaign` | query | string |  | The campaign id |
| `agent` | query | string |  | The agent id |
| `start_date` | query | string | sim | Start date |
| `end_date` | query | string | sim | End date |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | Success message for csv creation |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


## Status

### `GET /agents/status/metrics/total`

**Get status and metrics the agent**

Only available for users with the manager or supervisor role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `start_date` | query | string | sim | The start date to filter in Y-m-d H:i:s format |
| `end_date` | query | string | sim | The end date to filter in Y-m-d H:i:s format |
| `search` | query | string |  | Search by name or e-mail |
| `active` | query | string |  | The user's 1 active, 0 inactive |
| `teamId` | query | string |  | The team id to filter |
| `status` | query | string |  | The status to filter, use ONLINE or OFFLINE |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The agent status and metrics | [AgentStatusMetrics](API_MODELOS.md#agentstatusmetrics) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


## Teams

### `GET /teams`

**List all teams with pagination**

Only available for teams with the manager role

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | All teams paginated | [Teams](API_MODELOS.md#teams) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /teams`

**Crate a new team**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `name` | formData | string | sim | The team's name |
| `color` | formData | string | sim | The team's color |
| `supervisors` | formData | lista de lista de integer |  | The team's supervisors ids |
| `agents` | formData | lista de lista de integer |  | The team's agents ids |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The created team | [Team](API_MODELOS.md#team) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /teams/{team-id}`

**Get the team for a given id**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `team-id` | path | string | sim | The user id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The team for a given id | [Team](API_MODELOS.md#team) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `PUT /teams/{team-id}`

**Update a team**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `team-id` | path | string | sim | The user id |
| `name` | formData | string | sim | The team's name |
| `color` | formData | string | sim | The team's color |
| `supervisors` | formData | lista de lista de integer |  | The team's supervisors ids |
| `agents` | formData | lista de lista de integer |  | The team's agents ids |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The created team | [Team](API_MODELOS.md#team) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `DELETE /teams/{team-id}`

**Delete a team**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `team-id` | path | string | sim | The user id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


## URA

### `PUT /ivr_after_call/{ivr-id}`

**Update a ivr/ura**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `ivr-id` | path | string | sim | The ivr after call id |
| `name` | formData | string | sim | The ivrs after call name |
| `audio_start` | formData | file |  | The mp3 file with the audio start |
| `audio_null_key` | formData | file |  | The mp3 file with the audio null key |
| `audio_invalid_key` | formData | file |  | The mp3 file with the audio invalid key |
| `max_wait_time` | formData | integer | sim | The key press max wait time |
| `audio_end` | formData | file |  | The mp3 file with the audio end |
| `attempt_number` | formData | integer | sim | The attempt number |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The updated ivr after call | [IvrAfterCall](API_MODELOS.md#ivraftercall) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /uras`

**List all ivrs/uras with pagination**

Only available for users with the manager role

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | All ivr/uras Paginated | [Uras](API_MODELOS.md#uras) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /uras`

**Create a new ivr/ura**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `name` | formData | string | sim | The ura's name |
| `audio` | formData | file | sim | The mp3 file with the audio |
| `wait_time` | formData | integer | sim | The ura's wait time |
| `keys` | formData | lista de boolean | sim | The keys that when pressed will redirect to the campaign |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The created ivr/ura | [Ura](API_MODELOS.md#ura) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /uras/{ura-id}`

**Get the ura for a given id**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `ura-id` | path | string | sim | The ura id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The ura for a given id | [Ura](API_MODELOS.md#ura) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `PUT /uras/{ura-id}`

**Update a ivr/ura**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `ura-id` | path | string | sim | The ura id |
| `name` | formData | string | sim | The ura's name |
| `audio` | formData | file |  | The mp3 file with the audio |
| `wait_time` | formData | integer | sim | The ura's wait time |
| `keys` | formData | lista de boolean | sim | The keys that when pressed will redirect to the campaign |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The updated ivr/ura | [Ura](API_MODELOS.md#ura) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `DELETE /uras/{ura-id}`

**Delete a ivr/ura**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `ura-id` | path | string | sim | The ura id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No Content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


## User Data

### `GET /user_data`

**List all users data with pagination**

Only available for users with the admin/manager role.

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | All users Paginated. | [UserData](API_MODELOS.md#userdata) |
| default | Unexpected error. | [Error](API_MODELOS.md#error) |


### `POST /user_data`

**Create a new user data**

Only available for users with the admin/manager role.

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `name` | formData | string | sim | The user's name. |
| `email` | formData | string | sim | The user's email. This field is required. |
| `whatsapp_number` | formData | string | sim | The user's whatsapp number. |
| `roles_ids` | formData | lista de integer | sim | The user's company roles ids. |
| `lines_of_works_ids` | formData | lista de integer | sim | The user's lines of works ids. |
| `promoters_ids` | formData | lista de integer |  | The user's promoters ids. |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The created user. | [UserData](API_MODELOS.md#userdata) |
| default | Unexpected error. | [Error](API_MODELOS.md#error) |


### `PUT /user_data`

**Update a new user data**

Only available for users with the admin/manager role.

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `name` | formData | string | sim | The user's name. |
| `email` | formData | string | sim | The user's email. This field is required. |
| `whatsapp_number` | formData | string | sim | The user's whatsapp number. |
| `roles_ids` | formData | lista de integer | sim | The user's company roles ids. |
| `lines_of_works_ids` | formData | lista de integer | sim | The user's lines of works ids. |
| `promoters_ids` | formData | lista de integer |  | The user's promoters ids. |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The updated user data. | [UserData](API_MODELOS.md#userdata) |
| default | Unexpected error. | [Error](API_MODELOS.md#error) |


## Users

### `GET /users`

**List all users with pagination**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `active` | query | string |  | The user's 1 active, 0 inactive |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | All users Paginated | [Users](API_MODELOS.md#users) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /users`

**Create a new user**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `name` | formData | string | sim | The user's name |
| `extension_number` | formData | integer | sim | The user's extension number |
| `email` | formData | string |  | The user's email. This field is required if the role of the user is manager |
| `password` | formData | string | sim | The user's password |
| `web_extension` | formData | string |  | If provided the web extension will be set to true, otherwise false will be used. |
| `role` | formData | string | sim | The user's role. Must be agent or manager |
| `timezone` | formData | string | sim | The user's timezone. Example: America/Sao_Paulo |
| `date_format` | formData | string |  | A date format to be used for dates. Example: d-m-Y, Y/m/d Default to d/m/Y |
| `hour_format` | formData | string |  | A format to be used for hours. Example: H:i, h:i, H:i:s Default to H:i:s |
| `user_document` | formData | string |  | The user's CPF. Send 11 digits only numbers |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The created user | [User](API_MODELOS.md#user) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `PUT /users/{user-id}`

**Update a user**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `user-id` | path | string | sim | The user id |
| `name` | formData | string | sim | The user's name |
| `extension_number` | formData | integer | sim | The user's extension number |
| `email` | formData | string | sim | The user's email |
| `password` | formData | string | sim | The user's password |
| `web_extension` | formData | string |  | If provided the web extension will be set to true, otherwise false will be used. |
| `role` | formData | string | sim | The user's role. Must be agent or manager |
| `user_document` | formData | string |  | The user's CPF. Send 11 digits only numbers |
| `timezone` | formData | string | sim | The user's timezone. Example: America/Sao_Paulo |
| `date_format` | formData | string | sim | A date format to be used for dates. Example: d-m-Y, Y/m/d |
| `hour_format` | formData | string | sim | A format to be used for hours. Example: H:i, h:i, H:i:s |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The updated user | [User](API_MODELOS.md#user) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `DELETE /users/{user-id}`

**Delete a user**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `user-id` | path | string | sim | The user id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No Content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `PUT /users/{user-id}/basic-data`

**Update user basic data**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `user-id` | path | string | sim | The user id |
| `name` | formData | string | sim | The user's name |
| `password` | formData | string | sim | The user's password |
| `password_confirmation` | formData | string | sim | The user's password confirmed |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The updated user | [User](API_MODELOS.md#user) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /users/{user-id}/deactivate`

**Deactivate user**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `user-id` | path | integer | sim | The user id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | No Content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `PUT /users/{user-id}/disable`

**Disable a user**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `user-id` | path | string | sim | The user id |
| `remove_schedules` | query | boolean |  | The condition to remove schedules or not (0, 1, false, true) |
| `user_id` | query | string |  | The user ID that will receive the schedules |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The updated user | [User](API_MODELOS.md#user) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `PUT /users/{user-id}/enable`

**Enable a user**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `user-id` | path | integer | sim | The user id |
| `name` | formData | string | sim | The user's name |
| `extension_number` | formData | integer | sim | The user's extension number |
| `email` | formData | string | sim | The user's email |
| `password` | formData | string | sim | The user's password |
| `role` | formData | string | sim | The user's role. Must be agent or manager |
| `user_document` | formData | string |  | The user's CPF. Send 11 digits only numbers |
| `timezone` | formData | string | sim | The user's timezone. Example: America/Sao_Paulo |
| `date_format` | formData | string | sim | A date format to be used for dates. Example: d-m-Y, Y/m/d |
| `hour_format` | formData | string | sim | A format to be used for hours. Example: H:i, h:i, H:i:s |
| `web_extension` | formData | boolean |  | True if the web extension is enabled otherwise false |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The updated user | [User](API_MODELOS.md#user) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `PUT /users/{user-id}/enable/web_extension`

**Enable or disable the user web extension**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `user-id` | path | integer | sim | The user id |
| `name` | formData | string | sim | The user's name |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The updated user | [User](API_MODELOS.md#user) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /users/csv`

Only available for users with the manager role

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | Success message for csv creation |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /webphone/users`

**Create multiple webhpone users**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `names` | formData | lista de string | sim | The user's names |
| `emails` | formData | lista de string | sim | The user's emails |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | No Content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


## Work break groups

### `GET /work_break_group`

**List all work break groups that belongs to the company of the authenticated user**

Only available for users with the manager role

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | All work break groups paginated | [WorkBreakGroup](API_MODELOS.md#workbreakgroup) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `POST /work_break_group`

**Create a new work break group in the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `name` | formData | string | sim | The work break group's name |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The created work break group | [WorkBreakGroup](API_MODELOS.md#workbreakgroup) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `GET /work_break_group/{qualification-id}`

**Retrieve a work break group from the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `qualification-id` | path | string | sim | The qualification id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The work break group | [WorkBreakGroup](API_MODELOS.md#workbreakgroup) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `PUT /work_break_group/{qualification-id}`

**Update a work break group in the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `qualification-id` | path | string | sim | The qualification id |
| `name` | formData | string | sim | The work break group's name |

| Resposta | Descrição | Corpo |
|---|---|---|
| 200 | The updated work break group | [WorkBreakGroup](API_MODELOS.md#workbreakgroup) |
| default | Unexpected error | [Error](API_MODELOS.md#error) |


### `DELETE /work_break_group/{qualification-id}`

**Delete a work break group in the user's company**

Only available for users with the manager role

| Parâmetro | Onde | Tipo | Obrigatório | Descrição |
|---|---|---|---|---|
| `qualification-id` | path | string | sim | The qualification id |

| Resposta | Descrição | Corpo |
|---|---|---|
| 204 | No content |  |
| default | Unexpected error | [Error](API_MODELOS.md#error) |

