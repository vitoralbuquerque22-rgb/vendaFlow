# 3C Plus — Ramal WebRTC (áudio das ligações)

Para o agente ouvir e falar, o ramal SIP dele precisa estar registrado **antes** do login na campanha
(ordem oficial: ramal → socket → `POST /agent/login`). Sem ramal registrado o 3C emite `agent-login-failed`,
ou o login passa mas a ligação chega muda.

## Como o 3C registra o ramal

A página oficial `https://{dominio}.3c.plus/extension?api_token={token}` (componente `JssipIntegration` do app do 3C)
faz, no navegador:

1. `GET /api/v1/me?api_token={token}&include=company` — dados do agente.
2. Registra o ramal com [JsSIP](https://jssip.net/):
   ```js
   new JsSIP.UA({
     sockets: [new JsSIP.WebSocketInterface("wss://vox-socket.3c.plus:4443")],
     uri: `sip:${me.telephony_id}@${me.company.domain}.3c.plus`,
     password: me.extension_password,
     register: true,
     register_expires: 30,
     session_timers: false,
     no_answer_timeout: 60,
   });
   ```
3. Em `newRTCSession`, **atende automaticamente** (`session.answer({ mediaConstraints: { audio: true, video: false } })`)
   e toca o áudio remoto num `<audio autoplay>`.
4. `registrationFailed` → tenta de novo a cada 5 s, até 10 vezes.

Requisitos oficiais: HTTPS, permissão de microfone, navegador baseado no Chrome, e a página não pode ser recarregada
durante uma ligação.

## Por que a página /extension deixa de servir

A página lê o token da URL e chama `/me` **sem** o header `X-Agent-Id` (uma página aberta por URL não envia headers).
Com token de serviço de agente a API responde `400 Tokens de agente exigem o header X-Agent-Id` e o ramal não
registra — verificado em 25/09/2026. Como o token pessoal é descontinuado em **01/10/2026**, a página `/extension`
(e a extensão do Chrome, que abria essa mesma página numa aba) deixa de funcionar para integrações.

Além disso, colocar o token de serviço numa URL do navegador exporia uma credencial que opera por **qualquer agente**.

## Como o VendaFlow registra o ramal

O próprio CRM faz o que a página `/extension` fazia, com as credenciais obtidas pelo backend:

1. `backend/functions/executarComando3CPlus` — comando `get-ramal-webrtc`: chama `GET /me?include=company` **como o
   agente do usuário logado** (token de serviço + `X-Agent-Id`) e devolve `{ ws, uri, senha }` com
   `Cache-Control: no-store`. O navegador recebe **só a senha SIP do próprio ramal**, que só serve para registrar
   esse ramal — nunca o token de serviço.
2. `frontend/src/components/telefonia/RamalWebRTC.jsx` — registra com JsSIP (mesma configuração acima), atende
   automaticamente as chamadas do discador e confirma o registro pelo evento real `registered` do SIP.
3. **Uma aba só:** o registro acontece numa única aba (Web Locks API). As outras abas consultam o status por
   `BroadcastChannel`; se a aba dona fechar, outra assume e registra de novo. O áudio toca na aba dona.
4. Protocolo com o resto do CRM (o mesmo da antiga extensão): `VENDAFLOW_SET_AGENT { empresaId, dominio }`,
   `VENDAFLOW_GET_RAMAL_STATUS`, `VENDAFLOW_RAMAL_REGISTERED` / `VENDAFLOW_RAMAL_UNREGISTERED`.

CSP necessária em `frontend/index.html`: `connect-src ... wss://vox-socket.3c.plus:4443`.

## Checklist de teste com ligação real

1. HTTPS (ou `localhost`) e Chrome.
2. SDR com ramal cadastrado no perfil (o backend resolve o id 3C pelo ramal).
3. Entrar na campanha pelo softphone: o navegador pede o microfone; o selo "webrtc ✓" aparece e o login confirma com
   `agent-is-idle`.
4. Receber uma ligação do discador: o áudio sai na aba dona do ramal.
5. Abrir uma segunda aba do CRM: ela não registra de novo e mostra o ramal como registrado.
