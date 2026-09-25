# 3C Plus — Guias de integração

Resumo dos guias oficiais da central de ajuda (https://alo.3cplusnow.com/help, categoria "API e integração"),
com os endpoints da [API_REFERENCIA.md](API_REFERENCIA.md). Autenticação em [TOKENS_DE_SERVICO.md](TOKENS_DE_SERVICO.md).

## Domínios (mudança de 02/03/2025)

| Serviço | Antigo | Atual |
|---|---|---|
| API do discador | `https://{dominio}.3c.fluxoti.com/api/v1` | `https://{dominio}.3c.plus/api/v1` |
| Socket | `https://socket.3c.fluxoti.com` | `https://socket.3c.plus` |
| Telefonia/WebRTC | `{dominio}.3c.fluxoti.com` | sem alteração (`wss://vox-socket.3c.plus:4443` para o ramal) |

Fonte: https://alo.3cplusnow.com/help/mudan%C3%A7a-de-dom%C3%ADnio-da-api-em-02/03/2025-3c-plus-help-center

## Tela do agente

Fonte: https://alo.3cplusnow.com/help/guia-b%C3%A1sico-de-integra%C3%A7%C3%A3o-tela-do-agente-3c-plus-help-center

1. Registrar o ramal WebRTC ([RAMAL_WEBRTC.md](RAMAL_WEBRTC.md)).
2. Conectar ao socket ([EVENTOS_SOCKET.md](EVENTOS_SOCKET.md)).
3. `GET /agent/campaigns` → escolher a campanha → `POST /agent/login` (`campaign`, `mode`: `dialer` ou `manual`).
4. Reagir aos eventos:

| Estado | Evento que leva a ele | Ações possíveis |
|---|---|---|
| Ocioso | `agent-is-idle` | intervalo (`POST /agent/work_break/{id}/enter`), modo manual (`POST /agent/manual_call/enter`), sair (`POST /agent/logout`) |
| Falando | `call-was-connected` | qualificar (`POST /agent/call/{id}/qualify`), desligar (`POST /agent/call/{id}/hangup`) |
| TPA (pós-atendimento) | `agent-in-acw` (desligou sem qualificar) | qualificar (`POST /agent/call/{id}/qualify`) |
| Intervalo | `agent-entered-work-break` | sair (`POST /agent/work_break/exit`) → `agent-left-work-break` |

Intervalos disponíveis: `GET /agent/work_break_intervals` (ou os da campanha, `GET /campaigns/{id}/intervals`).
Campanha em que o agente está: `GET /agent/loggedCampaign` (404/422 = não logado).

## Ligação manual (click-to-call)

1. `POST /agent/manual_call/enter` → `agent-entered-manual`
2. `POST /agent/manual_call/dial` (`phone`) → `call-was-connected` (ou `manual-call-was-answered`)
3. `POST /agent/call/{id}/hangup` → `call-was-finished`
4. Qualificar: `POST /agent/manual_call/{id}/qualify`
5. `POST /agent/manual_call/exit` → `agent-is-idle`

Durante o TPA existe o modo manual de TPA: `/agent/manual_call_acw/enter`, `/dial`, `/exit`.
Um gestor **não** loga outro agente remotamente; ações do agente usam o token do papel agente + `X-Agent-Id`.

## Envio de listas de contatos (mailing)

Fonte: https://alo.3cplusnow.com/help/guia-b%C3%A1sico-de-integra%C3%A7%C3%A3o-envio-de-listas-de-mailing-3c-plus-help-center

1. Descobrir a campanha: `GET /campaigns`.
2. Enviar a lista — dois formatos:
   - **CSV** (recomendado acima de 10.000 linhas): `POST /campaigns/{campaign-id}/lists/csv`, com o parâmetro
     `header` mapeando as colunas.
   - **JSON** (envios frequentes e menores): `POST /campaigns/{campaign-id}/lists` (cria a lista) →
     `GET /campaigns/{campaign-id}/lists` → `POST /campaigns/{campaign-id}/lists/{list-id}/mailing.json`
     (o artigo da central escreve `mailing_json`; o swagger oficial e o VendaFlow usam `mailing.json`).
3. Ativar a discagem ajustando o peso: `PUT /campaigns/{campaign-id}/lists/{list_id}/updateWeight`.

Campos especiais (quando existirem):

| Campo | Conteúdo | Exemplo |
|---|---|---|
| `identifier` | Id único do cliente | `CLI-0001` |
| `areacodephone` | Telefone com DDD | `1140637921` |
| `areacode` | Só o DDD | `11` |
| `phone` | Só o número | `40637921` |

As demais colunas são livres. Uma campanha tem várias listas, com pesos/prioridades; quando a última acaba o socket
emite `list-empty`.

## Webhook

Fonte: https://alo.3cplusnow.com/help/integra%C3%A7%C3%A3o-via-webhook-3c-plus-help-center

- Configuração: Configurações do sistema → Integrações → Criar Webhook (URL + eventos).
- Eventos disponíveis: **`call-was-connected`** e **`call-history-was-created`**.
- Depois de **50 falhas** de entrega o webhook é desativado automaticamente (reativação manual).
- Para todo o resto, use o socket.

## Biblioteca de dados (histórico de chamadas)

Fonte: https://alo.3cplusnow.com/help/biblioteca-de-dados-3c-plus-3c-plus-help-center

Campos do histórico (`GET /calls`, evento `call-history-was-created`):

| Grupo | Campos |
|---|---|
| Geral | `id`, `list`, `number`, `call_date`, `call_date_rfc3339`, `campaign_id`, `campaign`, `queue_name`, `ivr_name`, `receptive_name`, `receptive_phone`, `receptive_did`, `has_agent`, `agent` |
| Tempos e custo | `acw_time`, `speaking_time`, `ivr_time`, `amd_time`, `waiting_time`, `speaking_with_agent_time`, `billed_time`, `billed_value` |
| Classificação | `qualification`, `behavior`, `readable_behavior_text`, `phone_type` (`mobile`/`landline`), `status_id`, `readable_status_text`, `hangup_cause`, `readable_hangup_cause_text` |
| Gravação e metadados | `recording`, `recording_amd`, `qualification_note`, `sid`, `is_dmc`, `is_transferred`, `is_consult`, `is_conversion`, `ended_by_agent` |
| Contato (`mailing_data.*`) | `_id`, `campaign_id`, `company_id`, `cpf`, `data`, `dialed_identifier`, `dialed_phone`, `identifier`, `list_id`, `on_calling`, `phone` |

Datas em RFC 3339; durações em `HH:MM:SS`. Tabelas de status: [EVENTOS_SOCKET.md](EVENTOS_SOCKET.md#códigos-de-status-biblioteca-de-dados).

## Omnichannel (WhatsApp)

Fonte: https://alo.3cplusnow.com/help/guia-b%C3%A1sico-de-integra%C3%A7%C3%A3o-envio-e-recebimento-de-mensagens-omnichannel-3c-plus-3c-plus-help-center
e documentação Postman "API Omni" (https://documenter.getpostman.com/view/25269027/2sA3JT1cqe).

- Instâncias (canais de WhatsApp): o `id` da instância (`company` → `instances.data`) é necessário para abrir chats
  e enviar mensagens.
- Para enviar é preciso ter um chat aberto com o número (`instance_id` + `number`).
- Tipos de mensagem: texto, imagem, áudio, vídeo, documento e mensagem interna.
- Recebimento em tempo real pelo socket: evento **`new-message-whatsapp`**.
- O VendaFlow ainda não usa o omnichannel.

## Documentação oficial

- API do discador (Swagger UI): https://api-docs.3c.plus/ — gerada em [API_REFERENCIA.md](API_REFERENCIA.md)
- Postman "API Discador": https://documenter.getpostman.com/view/25269027/2sA3JT1cqi
- Postman "API Omni": https://documenter.getpostman.com/view/25269027/2sA3JT1cqe
- Central de ajuda: https://alo.3cplusnow.com/help
- Página de desenvolvedores: https://3cplusnow.com/desenvolvedores/
- SDK JavaScript oficial: https://github.com/3C-Plus/3cplusv2-sdk
