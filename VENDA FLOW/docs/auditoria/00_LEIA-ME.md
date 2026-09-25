# Pacote de materiais para auditoria — VendaFlow CRM × 3C Plus

Montado em 25/09/2026 a partir do repositório https://github.com/vitoralbuquerque22-rgb/vendaFlow
(commit `1601bba`, pasta `VENDA FLOW/`). Os arquivos são **cópias**; a fonte da verdade é o repositório.
Nenhum segredo (tokens, `.env`) está incluído.

## Ordem de leitura (do essencial ao opcional)

O pacote inteiro tem ~830 mil caracteres (≈200 mil tokens) — não cabe de uma vez numa conversa.
Envie na ordem abaixo; os itens 1–5 (~120 mil caracteres) já permitem começar.

| # | Arquivo | Tamanho | O que é |
|---|---|---|---|
| 1 | `00_LEIA-ME.md` | pequeno | Este guia, o que não existe e o que já se sabe |
| 2 | `01_ARQUITETURA.md` | 8 KB | Arquitetura real: componentes, banco, autorização, eventos, funções públicas |
| 3 | `05_FLUXOS_CRITICOS.md` | — | Fluxos ponta a ponta rastreados no código (arquivo:linha), com pontos em aberto |
| 4 | `04_BANCO_REGRAS_DE_ACESSO.md` | 8 KB | Isolamento por empresa: regra de cada uma das 57 entidades |
| 5 | `02_INTEGRACAO_3CPLUS/docs/3cplus/INTEGRACAO_3CPLUS.md` e `EVENTOS_SOCKET.md`, `TOKENS_DE_SERVICO.md`, `RAMAL_WEBRTC.md`, `GUIAS.md` | ~60 KB | Contrato do 3C Plus + como o VendaFlow integra |
| 6 | `03_CODIGO_BACKEND_SRC.md` | 112 KB | Núcleo do servidor (acesso ao 3C, ponte de eventos, regras de acesso) |
| 7 | `03_CODIGO_FRONTEND_TELEFONIA.md` | 238 KB | Quem processa os eventos do 3C (o navegador) |
| 8 | `03_CODIGO_FUNCOES.md` | 331 KB | 47 funções de backend (3C Plus, leads, distribuição, automações) |
| 9 | `04_BANCO_ENTIDADES.md` | 141 KB | Schema SQL + definição das 57 entidades |
| 10 | `02_INTEGRACAO_3CPLUS/docs/3cplus/API_REFERENCIA.md`, `API_MODELOS.md`, `swagger.json` | ~380 KB | Referência completa da API do 3C (consulta pontual) |

As pastas `02_…/`, `03_CODIGO/` e `04_BANCO/` têm os mesmos arquivos soltos, na estrutura original do repositório,
para quem preferir anexar arquivo por arquivo.

## Três fontes — não confiar só na documentação

| Fonte | Arquivos | Papel |
|---|---|---|
| Documentação | `02_INTEGRACAO_3CPLUS/`, `01_ARQUITETURA.md` | O que deveria existir |
| Código | `03_*` | O que foi implementado |
| Banco/configuração | `04_*`, `03_CODIGO/docker-compose.yml`, `.env.example`, `deno.json` | O que sustenta a implementação |

A documentação de `docs/3cplus/` foi escrita em 25/09/2026 durante a migração, com testes contra a conta real do 3C;
os documentos `TELEFONIA_CONTRATO.md` e `RUNBOOK_TELEFONIA_3CPLUS.md` são anteriores (com notas de atualização).

## O que este sistema NÃO tem (para não procurar)

- Barramento de eventos, filas, workers, outbox, event log, retry automático, dead-letter, idempotência genérica.
- Tarefas agendadas (cron) — as do Base44 não foram migradas; o plano é usar n8n.
- Webhooks do 3C Plus configurados (o 3C oferece só `call-was-connected` e `call-history-was-created`).
- A ponte Node.js que alimentava `receberEvento3CPlus` (não existe mais).
- RLS, triggers, funções SQL, chaves estrangeiras ou migrations versionadas no Postgres (isolamento é em código).
- `workshop_id`: o tenant é `empresaId`.
- Documento de arquitetura/RFC anterior a esta migração.

## O que já se sabe (25/09/2026)

**Corrigido hoje (para conferir se a correção está certa):**
- Tokens do 3C iam para o navegador; qualquer SDR lia o token de gestor na entidade `Integracao` → agora mascarados;
  socket do 3C passou para o servidor.
- Token pessoal do 3C (descontinuado em 01/10/2026) → migrado para tokens de serviço + `X-Agent-Id`.
- Ligação manual era marcada como **atendida** (sessão `answered`, lead travado, histórico "Atendido via campanha")
  no momento da discagem, com o telefone ainda tocando → corrigido e validado com ligação real.
- Listagem de agentes do 3C lia só a 1ª página (25): agentes além do 25º eram ignorados → corrigido.
- `reached-max-online-agents` fazia o login "assumir conectado" → agora falha com `LIMITE_AGENTES`.

**Conhecido e não corrigido:**
- 48 das 57 entidades não têm regra de acesso (qualquer logado lê/grava registros de qualquer empresa).
- Funções públicas sem autenticação encontrada (ver `01_ARQUITETURA.md`).
- Eventos do 3C só são processados se o navegador do agente estiver aberto; nada persiste o evento.
- `sincronizarAgentes3CPlus` casa perfis pelo ramal sem filtrar por empresa.
- `finalizarLigacao3CPlus` executada por um admin age como o agente do admin, não do SDR da sessão.
- Payload de `agent-schedule` não documentado (só `agent`).
- ~5.900 avisos de tipo do `checkJs` nos arquivos `.js` (não impedem build nem testes).

## Validação real já feita (25/09/2026)

Com autorização: agente ramal 909, campanha "[TESTE CRM - DELETAR] 2026-05-20T19:31:46.065Z" (id 267781),
discagem manual para número do responsável:
registro SIP (`registered`) → `agent-connect`/`agent-login` → `agent-is-idle` → `iniciarDiscagemManual3CPlus` →
`call-was-connected` (call_mode=manual, sem `answered_time`) → `manual-call-was-answered` (com `answered_time`) →
`end-call` → `call-was-finished` (status 7) → `acw-exit` → `agent-logout` → `agent-was-logged-out`.

Campos de `call` observados nessa ligação (complementa os pontos marcados "não verificado" em `05_FLUXOS_CRITICOS.md`):
- `call-was-connected` (manual): `agent, call_mode, campaign_group_id, campaign_id, company_id, connected_time,
  dialed_time, id, identifier, mailing_id, phone, route_id, sid, status, telephony_id` — sem `answered_time`.
- `manual-call-was-answered`: os mesmos campos **+ `answered_time`**; `call_mode: manual`, `status: 3`.
- `call-was-finished`: + `hangup_cause, hangup_cause_color, hangup_cause_txt, hangup_time`; `status: 7`.
- `call-history-was-created`: histórico completo em `callHistory` (não em `call`).

## Conferência por amostragem de `05_FLUXOS_CRITICOS.md`

Duas afirmações graves foram conferidas no código e estão corretas:
- `finalizarLigacao3CPlus:546`, `retryGravacoes3CPlus:109` e `receberEvento3CPlus:209` chamam
  `${protocolo}//${host}/functions/processarGravacao3CPlus` — **sem `/api`**; o servidor só atende `/api/functions/…`.
- `webhookReceberLead:100` envia `BRIDGE_WEBHOOK_SECRET` e `distribuirLead:10` confere `INTERNAL_API_SECRET`;
  no `.env` local os dois valores são diferentes.
