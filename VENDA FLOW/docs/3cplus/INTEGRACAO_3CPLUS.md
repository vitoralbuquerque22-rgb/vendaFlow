# Integração VendaFlow × 3C Plus — arquitetura

Como o VendaFlow fala com o 3C Plus. A documentação do 3C em si está nos outros arquivos desta pasta
([README.md](README.md)).

## Endereços da organização

| Serviço | Endereço |
|---|---|
| API | `https://oficinasmaster.3c.plus/api/v1` |
| Socket (eventos) | `https://socket.3c.plus` (configurável no backend por `THREEC_SOCKET_URL`) |
| Ramal WebRTC (SIP) | `wss://vox-socket.3c.plus:4443` |

Limite da conta: `max_agents_login = 5` (acima disso o 3C emite `reached-max-online-agents`).

## Credenciais (tokens de serviço)

| Onde | O quê |
|---|---|
| `Integracao.configuracao.token_gestor` | Token de serviço, papel gestor |
| `Integracao.configuracao.token_servico_agente` | Token de serviço, papel agente (um só para todos os SDRs) |
| `UserProfile.id_3cplus` | Id do agente do SDR → header `X-Agent-Id` (resolvido pelo ramal quando vazio) |
| `UserProfile.ramal_3cplus` | Ramal do SDR (usado para descobrir o id) |
| `UserProfile.token_3cplus` | Token pessoal **legado** — usado só se não houver token de serviço de agente; deixa de funcionar em 01/10/2026 |

Os campos de token são **mascarados** (`••••••••`) em toda resposta da API para o navegador
(`backend/src/entities.ts`, `SEGREDOS`). Salvar a tela com o campo mascarado ou vazio mantém o valor guardado.

## Backend

- **`backend/src/telefonia3c.ts`** — único ponto de acesso à API do 3C:
  - `credencialGestor(api, empresaId)` / `credencialAgente(api, empresaId, email)` → credencial com token, domínio e
    `agenteId`; resolve o id do agente pelo ramal e grava em `UserProfile.id_3cplus`.
  - `chamar3C(cred, path, opcoes)` / `fetch3C(cred, url, init)` → `Authorization: Bearer` + `X-Agent-Id`.
  - `Erro3C` / `respostaErro3C` → erros de configuração com status e mensagem claros.
- **As 22 funções de telefonia** (`backend/functions/*3CPlus/`) usam só esse módulo; nenhuma lê token direto nem
  monta `api_token` em URL.
- **`backend/src/ponte3c.ts`** — abre o socket do 3C no servidor e repassa os eventos pelo Socket.IO do VendaFlow
  (salas `telefonia:agente:<userId>` e `telefonia:gestor:<empresaId>`, com permissão por sala). Fecha a conexão com
  o 3C 60 s depois que a sala esvazia. Detalhes: [EVENTOS_SOCKET.md](EVENTOS_SOCKET.md#como-o-vendaflow-recebe-os-eventos).
- **`executarComando3CPlus`** — proxy das ações do softphone (login, pausa, discagem, qualificação, TPA...) e do
  comando `get-ramal-webrtc` (credenciais SIP do próprio agente).

## Frontend

- **Nenhum token do 3C no navegador.** `useTelefoniaConfig` só informa `agenteHabilitado`.
- **Eventos:** `socketPonte.js` (interface de socket.io-client sobre a ponte) → `useTelefoniaSocket` (agente) e
  `useTelefoniaSocketGestor` (monitoramento). Roteamento em `TELEFONIA_ENGINE.js`.
- **Ramal:** `RamalWebRTC.jsx` registra o ramal com JsSIP numa única aba ([RAMAL_WEBRTC.md](RAMAL_WEBRTC.md)).
- **Login na campanha** (`useTelefoniaActions.loginCampanha`): ramal registrado → `agent-connect` → `agent-login` →
  confirmação pelo socket (`agent-is-idle`); `agent-login-failed` → `LOGIN_FALHOU`;
  `reached-max-online-agents` → `LIMITE_AGENTES`.

## Configuração (tela Integrações → Telefonia)

1. Domínio: `oficinasmaster`.
2. Token de serviço — papel gestor.
3. Token de serviço — papel agente.
4. Em cada SDR: ramal 3C Plus no perfil.

## Pendências

1. **Teste do ramal com ligação real** — registro SIP, áudio e atendimento automático (checklist em
   [RAMAL_WEBRTC.md](RAMAL_WEBRTC.md#checklist-de-teste-com-ligação-real)). Precisa de um agente autorizado que não
   esteja em atendimento.
2. Confirmar o payload de `agent-schedule` (o swagger só documenta `agent`).
3. Legado: remover o suporte a token pessoal (`token_3cplus`, `mapeamento_agentes`) depois de 01/10/2026.
4. `sincronizarAgentes3CPlus` casa perfis pelo ramal sem filtrar por empresa (comportamento anterior à migração).
