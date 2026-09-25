# 05 — Fluxos críticos do VendaFlow (rastreados no código)

Descrição do que o código faz **hoje** em cada fluxo crítico: passo a passo com `arquivo:linha`, entidades e campos lidos/gravados, chamadas à API do 3C Plus e eventos de socket esperados. Ao fim de cada fluxo há os **pontos em aberto observados**: fatos em que o código não fecha (função chamada que não existe, campo gravado que ninguém lê, evento esperado que ninguém emite, passo que depende de agendamento inexistente etc.), sempre com evidência. "Não encontrei" indica onde se procurou; "não existe" só é usado quando o código prova a ausência.

- Base: repositório `VENDA FLOW/`, commit `1601bba` (branch `main`), lido em 25/09/2026. Todos os caminhos são relativos a essa pasta.
- Levantamento feito só por leitura de código. Nenhum arquivo do projeto foi alterado, o banco não foi consultado e nada foi executado contra o 3C Plus.
- O documento é descritivo: não classifica severidade nem propõe correções.
- Contexto de operação (informado, não verificável no código): o sistema veio do Base44; as tarefas agendadas (cron) do Base44 **não** foram migradas (o plano é usar n8n); a ponte antiga em Node.js que chamava `receberEvento3CPlus` **não existe mais**; os webhooks do 3C Plus (só existem `call-was-connected` e `call-history-was-created`) **não estão configurados**. Comportamento real da ligação manual validado em 25/09/2026: `call-was-connected` chega na discagem com `call_mode=manual` e sem `answered_time`; `manual-call-was-answered` chega quando o cliente atende, com `answered_time`; `call-was-finished` chega com status 7 no fim.

## Mapa dos fluxos

| # | Fluxo | Entrada | Funções/arquivos principais | Entidades |
|---|---|---|---|---|
| 1 | Entrada de lead → distribuição → Tarefa/Atividade | Webhooks públicos (`webhookReceberLead`, `receberLeadExterno`, `capturarLead`), landing page (`processarLeadLandingPage`), telas (`Leads.jsx`, `ImportarListaModal.jsx`); `importarLeadsCSV`, `processarDistribuicaoProgramada`, `redistribuirLeadsVencidos` sem chamador | `backend/functions/{webhookReceberLead, receberLeadExterno, capturarLead, processarLeadLandingPage, importarLeadsCSV, distribuirLead, processarDistribuicaoProgramada, redistribuirLeadsVencidos}`; `frontend/src/components/crm/ImportarListaModal.jsx`; `frontend/src/pages/DistribuicaoLeads.jsx` | Lead, Empresa, Tarefa, Atividade, RegraDistribuicao, ProgramacaoDistribuicao, VinculoEmpresa, UserProfile, Cadencia, FaturamentoLead, MarketingAttribution, LandingPage, RespostaDiagnostico, LeadScore |
| 2 | Login do agente na campanha (ramal, ponte, logout, F5, heartbeat) | Clique em campanha no `SeletorCampanha` (aba Campanhas de Leads) | `SeletorCampanha.jsx`, `Softphone3CPlus.jsx`, `RamalWebRTC.jsx`, `useTelefoniaActions.js`, `useTelefoniaAgent.js`, `useTelefoniaSocket.js`, `useTelefoniaHeartbeat.js`, `socketPonte.js`; `executarComando3CPlus`; `backend/src/{ponte3c,telefonia3c,realtime}.ts` | Integracao, UserProfile, Equipe, VinculoEmpresa (nenhuma entidade guarda o status do agente) |
| 3 | Ligação da campanha (discador) | Evento `call-was-connected` (dialer) pela ponte do agente | `TelefoniaContext.jsx` (`marcarLigacaoAtendida`, `finalizarLigacao`, `fecharModalAtendimento`), `ModalAtendimentoLead.jsx`; `finalizarLigacao3CPlus`, `buscarQualificacoes3CPlus`, `processarGravacao3CPlus`, `buscarGravacoes3CPlus`, `obterUrlGravacao3CPlus` | CallSession, Lead, Atividade, SpinResposta, Tarefa, GravacaoLigacao |
| 4 | Ligação manual | Teclado do softphone; "Ligar" no card de tarefa | `Softphone3CPlus.jsx`, `TelefoniaContext.jsx` (`iniciarLigacaoManual`, `ligarAgoraLead`, `hangupManualCall`), `ModalAtendimentoManual.jsx`; `iniciarDiscagemManual3CPlus`, `ligarAgoraLead3CPlus`, `iniciarLigacao3CPlus`, `executarComando3CPlus`, `finalizarLigacao3CPlus` | CallSession, Lead, Atividade, SpinResposta, Tarefa |
| 5 | Power dialer e click2call do gestor | Tela `PowerDialerControle` (Preview/Executar); teclado do softphone para gestor | `powerDialer3CPlus`, `gerenciarCampanha3CPlus`, `ligarAgoraLead3CPlus`; `PowerDialerControle.jsx`, `Softphone3CPlus.jsx` | Lead, CallSession, UserProfile, CampanhaVendaFlow, Integracao |
| 6 | Monitoramento do gestor | Páginas `MonitoramentoAoVivo` e `Tarefas` (`PainelSupervisor`) | `useMonitoramentoRealTime.js`, `useTelefoniaSocketGestor.js`, sala `telefonia:gestor:<empresaId>` (`ponte3c.ts`); `monitoramento3CPlus`, `acaoAgente3CPlus`, `buscarStatusAgentes3CPlus`; `PainelSpyMonitoramento.jsx` | Integracao, CallSession, Lead, VinculoEmpresa, UserProfile, Empresa, MonitoramentoLog, Tarefa, Atividade |
| 7 | Automações e alertas | Botões em `Automacoes.jsx` e `ConfiguracaoAlertas.jsx`; `LeadModal.jsx`, landing page e clique de e-mail (score); `enviarCampanhasAgendadas` sem chamador | `processarAutomacoes`, `verificarAlertas`, `enviarCampanhasAgendadas`, `calcularLeadScore` | AutomacaoRegra, LogAutomacao, Alerta, ConfiguracaoAlerta, ConfiguracaoMeta, CampanhaAgendada, EmailTemplate, EmailEnvio, LeadScore, Lead, Tarefa, Atividade, Empresa, User |
| 8 | Sincronizações 3C | `sincronizarAgentes3CPlus` por botão; as demais sem chamador | `sincronizarAgentes3CPlus`, `sincronizarTelefonia3CPlus`, `processarEventos3CPlus`, `receberEvento3CPlus`, `repairGravacoes3CPlus`, `retryGravacoes3CPlus`, `purgeGravacoes`, `limparGravacoesInvalidas` | UserProfile, Integracao, Atividade, Lead, CallSession, GravacaoLigacao, TranscriptionJob, LogAutomacao |

## Contagem de pontos em aberto

| Fluxo | Pontos em aberto |
|---|---|
| 1. Entrada de lead | 21 |
| 2. Login do agente | 19 |
| 3. Ligação da campanha | 27 |
| 4. Ligação manual | 22 |
| 5. Power dialer / click2call | 13 (5A: 8, 5B: 2, 5C: 3) |
| 6. Monitoramento do gestor | 17 |
| 7. Automações e alertas | 19 |
| 8. Sincronizações 3C | 39 (8.1: 6, 8.2: 7, 8.3: 5, 8.4: 7, 8.5: 4, 8.6: 4, 8.7: 5, 8.8: 3) |
| **Total** | **177** |

Alguns fatos aparecem em mais de um fluxo (ex.: o caminho sem `/api` do processamento de gravação, o limite de 50 registros). Nesses casos o ponto é contado em cada fluxo onde tem efeito.

## Convenções e fatos de infraestrutura usados em todos os fluxos

Os fluxos citam estes itens pelo rótulo (I1, I2…).

- **I1 — `filter()`/`list()` sem limite trazem no máximo 50 registros.** `listRecords` usa `limit = opts.limit || 50` (`backend/src/entities.ts:232`; o mesmo em `:362`), com ordenação padrão `-created_date` (`backend/src/query.ts:186`). Toda chamada `entities.X.filter(query)` sem o 3º argumento devolve só os 50 registros mais recentes.
- **I2 — `update()` faz merge raso.** `update records set data = data || $json` (`backend/src/entities.ts:295`). Uma chave com ponto, como `'configuracao.mapeamento_ramais'`, vira chave literal no primeiro nível; o objeto aninhado não é alterado.
- **I3 — `created_date` (e demais campos de sistema) são descartados ao gravar.** `SYSTEM_FIELDS` inclui `id`, `created_date`, `updated_date`, `created_by`, `created_by_id`, e `cleanData` os remove (`backend/src/entities.ts:133-139`).
- **I4 — Papel do usuário (`users.role`).** Usuários são criados com `role` `admin` ou `user` (`backend/src/auth.ts:160`, `:292`); `ADMIN_ROLES = {admin, super_admin}` (`backend/src/config.ts:50`). Não foi encontrado caminho que grave `role = 'gestor'` na tabela `users` (procurado `User.update`, `updateMe`, `inviteUser` com role em `frontend/src` e `backend/functions`). O papel "gestor/supervisor" do CRM fica em `UserProfile.role` ou `VinculoEmpresa.papel`.
- **I5 — Chamada interna para `/functions/...` não chega a uma função.** O roteador só atende `/api/functions/:name` (`backend/src/main.ts:102`); fora de `/api/` responde 404 (`backend/src/main.ts:179-181`). Além disso, o host usado nessas chamadas vem de `req.url`, que `invokeFunction` reescreve para `${PUBLIC_URL}/api/functions/<nome>` (`backend/src/functions.ts:63`); no `.env` e no `.env.example`, `PUBLIC_URL=http://localhost:5173` (porta do Vite, `backend/src/config.ts:17`), cujo proxy só repassa `/api` e `/socket.io` (`frontend/vite.config.js:24-26`).
- **I6 — `api.functions.invoke` no navegador devolve um envelope.** O retorno é `{ data, status, headers }` (`frontend/src/api/client.js:93`, `:244-247`); o corpo da função fica em `res.data`. Resposta não-2xx vira exceção `ApiError` (`client.js:89-92`).
- **I7 — A ponte do socket só repassa eventos.** `backend/src/ponte3c.ts:146` faz `socket.onAny → emitToRoom(sala, {evento, data})`. Não grava entidades e não chama nenhuma função (em especial, não chama `receberEvento3CPlus`). Salas: `telefonia:agente:<userId>` (credencial de agente) e `telefonia:gestor:<empresaId>` (credencial de gestor) (`ponte3c.ts:42-48`, `:72-82`); guard em `backend/src/main.ts:146-157` → `ponte3c.podeEntrar` (`:51-69`); a conexão com o 3C fecha 60 s depois que a sala esvazia (`ponte3c.ts:21`, `:166-173`). Sem buffer de eventos: o que chega com a sala vazia é perdido (`backend/src/realtime.ts:77-79`).
- **I8 — A camada de entidades não valida schema.** `createRecord`/`updateRecord` só aplicam `default` do `.jsonc` (`backend/src/entities.ts:210-215`) e as regras RLS; `required`, `enum` e campos não declarados não são verificados. Os dados ficam em `records.data` (jsonb).
- **I9 — Regras de acesso.** `api.entities.X` (cliente do usuário) aplica o bloco `rls` do `.jsonc`; `api.asServiceRole.entities.X` ignora (`backend/src/entities.ts:98`). Entidade **sem** bloco `rls` não tem restrição para usuário logado (`entities.ts:97-105`); é o caso, entre outras, de `CallSession`, `MonitoramentoLog`, `Alerta`. Sem login, só passa regra com `allow: true` (`:101-103`).
- **I10 — Despacho e autenticação das funções.** `backend/src/main.ts:102` encaminha qualquer método em `/api/functions/:name` para `invokeFunction` (`backend/src/functions.ts:57-76`). Não existe lista de funções públicas: o servidor sempre chama `getAuth(req)` (`functions.ts:59`) e cada função decide se exige usuário (`api.auth.me()`) ou segredo. `getAuth` (`backend/src/auth.ts:80-90`): sem `Authorization` → anônimo; `Bearer` que não seja JWT válido do sistema → 401 antes da função (`auth.ts:73`); JWT `typ: "service"` → contexto de serviço, com usuário opcional via header `on-behalf-of` (`auth.ts:84-87`). O emissor `serviceToken()` (`auth.ts:51-54`) não é chamado em nenhum lugar de `backend/src` ou `backend/functions`. SDK das funções (`backend/src/sdk.ts:29-43`): `list, filter, get, create, update, delete, deleteMany, bulkCreate, bulkUpdate, updateMany` — não há `read`. `api.functions.invoke` roda outra função no mesmo processo mantendo o usuário original (`sdk.ts:74`, `functions.ts:86-105`).
- **I11 — Agendamento.** Não há agendador no backend (procurado `Deno.cron`, `setInterval`, `cron`, `n8n` em `backend/src`, `backend/functions`, `docs`, `README.md`). `README.md:104` diz que as tarefas agendadas irão para o n8n chamando `POST /api/functions/<nome>`; não há configuração de n8n no repositório. Funções que exigem `user.role === 'admin'` via `auth.me()` recebem 403 numa chamada sem JWT de usuário admin.
- **I12 — Tempo real de entidades.** Todo create/update/delete emite `update_model` na sala `entities:<Entidade>` (`backend/src/entities.ts:271`, `:300`, `:342` → `backend/src/realtime.ts:82-88`). Só `admin`/`super_admin` entram nessas salas (`backend/src/main.ts:154`). No frontend não há `entities.X.subscribe(...)`; a única assinatura de sala é a de telefonia (`frontend/src/contexts/telefonia/socketPonte.js:86`).
- **I13 — Credenciais do 3C Plus** (`backend/src/telefonia3c.ts`). `credencialGestor` usa `Integracao.configuracao.token_gestor` (`:67-72`). `credencialAgente` (`:78-99`): com `configuracao.token_servico_agente`, usa token de serviço + `X-Agent-Id` = `UserProfile.id_3cplus`; se o id falta, resolve pelo ramal (`GET /agents` paginado com token de gestor) e **grava `UserProfile.id_3cplus`** (`:101-122`). Sem token de serviço, usa `UserProfile.token_3cplus` (token pessoal, válido até 01/10/2026) ou `configuracao.mapeamento_agentes[email]` (`:89-91`). `chamar3C` envia `Authorization: Bearer` e, havendo agente, `X-Agent-Id` (`:149-172`).
- **I14 — Variáveis de ambiente relevantes** (`.env` da raiz; valores não reproduzidos): `BRIDGE_WEBHOOK_SECRET` e `INTERNAL_API_SECRET` estão preenchidas com valores **diferentes** (`.env:41-42`); `OPENAI_API_KEY` existe **vazia**; `PUBLIC_URL=http://localhost:5173` (`.env:13`). O ambiente de produção não foi verificado.

---

## 1. Entrada de lead → distribuição para SDR → Tarefa/Atividade

**Gatilho:**
- Sistemas externos fazendo `POST /api/functions/webhookReceberLead`, `/receberLeadExterno` ou `/capturarLead` (webhooks públicos). A única URL exibida no sistema é a de `webhookReceberLead` (`frontend/src/components/crm/LeadsExternos.jsx:79`); a configuração no sistema de origem é externa ao repositório.
- Visitante de landing page: `frontend/src/pages/LandingPagePublica.jsx:48` e `frontend/src/pages/LpDiagnosticoAutomotivo.jsx:57` chamam `processarLeadLandingPage`.
- Usuário logado criando lead pelo frontend (entidade direta): `frontend/src/pages/Leads.jsx:288`, `frontend/src/components/crm/ExecutarAtividadeModal/CriarLeadRapidoModal.jsx:32`, importação `frontend/src/components/crm/ImportarListaModal.jsx:69`.
- `importarLeadsCSV`, `processarDistribuicaoProgramada`, `redistribuirLeadsVencidos`: **nenhum chamador** no frontend nem no backend (grep pelo nome em `frontend/src`, `backend/src`, `backend/functions`, `extension`, `docs`). Dependiam de cron/chamada manual; não há cron configurado.
- `distribuirLead`: único chamador é `webhookReceberLead` (`backend/functions/webhookReceberLead/entry.ts:98-105`), via HTTP.

**Passo a passo:**

**1a. `webhookReceberLead`** (`backend/functions/webhookReceberLead/entry.ts`)
1. `:18-20` só aceita `POST`. `:22-27` corpo precisa ser JSON. `:30` exige `nome` e `telefone`.
2. `:35-43` `empresaId` vem do body ou de `?empresaId=`; obrigatório.
3. Autenticação `:46-67`: lê `webhook_token` do body ou query; busca `Empresa` por id (service role, `:51`). Se a empresa **tiver** `webhook_token`, ele precisa bater (`:63-66`, senão 401). Se a empresa **não tiver** `webhook_token`, aceita o lead só com o `empresaId` (`:61-62`). Não usa `auth.me()`.
4. `:72-74` `origem` (default `'outro'`), `app_origem` (default `'webhook_externo'`), `campanha` — body > query > default.
5. `:81-95` cria `Lead` (service role): `empresaId`, `nome`, `telefone`, `email`, `empresa`, `cargo`, `origem`, `campanha`, `observacoes`, `status:'novo'`, `fonte_externa:true`, `app_origem`, `campos_personalizados`. **Sem deduplicação** (não consulta leads existentes).
6. `:98-108` distribuição: faz `fetch` HTTP para `req.url` com o último segmento trocado por `/distribuirLead` (ou seja, `${PUBLIC_URL}/api/functions/distribuirLead`), header `X-Internal-Secret` = env `BRIDGE_WEBHOOK_SECRET`, body `{lead_id}`. Só erro de rede é capturado; o status HTTP da resposta não é verificado.
7. `:111-128` se vier `revenue`/`faturamento`, cria `FaturamentoLead` (`lead_id`, `empresaId`, `revenue_amount`, `observacao`, `source:'api'`). Texto não numérico vira `revenue_amount: 0` com o texto na observação.
8. `:130-167` se houver dados de atribuição/UTM, cria `MarketingAttribution` (campos UTM, `gclid`, ids de campanha/anúncio, `first_touch`/`last_touch`/`captured_at`).
9. `:169-175` responde 201 `{success, lead_id}`.

**1b. `receberLeadExterno`** (`backend/functions/receberLeadExterno/entry.ts`)
1. `:17-19` só `POST`; `:28-31` `empresaId` (ou `empresa_id`) só no body.
2. Autenticação `:40-51`: `webhook_token` (body ou query) **obrigatório**; se a `Empresa` não tiver `webhook_token` configurado → 403 (`:46-48`); se não bater → 401.
3. `:53-69` cria `Lead` com aliases em inglês (`name`, `phone`, `company`, `source`, `campaign`…), `nome` default `'Sem nome'`, `telefone` default `''`, `status:'novo'`, `fonte_externa:true`, `app_origem` default `'externo'`. Sem deduplicação.
4. **Não chama `distribuirLead`**, não cria Tarefa nem Atividade. Responde 201 `{success, id}`.

**1c. `capturarLead`** (`backend/functions/capturarLead/entry.ts`)
1. `:3-17` rate limit em memória: 30 requisições / 60 s por IP (`x-forwarded-for` ou `cf-connecting-ip`); aplicado em `:48`.
2. `:63-68` exige `nome|name` e `telefone|phone`; `:72-78` `empresaId` do body ou query.
3. Autenticação `:85-93`: igual ao `webhookReceberLead` — token só é exigido se a empresa tiver `webhook_token`.
4. Deduplicação `:97-124`: telefone normalizado para só dígitos (`:97`); busca `Lead` por `{empresaId, telefone}` (`:105`). Se existir, só preenche campos vazios (`email`, `empresa`, `cidade`, `cargo`, `campanha`) (`:113-124`). Se não existir, cria `Lead` (`:127-147`) com `status:'novo'`, `fonte_externa:true`, `app_origem = source` (default `'landing_page'`), `cidade`, `estado`, `tem_socios`, `ja_cliente`.
5. `:152-166` cria `FaturamentoLead` se `revenue` normalizado > 0.
6. `:173-180` cria `Atividade` `tipo:'anotacao'`, `resultado:'outro'` com descrição da captura (sem `sdr_email`).
7. **Não chama `distribuirLead`** e não cria Tarefa. Responde 201 (novo) ou 200 (existente).

**1d. `processarLeadLandingPage`** (`backend/functions/processarLeadLandingPage/entry.ts`)
1. Sem verificação de usuário, token ou rate limit (o arquivo não chama `auth.me()` nem lê token). Lê `{landingPageId, formData, respostas}` (`:6`).
2. `:9-18` busca `LandingPage` por `{slug: landingPageId, ativa: true}` (service role); pega a primeira. O `empresaId` do lead é o da landing page (`:30`).
3. Deduplicação `:21-26`: só por `{email, empresaId}` e só quando `formData.email` existe.
4. `:29-48` se existe, faz `Lead.update` com todo o `leadData` (inclui `status:'novo'`, `origem:'landing_page'`, `campanha: lp.titulo`, `fonte_externa:true`, `nome`, `telefone`, `respostas_formulario`); senão cria `Lead` com os mesmos campos.
5. `:51-58` soma `peso_score` das perguntas com resposta em `respostas[index]`.
6. `:67-74` cria `RespostaDiagnostico` (`landing_page_id`, `landing_page_titulo`, `lead_id`, `dados_basicos`, `respostas`, `pontuacao_diagnostico`).
7. `:77-82` atualiza `LandingPage.total_conversoes` e `taxa_conversao`.
8. `:85-89` chama `calcularLeadScore` via `api.asServiceRole.functions.invoke`; erro é só logado.
9. **Não chama `distribuirLead`**, não cria Tarefa nem Atividade.
- A página `LandingPagePublica` antes carrega a LP via `buscarLandingPagePublica` (`frontend/src/pages/LandingPagePublica.jsx:35`), que incrementa `LandingPage.total_visitas` (`backend/functions/buscarLandingPagePublica/entry.ts:22-24`).

**1e. Importação CSV**
- **Função `importarLeadsCSV`** (`backend/functions/importarLeadsCSV/entry.ts`): exige `user.role === 'admin'` (`:6-9`); recebe `{csvUrl, empresaId, offset, batchSize=300}`; faz `fetch(csvUrl)` (`:19`); separa por `\n` e `,` (`:21-27`, sem tratar aspas); monta leads `{empresaId, nome, telefone, email, status:'novo', origem:'lista_fria', fonte_externa:false}` (`:33-41`); `Lead.bulkCreate` service role (`:46`). Sem deduplicação, sem distribuição, sem Tarefa. Nenhum chamador encontrado.
- **Importação real usada pela tela** (`frontend/src/components/crm/ImportarListaModal.jsx`, aberto em `frontend/src/pages/Leads.jsx:1203`): lê o arquivo no navegador; cada linha vira `{nome: col0, telefone: col1||col2, empresa: col1, email: col3, origem:'lista_fria'}` (`:186-193`); cria cada lead com `api.entities.Lead.create` (`:69`); depois, round-robin no navegador entre os SDRs escolhidos: `Lead.update` com `sdr_responsavel`, `closer_responsavel` e, se houver cadência, `status:'em_cadencia'`, `cadencia_id`, `dia_cadencia:1`, `data_inicio_cadencia` (`:74-90`); cria uma `Tarefa` por etapa da cadência (`:94-109`) com `empresaId: dados.leads[0].empresaId`.

**1f. `distribuirLead`** (`backend/functions/distribuirLead/entry.ts`)
1. Autorização `:9-18`: usuário com `role` `admin` ou `gestor`, **ou** header `X-Internal-Secret` igual à env `INTERNAL_API_SECRET`.
2. `:21-31` exige `lead_id`; se o lead já tem `sdr_responsavel`, retorna sem fazer nada.
3. `:36-37` pega a primeira `ProgramacaoDistribuicao` com `{empresaId, ativa:true}`.
4. `:40-48` pega `RegraDistribuicao` `{ativa:true, empresaId}`, ordena por `prioridade` e escolhe a primeira cujo `tipo` bata: `campanha` (== `lead.campanha`) ou `origem` (== `lead.origem`).
5. `:53-76` elegibilidade por papel: lê `VinculoEmpresa {empresaId, status:'ativo'}` (papel por e-mail) e `UserProfile {empresaId}` (`modo_ativo`). E-mail sem vínculo = elegível; `supervisor` só se `modo_ativo === 'closer'`; `sdr|closer|cs|social_seller|gestor|admin` elegíveis.
6. `:79-108` round-robin a partir de `ultimo_indice_fila`, pulando inelegíveis. Se há regra aplicável, usa `regra.sdrs_atribuidos` e grava `RegraDistribuicao.ultimo_indice_fila`; senão (`else if`) usa a programação e grava `ProgramacaoDistribuicao.ultimo_indice_fila`.
7. `:110-112` sem SDR → responde 200 "Nenhum operador disponível".
8. `:117-121` `Lead.update`: `sdr_responsavel`, `data_atribuicao`, `status` (mantém `'novo'` se `fonte_externa`).
9. `:123-136` cria `Tarefa` `tipo:'ligacao'`, `data_prevista: hoje`, `periodo:'manha'`, `status:'pendente'`, `cadencia_id`, `campanha`, `observacao` "LEAD URGENTE" se externo.
10. `:138-168` se houver `cadencia_id`: `Lead.update` (`status:'em_cadencia'`, `cadencia_id`, `dia_cadencia:1`, `data_inicio_cadencia`) e cria uma `Tarefa` por etapa com `dia != 1` (`data_prevista = hoje + dia-1`, `tipo`, `periodo`, `dia_cadencia`, `script_id`).
11. Não cria `Atividade`. Não usa `closer_padrao` nem `modo_distribuicao`.

**1g. `processarDistribuicaoProgramada`** (`backend/functions/processarDistribuicaoProgramada/entry.ts`)
1. `:7-10` exige `role` `admin` ou `super_admin`.
2. `:13` lista `ProgramacaoDistribuicao {ativa:true}` de todas as empresas.
3. Para cada: `:23` ignora se antes de `data_inicio`; `:25-28` se passou `data_fim` → `status:'concluida', ativa:false`; `:30-32` `aguardando` → `em_andamento`; `:35` ignora se não tem `empresaId`.
4. `:38-46` lê `Lead {empresaId}` e filtra sem `sdr_responsavel` + `filtro_leads.status/origem/campanha`.
5. `:52-81` round-robin simples (sem checar elegibilidade) até `prog.total_leads` ou todos os disponíveis: `Lead.update` (`sdr_responsavel`, `data_atribuicao`) e `Tarefa.create` (`ligacao`, hoje, manhã, `cadencia_id` da programação). Não aplica as etapas da cadência nem muda `status` do lead para `em_cadencia`.
6. `:84-88` grava `ultimo_indice_fila`, `ultima_execucao`, `leads_distribuidos_total`.

**1h. `redistribuirLeadsVencidos`** (`backend/functions/redistribuirLeadsVencidos/entry.ts`)
1. `:10-13` exige `admin`/`super_admin`. `:18-24` empresa = `payload.empresaId` ou `user.empresaAtualId`; só se ambos faltarem, pega todas as empresas com programação ativa.
2. `:35-37` exige `ProgramacaoDistribuicao {empresaId, ativa:true}` com `sdrs_atribuidos`; usa a fila dela.
3. `:50-70` lê `Atividade {empresaId}` (última por lead), `Tarefa {empresaId, status:'pendente'}`, `Lead {empresaId}`; elegíveis = com `sdr_responsavel` e status fora de `desqualificado|sem_interesse|cliente|venda_sucesso|perdido`.
4. `:112` pula lead redistribuído há < 24 h.
5. Condições: `:120` externo sem nenhuma atividade há > 2 h → `urgente_sem_toque`; `:127-136` última atividade há > 24 h com resultado `nao_atendeu|ocupado|caixa_postal` → `retentativa_24h`; `:140-145` tarefa `ligacao` pendente com `data_prevista < hoje` → `retorno_vencido`.
6. `redistribuir` `:73-107`: todas as tarefas pendentes do lead → `status:'encerrada_automaticamente'`, `motivo_encerramento:'transferencia'`; `Lead.update` (`sdr_responsavel` = próximo da fila, `redistribuicoes_count+1`, `redistribuido_em`, `motivo_redistribuicao`, `data_atribuicao`); cria 1 `Tarefa` `ligacao` hoje com observação "Redistribuído automaticamente".
7. `:155-158` grava `ultimo_indice_fila` e `ultima_execucao` na programação.

**1i. Pós-entrada no frontend (fila de externos):** `frontend/src/components/crm/LeadsExternos.jsx:40` lista `Lead {empresaId, fonte_externa:true}`; "importar" (`:56-70`) faz `Lead.update` com `fonte_externa:false` + `campos_personalizados.importado_em` e cria `Atividade` `anotacao` com `sdr_email` do usuário. Não distribui nem cria Tarefa.

**Estados/campos que mudam:**
- `Lead`: criado com `status:'novo'`, `fonte_externa:true` (webhooks/LP) ou `false` (CSV); `sdr_responsavel`, `data_atribuicao` (distribuição); `status:'em_cadencia'`, `cadencia_id`, `dia_cadencia`, `data_inicio_cadencia` (com cadência); `redistribuicoes_count`, `redistribuido_em`, `motivo_redistribuicao` (redistribuição); `respostas_formulario` (LP).
- `Tarefa`: criada `status:'pendente'`; antigas → `encerrada_automaticamente` / `motivo_encerramento:'transferencia'`.
- `Atividade` (`anotacao`): criada por `capturarLead` e pela importação da fila de externos.
- `RegraDistribuicao.ultimo_indice_fila`; `ProgramacaoDistribuicao.ultimo_indice_fila`, `status` (`aguardando→em_andamento→concluida`), `ativa`, `ultima_execucao`, `leads_distribuidos_total`.
- `FaturamentoLead`, `MarketingAttribution`, `RespostaDiagnostico`, `LandingPage.total_visitas/total_conversoes/taxa_conversao`, `LeadScore` (se o cálculo rodar).

**Eventos de socket/realtime envolvidos:**
- Cada create/update acima emite `update_model` em `entities:Lead`, `entities:Tarefa`, `entities:Atividade`, `entities:RegraDistribuicao`, `entities:ProgramacaoDistribuicao`, `entities:FaturamentoLead`, `entities:MarketingAttribution`, `entities:RespostaDiagnostico`, `entities:LandingPage` (`backend/src/entities.ts:271, 300`). Salas restritas a admin (`main.ts:154`); nenhum componente do frontend assina salas de entidade (grep por `.subscribe(`). As telas atualizam por `invalidateQueries`/refetch.

**Pontos em aberto observados:**
1. **Segredo divergente entre `webhookReceberLead` e `distribuirLead`:** o webhook envia `X-Internal-Secret = BRIDGE_WEBHOOK_SECRET` (`webhookReceberLead/entry.ts:100`) e `distribuirLead` compara com `INTERNAL_API_SECRET` (`distribuirLead/entry.ts:10`). No `.env` da raiz as duas variáveis têm valores diferentes (`.env:41-42`; valores não reproduzidos aqui). Sem usuário, `distribuirLead` responde 401 (`:16-18`) e o webhook não verifica o status (`webhookReceberLead/entry.ts:101-108`).
2. **Destino HTTP da distribuição:** o `fetch` vai para `${PUBLIC_URL}/api/functions/distribuirLead` (reescrita em `backend/src/functions.ts:63`). No `.env` e no `.env.example`, `PUBLIC_URL=http://localhost:5173` (porta do Vite); no `docker-compose.yml:29-45` a API roda em container, onde `localhost:5173` é o próprio container. Não testei em execução.
3. **Somente `webhookReceberLead` dispara distribuição.** `receberLeadExterno`, `capturarLead`, `processarLeadLandingPage`, `importarLeadsCSV` e a criação manual (`frontend/src/pages/Leads.jsx:288`) não chamam `distribuirLead` nem criam Tarefa (procurei `distribuirLead` em `frontend/src`, `backend/src`, `backend/functions`).
4. **`ProgramacaoDistribuicao` é criada sem `empresaId`:** a única criação é `frontend/src/components/crm/ProgramarDistribuicaoModal.jsx:96-107` (campos gravados não incluem `empresaId`; o `.jsonc` também não declara `empresaId`). Consumidores dependem dele: `distribuirLead/entry.ts:36` filtra `{empresaId, ativa:true}`; `processarDistribuicaoProgramada/entry.ts:35` pula programação sem `empresaId`; `redistribuirLeadsVencidos/entry.ts:23, 35` filtra por `empresaId`.
5. **Campos de `ProgramacaoDistribuicao` lidos/gravados que não existem no `.jsonc`** (`backend/entities/ProgramacaoDistribuicao.jsonc`): `ultimo_indice_fila`, `total_leads` (lido em `processarDistribuicaoProgramada/entry.ts:55`), `leads_distribuidos_total` (`:87`). Campos gravados pelo modal que nenhuma função lê: `leads_por_dia_por_sdr`, `closer_padrao`, `filtro_leads.sem_sdr`, `total_leads_disponiveis` (grep em `backend/functions`).
6. **`RegraDistribuicao.jsonc` não declara `empresaId`**, mas a tela grava (`frontend/src/pages/DistribuicaoLeads.jsx:780`) e `distribuirLead/entry.ts:40` filtra por ele. O fallback `|| !r.empresaId` (`:41`) nunca recebe regras sem `empresaId`, pois o filtro da consulta já as exclui. `modo_distribuicao` e `closer_padrao` são gravados pela tela e não são lidos por `distribuirLead`.
7. **Regra casada sem SDR elegível não cai na programação:** o `else if` (`distribuirLead/entry.ts:94-108`) só usa a programação quando não há regra aplicável com SDRs.
8. **Papéis verificados que não existem nos enums:** `distribuirLead/entry.ts:53, 74` testa `supervisor`, `cs`, `social_seller`; `VinculoEmpresa.papel` aceita `admin|gestor|sdr|closer` (`backend/entities/VinculoEmpresa.jsonc`). `UserProfile.jsonc` não declara `empresaId`, filtrado em `:63` (os criadores gravam, ex.: `backend/functions/autoAssignProfile/entry.ts:45`).
9. **Autorização de `distribuirLead` por papel `gestor`:** usuários nascem `admin` ou `user` (`backend/src/auth.ts:160, 292`). Não encontrei no frontend nenhuma chamada direta a `distribuirLead`.
10. **`ImportarListaModal` cria leads sem `empresaId`:** o objeto do lead (`ImportarListaModal.jsx:186-193`) não tem `empresaId`. `Lead` não tem regra RLS de `create` (`backend/entities/Lead.jsonc`), então a criação passa. Já o `Lead.update` seguinte e a `Tarefa.create` usam RLS `data.empresaId = user.empresaAtualId` (`Lead.jsonc`, `Tarefa.jsonc`); a Tarefa recebe `empresaId: dados.leads[0].empresaId` (`:99`), que é `undefined`. O mapeamento de colunas usa `values[1]` como `telefone` e como `empresa` ao mesmo tempo (`:189-190`).
11. **`importarLeadsCSV`, `processarDistribuicaoProgramada`, `redistribuirLeadsVencidos` não têm chamador** (grep em `frontend/src`, `backend/src`, `backend/functions`, `extension`, `docs`) e exigem usuário admin via `auth.me()` (`importarLeadsCSV:6-9`, `processarDistribuicaoProgramada:7-10`, `redistribuirLeadsVencidos:10-13`). Uma chamada agendada (n8n) sem JWT de usuário admin recebe 403. Não existe emissor de token de serviço (`auth.ts:51` sem uso).
12. **Limite de 50 registros:** `processarDistribuicaoProgramada/entry.ts:38`, `redistribuirLeadsVencidos/entry.ts:50, 59, 67` e `distribuirLead/entry.ts:56, 63` consultam sem `limit` → no máximo os 50 mais recentes (`backend/src/entities.ts:232`).
13. **`receberLeadExterno` exige `webhook_token` na Empresa** (`:46-48`); `webhookReceberLead` e `capturarLead` aceitam sem token quando a empresa não tem um (`webhookReceberLead:61-67`, `capturarLead:91`). Não há tela que grave ou exiba `Empresa.webhook_token` (grep `webhook_token` em `frontend/src`: zero resultados); a URL mostrada em `LeadsExternos.jsx:79` não inclui token.
14. **Deduplicação inconsistente:** nenhuma em `webhookReceberLead`, `receberLeadExterno`, `importarLeadsCSV`, `ImportarListaModal`; `capturarLead` usa telefone só com dígitos (`:97`), enquanto os demais gravam o telefone como veio, então a comparação só casa com leads gravados no mesmo formato; `processarLeadLandingPage` usa só e-mail (`:21-26`).
15. **`processarLeadLandingPage` sobrescreve o lead existente** com `status:'novo'`, `origem`, `campanha`, `fonte_externa:true`, `nome`, `telefone` (`:29-45`), sem autenticação nem rate limit.
16. **Formato de `respostas` da LP automotiva:** `LpDiagnosticoAutomotivo.jsx:15-21` envia um objeto com chaves `ano, km, manutencao, pintura, intencao`, e a função lê `respostas[index]` numérico (`processarLeadLandingPage/entry.ts:54, 63`). Também depende de existir `LandingPage` com `slug:'diagnostico-automotivo'` e `ativa:true` (não verifiquei o banco).
17. **`Lead.respostas_formulario` não está declarado** em `backend/entities/Lead.jsonc`; é gravado por `processarLeadLandingPage:40` e lido por `calcularLeadScore:51`.
18. **`calcularLeadScore` chamado da LP retorna 401:** `processarLeadLandingPage:86` chama com `asServiceRole`, mas o `user` continua sendo o do visitante (normalmente anônimo) e `calcularLeadScore/entry.ts:6-9` exige `auth.me()`. O erro é só logado.
19. **Status `'cliente'`** usado no filtro de `redistribuirLeadsVencidos/entry.ts:70` não está no enum `Lead.status`.
20. **`FaturamentoLead.created_by: null`** (`webhookReceberLead:125`, `capturarLead:162`) é descartado, porque `created_by` é campo de sistema (`backend/src/entities.ts:133, 138`).
21. **Authorization inválido derruba webhooks:** se o sistema externo mandar `Authorization: Bearer <valor que não é JWT do VendaFlow>`, `getAuth` lança 401 antes da função (`backend/src/functions.ts:59` → `auth.ts:73, 89`).

---

## 2. Login do agente na campanha (inclui ramal WebRTC, ponte de socket, logout, restauração, heartbeat)

**Gatilho:**
- Caminho efetivo: aba "Campanhas" da página Leads → `SeletorCampanha` → clique numa campanha (`frontend/src/components/telefonia/SeletorCampanha.jsx:552` → `entrarCampanha`, `:166`).
- O botão "Entrar em campanha" do softphone **não** chama `entrarNaCampanha`: ele apenas redireciona para `/Leads#campanhas` (`frontend/src/components/telefonia/Softphone3CPlus.jsx:601-602`). A função `entrarNaCampanha` (`Softphone3CPlus.jsx:398-438`) existe, mas não é referenciada em nenhum outro ponto do arquivo (busca por `entrarNaCampanha` retorna só a declaração).
- Pré-carga no mount da aplicação: `TelefoniaProvider` (`frontend/src/Layout.jsx:439`), `RamalWebRTC` e `Softphone3CPlus` montados em `SoftphoneGlobal` (`frontend/src/Layout.jsx:263-285`, renderizado em `:543`).

**Passo a passo:**

### 2.0 Pré-condições carregadas no mount (antes do clique)

0a. `frontend/src/contexts/telefonia/useTelefoniaConfig.js:19-29` lê `UserProfile` (filtro `user_email`); `:38-41` lê `Integracao` (`empresaId`, `tipo:'telefonia'`, `ativa:true`, `configuracao.fornecedor==='3cplus'`). Monta `cfgTelefonia` (`:56-63`) com `dominio`, `agenteHabilitado` (= existe `id_3cplus` OU ramal OU `token_3cplus`, `:54`), `ramalAgente`, `campanhaId` (`campanha_id_padrao`), `integracaoId`. `empresaId` vem de `useEmpresaAtual` (`frontend/src/components/hooks/useEmpresaAtual.jsx:46`: impersonação em `localStorage.impersonated_empresa_id` para admin → `user.empresaAtualId` → primeiro `VinculoEmpresa` ativo).

0b. **Assinatura da sala do agente** — `frontend/src/contexts/telefonia/useTelefoniaSocket.js:50` calcula `chave = <user.id>:<integracaoId>` quando `agenteHabilitado`; `:64` chama `criarSocketPonte(salaAgente(user.id))` → sala `telefonia:agente:<userId>` (`frontend/src/contexts/telefonia/socketPonte.js:22-24`). Singleton global de módulo (`useTelefoniaSocket.js:18-27`, `:55-59`, `:149-151`); não desconecta no cleanup (`:153-155`).

0c. `socketPonte.js:86` → `api.realtime.subscribe(sala)` → `subscribeRoom` (`frontend/src/api/client.js:142-158`) → um único Socket.IO do navegador para o próprio backend (`client.js:111-134`: `io(window.location.origin, { path:'/socket.io/', transports:['websocket'], query:{ token: <JWT do CRM> } })`), que emite `join <sala>` ao conectar (`client.js:118-119`) ou na hora (`:146`).

0d. Backend — `backend/src/realtime.ts:52-64` recebe `join`: chama o guard (`backend/src/main.ts:146-157`), que para salas `telefonia:*` usa `ponte3c.podeEntrar` (`backend/src/ponte3c.ts:51-58`): sala de agente só se `<userId> === user.id`. Se aprovado: `socket.join`, contabiliza membros e chama `aoEntrar` (`main.ts:160-164`) → `ponte3c.aoEntrarNaSala` (`ponte3c.ts:72-82`).

0e. `ponte3c.ts:76-78`: para a sala de agente, `empresaId = user.data.empresaAtualId`; sem ele emite `__ponte:connect_error` "Usuário sem empresa selecionada". Com ele, `abrir()` (fila por sala, `:85-97`) → `abrirAgora` (`:99-149`): obtém `credencialAgente` (entidades lidas: `Integracao`, `UserProfile`; pode gravar `UserProfile.id_3cplus`), compara `chave = papel:origem:dominio:agenteId:token-mascarado` (`:113`); se já existe ponte igual, só reemite `__ponte:connect` para a sala (`:114-118`); senão abre `socket.io-client` para `THREEC_SOCKET_URL` (padrão `https://socket.3c.plus`, `:20`) com `query { token, agent_id? }` (`:121-130`).

0f. Repasse: `ponte3c.ts:146` `socket.onAny((evento,data) => emitToRoom(sala, {evento,data}))` — **todos** os eventos do 3C são repassados sem filtro. Ciclo de vida: `connect`→`__ponte:connect` (`:133-136`), `disconnect`→`__ponte:disconnect` (`:137-140`), `connect_error`→`__ponte:connect_error` (`:141-144`), `io.reconnect`→`__ponte:reconnect` (`:145`). `emitToRoom` (`backend/src/realtime.ts:77-79`) emite `update_model { room, data: JSON.stringify(payload) }`.

0g. Navegador: `client.js:122-130` despacha `update_model` aos listeners da sala; `socketPonte.js:86-118` traduz `__ponte:*` para `connect/disconnect/reconnect/connect_error` (reconnect só se já tinha conectado e estava desconectado, `:92-96`; `__ponte:reconnect` é ignorado, `:104`) e entrega os demais a `onAny` e aos handlers por nome.

0h. Fechamento: ao sair o último membro (`realtime.ts:31-42`), `aoEsvaziarSala` agenda fechar a conexão com o 3C após 60 s (`ponte3c.ts:21`, `:166-173`).

0i. **Registro do ramal no mount** — `Softphone3CPlus.jsx:106-130` lê `Integracao` e define `agenteHabilitado` local (retorna cedo para nível ≥ 4, `:109`). `:137-144`: se `extensaoInstalada` (resposta PONG/READY — o próprio `RamalWebRTC` emite `VENDAFLOW_EXTENSION_READY` em `RamalWebRTC.jsx:147` e responde `VENDAFLOW_PONG` em `:131`), envia `window.postMessage({type:'VENDAFLOW_SET_AGENT', config:{empresaId, dominio}})`.

0j. Restauração no mount — `frontend/src/contexts/TelefoniaContext.jsx:393-397` chama `restoreAgentState(cfgTelefonia.agenteHabilitado, true, dominio, empresaId)` (ver 2.4).

0k. `SeletorCampanha.jsx:74-164` (mount): lê `Integracao`, `UserProfile`, `Equipe` (`listarEquipes`); chama `executarComando3CPlus` `get-campaigns` → `GET /agent/campaigns` (`executarComando3CPlus/entry.ts:191-193`); filtra por `configuracao.campanhas_habilitadas`, `UserProfile.campanhas_permitidas` e `Equipe.campanhas_permitidas` (`:105-127`); chama `get-logged-campaign` → `GET /agent/loggedCampaign` (`entry.ts:168-176`, 422/404 → `{dados:null, nao_logado:true}`); se não logado e o contexto achava que estava, zera nome/flag e dispara `vendaflow:campanha-alterada {ativa:false}` (`:136-145`).
   - Para nível ≥ 4 o componente renderiza o painel de administração de campanhas (`SeletorCampanha.jsx:321`), que chama `get-all-campaigns` (`GET /campaigns?per_page=200`, `entry.ts:178-180`) e grava `Integracao.configuracao.campanhas_habilitadas` (`:288-307`).

### 2.1 Clique na campanha → máquina de login

1. `SeletorCampanha.jsx:166-176` — se já há `campanhaAtiva` diferente, bloqueia (aviso 4 s) e não loga.
2. `SeletorCampanha.jsx:181` → `useTelefoniaActions.loginCampanha(campanha.id, { dominio })` (`frontend/src/contexts/telefonia/useTelefoniaActions.js:63-112`).
   - 2a. `:66-69` trava reentrância (`loginEmAndamentoRef`) e `marcarLoginPending(true)` (`useTelefoniaAgent.js:57-60`: `loginPendingRef` + estado `loginPending`).
   - 2b. `:73` `window.postMessage({ type:'VENDAFLOW_SET_AGENT', config:{ empresaId, dominio } })`.
   - 2c. `:76` `aguardarRamalRegistrado(20000)` (`frontend/src/hooks/useRamalStatus.js:57-80`): primeiro `VENDAFLOW_GET_RAMAL_STATUS` com espera de 1,5 s (`:32-53`); se não registrado, espera `VENDAFLOW_RAMAL_REGISTERED` até 20 s. Falso → erro `RAMAL_NAO_REGISTRADO` (`useTelefoniaActions.js:77-79`).
3. **Ramal WebRTC** (`frontend/src/components/telefonia/RamalWebRTC.jsx`), montado em todas as páginas (`Layout.jsx:282`):
   - 3a. `:67-92` disputa a Web Lock `vendaflow-ramal-webrtc`; só a aba "dona" registra; outras abas conversam via `BroadcastChannel` (`:95-122`).
   - 3b. `:133-139` ao receber `VENDAFLOW_SET_AGENT`, guarda `{empresaId, dominio}` e repassa às outras abas.
   - 3c. `:152-161` na aba dona: `buscarCredenciais` (`:36-41`) → `executarComando3CPlus` comando `get-ramal-webrtc` → backend `entry.ts:205-224`: `GET /me?include=company` com a credencial de agente (Bearer + `X-Agent-Id`); exige `telephony_id` e `extension_password` (senão 409); responde `{ ramal:{ ws:'wss://vox-socket.3c.plus:4443', uri:'sip:<telephony_id>@<company.domain>.3c.plus', senha:<extension_password>, ramal, agente_id } }` com `Cache-Control: no-store`.
   - 3d. `:165-166` pede `getUserMedia({audio:true})`; `:169-209` cria `JsSIP.UA` (`register_expires: 30`), `registered` → `VENDAFLOW_RAMAL_REGISTERED` (`:179-182`, `:53-58`), `registrationFailed` → reintenta a cada 5 s até 10 vezes (`:184-192`), `newRTCSession` de entrada → `session.answer` automático e toca o áudio no `<audio>` (`:196-207`).
4. `useTelefoniaActions.js:82-86` — comando `agent-connect` → `POST /agent/connect` (form vazio) (`entry.ts:91-93`). Falha é só logada.
5. `useTelefoniaActions.js:89` — comando `agent-login` com `campanha_id` → `POST /agent/login` JSON `{ campaign: Number(campanha_id), mode: body.mode || 'dialer' }` (`entry.ts:96-101`). O front não envia `mode`. HTTP 204 → `{success:true, async:true}` (`entry.ts:245-248`); não-2xx → exceção no front.
6. `useTelefoniaActions.js:92` `aguardarConfirmacaoSocket(4000)` (`:36-57`): registra `socket.on` na ponte para sucesso `agent-is-idle | agent-is-free | agent-entered-manual | agent-entered-manual-mode` e falha `agent-login-failed | reached-max-online-agents`.
   - 6a. Sucesso → `{status:'connected'}` (`:93-96`).
   - 6b. `reached-max-online-agents` → erro `LIMITE_AGENTES` (`:97-99`); `agent-login-failed` → erro `LOGIN_FALHOU` (`:100-102`); em erro, `marcarLoginPending(false)` (`:107`).
   - 6c. Timeout de 4 s sem evento → `{status:'connected', warning:'sem_confirmacao_socket'}` (`:103-105`).
7. Em paralelo, o mesmo evento passa pelo roteador do contexto: `useTelefoniaSocket.js:72-142` → `rotaDoEvento` (`frontend/src/contexts/telefonia/TELEFONIA_ENGINE.js:131-171`). `agent-is-idle` tem rota `AGENTE` → `onEventoAgente(evento)` (`TelefoniaContext.jsx:420-423`) → `processarEventoAgente` (`useTelefoniaAgent.js:238-283`): `marcarLoginPending(false)`, `iniciarCronometroEstado('aguardando')`, `current3CSession.agentStatus='idle'` (`:240-247`). `agent-login-failed` → rota `LOGIN_FALHOU` → `onLoginFailed` só loga (`TelefoniaContext.jsx:424-431`) e `CallLifecycleManager.dispatch('RESET')` (`useTelefoniaSocket.js:106-108`, `TELEFONIA_ENGINE.js:181`); em `processarEventoAgente` é ignorado (`useTelefoniaAgent.js:275-281`).
8. Após `loginCampanha` resolver — `SeletorCampanha.jsx:184-190`: estado local `campanhaAtiva`, `telefonia.setNomeCampanhaAtiva(nome)`, `telefonia.setAgenteCampanhaAtiva(true)`, `window.dispatchEvent('vendaflow:campanha-alterada', {ativa:true, nome, id})`, toast.
   - 8a. Ouvintes de `vendaflow:campanha-alterada`: `Softphone3CPlus.jsx:147-160` (atualiza `campanhaAtiva` local, nome e `setAgenteCampanhaAtiva`) e `TelefoniaContext.jsx:665-676` (só age em `ativa === false`).
9. `SeletorCampanha.jsx:192-202` — **grava `UserProfile`**: `campanha_preferencial_id`, `campanha_preferencial_nome` (fire-and-forget).

### 2.2 Logout

10. Botão "Sair" — `SeletorCampanha.jsx:490` → `sairCampanha` (`:210-227`) ou `Softphone3CPlus.jsx:590` → `sairDaCampanha` (`:441-454`). Ambos chamam `useTelefoniaActions.sairDaCampanha` (`useTelefoniaActions.js:117-148`):
   - 10a. comando `agent-logout` → `POST /agent/logout` JSON `{}` (`entry.ts:103-105`).
   - 10b. espera `agent-was-logged-out` na ponte por 2,5 s (`useTelefoniaActions.js:129-142`); timeout → `{status:'assumed_offline'}`.
11. Limpeza de estado: `SeletorCampanha.jsx:215-220` (local, `setNomeCampanhaAtiva(null)`, `setAgenteCampanhaAtiva(false)`, `pararCronometroEstado()`, `telefonia.setCurrent3CSession?.(telefonia.SESSION_VAZIA)`, evento `campanha-alterada {ativa:false}`); `Softphone3CPlus.jsx:448-453` (idem sem `setCurrent3CSession`). O ouvinte do contexto (`TelefoniaContext.jsx:666-672`) zera `current3CSession`, `agenteCampanhaAtiva`, nome e cronômetro.
12. Evento `agent-was-logged-out` (inclusive quando vindo de deslogamento pelo gestor, ver Fluxo 6): rota `AGENTE` → `processarEventoAgente` (`useTelefoniaAgent.js:269-274`) zera cronômetro, `agenteCampanhaAtiva`, nome e `current3CSession`; `CallLifecycleManager` recebe `RESET` (`TELEFONIA_ENGINE.js:183`).

### 2.3 Restauração após recarregar a página (F5)

13. Não há persistência em `localStorage`/`sessionStorage` do estado de campanha (busca por `localStorage|sessionStorage` em `TelefoniaContext.jsx`, `contexts/telefonia/*`, `Softphone3CPlus.jsx`, `SeletorCampanha.jsx`: nenhuma ocorrência; o único `localStorage` no caminho é a impersonação em `useEmpresaAtual.jsx:16-21`). O estado é reconstruído consultando o 3C.
14. `TelefoniaContext.jsx:393-397` → `restoreAgentState` (`useTelefoniaAgent.js:148-207`): comando `get-logged-campaign` → `GET /agent/loggedCampaign` (`:164-168`); `normalize3CResponse` (`:21-26`) extrai `campaignId`/`campaignName` e devolve **sempre** `status:null, startedAt:null` (`:25`).
   - 14a. Com campanha: se a sessão local já está em outra campanha, ignora (`:174-180`); senão `_aplicarStatus3C('idle', {id,name}, null)` (`:181`) → `current3CSession = {connected:true, campaignId, campaignName, agentStatus:'idle', startedAt:null, elapsedSeconds:0}` (`:100-121`), `agenteCampanhaAtiva=true`, nome, cronômetro `aguardando` a partir de agora (`:123-130`) e `vendaflow:campanha-alterada {ativa:true}` (`:132-138`).
   - 14b. Sem campanha: só limpa se não houver sessão local conectada (`:185-193`).
15. `Softphone3CPlus.jsx:164-170` sincroniza `campanhaAtiva` local quando `current3CSession.connected` muda; `SeletorCampanha.jsx:63-72` sincroniza a campanha exibida.
16. Ramal após F5: `Softphone3CPlus.jsx:137-144` reenvia `VENDAFLOW_SET_AGENT` quando `extensaoInstalada && agenteHabilitado && dominioApp && empresaId` (não para nível ≥ 4). A sala de agente é reassinada pelo `useTelefoniaSocket` (0b); a ponte no backend sobrevive 60 s sem membros (0h).
17. Outros disparos de restauração: `socket 'reconnect'` → `onReconnect` + `reprocessarEstadoAgente` (`useTelefoniaSocket.js:66-70`); `visibilitychange` para visível → mesmo par (`useTelefoniaSocket.js:158-182`). `reprocessarEstadoAgente` dispara `vendaflow:reprocessar-agente` 3 vezes (0, 500, 1500 ms; `:192-199`), tratado em `TelefoniaContext.jsx:679-687` → `restoreAgentState(..., true, ...)` (concorrência barrada por `restoreInProgressRef`, `useTelefoniaAgent.js:152-153`).

### 2.4 Heartbeat

18. `TelefoniaContext.jsx:446-456` → `useTelefoniaHeartbeat` (`frontend/src/contexts/telefonia/useTelefoniaHeartbeat.js`). Roda a cada `TIMEOUTS.HEARTBEAT_INTERVAL` = 60 s (`TELEFONIA_ENGINE.js:246`) somente se aba visível, `empresaId`, `current3CSession.connected` e `socketRef.current.connected` (`useTelefoniaHeartbeat.js:19-24`, `:58-60`); ao voltar à aba roda na hora (`:63-73`).
19. Cada ciclo: comando `get-logged-campaign` (`:31-34`). Campanha 3C diferente da local → chama `_aplicarStatus3C?.(...)` (`:43-46`); campanha 3C vazia com local preenchida → só `console.warn` (`:48-50`).

**Estados/campos que mudam:**
- React (`useTelefoniaAgent`): `loginPending`/`loginPendingRef`, `current3CSession {connected, campaignId, campaignName, agentStatus, startedAt, elapsedSeconds}`, `agenteCampanhaAtiva`, `nomeCampanhaAtiva`, `estadoCampanha` ('aguardando'|'falando'|'tpa'|'idle'), `tempoEstado`, `agentStatus` ('em_pausa' em `agent-entered-work-break`).
- React local: `SeletorCampanha.campanhaAtiva`, `tentativaBloqueada`, `entrando`, `saindo`; `Softphone3CPlus.campanhaAtiva`, `erroCampanha`, `dominioApp`, `agenteHabilitado`.
- Refs de módulo: `_globalSocket/_globalChave` (`useTelefoniaSocket.js:18-19`); `RamalWebRTC` `registradoRef`, `configRef`, Web Lock, `BroadcastChannel`.
- `window` events: `VENDAFLOW_SET_AGENT`, `VENDAFLOW_GET_RAMAL_STATUS`/`VENDAFLOW_RAMAL_STATUS`, `VENDAFLOW_RAMAL_REGISTERED/UNREGISTERED`, `VENDAFLOW_PING/PONG/EXTENSION_READY`, `vendaflow:campanha-alterada`, `vendaflow:reprocessar-agente`.
- Backend (memória): `pontes` Map (`ponte3c.ts:33`), `membros` por sala (`realtime.ts:29`).
- Entidades: **gravadas** — `UserProfile.id_3cplus` (backend, só quando falta e há token de serviço, `telefonia3c.ts:119`); `UserProfile.campanha_preferencial_id/_nome` (`SeletorCampanha.jsx:197-200`); `Atividade` `tipo:'modo_manual'` ao sair do modo manual no softphone (`Softphone3CPlus.jsx:235-248`, lateral ao login). **Lidas** — `Integracao` (configuracao: `dominio`, `token_servico_agente`, `token_gestor`, `campanha_id_padrao`, `campanhas_habilitadas`, `mapeamento_*`), `UserProfile` (`ramal_3cplus`, `id_3cplus`, `token_3cplus`, `campanhas_permitidas`), `Equipe` (`membros`, `campanhas_permitidas`), `VinculoEmpresa` (fallback de empresa), `User.empresaAtualId`.
- Nenhuma entidade guarda status do agente/sessão de campanha (lista de `backend/entities/*.jsonc` verificada; nenhum campo de status online/campanha ativa).

**Eventos de socket envolvidos:**
| Evento | Emissor | Quem escuta (onde) |
|---|---|---|
| `join`/`leave` (Socket.IO do CRM) | `client.js:119`, `:146`, `:155` | `realtime.ts:52-74` |
| `update_model {room,data}` | `realtime.ts:78` | `client.js:122-130` |
| `__ponte:connect/disconnect/connect_error/reconnect` | `ponte3c.ts:116`, `:133-145`, `:77`, `:110` | `socketPonte.js:90-108` → `connect/disconnect/reconnect/connect_error` → `useTelefoniaSocket.js:66`, `:144-147` |
| `agent-is-idle` (e aliases `agent-is-free`, `agent-entered-manual[-mode]`) | 3C → ponte (`ponte3c.ts:146`) | `useTelefoniaActions.js:37,52` (confirmação login); `useTelefoniaSocket.js:121-122` → `useTelefoniaAgent.js:240-247` |
| `agent-login-failed` | 3C → ponte | `useTelefoniaActions.js:38,53`; `useTelefoniaSocket.js:114-117` → `TelefoniaContext.jsx:424-431` (log); `CallLifecycleManager` RESET |
| `reached-max-online-agents` | 3C → ponte | `useTelefoniaActions.js:38`; rota `AVISO_OPERACIONAL` → `TelefoniaContext.jsx:383-387` (toast suprimido durante login) |
| `agent-was-logged-out` | 3C → ponte | `useTelefoniaActions.js:140` (logout); `useTelefoniaAgent.js:269-274`; `CallLifecycleManager` RESET |
| Demais eventos 3C | 3C → ponte (sem filtro) | roteados por `TELEFONIA_ENGINE.rotaDoEvento` |

**Pontos em aberto observados:**
1. O botão "Entrar em campanha" do softphone só navega para `/Leads#campanhas` (`Softphone3CPlus.jsx:601-602`); `entrarNaCampanha` (`:398-438`) não é chamada em nenhum lugar do arquivo (procurei `entrarNaCampanha` em `Softphone3CPlus.jsx`).
2. Após login novo (sem F5), nada define `current3CSession.connected = true`: `processarEventoAgente('agent-is-idle')` só altera `agentStatus` (`useTelefoniaAgent.js:240-247`); o ouvinte de `campanha-alterada` no contexto só trata `ativa === false` (`TelefoniaContext.jsx:667`); `_aplicarStatus3C` só é chamado em `restoreAgentState` e `verificarAntesDeEntrar` (`useTelefoniaAgent.js:181`, `:228`). Consequências no código: o heartbeat exige `current3CSession.connected` (`useTelefoniaHeartbeat.js:22`) e não roda até uma restauração (F5, troca de aba, reconexão).
3. O heartbeat recebe `_aplicarStatus3C: undefined` (`TelefoniaContext.jsx:450`); a correção de campanha divergente em `useTelefoniaHeartbeat.js:45` vira no-op. `useTelefoniaAgent` também não exporta `_aplicarStatus3C` (retorno em `useTelefoniaAgent.js:292-306`).
4. `normalize3CResponse` devolve sempre `status:null` e `startedAt:null` (`useTelefoniaAgent.js:25`): após F5 o estado visual é sempre "aguardando" a partir do momento da restauração, independente do estado real no 3C, e o tick de `elapsedSeconds` não roda (exige `startedAt`, `:85`). O comentário "sobrevive a F5" (`:11`) não se verifica nesse caminho.
5. `useTelefoniaActions.restaurarEstadoAgente` e `listarCampanhas` leem `resp?.dados` (`useTelefoniaActions.js:156`, `:168`), mas `invoke` devolve `{data,...}` (`client.js:92`) — sempre `null`/`[]`. Nenhuma das duas é usada: `restaurarEstadoAgente` é desestruturada em `SeletorCampanha.jsx:43` e não chamada; `listarCampanhas` sem consumidores (busca em `frontend/src`). Também `if (resp?.error)` em `:29` nunca é verdadeiro porque erro HTTP vira exceção.
6. `loginCampanha` trata `agent-login-failed` como falha fatal (`useTelefoniaActions.js:100-102`), enquanto `useTelefoniaAgent.js:275-281` e `TelefoniaContext.jsx:424-431` tratam o mesmo evento como esperado/ignorável ("webphone:false").
7. O listener de confirmação é registrado só depois que `POST /agent/login` responde (`useTelefoniaActions.js:89-92`); um `agent-is-idle` entregue antes disso não é capturado e o fluxo cai no timeout otimista de 4 s (`:103-105`). `TIMEOUTS.LOGIN_CONFIRMATION` (15 s) e `LOGOUT_CONFIRMATION` (10 s) de `TELEFONIA_ENGINE.js:243-244` não são usados pelas ações (usam 4 s e 2,5 s).
8. `SeletorCampanha.jsx:219` chama `telefonia?.setCurrent3CSession?.(telefonia?.SESSION_VAZIA)`, mas o valor do contexto não expõe `setCurrent3CSession` nem `SESSION_VAZIA` (`TelefoniaContext.jsx:694-740`) — chamada no-op (a limpeza efetiva vem do evento `campanha-alterada`).
9. `Softphone3CPlus.campanhaAtiva` (`:28`) só muda via evento `campanha-alterada`, via mudança de `current3CSession.connected` (`:164-170`) ou pelos botões. Um `agent-was-logged-out` (ex.: gestor deslogou) quando `connected` já era `false` (ponto 2) não altera `connected` e não dispara `campanha-alterada` (`useTelefoniaAgent.js:269-274`), então o softphone continua exibindo "Em campanha".
10. `UserProfile.campanha_preferencial_id/_nome` são gravados (`SeletorCampanha.jsx:197-200`) e não são lidos em lugar nenhum (busca em `frontend/src` e `backend/`: só o schema `backend/entities/UserProfile.jsonc:99-106`).
11. `SeletorCampanha` declara `reconectando` (`:23`), usado na renderização (`:507`), mas `setReconectando` nunca é chamado (busca no arquivo).
12. A ponte do agente usa `user.data.empresaAtualId` (`ponte3c.ts:76`); o front usa `useEmpresaAtual`, que pode resolver a empresa por impersonação (`localStorage`) ou por `VinculoEmpresa` quando `empresaAtualId` está vazio (`useEmpresaAtual.jsx:46`). Nesses casos a ponte usa outra empresa ou emite `__ponte:connect_error` "Usuário sem empresa selecionada", enquanto os comandos HTTP usam o `empresaId` do front.
13. `executarComando3CPlus` não verifica se o usuário pertence a `body.empresaId`: carrega `Integracao` por `empresaId` com service role (`telefonia3c.ts:58`) e o perfil pelo e-mail do usuário (`entry.ts:69-71`). Não encontrei checagem de vínculo nesse arquivo nem em `credencialAgente`.
14. Guard negado em `join` retorna em silêncio (`realtime.ts:55`): o navegador não recebe erro e `socketPonte.connected` permanece `false` (sem `connect_error`).
15. O logout não desregistra o ramal: `RamalWebRTC` só trata `PING`, `SET_AGENT` e `GET_RAMAL_STATUS` (`RamalWebRTC.jsx:131-143`); não há mensagem de "unset" enviada por `sairDaCampanha` (`useTelefoniaActions.js:117-148`). O ramal segue registrado e com atendimento automático (`:196-207`).
16. Para nível ≥ 4 (gestor/admin), o softphone não carrega config nem envia `VENDAFLOW_SET_AGENT` (`Softphone3CPlus.jsx:109`, `:138`), e `SeletorCampanha` mostra só o painel admin (`:321`) — não há caminho de UI para esses papéis entrarem em campanha.
17. `verificarAntesDeEntrar` é exposto no contexto (`TelefoniaContext.jsx:708-709`) e desestruturado no softphone (`Softphone3CPlus.jsx:100`), mas não é chamado (busca em `frontend/src`).
18. Comando `get-ramal-webrtc` existe no backend (`entry.ts:205`) mas não está na lista `COMMANDS` do front (`TELEFONIA_ENGINE.js:225-239`) nem no comentário de comandos do backend (`entry.ts:13-31`) — é chamado por string literal em `RamalWebRTC.jsx:37`.
19. `restoreAgentState` recebe `cfgTelefonia.agenteHabilitado` (booleano) como parâmetro `token` (`TelefoniaContext.jsx:394-396`, `:406`, `:681-683`); `dominio` também é recebido e não é usado no corpo (`useTelefoniaAgent.js:148-207`).

---

## 3. Ligação da campanha (discador automático)

**Gatilho:** o agente está logado numa campanha do 3C. O discador completa uma chamada e o 3C a conecta ao agente. O socket do agente emite `call-was-connected` com `call.call_mode = dialer` (ou sem `call_mode`/`mode` = `manual`).

**Passo a passo:**

1. [`frontend/src/contexts/telefonia/useTelefoniaSocket.js:72-75`] `onAny` recebe o evento. `ramalConectadoManual` só é `true` quando a rota é ATENDIDA **e** `ehChamadaManual(data)` retorna verdadeiro. `ehChamadaManual` (`TELEFONIA_ENGINE.js:164-167`) testa `call.call_mode === 'manual' || call.mode === 'manual'` (em `data.call` ou `data.callHistory`). No discador o resultado é `false`.
   - 1a. [`useTelefoniaSocket.js:78-90`] É despachado para a máquina paralela `callLifecycle.dispatch('CONNECTED', { callId, uniqueId, qualifications, mailing, campaignId })`. Em `CallLifecycleManager.js:89-110` a transição é IDLE→ATENDIDA→EM_ATENDIMENTO (automática).
   - 1b. [`useTelefoniaSocket.js:134-137`] A rota ATENDIDA chama `onAtendimento(data, evento)`, ou seja, `marcarLigacaoAtendida` (`TelefoniaContext.jsx:402`). As rotas ATENDIDA são `call-was-connected`, `call-was-answered` e `call-answered` (`TELEFONIA_ENGINE.js:145`).

2. [`frontend/src/contexts/TelefoniaContext.jsx:88-106`] `marcarLigacaoAtendida` começa pelos guards:
   - retorna logo se `ligacaoAtendidaProcessandoRef` for `true` (`:89`);
   - se já existe `callSessionRef.current.id` e a origem não é `agent-is-connected`, limpa **somente o estado local** da sessão anterior: cronômetro, `callSession`, `leadCallStatus` e modal (`:92-102`);
   - marca o guard como `true` (`:106`). O guard só volta a `false` em `marcarLigacaoEncerrada`, `marcarLigacaoNaoAtendida`, `fecharModalAtendimento`, `finalizarLigacao` ou em caso de erro.

3. [`TelefoniaContext.jsx:132-137`, `frontend/src/lib/telefonia3cDados.js:50-83`] Sem sessão local (caso normal do discador), `extrairDadosCall3C(data)` normaliza o payload:
   - `telefone` = dígitos de `call.number || call.phone || mailing.phone` (`telefonia3cDados.js:57`);
   - `mailing` = `data.mailing_data || call.mailing_data || call.mailing` (`:54`);
   - `nome_mailing` vem de `mailing.data`/`fields` (chaves `nome`/`name`/`cliente`/`contato`) ou de `mailing.name` (`:16-32`);
   - também extrai `identifier`, `cpf`, `campanha_id`, `campanha_nome`, `protocolo` (`call.sid`), `gravacao_url` (`call.recording`), `qualification_list_id` e `qualificacoes` embutidas (`:60-82`).

4. [`TelefoniaContext.jsx:139-165`] **Identificação do lead: só pelo telefone.** São feitas até 3 consultas `listarLeadsPorTelefone(empresaId, tel)`, que é `Lead.filter({ empresaId, telefone })` com igualdade exata (`frontend/src/lib/services/leadService.js:91-94`):
   1. o número como veio;
   2. sem o `55` (se começa com 55 e tem 12 dígitos ou mais);
   3. com `55` na frente (se não começa com 55 e tem 10 dígitos ou mais).

   Usa o primeiro resultado (`[0]`). `identifier`, `cpf` e campos extras do mailing **não** entram na busca.
   - 4a. [`:158-162`] Se encontrou o lead, grava direto do navegador `Lead.update` com `is_locked_for_call: true`, `lock_agent_email: user.email` e `lock_at: now`, e ignora erro (`.catch(() => {})`). Não confere se o lead já estava travado e não grava `Lead.call_session_id`.

5. [`TelefoniaContext.jsx:167-186`] `criarCallSession(payload)` (`frontend/src/lib/services/telefoniaService.js:39-41` → `api.entities.CallSession.create`) grava `CallSession` com:
   - `empresaId`, `lead_nome`, `lead_telefone`, `sdr_email`, `campanha_id_3cplus`, `chamada_id_3cplus = call.id`;
   - `status: 'answered'`, `origem: 'campanha_automatica'`, `iniciada_em` e `atendida_em` (ambos = agora);
   - `spin_preenchido: false`, `gravacao_processada: false`, `gravacao_url: call.recording`;
   - `lead_id`, se identificado.

   O objeto `_info3c` fica apenas no objeto local. Se a criação falhar, libera o guard e retorna (`:206-210`).

6. [`TelefoniaContext.jsx:190-205`] Se o lead foi identificado, `criarAtividade` (`api.entities.Atividade.create`) grava:
   - `tipo: 'ligacao'`, `lead_id`, `lead_nome`, `lead_telefone`, `sdr_email`;
   - `call_session_id`, `chamada_id_3cplus`, `campanha`, `gravacao_url`;
   - `origem_sincronizacao: '3cplus'`, `observacao: "📞 Atendido via campanha …"`.

   Sem `resultado`. Erro é ignorado.

7. [`TelefoniaContext.jsx:212-228`] Faz `atualizarCallSession(id, { status: 'answered', atendida_em })` e atualiza o estado:
   - `callSession.status = 'answered'` (então `emLigacao = true`, `:61`), `leadCallStatus = 'em_ligacao'`, `modalAtendimentoAberto = true`;
   - `iniciarCronometroEstado('falando')`;
   - descarta qualquer `manualCallSession` pendente.

8. [`TelefoniaContext.jsx:233-271`] Qualificações do modal:
   - se o evento trouxe a lista, usa essa lista;
   - senão, chama `api.functions.invoke('buscarQualificacoes3CPlus', { empresaId, campaign_id, qualification_list_id })`, com timeout de segurança de 8 s. O backend escolhe a lista nesta ordem: `body.qualification_list_id`, depois `cfg.qualification_list_id`, depois a campanha (`GET /campaigns/{id}`), depois `/qualification_lists` (`backend/functions/buscarQualificacoes3CPlus/entry.ts:58-95`).

   Inicia o cronômetro de duração (`cronometroRef`, `:266-271`).

9. [`frontend/src/Layout.jsx:317` → `frontend/src/components/telefonia/ModalAtendimentoLead.jsx:30`] O modal é renderizado quando `modalAtendimentoAberto && callSession`. Ele usa `ModalAtendimentoBase` → `ExecutarAtividadeModal`. O `onSave` recebe `{...formData, lead_id_vinculado, tma_segundos, ...}` (`frontend/src/components/crm/ExecutarAtividadeModal/index.jsx:308-313`). O `qualification_id` é escolhido no wizard e pode ser `autoMatch.id ?? autoMatch.name` (`WizardEtapas.jsx:192`).
   - 9a. `handleSave` (`ModalAtendimentoLead.jsx:34-133`):
     - agendamento de próximo contato: `criarTarefa` + `Atividade` com `tipo: 'anotacao', resultado: 'agendamento'` (`:38-66`);
     - reunião: `Lead.update { status: 'reuniao_agendada', data_reuniao, closer_responsavel }` + `Tarefa` para o closer (`:68-102`);
     - desqualificado/sem interesse: encerra as tarefas pendentes (`:105-117`);
     - por fim chama `finalizarLigacao(resultado, spin, observacao, novoStatusLead, qualification_id)` (`:119-129`). `lead_id_vinculado` **não** é repassado ao `finalizarLigacao`.
   - 9b. Fechar/cancelar (`:32`) chama `fecharModalAtendimento` (`TelefoniaContext.jsx:318-355`):
     - se `origem === 'campanha_automatica'`, libera o lock do lead pelo navegador (`:321-327`);
     - se a sessão tem `chamada_id_3cplus`, chama `finalizarLigacao('outro', {}, 'Encerrada sem registro pelo agente')`, com `acw-exit` como fallback (`:333-339`); senão chama só `acw-exit` (`:340-343`);
     - limpa o estado local.
   - 9c. O botão "Hang up" do bloco de lead no softphone chama `finalizarLigacao('nao_atendeu', null, …)`, **tanto em `em_ligacao` quanto antes** (`frontend/src/components/telefonia/Softphone3CPlus.jsx:877-879`).

10. [`TelefoniaContext.jsx:549-582`] O `finalizarLigacao` do contexto chama `api.functions.invoke('finalizarLigacao3CPlus', { empresaId, call_session_id, resultado, spin, observacao, duracao_segundos: cronometroRef, novo_status_lead, qualification_id })`. Não envia `gravacao_url`.
    - Com resposta 2xx, limpa o estado local e libera o guard (`:572-578`).
    - Se `invoke` lança exceção (qualquer status diferente de 2xx, `frontend/src/api/client.js:90-91`), retorna `{ sucesso: false }` **sem** limpar o estado (`:579-581`).

11. [`backend/functions/finalizarLigacao3CPlus/entry.ts`] Etapas no backend:
    - 11a. [`:158-170`] Lê `CallSession.get(call_session_id)` (service role) e confere se `empresaId` bate.
    - 11b. [`:177-182`] Resolve a credencial do agente logado com `credencialAgente(api, empresaId, user.email)`. Se falhar, apenas pula as ações no 3C.
    - 11c. [`:185-197`] Se a sessão já está `finished`, faz só `POST /agent/manual_call_acw/exit` e `POST /agent/acw/exit` e retorna 200.
    - 11d. [`:203-235`] SPIN: com `origem === 'campanha_automatica'` não é exigido. Nos outros casos exige 3 de 5 campos, salvo quando o resultado está em `RESULTADOS_SEM_SPIN`; se faltar, responde 422 `SPIN_REQUIRED`.
    - 11e. [`:253-264`] `POST /agent/call/{chamada_id_3cplus}/hangup` (form vazio, 5 s). Falha não bloqueia.
    - 11f. [`:270-411`] Qualificação:
      - endpoint `POST /agent/call/{id}/qualify` para `campanha_automatica`/`power_dialer`, ou `/agent/manual_call/{id}/qualify` para as demais origens (`:272-274`);
      - `qualification_id` informado pelo agente é usado direto (`:278`, com `Number()`);
      - senão, mapeia o resultado para um nome (`RESULTADO_PARA_QUALIFICACAO_3C`, `:42-57`) e procura esse nome em `GET /qualification_lists/{cfg.qualification_list_id}/qualifications`, depois em todas as listas (`GET /qualification_lists` + N×`GET /qualification_lists/{id}/qualifications`), depois nos IDs negativos do sistema (`:69-74`);
      - fallback universal: 1ª qualificação da lista `type === 4`, ou da lista com "padr" no nome, ou da primeira lista (`:352-374`);
      - envia form `{ qualification_id, qualification_note }` (`:381-389`). Se a resposta não for ok, tenta o endpoint alternativo manual↔campanha (`:393-404`).
    - 11g. [`:418-436`] Saída do TPA: `POST /agent/manual_call_acw/exit` e `POST /agent/acw/exit`, sempre que há credencial.
    - 11h. [`:443-457`] `SpinResposta.create`, apenas se `exigeSpin && spin && lead_id` (então nunca na campanha automática).
    - 11i. [`:466-487`] Se `sessao.lead_id` existe, `Atividade.create` grava:
      - `tipo: 'ligacao'`, `resultado`, `duracao_segundos`, `observacao`;
      - `sdr_email`, `lead_id`, `lead_nome`, `lead_telefone`;
      - `chamada_id_3cplus`, `gravacao_url`, `tpa_segundos: 0`, `origem_sincronizacao: 'manual'`.

      Sem `call_session_id` e sem `campanha`. Se não há `lead_id`, nenhuma Atividade é criada.
    - 11j. [`:492-520`] `Lead.update` grava `is_locked_for_call: false`, `lock_agent_email: null`, `lock_at: null`, `call_session_id: null`, `ultima_ligacao_em` e `total_ligacoes + 1`. Também grava `status = novo_status_lead || RESULTADO_PARA_STATUS[resultado]` (`:80-86`), quando esse valor existe.
    - 11k. [`:525-533`] `CallSession.update` grava `status: 'finished'`, `finalizada_em`, `duracao_segundos`, `spin_preenchido`, `spin_respostas`, `gravacao_url` e `atividade_id`.
    - 11l. [`:538-561`] Se `body.gravacao_url || sessao.gravacao_url` existe, faz um `fetch` sem aguardar para `${protocolo}//${host de req.url}/functions/processarGravacao3CPlus`, repassando o header `Authorization`.

12. Gravação:
    - 12a. [`backend/functions/processarGravacao3CPlus/entry.ts:58-305`] Exige `empresaId`, `call_session_id` e `gravacao_url` (`:58-63`). Não reprocessa se `gravacao_processada && transcricao` (`:80-90`). Exige `OPENAI_API_KEY` (`:92-95`). Etapas:
      - grava `gravacao_url` (`:98-100`);
      - valida o host (`*.3c.plus`, S3, CloudFront, Twilio, googleapis; `:109-122`);
      - baixa o áudio com `fetch(url)` **sem header de autenticação** (`:125`), limite de 25 MB;
      - transcreve com Whisper (`:185-202`) e analisa com GPT-4o (`:253-272`);
      - grava `CallSession.{ gravacao_processada: true, transcricao, analise_ia, erro_mensagem: null }` (`:282-288`);
      - se `sessao.atividade_id` existe, grava `Atividade.{ gravacao_url, observacao: "[IA] resumo" }` (`:293-305`).
    - 12b. `call-history-was-created`: não tem rota no socket do agente (fora de `ROTA_POR_EVENTO`, `TELEFONIA_ENGINE.js:131-147`). No socket do gestor ele chega a `onEventoChamada`, que é vazio (`frontend/src/hooks/useMonitoramentoRealTime.js:134-136`). O único tratamento no backend está em `receberEvento3CPlus` (`backend/functions/receberEvento3CPlus/entry.ts:192-265`), que exige o header `X-Bridge-Secret` e o corpo `{ evento, dados, timestamp }` (`:27-62`) e não tem chamador (ver Pontos em aberto).
    - 12c. `buscarGravacoes3CPlus` (`backend/functions/buscarGravacoes3CPlus/entry.ts`), acionado pelo botão "Sincronizar" da página de gravações (`frontend/src/pages/Gravacoes.jsx:441-452, 465, 530`):
      - usa a credencial de gestor e faz `GET /agents` (paginado) e `GET /calls?start_date&end_date&per_page=200&with_mailing=true&minimum_duration=5[&agents[]=id]` (`:72-93`);
      - cria `GravacaoLigacao` com `call_id_3cplus`, `sdr_email`, `lead_nome` = `mailing_data.identifier`, `lead_telefone`, `campanha_*`, `duracao_segundos`, `resultado`, `data_gravacao`, `gravacao_url_backup = call.recording`, `checksum_metadata`, `expires_at` e outros (`:190-211`). Deduplica por `call_id` e por checksum.
      - Não grava `call_session_id` nem `lead_id`.
      - Retorna contadores `{ sincronizadas, novas, atualizadas, duplicatas, erros, repaired }` (`:112, :251`).
    - 12d. `obterUrlGravacao3CPlus` (`backend/functions/obterUrlGravacao3CPlus/entry.ts`) aceita `gravacao_id` e/ou `call_id_3cplus` (`:18-21`). Se houver `gravacao_url_backup`, devolve esse link (`:44-52`). Senão, faz `GET /calls/{callId}/recording` com a credencial de gestor (`:68`) e devolve `audio_base64` (`:101-107`). Quem chama é `Gravacoes.jsx:39-43`.

13. `call-was-finished`, `call-was-abandoned` (e aliases `call-finished`/`call-ended`) → rota ENCERRADA (`TELEFONIA_ENGINE.js:143`):
    - no lifecycle: `HANGUP` (`useTelefoniaSocket.js:100-101`);
    - no contexto: `marcarLigacaoEncerrada` (`TelefoniaContext.jsx:298-316`). Se não há `callSessionRef.current.id`, ignora. Se há: libera o guard, para o cronômetro de duração, faz `agentStatus = 'livre'`, `leadCallStatus = 'encerrado'` e `iniciarCronometroEstado('tpa')`. Não fecha o modal e não grava nada no banco.

14. `call-was-not-answered`, `call-was-failed` (e aliases `call-not-answered`, `call-was-busy`, `call-failed`) → rota NAO_ATENDIDA (`TELEFONIA_ENGINE.js:142`):
    - no lifecycle: `NOT_ANSWERED`;
    - no contexto: `marcarLigacaoNaoAtendida` (`TelefoniaContext.jsx:279-296`). Se não há sessão, ignora. Se há: libera o guard, faz `leadCallStatus = 'nao_atendeu'` e, 2 s depois, `callSession = null`. Não altera `modalAtendimentoAberto` e não grava nada no banco.

15. `call-was-abandoned-due-amd`, `call-was-ended`, `call-was-created`, `call-is-trying`, `call-was-amd` e `call-history-was-created` não estão em `ROTA_POR_EVENTO` e não disparam handler do agente.

16. Recarga da página no meio da ligação:
    - 16a. O estado da ligação (`callSession`, `modalAtendimentoAberto`, cronômetros) vive só em `useState`/`useRef` (`TelefoniaContext.jsx:45-59`). Não encontrei persistência: procurei `localStorage`/`sessionStorage` em `contexts/` e `components/telefonia/`, e o único resultado é um comentário em `useTelefoniaAgent.js:5`.
    - 16b. No backend, a sala fica sem membros e a ponte continua aberta por 60 s (`ponte3c.ts:166-173`). Eventos emitidos nesse intervalo vão para `io.to(room).emit` sem buffer (`backend/src/realtime.ts:77-79`). Ao reentrar com a mesma credencial, a ponte só emite `__ponte:connect` (`ponte3c.ts:114-118`).
    - 16c. Ao montar, `restoreAgentState` (`TelefoniaContext.jsx:393-397` → `frontend/src/contexts/telefonia/useTelefoniaAgent.js:149-208`) chama `executarComando3CPlus { comando: 'get-logged-campaign' }` e aplica `_aplicarStatus3C(status || 'idle', …)`. Como `normalize3CResponse` sempre devolve `status: null` (`useTelefoniaAgent.js:26`), o cronômetro volta para "aguardando" mesmo durante uma chamada (`:127-131`). Não busca a `CallSession` ativa: `buscarCallSessionAtiva` existe em `telefoniaService.js:13-18`, mas não tem chamador.
    - 16d. O evento `vendaflow:reconnect-call-recovery` tem listener (`TelefoniaContext.jsx:654-660`), mas não encontrei quem o emita (procurei em `frontend/src` e `backend`). `reprocessarEstadoAgente` (`useTelefoniaSocket.js:192-198`) só emite `vendaflow:reprocessar-agente`, que leva de novo a `restoreAgentState` (`TelefoniaContext.jsx:679-687`).
    - 16e. Resultado: a `CallSession` no banco fica `answered`, o lead fica com `is_locked_for_call: true` e não há modal. O `call-was-finished` que chegar depois é ignorado pelo guard (`:300-302`). O `agent-in-acw` só muda o cronômetro para "tpa" (`useTelefoniaAgent.js:254-258`). Liberação do lock depois disso:
      - lógica, após 15 min, em `ligarAgoraLead3CPlus` (`backend/functions/ligarAgoraLead3CPlus/entry.ts:6, 62-71`) e `iniciarLigacao3CPlus` (`backend/functions/iniciarLigacao3CPlus/entry.ts:4, 58-72`);
      - por timer de 5 min em `frontend/src/components/crm/TaskCard.jsx:51-75`, que lê `tarefa.is_locked_for_call`/`tarefa.lock_at`. `Tarefa.jsonc` não define esses campos; não confirmei se o objeto `tarefa` é enriquecido com dados do lead.

**Estados/campos que mudam:**
- `Lead`:
  - `is_locked_for_call`, `lock_agent_email` e `lock_at` passam a `true`/email/data no navegador (passo 4a) e voltam a `false`/`null` em `finalizarLigacao3CPlus` ou em `fecharModalAtendimento`;
  - `call_session_id` é zerado (`null`) no finalizar;
  - `ultima_ligacao_em`, `total_ligacoes` e `status` (quando mapeado) são gravados no finalizar;
  - `status`, `data_reuniao` e `closer_responsavel` são gravados pelo modal quando há agendamento de reunião.
- `CallSession`: criada com `status: 'answered'` e `origem: 'campanha_automatica'`; no fim recebe `status: 'finished'`, `finalizada_em`, `duracao_segundos`, `spin_*`, `gravacao_url` e `atividade_id`; `processarGravacao3CPlus` grava `gravacao_processada`, `transcricao`, `analise_ia` e `erro_mensagem`.
- `Atividade`: uma criada no connect (`origem_sincronizacao: '3cplus'`, sem `resultado`) e outra no finalizar (`origem_sincronizacao: 'manual'`, com `resultado`). A `observacao` da segunda é sobrescrita por `[IA] …` quando o processamento da gravação conclui.
- `SpinResposta`: não é criada na campanha automática.
- `GravacaoLigacao`: só é criada pelo botão "Sincronizar" da página de gravações.
- Estado local: `callSession.status`, `leadCallStatus` (`em_ligacao` → `encerrado`/`nao_atendeu` → `null`), `modalAtendimentoAberto`, `estadoCampanha` (`falando` → `tpa`), `callLifecycle.state`.

**Eventos de socket envolvidos:**
- Emissor: 3C Plus → `ponte3c.ts:146` → sala `telefonia:agente:<userId>` (`realtime.ts:77-79`) → `socketPonte.js` → `useTelefoniaSocket.js`.
- `call-was-connected` / `call-was-answered` / `call-answered` → `marcarLigacaoAtendida` + lifecycle `CONNECTED`.
- `call-was-finished` / `call-was-abandoned` / `call-finished` / `call-ended` → `marcarLigacaoEncerrada` + `HANGUP`.
- `call-was-not-answered` / `call-was-failed` / aliases → `marcarLigacaoNaoAtendida` + `NOT_ANSWERED`.
- `agent-in-acw`, `agent-is-idle` e demais `agent-*` → `processarEventoAgente` (`useTelefoniaAgent.js:239-284`).
- `call-history-was-created` → nenhum handler no agente. No gestor (`useTelefoniaSocketGestor.js:84-92` → `useMonitoramentoRealTime.js:134-136`) o handler é vazio.
- Eventos internos do navegador: `vendaflow:reprocessar-agente` (emitido em `useTelefoniaSocket.js:195`, escutado em `TelefoniaContext.jsx:685`); `vendaflow:reconnect-call-recovery` (escutado em `TelefoniaContext.jsx:658`, sem emissor encontrado).

**Pontos em aberto observados:**
1. **Identificação só por telefone exato.**
   - O mailing enviado ao 3C leva apenas `identifier` (nome do lead) e `phone` (dígitos). Nenhum id do lead vai no mailing (`backend/functions/criarCampanha3CPlus/entry.ts:119-122`).
   - A busca é de igualdade exata em `Lead.telefone` (`leadService.js:91-94`), comparando com o número só em dígitos (`telefonia3cDados.js:57`).
   - A importação CSV grava `telefone` como veio no arquivo (`backend/functions/importarLeadsCSV/entry.ts:36`), enquanto `capturarLead` grava só dígitos (`backend/functions/capturarLead/entry.ts:97`).
   - Com mais de um lead no mesmo número, usa `[0]` (`TelefoniaContext.jsx:143`).
2. **Lock no connect.** O lock é gravado pelo navegador sem conferir se o lead já estava travado por outro agente e sem gravar `Lead.call_session_id` (`TelefoniaContext.jsx:158-162`). Os fluxos iniciados no backend gravam esse campo (`ligarAgoraLead3CPlus/entry.ts:144`, `iniciarLigacao3CPlus/entry.ts:143-145`).
3. **Duas Atividades por ligação atendida com lead identificado.**
   - Uma no connect (`TelefoniaContext.jsx:191-204`, com `call_session_id`, sem `resultado`).
   - Outra no finalizar (`finalizarLigacao3CPlus/entry.ts:468-484`, sem `call_session_id` nem `campanha`).
   - `CallSession.atividade_id` aponta para a segunda (`:532`).
4. **Nova ligação com sessão anterior ativa.** Se um `call-was-connected` chega com sessão local ativa e o guard já liberado (depois de `call-was-finished`), a sessão anterior é descartada só no estado local (`TelefoniaContext.jsx:92-102`). Não há qualificação no 3C, a `CallSession` anterior continua `answered` e o lead anterior continua travado.
5. **Ramo `agent-is-connected` inalcançável.** `agent-is-connected` é roteado como evento de AGENTE (`TELEFONIA_ENGINE.js:108, 140`), nunca como ATENDIDA. Por isso os ramos de `marcarLigacaoAtendida` que testam `origem === 'agent-is-connected'` (`TelefoniaContext.jsx:92, 121-129`) não são executados por nenhum evento.
6. **Eventos sem conferência de chamada.** `marcarLigacaoEncerrada` e `marcarLigacaoNaoAtendida` não comparam o `call.id` do evento com `callSession.chamada_id_3cplus` (`TelefoniaContext.jsx:279-316`). A documentação descreve `call-was-abandoned` como "cliente atendeu e desligou sem agente disponível" (`docs/3cplus/EVENTOS_SOCKET.md:66`), mas ele cai na mesma rota de encerramento (`TELEFONIA_ENGINE.js:143`). Não verifiquei quais desses eventos o socket de um agente recebe no modo discador.
7. **Modal some sem finalizar.** Com o modal aberto, um evento NAO_ATENDIDA zera `callSession` em 2 s (`TelefoniaContext.jsx:292-295`), mas `modalAtendimentoAberto` continua `true`. `ModalAtendimentoLead` retorna `null` sem `callSession` (`ModalAtendimentoLead.jsx:30`). O modal some sem finalizar: sem qualificação no 3C, lock mantido e `CallSession` em `answered`.
8. **Reload no meio da ligação:**
   - não há recuperação da sessão (passo 16);
   - `buscarCallSessionAtiva` não tem chamador (`telefoniaService.js:13`);
   - `vendaflow:reconnect-call-recovery` não tem emissor (`TelefoniaContext.jsx:658`);
   - o comentário em `useTelefoniaSocket.js:187-191` diz que a função "dispara onAtendimento para abrir o modal", mas o código só emite `vendaflow:reprocessar-agente` (`:195`).
9. **Liberação de lock no servidor sem chamador.** A liberação do lock no servidor ao terminar a chamada existe apenas em `receberEvento3CPlus` (`receberEvento3CPlus/entry.ts:162-178, 268-285`). Essa função exige `BRIDGE_WEBHOOK_SECRET`/`X-Bridge-Secret` (`:27-51`) e o formato `{ evento, dados, timestamp }` (`:60-62`). Não encontrei chamador (procurei em `frontend/src` e `backend`); o cabeçalho diz "chamado pelo serviço Node.js bridge" (`:6`).
10. **Disparo do processamento de gravação em rota inexistente.**
    - `finalizarLigacao3CPlus` faz `fetch` para `/functions/processarGravacao3CPlus` (`entry.ts:546`), usando o host de `req.url`.
    - Esse host é `config.publicUrl` (`backend/src/functions.ts:63`; padrão `http://localhost:5173`, `backend/src/config.ts:17`).
    - O backend só roteia `/api/*` (`backend/src/main.ts:102, 179-181`). O proxy do Vite só repassa `/api` e `/socket.io` (`frontend/vite.config.js:24-27`).
    - O mesmo padrão aparece em `retryGravacoes3CPlus/entry.ts:109` e `receberEvento3CPlus/entry.ts:209`.
    - O `fetch` não é aguardado e o erro é descartado (`finalizarLigacao3CPlus/entry.ts:557`).
11. **`CallSession.gravacao_url` só tem uma origem:** `call.recording` do próprio `call-was-connected` (`TelefoniaContext.jsx:180`, `telefonia3cDados.js:75`). O frontend não envia `gravacao_url` ao finalizar (`TelefoniaContext.jsx:560-569`). Não encontrei outro caminho ativo que preencha esse campo depois (`call-history-was-created` não tem handler ativo).
12. **Download da gravação sem autenticação.** `processarGravacao3CPlus` baixa o áudio sem header de autenticação (`entry.ts:125`), enquanto `obterUrlGravacao3CPlus` usa credencial de gestor em `GET /calls/{id}/recording` (`entry.ts:57, 68`).
13. **Contratos divergentes em `useTelefoniaGravacoes`:**
    - `processarGravacao` envia `{ empresaId, call_id }` (`useTelefoniaGravacoes.js:34`), mas a função exige `call_session_id` e `gravacao_url` (`processarGravacao3CPlus/entry.ts:58-63`);
    - `obterUrlGravacao` envia `call_id` (`:23`), mas a função lê `gravacao_id`/`call_id_3cplus` (`obterUrlGravacao3CPlus/entry.ts:18-21`); além disso, o hook lê `data.url` (`:24`) e a função devolve `audio_base64`;
    - `buscarGravacoes` lê `data.gravacoes` (`:13`), mas a função devolve contadores (`buscarGravacoes3CPlus/entry.ts:112, 251`);
    - nenhuma dessas três funções do contexto (`TelefoniaContext.jsx:734`) é chamada por componente; procurei em `frontend/src`, excluindo `__tests__`.
14. **`GravacaoLigacao` sem vínculo com a ligação.** O registro é criado sem `call_session_id` e sem `lead_id` (`buscarGravacoes3CPlus/entry.ts:190-211`); o único elo com a `CallSession`/`Atividade` é `call_id_3cplus` ↔ `chamada_id_3cplus`. A sincronização é só manual (botão em `Gravacoes.jsx:465, 530`).
15. **Funções que dependiam de agendamento sem chamador:**
    - `sincronizarTelefonia3CPlus` (cabeçalho: "Chamada por agendamento (n8n) ou manualmente pelo gestor", `entry.ts:6`);
    - `retryGravacoes3CPlus` (varredura de `CallSession` com gravação pendente, `entry.ts:1-15`).

    Não encontrei chamador no frontend nem agendamento no repositório (procurei em `frontend/src`, `backend/` e `docker-compose.yml`).
16. **`callLifecycle` sem consumidor e preso em ENCERRADA.**
    - Nenhum código despacha `SELECT_RESULT`, `SUBMIT` ou `FINALIZED`; os únicos `dispatch` estão em `useTelefoniaSocket.js:80-107`.
    - De `ENCERRADA` só há transição para `SELECT_RESULT` (`CallLifecycleManager.js:23`), então após a primeira ligação o estado fica em `ENCERRADA` e um novo `CONNECTED` é recusado com aviso, até um `RESET`.
    - `useCallLifecycle` não é importado por nenhum componente (procurei em `frontend/src`, excluindo `__tests__`).
17. **Fechar sem registrar qualifica com a 1ª qualificação da lista.** Fechar o modal sem registrar finaliza com `resultado: 'outro'`. Como `'outro'` não está em `RESULTADO_PARA_QUALIFICACAO_3C` (`finalizarLigacao3CPlus/entry.ts:42-57`), o fallback universal envia a 1ª qualificação da lista escolhida (`:352-374`) e cria `Atividade.resultado = 'outro'`.
18. **"Hang up" do softphone registra "não atendeu".** O botão do bloco de lead finaliza sempre com `resultado: 'nao_atendeu'`, inclusive em `em_ligacao` (`Softphone3CPlus.jsx:877-879`). Isso qualifica no 3C como "Sem contato / Ligação caiu" (`finalizarLigacao3CPlus/entry.ts:43`).
19. **Lead vinculado no modal é descartado.** `lead_id_vinculado` escolhido no modal não chega a `finalizarLigacao3CPlus`: a assinatura do contexto não o inclui (`TelefoniaContext.jsx:549-569`). Numa sessão sem `lead_id`, a Atividade não é criada (`finalizarLigacao3CPlus/entry.ts:467-487`) e o lock/status do lead vinculado não é tratado.
20. **`qualification_id` pode ser um nome.** O wizard pode preencher `qualification_id` com o nome da qualificação (`WizardEtapas.jsx:192`, `autoMatch.id ?? autoMatch.name`). O backend faz `Number(body.qualification_id)` (`finalizarLigacao3CPlus/entry.ts:278`); com um nome, o resultado é `NaN` e a resolução automática entra em ação.
21. **`CallSession.jsonc` não tem bloco `rls`.** Com isso, `accessFilter` não restringe (`backend/src/entities.ts:99-104`) e qualquer usuário autenticado lê e altera qualquer `CallSession`. O navegador grava `CallSession` diretamente (`telefoniaService.js:39-45`).
22. **`call.id` sem codificação no path.** `finalizarLigacao3CPlus` interpola `chamada_id_3cplus` no path sem `encodeURIComponent` (`entry.ts:257, 273-274`), enquanto `executarComando3CPlus` codifica (`entry.ts:138`). O id do discador tem o formato `call:{empresa}:{campanha}:{telephony_id}` (`docs/3cplus/EVENTOS_SOCKET.md:97`).
23. **Dois eventos na mesma rota ATENDIDA.** `call-was-answered` e `call-was-connected` usam a mesma rota. O primeiro que chegar cria a sessão com o próprio payload, e o segundo é descartado pelo guard (`TelefoniaContext.jsx:89`). Não verifiquei se o socket do agente recebe `call-was-answered` no discador.
24. **`marcarLigacaoEncerrada` marca "livre" durante o TPA.** Ela faz `setAgentStatus({ status: 'livre' })` (`TelefoniaContext.jsx:308`) no momento em que o 3C coloca o agente em TPA.
25. **`OPENAI_API_KEY` vazia no `.env` da raiz** (I14): mesmo que a chamada chegasse, `processarGravacao3CPlus` responderia 500 "OPENAI_API_KEY não configurada" (`backend/functions/processarGravacao3CPlus/entry.ts:92-95`). O ambiente de produção não foi verificado.
26. **TMA do modal de campanha sempre 0.** `ModalAtendimentoLead.jsx:15, 144` lê `telefonia.tmaLigacao`, que o contexto não expõe (valor do contexto em `TelefoniaContext.jsx:694-740`).
27. **Nenhuma rotina encerra CallSessions abandonadas.** O enum de `CallSession.status` tem `timeout` e `abandoned` (`backend/entities/CallSession.jsonc:30-42`). Procurei gravações desses status em `backend/functions` e `frontend/src`: só `receberEvento3CPlus` (sem chamador, 8.4) grava `abandoned`/`failed`; `timeout` não é gravado por ninguém. Sessões `answered` sem finalização (reload, modal que some, ponto 7) permanecem assim.

---

## 4. Ligação manual

**Gatilho:**
- (a) O teclado do softphone chama `discarManual` (`frontend/src/components/telefonia/Softphone3CPlus.jsx:319-381`).
- (b) "Ligar" num card de tarefa chama `telefonia.ligarAgoraLead(lead_id, lead_nome)` (`frontend/src/components/crm/TaskCard.jsx:208`).
- (c) `telefonia.iniciarLigacao(...)` → `iniciarLigacao3CPlus` está exposta no contexto (`TelefoniaContext.jsx:712-717`), mas nenhum componente a chama; procurei em `frontend/src`, excluindo `__tests__`.

**Passo a passo (a) — teclado, sem lead:**

1. [`Softphone3CPlus.jsx:319-381`] Discagem pelo teclado:
   - `discarManual` só pode ser acionado com `!manualCallSession && !telefonia.callSession` (`:704, :746-750`);
   - para gestor/admin exige ramal e, se houver `manualCallSession?.lead_id`, usaria `ligarAgoraLead3CPlus` com `forcar_metodo: 'click2call'` (`:326-356`);
   - nos demais casos chama `telefonia.iniciarLigacaoManual({ telefone_manual, lead_nome: telefone, lead_id: '' })` (`:362-366`).
2. [`TelefoniaContext.jsx:494-532`] `iniciarLigacaoManual`:
   - faz `manualCallStatus = 'chamando'` (`:499`);
   - chama `api.functions.invoke('iniciarDiscagemManual3CPlus', { empresaId, telefone_manual, lead_nome, lead_id })`;
   - se der certo, cria o objeto local `manualCallSession = { id, lead_id, lead_nome, lead_telefone, chamada_id_3cplus, telephony_id_3cplus, status: 'iniciando', origem: 'discador_manual' }` (`:514-525`).
3. [`backend/functions/iniciarDiscagemManual3CPlus/entry.ts`] No backend:
   - 3a. [`:39-47`] Normaliza o telefone para dígitos; mínimo de 8.
   - 3b. [`:50-55`] `carregarConfig3C`; se não houver integração, responde 424.
   - 3c. [`:59-69`] `credencialAgente(api, empresaId, user.email)`; se não houver, responde 400 `TOKEN_NOT_FOUND`.
   - 3d. [`:74-87`] `POST /agent/manual_call/enter` (form vazio, 8 s). Aceita 200, 204 ou 422; qualquer outro status → 502.
   - 3e. [`:90-112`] `POST /agent/manual_call/dial` com form `{ phone }` (10 s). Aceita 2xx ou 422; outro status → 502.
   - 3f. [`:118-120`] `chamada_id` = `data.call.id || call.id`; `telephony_id` = `data.agent.telephony_id`. Se o dial responder 204, os dois ficam `null`.
   - 3g. [`:126-141`] `CallSession.create` (service role) grava:
     - `lead_id` (vazio pelo teclado), `lead_nome`, `lead_telefone`, `sdr_email`;
     - `campanha_id_3cplus = cfg.campanha_id_padrao`, `chamada_id_3cplus`, `telephony_id_3cplus`;
     - `status: 'iniciando'`, `origem: 'discador_manual'`, `session_scope: 'manual'`, `iniciada_em`.
   - 3h. [`:144-151`] Se veio `lead_id`, `Lead.update` grava `is_locked_for_call: true`, `lock_agent_email`, `lock_at` e `call_session_id`.
4. Eventos do 3C na ordem real validada em 25/09/2026:
   - 4a. `agent-entered-manual`, emitido por `manual_call/enter`: rota MODO_MANUAL (`TELEFONIA_ENGINE.js:133`).
     - No lifecycle: `START_CALL` (`useTelefoniaSocket.js:79-80`).
     - No contexto: `onManualMode` (`TelefoniaContext.jsx:407-419`) só atualiza `chamada_id_3cplus` se já existe `manualCallSessionRef`; normalmente ainda não existe, porque o evento chega durante a requisição HTTP.
     - O `case 'agent-entered-manual'` de `processarEventoAgente` (`useTelefoniaAgent.js:259-264`) não é executado por esse evento: `onEventoAgente` só roda para a rota AGENTE (`useTelefoniaSocket.js:121-123`).
   - 4b. **`call-was-connected` com `call_mode = manual` e sem `answered_time`** (discagem; ramal conectado, cliente tocando). `ehChamadaManual` retorna `true` (`TELEFONIA_ENGINE.js:164-167`), então:
     - o lifecycle não é despachado (`useTelefoniaSocket.js:78`, `switch(null)`);
     - a rota vai para `onManualRamalConectado` (`:135`) → `TelefoniaContext.jsx:435-442`, que só preenche `chamada_id_3cplus` no estado local e no banco (`CallSession.update`) se existir `manualCallSessionRef`, se a sessão ainda não tiver id da chamada e se o evento trouxer `data.call.id`. Não muda `status` nem `manualCallStatus`.
     - Isso corresponde ao comportamento real: o evento não é tratado como atendimento.
   - 4c. **`manual-call-was-answered`, com `answered_time`** (cliente atendeu) → rota MANUAL_ATENDIDA (`TELEFONIA_ENGINE.js:144`):
     - no lifecycle: `CONNECTED_MANUAL`, que vira `dispatch('CONNECTED')` (`useTelefoniaSocket.js:91-98`);
     - no contexto: `marcarLigacaoManualAtendida` (`TelefoniaContext.jsx:72-85`) faz `manualCallStatus = 'em_ligacao'` sempre;
     - só se existe `manualCallSessionRef` **e** `data.call.id`, grava `manualCallSession.status = 'answered'`, troca `chamada_id_3cplus` e faz `CallSession.update { status: 'answered', atendida_em: now, chamada_id_3cplus }`;
     - `answered_time` não é lido: não há ocorrência de `answered_time` em `frontend/src`.
   - 4d. [`frontend/src/components/telefonia/ModalAtendimentoManual.jsx:44-46`] O modal manual abre quando `manualCallSession.status === 'answered'` e não há `callSession`. O cronômetro de duração começa quando `manualCallStatus === 'em_ligacao'` (`:48-55`). As qualificações vêm de `buscarQualificacoes3CPlus { empresaId }` (`:25-33`).
   - 4e. **`call-was-finished` (status 7)** → rota ENCERRADA:
     - no lifecycle: `HANGUP`;
     - no contexto: `marcarLigacaoEncerrada` (`TelefoniaContext.jsx:298-302`) retorna logo, porque o guard olha `callSessionRef` (sessão de campanha/lead), não `manualCallSessionRef`;
     - `manualCallStatus` não muda e o `status` do evento não é lido (não há ocorrência de `status_id` em `frontend/src`).
     - Depois vem `agent-entered-manual-acw` → `processarEventoAgente` → `iniciarCronometroEstado('tpa')` (`useTelefoniaAgent.js:254-258`).
5. Encerramento pelo agente, pelo botão "Hang up" do softphone (`Softphone3CPlus.jsx:804-813`) → `hangupManualCall` (`TelefoniaContext.jsx:626-651`):
   - `manualCallStatus = 'encerrado'`;
   - se houver `chamada_id_3cplus`, chama `executarComando3CPlus { comando: 'end-call', chamada_id }`, que faz `POST /agent/call/{id}/hangup` (`backend/functions/executarComando3CPlus/entry.ts:136-139`);
   - depois chama `acw-exit`, que faz `POST /agent/manual_call_acw/exit` e `POST /agent/acw/exit` (`:144-157`);
   - por fim `limparSessaoManual()` (`manualCallSession = null`, `manualCallStatus = null`).

   Não qualifica no 3C nem grava `CallSession`/`Atividade`.
6. Registro pelo modal: `handleRegistrar` (`ModalAtendimentoManual.jsx:86-209`):
   - 6a. Se `manualCallSession.id && empresaId`, chama `finalizarLigacao3CPlus` com `{ empresaId, call_session_id, resultado, spin, observacao, duracao_segundos, tma_segundos, novo_status_lead, lead_id_vinculado }` (`:95-107`). **Não** envia `qualification_id`.
   - 6b. No backend (mesmas etapas do fluxo 3, passo 11):
     - SPIN exigido para `discador_manual`, exceto nos resultados de `RESULTADOS_SEM_SPIN` (`finalizarLigacao3CPlus/entry.ts:29-37, 203-235`);
     - `POST /agent/call/{id}/hangup`;
     - qualificação em `POST /agent/manual_call/{id}/qualify` (`:272-274`), com fallback para `/agent/call/{id}/qualify` (`:393-404`);
     - saída do TPA nos dois endpoints;
     - `Atividade` só se `sessao.lead_id` existir;
     - `Lead` (lock/status) só se `sessao.lead_id` existir;
     - `CallSession` → `finished`.
   - 6c. Se o `invoke` falhar (qualquer status diferente de 2xx), chama `acw-exit` como fallback (`ModalAtendimentoManual.jsx:108-121`).
   - 6d. Grava `Lead.update { status }` pelo navegador quando `status_lead` não é "manter" (`:124-126`); encerra tarefas; cria próximo contato ou reunião (`:128-201`).
   - 6e. Sempre executa `handleClose()` no fim (`:203-207`), que chama `limparSessaoManual`.
7. Cancelar ou fechar o modal manual (`ModalAtendimentoManual.jsx:76-84`, via `ModalAtendimentoBase.jsx:50`): para os timers e chama `limparSessaoManual()`. Não chama `finalizarLigacao3CPlus` nem `acw-exit`.

**Passo a passo (b) — `ligarAgoraLead` (card de tarefa):**

8. [`TelefoniaContext.jsx:459-491`] Chama `api.functions.invoke('ligarAgoraLead3CPlus', { empresaId, lead_id })`. Se der certo, cria o estado local `callSession = { id, lead_id, lead_nome, status: 'aguardando_confirmacao', _timeoutId }` e `leadCallStatus = 'discando'`. Depois de 15 s, se o status ainda for `aguardando_confirmacao`, limpa `callSession` (`:467-474`).
9. [`backend/functions/ligarAgoraLead3CPlus/entry.ts`] No backend:
   - `Lead.get`; recusa com 409 `LEAD_LOCKED` se o lock tem menos de 15 min (`:62-71`);
   - idempotência de 30 s por `CallSession` em `iniciando` (`:74-94`);
   - `carregarConfig3C` e `credencialAgente`; lê o ramal em `UserProfile.ramal_3cplus` (`:119-123`);
   - grava o lock em `Lead` (`:131-133`);
   - cria `CallSession { status: 'iniciando', origem: 'manual', session_scope: 'lead' }` (`:136-142`) e grava `Lead.call_session_id` (`:144`);
   - método A: `POST /click2call` com credencial de gestor e form `{ extension, phone }` (`:159-174`);
   - método B: `POST /agent/manual_call/enter` + `POST /agent/manual_call/dial { phone }` com credencial do agente (`:177-196`);
   - se falhar, desfaz o lock e marca a `CallSession` como `failed` (`:199-210`);
   - se tiver o id da chamada, grava `CallSession { chamada_id_3cplus, status: 'ringing' }` (`:212-215`).
10. Eventos deste caminho, pelo código:
    - `call-was-connected` manual → `onManualRamalConectado`, que retorna logo porque `manualCallSessionRef` é `null` (`TelefoniaContext.jsx:437`);
    - `manual-call-was-answered` → `marcarLigacaoManualAtendida`: faz `manualCallStatus = 'em_ligacao'`, mas sem `manualCallSession` não atualiza nada (`:73-75`);
    - `callSession` segue em `aguardando_confirmacao` (o cancelamento do timeout em `:112-118` só ocorre dentro de `marcarLigacaoAtendida`, que não é chamada para eventos manuais);
    - `modalAtendimentoAberto` não é ligado, então `ModalAtendimentoLead` não abre (`ModalAtendimentoLead.jsx:30`); `ModalAtendimentoManual` também não abre (exige `manualCallSession.status === 'answered'`, `ModalAtendimentoManual.jsx:45`);
    - depois de 15 s o `callSession` local é limpo (`TelefoniaContext.jsx:467-474`);
    - um `call-was-finished` que chegue antes disso marca `leadCallStatus = 'encerrado'` (`:298-316`); depois disso é ignorado.

**Estados/campos que mudam:**
- `CallSession`:
  - discador manual: `iniciando` → (`chamada_id_3cplus` preenchido por 4b/4c) → `answered` em 4c (via navegador) → `finished`, `finalizada_em`, `duracao_segundos`, `spin_*`, `atividade_id` no finalizar;
  - `ligarAgoraLead`: `iniciando` → `ringing` (ou `failed`); não há outra atualização neste caminho.
- `Lead`: `is_locked_for_call`, `lock_agent_email`, `lock_at` e `call_session_id` são gravados só quando há `lead_id` (3h, 9); a liberação vem de `finalizarLigacao3CPlus`; `status` é gravado pelo navegador em 6d.
- `Atividade`: só no finalizar e só com `sessao.lead_id`. Pelo teclado, `lead_id` é `''` (`Softphone3CPlus.jsx:365`), então nenhuma Atividade da ligação é criada. Uma `Atividade` `tipo: 'anotacao'` é criada no próximo contato.
- Estado local:
  - `manualCallStatus`: `chamando` → `em_ligacao` → `encerrado` (só via `hangupManualCall`) → `null`;
  - `manualCallSession.status`: `iniciando` → `answered`;
  - `estadoCampanha`: vai para `tpa` com `agent-entered-manual-acw`;
  - `callLifecycle`: `START_CALL`/`CONNECTED`/`HANGUP`.

**Eventos de socket envolvidos:**
- Emissor: 3C → `ponte3c.ts:146` → sala `telefonia:agente:<userId>` → `useTelefoniaSocket.js`.
- `agent-entered-manual` (alias `agent-entered-manual-mode`) → rota MODO_MANUAL (`TELEFONIA_ENGINE.js:133`) → só `onManualMode` + lifecycle `START_CALL`. O `case` equivalente em `processarEventoAgente` (`useTelefoniaAgent.js:259-264`) não é alcançado por esse evento.
- `call-was-connected` (`call_mode: manual`) → `onManualRamalConectado`.
- `manual-call-was-answered` → `marcarLigacaoManualAtendida` + lifecycle `CONNECTED`.
- `call-was-finished` → `marcarLigacaoEncerrada` (ignorado sem `callSession`) + lifecycle `HANGUP`.
- `agent-entered-manual-acw`, `agent-left-manual-acw`, `agent-left-manual-mode` → `processarEventoAgente`.
- `manual-call-acw-connected` / `manual-call-acw-disconnected` → não estão em `ROTA_POR_EVENTO`; sem handler.

**Pontos em aberto observados:**
1. **`ligarAgoraLead`/`iniciarLigacao` não abrem modal com os eventos reais.** Esses caminhos guardam a sessão em `callSession`, mas os eventos manuais (`call-was-connected` manual e `manual-call-was-answered`) só atuam sobre `manualCallSessionRef` (`TelefoniaContext.jsx:72-85, 435-442`).
   - Com a sequência real de 25/09/2026, nenhum modal de atendimento abre para essas ligações (passo 10).
   - A `CallSession` no banco fica `ringing`/`iniciando` e o lead fica travado até o finalizar ou o limite de 15 min.
   - `iniciarLigacao` não tem timeout local (`TelefoniaContext.jsx:597-604`).
2. **`em_ligacao` sem sessão.** `marcarLigacaoManualAtendida` faz `manualCallStatus = 'em_ligacao'` mesmo sem `manualCallSession` (`TelefoniaContext.jsx:73`).
3. **Corrida entre evento e resposta HTTP.** O `call-was-connected` manual chega "no momento da discagem" (`docs/3cplus/EVENTOS_SOCKET.md:98`), possivelmente antes de `iniciarDiscagemManual3CPlus` responder e de `manualCallSessionRef` ser preenchido (`TelefoniaContext.jsx:524-525`). Nesse caso `onManualRamalConectado` retorna sem gravar `chamada_id_3cplus` (`:437`), e o id depende da resposta do dial (`iniciarDiscagemManual3CPlus/entry.ts:118-120`; `null` se a resposta for 204) ou de 4c.
4. **Modal manual depende de `call.id` no evento.** O modal só abre se o payload de `manual-call-was-answered` trouxer `data.call.id` (`TelefoniaContext.jsx:75`; `ModalAtendimentoManual.jsx:45`). O formato desse payload não está documentado no repositório (`docs/3cplus/EVENTOS_SOCKET.md:88` registra só o nome).
5. **`call-was-finished` não afeta a ligação manual.**
   - É descartado pelo guard `callSessionRef` (`TelefoniaContext.jsx:300-302`);
   - `manualCallStatus` fica `em_ligacao`, o modal mostra `em_ligacao` (`ModalAtendimentoManual.jsx:211-213`) e o cronômetro de duração continua contando (`:48-63`), porque só para em `encerrado` ou `null`;
   - o status 7 não é lido.
6. **Ligação manual não atendida.** Não encontrei no repositório quais eventos o 3C envia nesse caso (a doc só registra o histórico `status_id: 5`, `EVENTOS_SOCKET.md:98`). Se vier `call-was-not-answered`/`call-was-failed`, `marcarLigacaoNaoAtendida` ignora, porque o guard olha `callSessionRef` (`TelefoniaContext.jsx:282-284`). A sessão manual fica em `chamando` até o agente usar "Hang up". O link "Descartar sessão travada" só aparece em `encerrado` (`Softphone3CPlus.jsx:815`).
7. **"Hang up" com modal aberto perde o registro.** `hangupManualCall` limpa `manualCallSession` (`TelefoniaContext.jsx:650`), mas o `aberto` do `ModalAtendimentoManual` é estado próprio e continua `true`. Um "Registrar" posterior pula `finalizarLigacao3CPlus`, porque `manualCallSession?.id` é `undefined` (`ModalAtendimentoManual.jsx:95`): não há qualificação no 3C, a `CallSession` fica `answered` e só o fallback `acw-exit` é executado (`:117-121`).
8. **`hangupManualCall` não qualifica.** Chama `end-call` (`/agent/call/{id}/hangup`) e `acw-exit` sem qualificação (`TelefoniaContext.jsx:636-648`). O contrato interno lista `hangup → qualify → manual_call/exit` (`docs/TELEFONIA_CONTRATO.md:317-320`).
9. **Campos do modal manual que o backend não usa.** `ModalAtendimentoManual` não envia `qualification_id` (`:97-107`), então a qualificação escolhida no modal não chega ao 3C; vale o mapeamento automático por resultado. Ele envia `lead_id_vinculado` e `tma_segundos`, que `finalizarLigacao3CPlus` não lê (o arquivo não referencia esses campos). Consequência: com lead vinculado no modal, a Atividade da ligação não é criada nem o lock/`total_ligacoes` do lead é tratado; o navegador grava só `Lead.status` (`:124-126`).
10. **SPIN exigido na origem `discador_manual`.** Resultados fora de `RESULTADOS_SEM_SPIN` recebem 422 `SPIN_REQUIRED` (`finalizarLigacao3CPlus/entry.ts:203-235`). No modal manual o 422 lança exceção e cai no fallback `acw-exit` seguido de `handleClose` (`ModalAtendimentoManual.jsx:108-121, 203-207`): a `CallSession` não é finalizada e a qualificação não é enviada.
11. **Cancelar o modal manual não finaliza.** Diferente de `fecharModalAtendimento` (fluxo 3), `handleClose` não qualifica nem chama `acw-exit` (`ModalAtendimentoManual.jsx:76-84`).
12. **Ramo `ligarAgoraLead` do teclado inalcançável.** O ramo do gestor usa `manualCallSession?.lead_id` (`Softphone3CPlus.jsx:326`), mas a discagem só é permitida com `!manualCallSession` (`:704, :749`), então `leadIdAtual` é sempre `''` ao discar.
13. **Endpoint de qualificação divergente da doc interna.** Para `discador_manual`, o backend qualifica em `/agent/manual_call/{id}/qualify` (`finalizarLigacao3CPlus/entry.ts:272-274`). A doc interna do fluxo manual indica `/agent/call/{id}/qualify` (`docs/TELEFONIA_CONTRATO.md:318`). O código tenta o outro endpoint se o primeiro falhar (`:393-404`).
14. **`hangup` só existe no endpoint genérico.** O hangup da ligação manual usa `/agent/call/{id}/hangup` (`executarComando3CPlus/entry.ts:138`; `finalizarLigacao3CPlus/entry.ts:255-258`). Na referência da API do repositório não há endpoint de hangup específico para `manual_call` (`docs/3cplus/API_REFERENCIA.md`: só `POST /agent/call/{call-id}/hangup`, `:56`).
15. **`callLifecycle` na manual.** `agent-entered-manual` → `START_CALL`; `call-was-connected` manual → nada; `manual-call-was-answered` → `CONNECTED`; `call-was-finished` → `HANGUP`. O estado depois fica em `ENCERRADA` (ver fluxo 3, ponto 16), e não há consumidor.
16. **Componentes não usados.** `ManualCallAnsweredCard.jsx` e `LeadCallAttendanceModal.jsx` não são importados por nenhum arquivo (procurei em `frontend/src`, excluindo `__tests__`).
17. **`aguardandoAtendimento` nunca é `true`.** Ele é declarado (`TelefoniaContext.jsx:51`), mas `setAguardandoAtendimento` não é chamado em lugar nenhum. A barra de campanha em `Layout.jsx:269-270` depende dele e de `emLigacao`; por isso a barra não aparece durante a discagem de `ligarAgoraLead` (`callSession.status = 'aguardando_confirmacao'`, não `answered`).
18. **Sem registro automático sem lead.** Na ligação manual sem `lead_id`, o `finalizarLigacao3CPlus` não cria Atividade (`entry.ts:467-487`), e não encontrei outra criação ativa de Atividade para esse caso. A criação via `call-history-was-created` existe só em `receberEvento3CPlus` (`entry.ts:229-263`, sem chamador) e `sincronizarTelefonia3CPlus` não tem agendamento.
19. **`answered_time` do evento não é usado.** `marcarLigacaoManualAtendida` grava `atendida_em = new Date()` do navegador (`TelefoniaContext.jsx:81`); o campo `answered_time` de `manual-call-was-answered` não é lido.
20. **Casos de modo manual inalcançáveis em `processarEventoAgente`.** `agent-entered-manual` e `agent-entered-manual-mode` são roteados para `MODO_MANUAL` (`TELEFONIA_ENGINE.js:133`) e vão só para `onManualMode`; nunca chegam a `onEventoAgente`. Os `case` correspondentes em `useTelefoniaAgent.js:259-264` não rodam para eles, e `current3CSession.agentStatus` não passa a `manual` por esses eventos.
21. **Atividade `modo_manual` fora do schema.** Ao sair do modo manual o softphone grava `tipo:'modo_manual'`, `resultado:'modo_manual_encerrado'`, sem `lead_id` (`Softphone3CPlus.jsx:237-245`). Esses valores não estão nos enums de `backend/entities/Atividade.jsonc` e `lead_id` consta em `required` (`:130-134`); a gravação passa porque não há validação (I8). A RLS de criação exige `empresaId` = `user.empresaAtualId` (`Atividade.jsonc:136-138`); o erro é engolido (`.catch(() => {})`).
22. **Status local sem correspondência no schema.** `aguardando_confirmacao` (sessão local de `ligarAgoraLead`/`iniciarLigacao`, `TelefoniaContext.jsx:479`, `:601`) não existe no enum de `CallSession.status` (`backend/entities/CallSession.jsonc:30-42`); é só estado React, mas `receberEvento3CPlus` o inclui na busca de sessão ativa (8.4).

---

## 5. Power dialer (`powerDialer3CPlus`) e click2call do gestor

### 5A. Power dialer

**Gatilho:** manual. A tela `PowerDialerControle` (menu "Power Dialer", `gestorOuAdminOnly: true` em `frontend/src/Layout.jsx:56`) tem os botões Preview (`frontend/src/pages/PowerDialerControle.jsx:99-117`) e Executar (`:119-150`). O cabeçalho da função fala em "Agendado via cron (n8n)" (`backend/functions/powerDialer3CPlus/entry.ts:11`), mas esse cron não existe hoje. Único chamador encontrado: `PowerDialerControle.jsx` (grep em `frontend/src` e `backend`).

**Passo a passo:**
1. [`frontend/src/pages/PowerDialerControle.jsx:104-110` / `:124-130`] O front chama `invoke("powerDialer3CPlus", { empresaId, modo: "preview"|"executar", quantidade, sdr_email?, campanha? })`. `sdr_email` vem do filtro de SDR, montado a partir de `VinculoEmpresa.filter({empresaId, status:"ativo"})` (`:95`).
2. [`backend/functions/powerDialer3CPlus/entry.ts:60-65`] A função exige apenas usuário autenticado. Não confere o papel do usuário nem o vínculo dele com o `empresaId` recebido.
3. [`:79`] `quantidade` limitada a no máximo 10.
4. [`:87-91`] Lê `Lead.filter({empresaId, sdr_responsavel?, campanha?})` como service role, sem `limit` (ver I1).
5. [`:96-117`] Filtro de elegibilidade. Exclui leads com:
   - `status` ∈ {desqualificado, sem_interesse, reuniao_agendada, reuniao_realizada, qualificado} (`:35-41`);
   - `cadencia_id` preenchido;
   - `is_locked_for_call` com `lock_at` há menos de 15 min;
   - `ultima_ligacao_em` há menos de 30 min.
6. [`:122-129`] Ordena `status='novo'` primeiro, depois menor `total_ligacoes`. [`:131`] Pega os N primeiros.
7. [`:136-154`] **Modo preview:** devolve `total_elegiveis`, `total_bloqueados` e `leads_que_seriam_discados`, sem gravar nada.
8. [`:159-182`] Sem elegíveis: devolve `discados: 0` e `motivos_bloqueio`.
9. [`:185-193`] `carregarConfig3C`: `Integracao` com `tipo='telefonia'`, `fornecedor='3cplus'` e `dominio` (`backend/src/telefonia3c.ts:56-65`). Sem integração, responde 424.
10. [`:199-209`] `credencialAgente(api, empresaId, user.email)`, do **usuário logado**. Com token de serviço de agente, resolve `UserProfile.id_3cplus`. Se faltar, busca pelo ramal com `GET /agents` paginado e grava `UserProfile.id_3cplus` (`backend/src/telefonia3c.ts:101-121`). A credencial só valida que o usuário é agente; não é usada para discar (comentário em `:195-198`).
11. [`:215-237`] Ramal, na ordem: `UserProfile.ramal_3cplus` do usuário logado → `cfg.mapeamento_ramais[email]` → `cfg.ramal_padrao`. Sem ramal, responde 400 `RAMAL_NOT_FOUND`.
12. [`:240-246`] `credencialGestor`: `configuracao.token_gestor`.
13. Loop por lead (`:252-336`):
    - [`:262-266`] **Lead.update**: `is_locked_for_call=true`, `lock_agent_email=user.email`, `lock_at`.
    - [`:269-281`] **CallSession.create**: `empresaId`, `lead_id`, `lead_nome`, `lead_telefone`, `sdr_email=user.email`, `campanha_id_3cplus=cfg.campanha_id_padrao`, `status='iniciando'`, `origem='power_dialer'`, `iniciada_em`, `spin_preenchido=false`, `gravacao_processada=false`.
    - [`:283-285`] **Lead.update** `call_session_id`.
    - [`:290-297`] **3C: `POST /click2call`**, credencial de gestor, form `{extension: ramal, phone: telefone}`, timeout de 10 s.
    - [`:302-307`] Resposta 200/201/204: **CallSession.update** `status='ringing'`. O corpo da resposta não é lido, então `chamada_id_3cplus` não é gravado.
    - [`:308-328`] Outro status (422 = "Agente não logado na campanha"): **Lead.update** desfaz o lock (`is_locked_for_call=false`, `lock_*`=null, `call_session_id=null`). A CallSession criada fica como está, com `status='iniciando'`.
    - [`:333-335`] Pausa de 500 ms entre leads.
14. [`:340-350`] Resposta: `{success, modo, discados, com_erro, total_elegiveis_restantes, resultados[]}`.
15. [`PowerDialerControle.jsx:132-142`] O front lê `res.resultados`, `res.discados`, `res.com_erro` e `res.mensagem` direto no envelope (ver I6). [`:111`] No preview, `setPreviewData(res)`, e a tela lê `previewData.total_elegiveis`, `.total_bloqueados`, `.leads_que_seriam_discados` e `.motivos_bloqueio` (`:435`, `:565-576`).

**Estados/campos que mudam:**
- `Lead`: `is_locked_for_call`, `lock_agent_email`, `lock_at`, `call_session_id`.
- `CallSession`: criada com `status` `iniciando`, que passa a `ringing` no sucesso ou fica `iniciando` no erro; `origem='power_dialer'`.
- `UserProfile.id_3cplus`: gravado quando o id é resolvido pelo ramal.

**Eventos de socket envolvidos:** a função não emite nem espera eventos. Os eventos do 3C chegam ao navegador do **usuário que executou** (o ramal é o dele) pela ponte (I7). No `TelefoniaContext`, um `call-was-connected` sem sessão local cria **uma nova** CallSession com `origem='campanha_automatica'`, casa o lead pelo telefone e trava o lead (`frontend/src/contexts/TelefoniaContext.jsx:130-190`). O `PowerDialerControle` não passa o `call_session_id` devolvido ao `TelefoniaContext`: não há `useTelefonia`, `setCallSession` nem `call_session_id` no arquivo (grep).

**Pontos em aberto observados:**
1. **Front lê o envelope, não o corpo.** `PowerDialerControle.jsx:132-141` lê `res.resultados` e `res.discados`, e `:111`/`:565` leem `previewData.total_elegiveis`. Como `invoke` devolve `{data,…}` (I6), esses campos ficam em `res.data.*`. Pelo código, a tela mostra resultados vazios e o toast "Nenhuma ligação iniciada" mesmo quando houve discagem. O preview mostra os valores como `undefined`.
2. **Só 50 leads avaliados.** A seleção parte de `Lead.filter(filtroBase)` sem limite (`powerDialer3CPlus/entry.ts:91`). Pela I1, só os 50 leads mais recentes da empresa (ou do filtro) entram na elegibilidade.
3. **Leads de um SDR, ramal de outro.** O filtro `sdr_email` escolhe os leads de outro SDR (`:88`), mas o ramal e a validação de agente são sempre os do **usuário logado** (`:201`, `:217-229`). As ligações tocam no ramal de quem clicou.
4. **Ninguém fica com o id da CallSession do power dialer.** No sucesso, a CallSession criada no servidor fica `ringing`, sem `chamada_id_3cplus` (`:302-307`). O id vai só para a tela do power dialer. `finalizarLigacao3CPlus` e `receberEvento3CPlus` a atualizariam, mas: `receberEvento3CPlus` não tem chamador (ver 8.4); e o front, sem sessão local, cria outra CallSession `campanha_automatica` (`TelefoniaContext.jsx:171-187`). Não encontrei rotina que feche ou expire CallSessions `ringing`/`iniciando`: procurei `'timeout'` e `status: 'ringing'` em `backend/functions`.
5. **CallSession órfã no erro.** Quando o click2call falha, só o Lead é revertido (`:318-324`). A CallSession fica `iniciando`, sem `finalizada_em` e sem `erro_mensagem`.
6. **Lock só expira por tempo.** Na sessão do power dialer, o lock do lead só é liberado quando uma sessão que referencia o lead é finalizada (`finalizarLigacao3CPlus/entry.ts:497`, `receberEvento3CPlus`) ou quando os 15 min passam (`:104-107`). `ultima_ligacao_em` e `total_ligacoes`, que alimentam os filtros `:111-114` e `:128`, só são gravados em `finalizarLigacao3CPlus/entry.ts:501-509` e `receberEvento3CPlus/entry.ts:162,264,290`.
7. **Sem checagem de papel ou vínculo.** A função só exige autenticação. A restrição a gestor/admin existe só no menu do front (`Layout.jsx:56`).
8. **Comentário diverge do código.** O cabeçalho lista 4 status bloqueados (`:18`); o código tem 5, incluindo `qualificado` (`:40`). O cabeçalho também cita "Agendado via cron (n8n)" (`:11`), e esse agendamento não existe.

### 5B. Gestão de campanhas no Power Dialer (`gerenciarCampanha3CPlus`)

**Gatilho:** a mesma tela. `carregarCampanhasCriadas` chama `acao:'detalhes'` para cada `CampanhaVendaFlow` (`PowerDialerControle.jsx:168-197`). Também há `buscarAgentes3C` (`acao:'agentes'`, `:297-309`) e `executarAcao3C` (pause/resume/delete/editar, mais `sincronizar_agentes` em paralelo; `:321-360`). Único chamador encontrado: `PowerDialerControle.jsx`.

**Passo a passo:**
1. [`backend/functions/gerenciarCampanha3CPlus/entry.ts:10-20`] Exige usuário autenticado e `empresaId`, `campanha_id_3cplus` e `acao`. Não confere papel nem vínculo.
2. [`:24-30`] `credencialGestor`.
3. Chamadas ao 3C por ação:
   - `pause`: `PUT /campaigns/{id}/pause` (`:39`); se ok, **CampanhaVendaFlow.update** `status='pausada'` (`:43-48`).
   - `resume`: `PUT /campaigns/{id}/resume` (`:54`); se ok, `status='ativa'` (`:58-63`).
   - `delete`: `DELETE /campaigns/{id}` (`:69`); se ok, `status='encerrada'` (`:72-80`).
   - `editar`: `GET /campaigns/{id}` (`:90`), merge dos dados e `PUT /campaigns/{id}` com o payload completo (`:124`).
   - `detalhes`: `GET /campaigns/{id}` (`:128`). `agentes`: `GET /campaigns/{id}/agents` (`:132`).
   - `adicionar_agente`: `POST /campaigns/{id}/agents`, multipart `agents[]` via `fetch3C` (`:141-145`).
   - `sincronizar_agentes`: `GET /campaigns/{id}/agents`, depois `DELETE /campaigns/{id}/agents/{agentId}` para cada agente removido e `POST /campaigns/{id}/agents` para cada novo (`:156-183`).
4. [`:213-216`] Resposta: `{success, acao, statusCode, data: <corpo 3C>}`.
5. [`PowerDialerControle.jsx:180-185`] O front lê `det?.data?.data || det?.data` e procura `is_active` ou `active`. Se o status calculado divergir, grava **CampanhaVendaFlow.update** `status` pelo **cliente** (`api.entities`).

**Estados/campos que mudam:** `CampanhaVendaFlow.status` (`pausada`, `ativa`, `encerrada`), pelo backend e também pelo front.

**Eventos de socket envolvidos:** nenhum.

**Pontos em aberto observados:**
1. **Ações de campanha sem checagem de papel.** Qualquer usuário autenticado pode pausar, retomar, excluir ou editar campanhas e mexer nos agentes de uma campanha com o token de gestor de qualquer `empresaId` enviado (`:10-30`).
2. **Status calculado sobre o corpo com envelope.** Em `PowerDialerControle.jsx:180`, `det.data.data` é o corpo inteiro devolvido pelo 3C. A própria função trata esse corpo como `dGet?.data || dGet` (`gerenciarCampanha3CPlus/entry.ts:92`), o que indica que o 3C envolve a campanha em `data`. Se for assim, `camp3c.is_active` é `undefined` e o status não é recalculado. É uma inferência pelo formato usado na própria função; não validei contra a API real.

### 5C. Click2call do gestor (Softphone → `ligarAgoraLead3CPlus` com `forcar_metodo:'click2call'`)

**Gatilho:** no Softphone, gestor/admin (`nivel >= 4`, `frontend/src/components/telefonia/Softphone3CPlus.jsx:71`) clica em "ligar" no teclado (`discarManual`, `:319-380`).

Onde procurei `click2call` e variações: `frontend/src` e `backend`. O endpoint 3C `/click2call` só é chamado em `powerDialer3CPlus` e `ligarAgoraLead3CPlus`. `acaoAgente3CPlus` (pausar, retomar, deslogar, spy, whisper, stop_spy, listar_intervalos; chamado por `MonitoramentoAoVivo.jsx:409,442` e `qaTest3CPlus`), `executarComando3CPlus` e `gerenciarCampanha3CPlus` **não** fazem click2call. Não encontrei função "ligar para agente": procurei `ligarParaAgente`, "ligar para agente" e `click.to.call` em `frontend/src`.

**Passo a passo:**
1. [`Softphone3CPlus.jsx:326-357`] Se o usuário é gestor/admin, exige `userProfile.ramal_3cplus` e usa `leadIdAtual = manualCallSession?.lead_id`. Havendo `leadIdAtual`, chama `invoke("ligarAgoraLead3CPlus", {empresaId, lead_id, forcar_metodo:"click2call"})`. Sem ele, segue para `telefonia.iniciarLigacaoManual` (discagem manual comum, `:360-366`).
2. [`backend/functions/ligarAgoraLead3CPlus/entry.ts:32-59`] Exige autenticação e lê o Lead com `get`; se falhar, usa `filter` por empresa.
3. [`:62-71`] Lock com menos de 15 min: responde 409 `LEAD_LOCKED`.
4. [`:74-94`] Idempotência: se existe CallSession `iniciando` do mesmo lead e SDR há menos de 30 s, devolve a sessão existente.
5. [`:97-116`] `carregarConfig3C` e `credencialAgente` do usuário logado.
6. [`:119-123`] Ramal: apenas `UserProfile.ramal_3cplus`.
7. [`:131-144`] **Lead.update** (lock); **CallSession.create** `status='iniciando'`, `origem='manual'`, `session_scope='lead'`; **Lead.update** `call_session_id`.
8. [`:151-174`] Com ramal e credencial de gestor: **3C `POST /click2call`** com `{extension, phone}`. Se ok, lê `chamadaId` do corpo. Se 422, cai no método B.
9. [`:177-196`] Método B, por fallback ou quando não há ramal ou token de gestor: **3C `POST /agent/manual_call/enter`** e **`POST /agent/manual_call/dial`** com a credencial de agente.
10. [`:199-210`] Falha: **Lead.update** desfaz o lock; **CallSession.update** `status='failed'`, `finalizada_em`, `erro_mensagem`. Responde 502.
11. [`:212-215`] Sucesso com `chamadaId`: **CallSession.update** `chamada_id_3cplus`, `status='ringing'`.

O outro chamador do mesmo endpoint, sem `forcar_metodo` (click2call preferido quando há token de gestor e ramal), é `TelefoniaContext.ligarAgoraLead` (`frontend/src/contexts/TelefoniaContext.jsx:459-491`), usado por `TaskCard.jsx:208`. Ele cria uma sessão local `aguardando_confirmacao` com timeout de 15 s. Esse caminho pertence ao fluxo de ligação por lead e só é citado aqui como contexto.

**Estados/campos que mudam:** `Lead` (lock e `call_session_id`); `CallSession` (`iniciando` → `ringing` ou `failed`; `chamada_id_3cplus`).

**Eventos de socket envolvidos:** a função não emite eventos. A confirmação chega pela ponte do agente (I7): `call-was-connected` e `manual-call-was-answered`, roteados em `frontend/src/contexts/telefonia/useTelefoniaSocket.js:73-139`.

**Pontos em aberto observados:**
1. **O ramo de click2call do gestor não é alcançável pela interface.** Ele só roda com `manualCallSession?.lead_id` preenchido (`Softphone3CPlus.jsx:326,334`). Mas o botão "ligar" fica desabilitado quando `!!manualCallSession` (`:749`), e a tecla Enter também exige `!manualCallSession` (`:704`).
2. **Número digitado descartado.** No ramo do gestor, o número digitado (`telefone`, `:320`) não é enviado. `ligarAgoraLead3CPlus` disca `lead.telefone` do `lead_id` (`entry.ts:125`), e o toast mostra o número digitado (`Softphone3CPlus.jsx:346`).
3. **Sem sessão local no ramo do gestor.** O `call_session_id` retornado não é guardado no contexto de telefonia (`Softphone3CPlus.jsx:343-350`), ao contrário de `TelefoniaContext.ligarAgoraLead` (`:474-482`).

---

## 6. Monitoramento do gestor

**Gatilho:**
- Página `MonitoramentoAoVivo` (`frontend/src/pages/MonitoramentoAoVivo.jsx:314`), item de menu `gestorOuAdminOnly` (`frontend/src/Layout.jsx:54`, filtro em `:214`, `:362`); permissões por papel em `frontend/src/components/lib/pagePermissions.jsx:151-155`.
- Componente `PainelSupervisor` (`frontend/src/components/crm/PainelSupervisor.jsx:39`), renderizado em `frontend/src/pages/Tarefas.jsx:765` (visão "Painel da Equipe").

**Passo a passo:**

### 6.1 MonitoramentoAoVivo — carga

1. `MonitoramentoAoVivo.jsx:319-326` lê `Integracao` (`empresaId`, `tipo:'telefonia'`, `ativa:true`) e define `monitoramentoConfigurado = !!integracoes[0].configuracao.token_gestor` (o valor chega mascarado como `••••••••` por `backend/src/entities.ts:143-186`; só a presença conta). RLS de `Integracao.read`: `data.empresaId == user.data.empresaAtualId` (`backend/entities/Integracao.jsonc:76-78`).
2. `:336` → `useMonitoramentoRealTime({ empresaId, habilitado: monitoramentoConfigurado })` (`frontend/src/hooks/useMonitoramentoRealTime.js:49-184`):
   - 2a. `:171-175` → `carregarEstadoInicial` (`:67-82`) → `invoke('monitoramento3CPlus', {empresaId})`.
   - 2b. `:156-163` → `useTelefoniaSocketGestor` (ver 6.3).
3. `MonitoramentoAoVivo.jsx:511-516` → `buscarDados()` (`:379-404`) no mount e a cada 60 s (`POLLING_MS`, `:23`) → também `invoke('monitoramento3CPlus', {empresaId})`. No mount há, portanto, duas chamadas à mesma função (2a e 3).
4. Backend `backend/functions/monitoramento3CPlus/entry.ts`:
   - 4a. `:11-12` exige usuário autenticado; `:21` `credencialGestor(api, empresaId)` (lê `Integracao.configuracao.token_gestor`, decripta; `telefonia3c.ts:67-72`). Erro de credencial → 424 (`:23-25`).
   - 4b. `:40` `GET /campaigns?per_page=100` (Bearer token de gestor); filtra `!c.paused` (`:43`).
   - 4c. `:45-51` para cada campanha, `GET /campaigns/{id}/agents/status` em paralelo (`Promise.allSettled`).
   - 4d. `:53-77` consolida por `agent.id` (fica o maior `status`), calcula `duracao` a partir de `status_start_time`, `ramal`, `campanha_id` (`logged_campaign` ou a campanha), `em_ligacao` (status 2, 5 ou 4), `em_manual`, `em_pausa` (6), `disponivel` (1). Resposta `{ agentes, metricas, campanhas }` (`:89-92`). Campos devolvidos por agente: `id, nome, ramal, status, status_label, status_cor, status_icone, campanha_id, campanha_nome, duracao, em_ligacao, em_manual, em_pausa, disponivel` (sem `email` e sem `call_id`).
5. `MonitoramentoAoVivo.jsx:383-400`: grava estado `agentes`, `metricas`, `campanhas`, `ultimaAtt`, `conectado=true`; limpa `infoCliente` de quem saiu de ligação; para agentes `em_ligacao && email` chama `buscarInfoCliente` (`:416-436`: lê `CallSession` `{empresaId, sdr_email, status:'answered'}` e `Lead` por `id`).
6. `useMonitoramentoRealTime.js:73-78` preenche `agentesMapRef` com os agentes da resposta e `campanhas`; `sincronizarState` (`:58-64`) ordena, recalcula métricas localmente (`calcularMetricas`, `:39-47`: `emLigacao` só status 2/5) e seta `ultimaAtt`.
7. `MonitoramentoAoVivo.jsx:501-509`: se `conectadoSocket && agentesSocket.length > 0`, substitui `agentes/metricas/campanhas/ultimaAtt` pelos do hook.

### 6.2 PainelSupervisor

8. `PainelSupervisor.jsx:51-63`: mesma leitura de `Integracao` e mesmo `useMonitoramentoRealTime`.
9. `:66-72` indexa `agentesAoVivo` por `a.email.toLowerCase()`; `:211-218` associa a cada membro (de `VinculoEmpresa` com papel operacional, `:135-144`) o `statusTelefonia` pelo e-mail, com `duracao_ao_vivo = duracao + tickCount` para em ligação/pausa (`tickCount` incrementa 1/s desde o mount, `:42-46`).
10. Outras leituras (30 s/15 s): `VinculoEmpresa`, `Tarefa`, `Atividade`, `Lead`, `UserProfile.filter({ empresaId })` (`:74-106`).

### 6.3 Sala `telefonia:gestor:<empresaId>` (tempo real)

11. `frontend/src/contexts/telefonia/useTelefoniaSocketGestor.js:33` `alvo = habilitado && empresaId`; `:38-42` se o singleton de módulo já existe para a mesma empresa, só aponta `socketRef` e copia `connected`; senão `:46` `criarSocketPonte(salaGestor(alvo))` → `join telefonia:gestor:<empresaId>` (mesmo caminho de 0c do Fluxo 2).
12. Backend: guard `ponte3c.podeEntrar` → `podeMonitorar` (`ponte3c.ts:60-69`): admin global; ou `Empresa.ownerEmail == user.email`; ou `VinculoEmpresa {empresaId, userEmail}` não inativo com `papel` em `PAPEIS_MONITOR` (`super_admin, admin, gestor_empresa, gerente_empresa, gerente_filial, supervisor, gestor`, `:24`); ou `UserProfile.role` nesse conjunto e (`perfil.empresaId` vazio ou igual). Entidades lidas com service role: `Empresa`, `VinculoEmpresa`, `UserProfile`.
13. `aoEntrarNaSala` (`ponte3c.ts:80-81`) → `abrir(sala, credencialGestor(empresaId))` → socket 3C com `query { token: token_gestor }` (sem `agent_id`), repasse integral via `onAny` (`:146`). Fecha 60 s após esvaziar (`:166-173`).
13a. Navegador (`useTelefoniaSocketGestor.js:62-94`): `list-empty` e `reached-max-online-agents` → `onAvisoOperacional` (`:66-69`); `agent-*` → `onEventoAgente` (`:72-75`); `campaign-*` → `onEventoCampanha` (`:78-81`); lista fixa de eventos de chamada → `onEventoChamada` (`:84-93`).
14. `useMonitoramentoRealTime.js:85-127` (`onEventoAgente`): mapeia o evento por `EVENTO_PARA_STATUS` (`:24-37`); id do agente de `data.agent_id || data.agent.id || data.id`; atualiza ou cria entrada no mapa (entradas novas trazem `nome`, `email`, `ramal` do evento, `:109-124`); `duracao` volta a 0; `sincronizarState`.
15. `onEventoCampanha` só loga (`:129-132`); `onEventoChamada` não faz nada (`:134-136`); `onAvisoOperacional` mostra toast com deduplicação de 10 min (`:140-153`).
16. `conectadoSocket` = `conectado.current` (ref do hook gestor, `useTelefoniaSocketGestor.js:32`, `:48-56`) copiado em `useEffect` com dependência `[conectado.current]` (`useMonitoramentoRealTime.js:166-168`).

### 6.4 Ações do gestor sobre agentes (`acaoAgente3CPlus`) e Spy

17. `MonitoramentoAoVivo.jsx:406-414` `carregarIntervalos` (ao abrir o seletor de pausa, `:684`) → `acaoAgente3CPlus {acao:'listar_intervalos'}` → `backend/functions/acaoAgente3CPlus/entry.ts:52-62`: `GET /campaigns/{campanha_id || campanha_id_padrao}/intervals` com token de gestor.
18. `executarAcao` (`MonitoramentoAoVivo.jsx:438-491`) → `acaoAgente3CPlus { empresaId, acao, agent_id: agente.id, ...params }`:
   - `pausar` (`entry.ts:64-79`): `PUT /agents/{agent_id}/work_break` form `work_break_id`, token de gestor; 204 ok, 422 "não disponível".
   - `retomar` (`:81-91`): `POST /agent/work_break/exit` com `credencialAgenteDoGestor` (credencial de agente **do próprio gestor**: `credencialAgente(email do gestor)` → fallback `configuracao.token_agente_gestor` → token de gestor, `:12-23`).
   - `deslogar` (`:93-101`): `POST /agents/{agent_id}/logout` com token de gestor. O agente recebe `agent-was-logged-out` pela sala dele (Fluxo 2, passo 12).
   - `spy` (`:103-113`): `POST /spy/{agent_id}/start` com credencial de agente do gestor; 409 já escutando, 404 agente não logado.
   - `whisper` (`:115-128`): `POST /spy/{agent_id}/start?whisper=true` (parâmetro marcado no código como não documentado).
   - `stop_spy` (`:130-145`): `DELETE /spy/stop`.
   - Sucesso → toast, **grava `MonitoramentoLog`** pelo navegador (`empresaId, gestor_email, agente_id, agente_nome, acao, campanha_nome, work_break_nome, sucesso:true, executado_em`) (`MonitoramentoAoVivo.jsx:456-466`) e agenda `atualizarAgora` em 1,5 s (`:470`, `:493-498`: `buscarDados` + `recarregarSocket`). Resposta com `success:false` em 2xx → grava `MonitoramentoLog` com `sucesso:false, erro_mensagem` (`:471-485`). Exceção (HTTP não-2xx) → só toast (`:486-487`).
19. `PainelSpyMonitoramento.jsx` (renderizado em `MonitoramentoAoVivo.jsx:699-705`): exibe quando `spyAtivo` existe (`PainelSpyMonitoramento.jsx:6`); mostra `infoCliente[agente.id]` (lead/telefone de `CallSession`); troca de modo chama `onAcao(agente, 'spy'|'whisper')` e `setSpyAtivo` (`:129-133` do arquivo, bloco a partir de `:80`); "encerrar" chama `onAcao(agente,'stop_spy')` e `setSpyAtivo(null)` (`:147-150`). Os botões de spy no card chamam `onAcao(...)` e `setSpyAtivo(...)` na mesma expressão, sem aguardar o resultado (`MonitoramentoAoVivo.jsx:159`, `:167`, `:193`, `:206-208`).

### 6.5 `buscarStatusAgentes3CPlus`

20. `backend/functions/buscarStatusAgentes3CPlus/entry.ts` — marcada DEPRECADO (`:13`); `GET /campaigns/{campanha_id_padrao}/agents/status` com token de gestor (`:27`). Não há chamada no frontend (busca por `buscarStatusAgentes3CPlus` em `frontend/src`: nenhuma; no backend só `qaTest3CPlus`).

**Estados/campos que mudam:**
- `MonitoramentoAoVivo`: `agentes`, `metricas`, `campanhas`, `conectado`, `ultimaAtt`, `intervalos`, `acaoProcessando`, `seletorPausa`, `confirmDeslogar`, `spyAtivo`, `infoCliente`, `filtroStatus`, `filtroCampanha`; `pollingRef` (60 s).
- `useMonitoramentoRealTime`: `agentesMapRef` (Map id→agente), `agentes`, `metricas`, `campanhas`, `conectadoSocket`, `ultimaAtt`, `avisosMostradosRef`.
- `useTelefoniaSocketGestor`: singleton de módulo `_gestorSocket/_gestorEmpresa` (`:16-17`), `conectado` (ref).
- `PainelSupervisor`: `tickCount` (1/s), mapas por e-mail.
- Backend: `pontes` (sala gestor), `membros`.
- Entidades: **gravada** `MonitoramentoLog` (pelo navegador). **Lidas**: `Integracao`, `CallSession`, `Lead`, `VinculoEmpresa`, `Tarefa`, `Atividade`, `UserProfile`, `Empresa` (guard). Nenhuma entidade de status de agente é lida/gravada.

**Eventos de socket envolvidos:**
| Evento | Emissor | Quem escuta (onde) | Efeito |
|---|---|---|---|
| `__ponte:*` | `ponte3c.ts:116,133-145` | `socketPonte.js:90-108` → `useTelefoniaSocketGestor.js:48-60` | `conectado.current` |
| `agent-is-idle`, `agent-in-acw`, `agent-entered-manual-acw`, `agent-left-manual-mode`, `agent-entered-work-break`, `agent-left-work-break`, `agent-was-logged-out` (+ aliases `agent-is-free`, `agent-is-connected`, `agent-entered-call`, `agent-entered-manual-mode`, `agent-logged-out`) | 3C (token gestor) → ponte | `useMonitoramentoRealTime.js:85-127` | status no mapa |
| outros `agent-*` (ex.: `agent-entered-manual`, `agent-left-manual-acw`, `agent-login-failed`) | 3C → ponte | `useTelefoniaSocketGestor.js:72-75` → descartados em `useMonitoramentoRealTime.js:86-87` | nenhum |
| `campaign-*` | 3C → ponte | `useMonitoramentoRealTime.js:129-132` | só log |
| `call-was-connected`, `call-was-answered`, `call-was-finished`, `call-was-not-answered`, `call-was-abandoned`, `call-history-was-created`, `manual-call-was-answered` (+ aliases) | 3C → ponte | `useMonitoramentoRealTime.js:134-136` | nenhum |
| `list-empty`, `reached-max-online-agents` | 3C → ponte | `useMonitoramentoRealTime.js:141-153` | toast |
| `spy-started/ended/failed` | 3C → ponte | não há tratamento (não começam com `agent-`/`campaign-` nem estão na lista de chamada, `useTelefoniaSocketGestor.js:62-94`) | nenhum |

**Pontos em aberto observados:**
1. `useTelefoniaSocketGestor` é singleton por empresa, mas o `onAny` com os handlers é registrado só pela primeira instância (`useTelefoniaSocketGestor.js:38-42` retorna cedo; `:62` só roda na criação). Uma segunda instância (ex.: abrir `MonitoramentoAoVivo` depois de `Tarefas`/`PainelSupervisor`) não recebe eventos em seus handlers; os eventos continuam indo ao `handlersRef` da primeira instância. Não há cleanup ao desmontar (`:35-99`), então a sala e a ponte ficam ativas enquanto a aba estiver aberta.
2. `conectadoSocket` é derivado de um `useRef` (`useTelefoniaSocketGestor.js:32`) em `useEffect([conectado.current])` (`useMonitoramentoRealTime.js:166-168`); a mudança do ref não provoca re-render, então o valor só é atualizado quando outro estado do componente muda. `MonitoramentoAoVivo.jsx:502` só aplica os dados do socket quando `conectadoSocket` é `true`.
3. Status "em ligação" via socket depende de `agent-is-connected`/`agent-entered-call` (`useMonitoramentoRealTime.js:27-28`), que não constam na lista oficial de eventos de agente (`docs/3cplus/EVENTOS_SOCKET.md`, seção Agente; no código são "aliases", `TELEFONIA_ENGINE.js:108`); os eventos de chamada são ignorados (`useMonitoramentoRealTime.js:134-136`). A entrada em ligação só aparece pelo polling REST de 60 s.
4. `EVENTO_PARA_STATUS` usa `agent-entered-manual-mode` (`useMonitoramentoRealTime.js:31`), enquanto o evento oficial é `agent-entered-manual` (`TELEFONIA_ENGINE.js:55`); `agent-left-manual-acw` também não está mapeado. Esses eventos não mudam o status no painel.
5. `monitoramento3CPlus` não devolve `email` nem `call_id` por agente (`monitoramento3CPlus/entry.ts:65-74`). Efeitos no código: `buscarInfoCliente` só é chamado para agentes com `email` (`MonitoramentoAoVivo.jsx:400`) — não ocorre para os agentes vindos do REST; `PainelSupervisor` indexa por e-mail (`PainelSupervisor.jsx:68-70`) — agentes do REST não casam com nenhum membro, só os criados por evento de socket com `agent.email` (`useMonitoramentoRealTime.js:112`); os botões de spy/whisper condicionados a `agente.call_id` (`MonitoramentoAoVivo.jsx:156`) não são exibidos; `call_id` enviado ao backend (`:159`, `:167`) não é lido por `acaoAgente3CPlus` (`entry.ts:38`).
6. `monitoramento3CPlus` e `acaoAgente3CPlus` só exigem usuário autenticado (`monitoramento3CPlus/entry.ts:11-12`, `acaoAgente3CPlus/entry.ts:32-33`) e usam o token de gestor da `empresaId` recebida no corpo; não encontrei checagem de papel ou de vínculo com a empresa nesses arquivos (diferente do guard da sala, `ponte3c.ts:60-69`).
7. `MonitoramentoLog` é gravado pelo navegador após a resposta (`MonitoramentoAoVivo.jsx:456-484`), não pela função; exceções HTTP (ex.: 409/404/422/502 do spy/pausar) caem no `catch` (`:486-487`) e não geram log. `MonitoramentoLog.jsonc` não define `rls` (lista de entidades com `rls`: Atividade, Empresa, Filial, Integracao, Lead, LogImpersonacao, RespostaDiagnostico, Tarefa, VinculoEmpresa). Leitura: existe `listarLogsMonitoramento` em `frontend/src/lib/services/dashboardService.js:72-75`, mas não tem chamador (busca por `listarLogsMonitoramento` em `frontend/src`: só a declaração); no backend não há referência a `MonitoramentoLog` fora do schema (busca no projeto inteiro). O log é gravado e ninguém o lê.
8. `retomar` executa `POST /agent/work_break/exit` com a credencial de agente **do gestor** (`acaoAgente3CPlus/entry.ts:81-86`), não do agente alvo; `agent_id` enviado pelo front (`MonitoramentoAoVivo.jsx:443`) não é usado nessa ação.
9. Spy/whisper usam a credencial de agente do gestor; o áudio do spy depende de o ramal do gestor estar registrado. No CRM o ramal só é registrado após `VENDAFLOW_SET_AGENT`, que não é enviado para nível ≥ 4 (`Softphone3CPlus.jsx:109`, `:138`); não encontrei outro envio de `VENDAFLOW_SET_AGENT` na página de monitoramento (busca em `frontend/src`: só `useTelefoniaActions.js:73` e `Softphone3CPlus.jsx:141`).
10. `setSpyAtivo` é chamado antes/independente do resultado de `onAcao` (`MonitoramentoAoVivo.jsx:159`, `:167`, `:193`, `:207-208`): o painel "AO VIVO" abre mesmo se o spy falhar. Eventos `spy-started/spy-ended/spy-failed` não são tratados (`useTelefoniaSocketGestor.js:62-94`).
11. `/campaigns` é chamado com `per_page=100` sem paginação (`monitoramento3CPlus/entry.ts:40`); o comentário em `backend/src/telefonia3c.ts:125-126` registra que a API do 3C pagina em 25 e ignora `per_page` maior (observação feita para `/agents`; para `/campaigns` não verificado).
12. Duas chamadas simultâneas a `monitoramento3CPlus` no mount (`useMonitoramentoRealTime.js:171-175` e `MonitoramentoAoVivo.jsx:511-516`), cada uma com 1 + N chamadas ao 3C (N = campanhas não pausadas); `PainelSupervisor` faz mais uma na sua própria instância.
13. Divergências de regra entre backend e hook: `em_ligacao` inclui status 4 no backend (`monitoramento3CPlus/entry.ts:70`) e não no hook (`useMonitoramentoRealTime.js:101`, `:121`); o hook zera `duracao` a cada evento (`:104`); `PainelSupervisor` soma `tickCount` desde o mount do componente, não desde a mudança de status (`PainelSupervisor.jsx:216`).
14. `monitoramentoConfigurado` usa `integracoes[0]` sem filtrar `configuracao.fornecedor === '3cplus'` (`MonitoramentoAoVivo.jsx:326`, `PainelSupervisor.jsx:58`), enquanto o backend procura a integração com esse fornecedor (`telefonia3c.ts:59`).
15. `PainelSupervisor` filtra `UserProfile` por `empresaId` (`PainelSupervisor.jsx:103`), campo que não existe no schema `backend/entities/UserProfile.jsonc` (propriedades verificadas; há `modo_ativo`, não há `empresaId`). O guard da sala gestor também lê `perfil.empresaId` (`ponte3c.ts:68`).
16. `buscarStatusAgentes3CPlus` sem consumidor no frontend (item 20 acima). A função `monitoramento3CPlus` é a única fonte REST do painel.
17. Guard negado em `join` da sala gestor é silencioso (`realtime.ts:55`): usuário sem papel de monitoramento que abra `PainelSupervisor` fica sem eventos e sem `connect_error`; o painel segue só com REST.

---

## 7. Automações e alertas

**Gatilho:**
- `processarAutomacoes`: botão "executar agora" em `frontend/src/pages/Automacoes.jsx:101`. Nenhum outro chamador (grep em `frontend/src`, `backend`).
- `verificarAlertas`: botão em `frontend/src/pages/ConfiguracaoAlertas.jsx:81, 153`. Nenhum outro chamador.
- `enviarCampanhasAgendadas`: **nenhum chamador** (grep em `frontend/src`, `backend/src`, `backend/functions`, `extension`, `docs`). Só rodaria por cron, que não existe.
- `calcularLeadScore`: botão "recalcular" em `frontend/src/components/crm/LeadModal.jsx:130`; `backend/functions/processarLeadLandingPage/entry.ts:86`; `backend/functions/trackEmailClick/entry.ts:57` (chamada a partir de `frontend/src/pages/EmailRedirect.jsx:23`).
- Os comentários das três primeiras dizem "Job sistêmico agendado" (`processarAutomacoes/entry.ts:17`, `verificarAlertas/entry.ts:16`, `enviarCampanhasAgendadas/entry.ts:14`); todas exigem `user.role === 'admin'` via `auth.me()`.

**Passo a passo:**

**7a. `processarAutomacoes`** (`backend/functions/processarAutomacoes/entry.ts`)
1. `:7-11` exige `role === 'admin'` (não aceita `super_admin`).
2. `:20` lista `Empresa {statusPlano:'ativo'}` de **todas** as empresas.
3. `:24-30` por empresa: `AutomacaoRegra {ativa:true, empresaId}` ordenadas por `prioridade`.
4. `:32-36` lê `Lead`, `Tarefa`, `Atividade` da empresa.
5. Seleção de leads por `trigger` (`:42-89`): `mudanca_status_lead` (status na lista `condicoes.status_lead`, sem comparar com status anterior); `sem_atividade` (≥ `dias_sem_atividade`, padrão 3); `tarefa_atrasada` (tarefa pendente com ≥ `dias_atraso`, padrão 1); `reuniao_proxima` (`data_reuniao` dentro de `horas_antes_reuniao`, padrão 24); `novo_lead` (criado há ≤ 2 h). Filtro opcional `condicoes.origem_lead` (`:91-95`).
6. Ações por `tipo`:
   - `criar_tarefa` `:101-118` → `Tarefa.create` (`sdr_email = sdr_responsavel || closer_responsavel`, `tipo`, `data_prevista = hoje + dias_futuro`, `periodo`, `status:'pendente'`, observação com o nome da automação).
   - `enviar_lembrete` `:120-150` → se `acoes.notificar_app`: `Alerta.create` (`tipo:'anomalia'`, `destinatarios` = `acoes.destinatarios` ou `[sdr_responsavel]`, `prioridade:'media'`); se `acoes.enviar_email`: `Core.SendEmail` por destinatário (SMTP, `backend/src/integrations.ts:51-60` → `backend/src/mailer.ts:77-84`).
   - `escalar_lead` `:152-166` → `Lead.update {closer_responsavel: acoes.escalar_para}` + `Alerta.create` (`prioridade:'alta'`).
   - `notificar_reuniao` `:168-189` → `Alerta.create` para closer+SDR + e-mail opcional.
7. `:191-202` cria `LogAutomacao` (`automacao_regra_id`, `automacao_nome`, `lead_id`, `lead_nome`, `acao_executada`, `status:'sucesso'`, `detalhes`). Em exceção `:204-212`, `LogAutomacao` com `status:'erro'`.
8. Retorna `{automacoes_executadas, logs}`.

**7b. `verificarAlertas`** (`backend/functions/verificarAlertas/entry.ts`)
1. `:9-11` exige `role === 'admin'`.
2. `:19` `Empresa {statusPlano:'ativo'}` (todas); `:22` `User.list()` (tabela global).
3. `:26-37` por empresa: `ConfiguracaoAlerta {ativo:true, empresaId}`; lê `Lead`, `Atividade`, `Tarefa`, `ConfiguracaoMeta {empresaId}`.
4. `:51-74` período `diario|semanal|mensal` e filtros por `created_date`.
5. `:76-136` valor atual por escopo: `individual` (métricas `leads, ligacoes, reunioes_marcadas, reunioes_realizadas, tarefas_concluidas, vendas`, meta de `User.meta_mensal.*`) ou `empresa` (métricas `leads, mql, conexoes, reunioes_marcadas, reunioes_realizadas, vendas, faturamento`, meta de `ConfiguracaoMeta.meta_*`). "Vendas" = leads com `status:'qualificado'`.
6. `:138-155` condição `percentual_meta` (tipos `meta_em_risco`/`meta_atingida`) ou comparação numérica.
7. `:179-184` dedup: não cria se já houver `Alerta` não resolvido da mesma configuração nas últimas 24 h.
8. `:187-201` `Alerta.create` (`empresaId`, `configuracao_alerta_id`, `tipo`, `titulo`, `mensagem`, `metrica`, `valor_atual`, `valor_esperado`, `destinatarios`, `prioridade`, `usuario_referencia`, `periodo_referencia`).
9. `:204-212` se `enviar_email`, `Core.SendEmail` para cada destinatário.

**7c. `enviarCampanhasAgendadas`** (`backend/functions/enviarCampanhasAgendadas/entry.ts`)
1. `:6-10` exige `role === 'admin'`.
2. `:17-23` `CampanhaAgendada {status:'pendente'}` (todas as empresas) com `data_envio <= agora`.
3. `:34` busca o template com `api.asServiceRole.entities.EmailTemplate.read(...)`.
4. `:47-56` sem `empresaId` → `status:'erro'`.
5. `:58-63` leads `{empresaId, status?, origem?}` com e-mail.
6. Por lead: `:72-81` `EmailEnvio.create` (`template_id`, `template_nome`, `destinatario_email/nome`, `lead_id`, `assunto`, `status:'enviado'`, `enviado_por`); `:84-110` troca `{nome}`, `{empresa}`, `{dores_mapeadas}` e reescreve links para `https://<host>/EmailRedirect?envio_id&lead_id&destino`; `:113-118` `Core.SendEmail`.
7. `:128-133` `CampanhaAgendada.update` → `status:'enviado'`, `total_enviados`, `total_falhas`, `data_execucao`.
8. `:136-154` sequência: reagenda a próxima (`ordem_sequencia + 1`) para `agora + dias_apos_anterior`.
9. `:159-165` em exceção → `status:'erro'`, `erro_mensagem`.

**7d. `calcularLeadScore`** (`backend/functions/calcularLeadScore/entry.ts`)
1. `:6-9` exige usuário logado (qualquer papel).
2. `:18` lê `Lead` pelo client do usuário (RLS `empresaId = empresaAtualId`); `:26-28` recusa se `lead.empresaId` ≠ `user.empresaAtualId`.
3. `:31-32` lê `Atividade {lead_id, empresaId}` e `EmailEnvio {lead_id, empresaId}`.
4. Pontuação: perfil 0-40 (`respostas_formulario`, cargo decisor, `empresa`, `produto_interesse`) `:50-73`; engajamento (cliques em e-mail até 20, resposta email/whatsapp 15, reunião agendada 20, reunião realizada 25) `:76-103`; comportamento (resposta < 24 h, ≥ 3 atividades, > 1 `produto_id`) `:106-131`.
5. `:137-139` temperatura: ≥ 80 `quente`, ≥ 50 `morno`, senão `frio`.
6. `:142-175` `LeadScore` por `lead_id`: atualiza ou cria (`score_total`, `score_perfil`, `score_engajamento`, `score_comportamento`, `temperatura`, `detalhes_pontuacao`, `historico_scores` (últimos 10), `ultima_atualizacao`).
7. Não altera o `Lead` (o campo `Lead.temperatura_lead` não é tocado — grep em `backend/functions`).

**Estados/campos que mudam:**
- `Tarefa` (nova, `pendente`), `Lead.closer_responsavel` (escalar), `Alerta` (novo, `resolvido:false` por default), `LogAutomacao` (novo).
- `CampanhaAgendada.status` (`pendente → enviado | erro`), `total_enviados`, `total_falhas`, `data_execucao`, `erro_mensagem`; `data_envio` da próxima da sequência; `EmailEnvio` (novo).
- `LeadScore` (criado/atualizado).
- E-mails via SMTP (`backend/src/mailer.ts`).
- No frontend, `Alerta.visualizado_por`, `resolvido`, `resolvido_por`, `resolvido_em` são alterados em `frontend/src/components/alertas/AlertasCard.jsx:103-115, 190`.

**Eventos de socket/realtime envolvidos:**
- `update_model` em `entities:Tarefa`, `entities:Alerta`, `entities:LogAutomacao`, `entities:Lead`, `entities:CampanhaAgendada`, `entities:EmailEnvio`, `entities:LeadScore` a cada gravação (`backend/src/entities.ts:271, 300`). Nenhum assinante no frontend. `AlertasCard` busca alertas por polling a cada 30 s (`AlertasCard.jsx:98`).

**Pontos em aberto observados:**
1. **`enviarCampanhasAgendadas` chama um método que não existe:** `EmailTemplate.read(...)` (`enviarCampanhasAgendadas/entry.ts:34`); o SDK só tem `get`/`filter`/… (`backend/src/sdk.ts:29-43`). A exceção cai no `catch` por campanha (`:159-165`), que grava `status:'erro'`.
2. **`enviarCampanhasAgendadas` não tem chamador** (grep em `frontend/src`, `backend`, `extension`, `docs`); dependia de cron, que não existe. As telas criam `CampanhaAgendada` com `status` default `pendente` (`frontend/src/components/email-marketing/CampanhaManager.jsx:51`, `SequenciaManager.jsx:41`).
3. **Execução agendada exige usuário admin:** as três funções "de job" validam `user.role === 'admin'` via `auth.me()` (`processarAutomacoes:7-11`, `verificarAlertas:7-11`, `enviarCampanhasAgendadas:6-10`). Uma chamada do n8n sem JWT de um usuário admin recebe 403; não existe emissor de token de serviço (`backend/src/auth.ts:51`, sem uso). `processarAutomacoes`/`verificarAlertas` hoje só rodam pelo botão das telas.
4. **Botões processam todas as empresas:** `processarAutomacoes:20` e `verificarAlertas:19` iteram `Empresa {statusPlano:'ativo'}` sem restringir à empresa do admin que clicou.
5. **`LogAutomacao` é gravado sem `empresaId`** (`processarAutomacoes:192-201, 205-211`; o `.jsonc` também não declara o campo), e a tela lista `LogAutomacao {empresaId}` (`frontend/src/pages/Automacoes.jsx:69`).
6. **`processarAutomacoes` repete ações a cada execução:** não consulta `LogAutomacao` nem tarefas/alertas existentes antes de criar (`:97-189`). `mudanca_status_lead` seleciona todos os leads no status, sem detectar mudança (`:43-49`).
7. **Tipo `atribuir_lead`** existe no enum `AutomacaoRegra.tipo` (`backend/entities/AutomacaoRegra.jsonc`) e não é tratado por `processarAutomacoes` (tipos tratados: `criar_tarefa`, `enviar_lembrete`, `escalar_lead`, `notificar_reuniao`).
8. **Campos gravados sem declaração no `.jsonc`:** `Alerta.empresaId` (`processarAutomacoes:126`, `verificarAlertas:188`), `AutomacaoRegra`/`ConfiguracaoAlerta.empresaId` são filtrados (`processarAutomacoes:24-27`, `verificarAlertas:26-29`) — `ConfiguracaoAlerta.jsonc` não declara `empresaId` (a tela grava: `frontend/src/pages/ConfiguracaoAlertas.jsx:63`). `CampanhaAgendada.jsonc` e `EmailEnvio.jsonc` não declaram `empresaId`.
9. **`ConfiguracaoMeta` sem `empresaId`:** `verificarAlertas:36` filtra `ConfiguracaoMeta {empresaId}`; a tela de metas cria com `create(data)` sem `empresaId` e lê com `list()` sem filtro (`frontend/src/pages/MetasEmpresa.jsx:18, 28`). Nesse caso a meta cai no `valor_threshold` (`verificarAlertas:109-133`). (`dashboardService.js:55-59` também tem criação/leitura; não rastreei seus chamadores.)
10. **Leitura de alertas no frontend:** `AlertasCard.jsx:76-79` busca `Alerta {resolvido:false}` sem `empresaId` e com o limite padrão de 50, filtrando depois por `destinatarios` no navegador. `Alerta.jsonc` não tem regras RLS. `alertaService.notificarGestores` grava `tipo:'tarefa_concluida'` e `prioridade:'normal'` (`frontend/src/lib/services/alertaService.js:23-26`), valores que não estão nos enums de `Alerta.jsonc`.
11. **Métricas/escopos do enum sem cálculo em `verificarAlertas`:** `ticket_medio`, `taxa_conversao` (enum de `ConfiguracaoAlerta.metrica`) e escopo `equipe` não têm `case` (`:76-136`); `equipeRef` fica sempre `null` (`:49`). Tipo `anomalia` não gera título/mensagem (`:165-177`).
12. **`destinatarios` pode ir vazio:** `verificarAlertas:196` usa `config.destinatarios` direto; `processarAutomacoes:130` filtra valores vazios. `AlertasCard` só mostra alertas cujo `destinatarios` contém o e-mail do usuário (`:79`).
13. **Limite de 50 registros:** `Lead`/`Tarefa`/`Atividade` (`processarAutomacoes:32-36`, `verificarAlertas:32-37`), `User.list()` (`verificarAlertas:22`), `Empresa` (`:20`/`:19`), `CampanhaAgendada` (`enviarCampanhasAgendadas:17`) e leads da campanha (`:62`) são limitados a 50 (`backend/src/entities.ts:232, 362`). Então as contagens de `verificarAlertas` consideram no máximo 50 itens por entidade.
14. **`EmailEnvio` de `enviarCampanhasAgendadas` sem `empresaId`** (`:72-81`), enquanto `calcularLeadScore:32` filtra `EmailEnvio {lead_id, empresaId}`. O envio manual da tela grava `empresaId` (`CampanhaManager.jsx:93`). `campanha_id` também não é gravado.
15. **Link de rastreio usa `https://` + header `Host`** (`enviarCampanhasAgendadas:91`); em chamada interna/agendada o `Host` é o do servidor da API. Não há pixel de abertura nesse caminho (o envio manual adiciona `trackEmailOpen` em `CampanhaManager.jsx:99`).
16. **`LeadScore` sem `empresaId`:** `calcularLeadScore:158-169` não grava `empresaId` (nem o `.jsonc` declara), e a lista de leads carrega scores com `LeadScore {empresaId}` (`frontend/src/lib/services/leadService.js:25-27`, usada em `frontend/src/pages/Leads.jsx:235`). O modal do lead busca por `lead_id` (`leadService.js:61`).
17. **`calcularLeadScore` a partir de chamadas públicas:** chamada de `processarLeadLandingPage:86` e `trackEmailClick:57` com o usuário da requisição original; sem login, `calcularLeadScore:7-9` retorna 401 (o erro é capturado pelos chamadores).
18. **Critérios do score que usam valores fora dos enums/schemas:** `Atividade.tipo === 'realizar_reuniao'` (`calcularLeadScore:99`) não existe no enum de `Atividade.tipo` (é valor de `Tarefa.tipo`); `lead.respostas_formulario` (`:51`) não está em `Lead.jsonc`.
19. **Score não reflete no Lead:** `calcularLeadScore` grava só `LeadScore.temperatura`; `Lead.temperatura_lead` existe no `.jsonc` e não é atualizado por esta função.

---

## 8. Sincronizações 3C

Quem chama cada função hoje (grep por nome em `frontend/src`, `backend/src`, `backend/functions` e `docs`):

| Função | Chamadores encontrados |
|---|---|
| `sincronizarAgentes3CPlus` | `frontend/src/components/integracoes/TelefoniaConfig.jsx:94`, `frontend/src/pages/GestaoUsuariosEmpresa.jsx:168` |
| `sincronizarTelefonia3CPlus` | nenhum; só citada em comentários (`finalizarLigacao3CPlus:12`, `processarEventos3CPlus:17,20`, `processarGravacao3CPlus:11`) |
| `processarEventos3CPlus` | nenhum; citada em `docs/TELEFONIA_CONTRATO.md:389` |
| `receberEvento3CPlus` | nenhum |
| `repairGravacoes3CPlus` | nenhum |
| `retryGravacoes3CPlus` | nenhum |
| `purgeGravacoes` | nenhum |
| `limparGravacoesInvalidas` | nenhum |

### 8.1 `sincronizarAgentes3CPlus`

**Gatilho:** botão "sincronizar agentes" em `TelefoniaConfig.jsx:92-101` (`empresaId: integracao.empresaId`) e em `GestaoUsuariosEmpresa.jsx:164-185` (`empresaId: empresa[0].id`). O comentário `/* cron sem body */` (`entry.ts:49`) indica que ela já foi agendada; esse cron não existe hoje.

**Autenticação:** `users.role` precisa ser `'admin'` ou `'gestor'` (`backend/functions/sincronizarAgentes3CPlus/entry.ts:44-46`); ver I4. Todo o resto roda como service role.

**Passo a passo:**
1. [`:59-67`] `Integracao.filter({tipo:'telefonia', ativa:true, empresaId?})` e pega a primeira com `fornecedor='3cplus'`.
2. [`:73-77`] `credencialGestor(integracao.empresaId)`.
3. [`:81`] `temTokenServicoAgente = !!cfg.token_servico_agente`.
4. [`:86`] **3C `GET /agents`** com paginação (`listarAgentes`, `backend/src/telefonia3c.ts:128-138`). Monta o índice ramal → agente (`:95-102`).
5. [`:119-127`] `UserProfile.filter({'3cplus_sincronizado': false})`, ou `{}` se `forcar_todos`, e mantém os perfis com `ramal_3cplus`.
6. Para cada perfil com agente encontrado pelo ramal (`:136-179`):
   - **UserProfile.update**: `id_3cplus`, `3cplus_sincronizado=true`, `3cplus_sincronizado_em`.
   - Sem token de serviço de agente: **3C `GET /agents/{id}`** para ler `api_token` (`:105-116`), grava `token_3cplus` criptografado e guarda o token em texto puro em `mapeamentoAtualizado`.
7. [`:182-190`] Com pelo menos um vínculo: **Integracao.update** com as chaves `'configuracao.mapeamento_agentes'` (só no modo legado), `'configuracao.mapeamento_ids_3cplus'`, `'configuracao.mapeamento_ramais'` e `ultima_sincronizacao`.
8. Resposta: `{success, perfis_verificados, agentes_vinculados, agentes_nao_encontrados, erros, mensagem}`.

**Estados/campos que mudam:**
- `UserProfile`: `id_3cplus`, `3cplus_sincronizado`, `3cplus_sincronizado_em`, `token_3cplus` (no legado).
- `Integracao`: `ultima_sincronizacao`, mais três chaves de primeiro nível com ponto no nome (I2).

**Eventos de socket:** nenhum.

**Pontos em aberto observados:**
1. **Mapeamentos gravados fora de `configuracao`.** As chaves `'configuracao.mapeamento_*'` (`:185-187`) são gravadas no primeiro nível do registro (I2), e `configuracao.mapeamento_*` fica inalterado. Quem lê a versão aninhada: `powerDialer3CPlus/entry.ts:224` (`cfg.mapeamento_ramais`), `telefonia3c.ts:91` (`config.mapeamento_agentes`) e `TelefoniaConfig.jsx:103-105`.
2. **Tokens em texto puro fora da máscara.** No modo legado, `mapeamento_agentes` com tokens em texto puro (`:162`, `:166`) vai para a chave de primeiro nível `'configuracao.mapeamento_agentes'`. A máscara de segredos procura o caminho aninhado `configuracao` → `mapeamento_agentes` (`backend/src/entities.ts:146-151`, `:174-184`), então essa chave não é mascarada nas leituras nem no broadcast (`entities.ts:300`).
3. **Perfis de todas as empresas.** `UserProfile.filter` não tem filtro de empresa (`:124`); o casamento é só pelo ramal. Isso está documentado em `docs/3cplus/INTEGRACAO_3CPLUS.md:68`. Sem `limit`, só entram os 50 perfis mais recentes que atendem o filtro (I1).
4. **Pode pegar a integração de outra empresa.** Sem `body.empresaId`, a função usa a primeira integração 3C encontrada entre todas as empresas (`:60-63`).
5. **Gestor do CRM recebe 403.** A checagem usa `users.role === 'gestor'` (`:44`). Pela I4, um gestor do CRM (`UserProfile.role`/`VinculoEmpresa.papel`) com `users.role='user'` recebe 403.
6. **Toast sempre "Nenhum agente novo".** `GestaoUsuariosEmpresa.jsx:173-178` lê `res.agentes_vinculados` e `res.agentes_nao_encontrados` no envelope (I6), então o toast mostra "Nenhum agente novo para sincronizar". `TelefoniaConfig.jsx:96` lê `res.data?.agentes_vinculados` corretamente.

### 8.2 `sincronizarTelefonia3CPlus`

**Gatilho:** nenhum chamador. O cabeçalho diz "Chamada por agendamento (n8n) ou manualmente pelo gestor" (`entry.ts:7`); o agendamento não existe e não há botão no front.

**Autenticação:** `users.role` `'admin'` ou `'gestor'` (`:60-62`). Uma chamada de cron sem usuário receberia 403. Opera como service role.

**Passo a passo:**
1. [`:68-72`] Janela de busca: `janela_minutos`, padrão 360. As datas são formatadas `Y-m-d H:i:s` a partir de `toISOString()`, ou seja, em UTC.
2. [`:77-80`] `Integracao.filter({tipo:'telefonia', ativa:true, empresaId?})`. Sem `empresaId`, processa todas as empresas.
3. Para cada integração 3C (`:91-240`):
   - `credencialGestor`.
   - **3C `GET /calls`** com `start_date`, `end_date` e `per_page=200`, timeout de 30 s (`:113-116`).
   - Índices: `Lead.filter({empresaId})` por telefone (`:135-140`); `Atividade.filter({empresaId, origem_sincronizacao:'3cplus'})` para deduplicar (`:141-142`); `VinculoEmpresa.filter({empresaId})` para mapear nome do agente → e-mail (`:145-149`).
   - Para cada chamada com lead casado pelo telefone (igual ou sufixo, `:176-186`): **Atividade.create** com `tipo='ligacao'`, `resultado` (de `status_id`), `duracao_segundos`, `tpa_segundos`, `chamada_id_3cplus`, `gravacao_url`, `observacao`, `sdr_email`, `lead_id`, `lead_telefone`, `lead_nome`, `created_date`, `origem_sincronizacao='3cplus'` (`:190-205`).
   - Se `readable_status_text` casa com `QUALIFICACAO_PARA_STATUS`: **Lead.update** `status` (`:211-219`).
   - **3C `GET /agents`** paginado, depois **Integracao.update** `ultima_sincronizacao`, `status_conexao='ativa'`, `dados_cache.agentes_ao_vivo` (`:228-239`).
4. Resposta: `{success, integracoes_processadas, chamadas_sincronizadas, atividades_criadas, ja_sincronizadas_realtime, leads_atualizados, erros}`.

**Estados/campos que mudam:**
- `Atividade`: criação, com `origem_sincronizacao='3cplus'`.
- `Lead.status`.
- `Integracao`: `ultima_sincronizacao`, `status_conexao`, `dados_cache`.

**Eventos de socket:** nenhum. A função usa REST; o comentário em `:12-16` explica o motivo.

**Pontos em aberto observados:**
1. **Cache de agentes nunca atualizado.** A função não tem chamador e o cron não existe. Por isso `Integracao.dados_cache.agentes_ao_vivo` e `ultima_sincronizacao`, lidos por `processarEventos3CPlus` (8.3), não são atualizados por ela.
2. **Dedup ignora atividades do tempo real.** A deduplicação olha só `origem_sincronizacao:'3cplus'` (`:141`). Atividades criadas por `receberEvento3CPlus` (`'3cplus_realtime'`, `receberEvento3CPlus/entry.ts:255`) ou pelo front não entram no índice. O contador se chama `ja_sincronizadas_realtime` (`:171`), mas só conta atividades `'3cplus'`.
3. **Três índices limitados a 50.** `Lead.filter`, `Atividade.filter` e `VinculoEmpresa.filter` não têm `limit` (`:135`, `:141`, `:145`). Pela I1, cada índice tem no máximo 50 registros: leads fora dos 50 mais recentes não casam e o dedup só enxerga as 50 atividades mais recentes.
4. **`created_date` descartado.** O valor enviado no `create` (`:203`) é removido (I3); a Atividade fica com a data de criação do registro.
5. **Formato de data diferente do repair.** `start_date`/`end_date` saem em UTC (`:70`). `repairGravacoes3CPlus` aplica UTC-3 para a mesma API (`repairGravacoes3CPlus/entry.ts:64-68`).
6. **Gestor do CRM recebe 403.** Mesma situação de papel do 8.1, item 5.
7. **Sem `empresaId`, varre todas as empresas.** Nesse caso a função percorre todas as integrações (`:77-78`), e qualquer usuário com `users.role` admin/gestor pode dispará-la.

### 8.3 `processarEventos3CPlus`

**Gatilho:** nenhum chamador. O cabeçalho descreve "O frontend chama este endpoint a cada ~10s" (`entry.ts:11`); não encontrei essa chamada em `frontend/src`.

**Autenticação:** apenas usuário autenticado (`:51-53`). `isGestorOuAdmin` usa `users.role` (`:71`). Não confere vínculo com o `empresaId`.

**Passo a passo:**
1. [`:56-69`] Lê `empresaId` e `desde` da query string ou do body. Aceita GET e POST.
2. [`:76-91`] Lê `Integracao` 3C ativa. Não chama o 3C.
3. [`:93-102`] Calcula `segundos_desde_sync` e lê `dados_cache.agentes_ao_vivo`.
4. [`:109-131`] `Atividade.filter({empresaId, tipo:'ligacao', origem_sincronizacao:'3cplus'})`, recortado por `desde` ou pelas 10 mais recentes. Para quem não é gestor/admin, filtra por `sdr_email`.
5. [`:139-170`] Para gestor/admin: métricas do dia a partir de `Atividade.filter({empresaId, tipo:'ligacao'})` e do cache de agentes.
6. [`:185-195`] Resposta: `{conectado, ultima_sincronizacao, segundos_desde_sync, agentes, atividades_recentes, metricas}`.

**Estados/campos que mudam:** nenhum; a função só lê.

**Eventos de socket:** nenhum.

**Pontos em aberto observados:**
1. **Cache sem atualização.** A função depende de `dados_cache.agentes_ao_vivo`, que só é escrito por `sincronizarTelefonia3CPlus` (8.2, sem chamador).
2. **Documentação diverge do código.** `docs/TELEFONIA_CONTRATO.md:389` diz que a função "faz polling via Socket.IO"; o código só lê entidades.
3. **Atividades de outras origens ficam de fora.** As atividades recentes consideram só `origem_sincronizacao:'3cplus'` (`:112`), não `'3cplus_realtime'` nem as criadas pelo front.
4. **Métricas do dia sobre 50 registros.** `Atividade.filter` sem `limit` (`:109`, `:144`) traz no máximo 50 registros (I1).
5. **Métricas restritas a `users.role`.** `isGestorOuAdmin` usa `users.role` (`:71`), então um gestor do CRM com `users.role='user'` recebe `agentes: []` e `metricas: {}`.

### 8.4 `receberEvento3CPlus`

**Gatilho:** webhook descrito como "chamado pelo serviço Node.js bridge" (`entry.ts:6`). Essa ponte não existe mais. A ponte atual (`backend/src/ponte3c.ts`) não chama esta função (I7). Os webhooks do 3C não estão configurados, e o formato esperado (`{evento, dados, timestamp}` com cabeçalho `X-Bridge-Secret`) não é o formato de webhook do 3C. Não há chamador.

**Autenticação:** pública, sem usuário. Valida o cabeçalho `X-Bridge-Secret` contra `BRIDGE_WEBHOOK_SECRET` (`:28-51`); a variável existe em `.env:41`. Anti-replay: `timestamp` com diferença maior que 5 min é rejeitado (`:66-74`). Grava como service role.

**Passo a passo:**
1. [`:78-84`] Extrai `email`, `call_session_id`, `call_id` e `empresaId` do payload.
2. [`:105-121`] `buscarSessaoAtiva`: procura pelo `call_session_id`; senão, pela CallSession mais recente do `sdr_email` e `empresaId` com status em {iniciando, ringing, answered, aguardando_confirmacao}.
3. Tratamento por evento:
   - `agent-is-idle`, `agent-logged-out`, `agent-was-logged-out`, `agent-in-acw`, `agent-entered-work-break`, `agent-left-work-break`: **UserProfile.update** `status_3cplus` (idle, offline, acw ou work_break) e `ultima_atualizacao_status`, com filtro `{user_email, empresaId}` (`:125-133`, `:296-327`).
   - `agent-entered-manual(-mode)`: **CallSession.update** `status='ringing'` (`:135-140`).
   - `manual-call-was-answered`, `call-was-answered`, `call-answered`, `call-was-connected`: **CallSession.update** `status='answered'`, `chamada_id_3cplus`, `telephony_id_3cplus`, `atendida_em`; **Lead.update** `ultima_ligacao_em` (`:143-166`).
   - `call-finished`, `call-was-finished`, `call-ended`, `call-hangup`, `call-was-ended`: **CallSession.update** `status='finished'`, `finalizada_em`; **Lead.update** libera o lock (`:169-190`).
   - `call-history-was-created` / `call-history-created`:
     - **CallSession.update** `gravacao_url`, `duracao_segundos`, `status='finished'`, `finalizada_em`, `gravacao_processada=false`.
     - Com gravação, dispara `fetch` "fire-and-forget" para `${base}/functions/processarGravacao3CPlus` (`:206-221`).
     - Dedup por `chamada_id_3cplus` e **Atividade.create** com `origem_sincronizacao='3cplus_realtime'` (`:225-256`).
     - **Lead.update** `status` e `ultima_ligacao_em` (`:259-266`).
   - Eventos abandonada, não atendida ou falha: **CallSession.update** `status` (`failed` ou `finished`); **Lead.update** libera o lock e grava `ultima_ligacao_em` (`:273-294`).

**Estados/campos que mudam:**
- `CallSession`: `status`, `chamada_id_3cplus`, `telephony_id_3cplus`, `atendida_em`, `finalizada_em`, `gravacao_url`, `duracao_segundos`, `gravacao_processada`.
- `Lead`: `status`, `ultima_ligacao_em`, lock.
- `UserProfile`: `status_3cplus`, `ultima_atualizacao_status`.
- `Atividade`: criação.

**Eventos de socket esperados (como entrada):** os listados acima, que viriam da ponte Node antiga.

**Pontos em aberto observados:**
1. **Função sem chamador.** Nada chama esta função hoje (grep em `frontend/src`, `backend/src`, `backend/functions`). A ponte atual só repassa eventos (`ponte3c.ts:146`). As atualizações acima (lock liberado por evento, `ultima_ligacao_em`, `status_3cplus`, Atividade `3cplus_realtime`) não ocorrem por este caminho.
2. **Chamada de gravação em caminho inexistente.** O disparo vai para `/functions/processarGravacao3CPlus` (`:209`), sem o prefixo `/api`; pela I5 isso responde 404. O mesmo padrão aparece em `finalizarLigacao3CPlus/entry.ts:546`.
3. **Sem usuário para o processamento da gravação.** O disparo repassa o cabeçalho `Authorization` da requisição original (`:213`), mas esta função é chamada sem usuário. `processarGravacao3CPlus` exige usuário e responde 401 sem ele (`processarGravacao3CPlus/entry.ts:44-47`).
4. **Valor fora do enum.** `origem_sincronizacao='3cplus_realtime'` (`:255`) não está no enum de `Atividade.origem_sincronizacao` (`manual|3cplus|webhook`, `backend/entities/Atividade.jsonc`). A gravação não é rejeitada (I8).
5. **`created_date` descartado.** O valor enviado em `:254` é removido (I3).
6. **Filtro por campo que o schema não declara.** Os filtros de `UserProfile` usam `empresaId` (`:127`, `:300`, `:311`), campo que não está declarado em `backend/entities/UserProfile.jsonc`. Ele só é gravado em algumas criações (`autoAssignProfile/entry.ts:45`, `repairUserProfiles/entry.ts:76`), e perfis sem `empresaId` não casam.
7. **Campos fora do schema.** `status_3cplus` e `ultima_atualizacao_status` não estão declarados em `UserProfile.jsonc`. `status_3cplus` é lido em `frontend/src/components/crm/PainelSupervisor.jsx:201`.

### 8.5 `repairGravacoes3CPlus`

**Gatilho:** nenhum chamador (grep em `frontend/src` e `backend`). Sem cron.

**Autenticação:** usuário autenticado, com `users.role==='admin'` ou `UserProfile.role` `admin`/`gestor`. O perfil é buscado com `{user_email, empresaId}` (`entry.ts:25-29`). Grava como service role.

**Passo a passo:**
1. [`:34-39`] `credencialGestor`. Sem credencial, responde 424.
2. [`:45-59`] **3C `GET /agents`** paginado. Monta o mapa nome ↔ e-mail a partir de `a.login` ou `a.email`.
3. [`:62-86`] **3C `GET /calls`** com `start_date` e `end_date` em UTC-3, janela de `dias` (padrão 30), `per_page=500` e `with_mailing=true`.
4. [`:89-103`] Indexa as chamadas por id e por telefone + dia.
5. [`:106-110`] `GravacaoLigacao.filter({empresaId})`. Mantém as gravações não expurgadas que não têm `lead_nome`, `sdr_email` ou `campanha_nome`.
6. [`:117-189`] Para cada gravação, casa por `call_id_3cplus` ou por telefone + dia. **GravacaoLigacao.update** preenche só os campos vazios: `sdr_email`, `sdr_nome`, `lead_nome`/`lead_nome_original`, `lead_telefone`/`lead_telefone_original`, `campanha_nome`, `campanha_id`, `duracao_segundos`, `resultado`, `gravacao_url_backup`. Corrige `call_id_3cplus` quando diverge.
7. Resposta: `{total_precisam_repair, corrigidos, sem_match, ja_completos, calls_da_api, mensagem}`.

**Estados/campos que mudam:** `GravacaoLigacao`, nos campos listados no passo 6.

**Eventos de socket:** nenhum.

**Pontos em aberto observados:**
1. **Função sem chamador.** Não há chamador nem agendamento.
2. **Só 50 gravações avaliadas.** `GravacaoLigacao.filter({empresaId})` sem `limit` (`:106`) traz no máximo 50 registros (I1).
3. **Paginação de `/calls` ignorada.** A função lê só a primeira página de `/calls`, com `per_page=500` (`:73`). Diferente de `/agents`, não percorre `meta.pagination`. O comentário em `telefonia3c.ts:125-126` registra que a API pagina `/agents` em 25 e ignora `per_page` maior; não verifiquei se `/calls` se comporta igual.
4. **Filtro por campo não declarado.** A checagem de permissão filtra `UserProfile` por `empresaId` (`:26`), campo não declarado no schema (ver 8.4, item 6).

### 8.6 `retryGravacoes3CPlus`

**Gatilho:** nenhum chamador. O código prevê um cron ("Permite cron (sem user)", `entry.ts:36`), que não existe.

**Autenticação:** **pública quando não há usuário**. `isAutorizado = !user || users.role==='admin' || 'gestor'` (`:37`): sem token a função roda; com token de usuário comum, responde 403. Grava como service role. Não valida `empresaId`.

**Passo a passo:**
1. [`:58-64`] `CallSession.filter({status:'finished', gravacao_processada:false, empresaId?})`. Sem `empresaId`, pega todas as empresas.
2. [`:67-74`] Mantém as sessões com `gravacao_url` finalizadas nas últimas 48 h. `body.forcar` ignora a janela.
3. [`:87-98`] Com `tentativas_processamento >= 3`: **CallSession.update** `erro_mensagem`, e a sessão é ignorada.
4. [`:101-103`] **CallSession.update** `tentativas_processamento + 1`.
5. [`:109-120`] `fetch` para `${base}/functions/processarGravacao3CPlus`, repassando o `Authorization` recebido.
6. [`:155-160`] **LogAutomacao.create** com `tipo='retry_gravacoes_3cplus'`, `status` (`sucesso` ou `parcial`), `detalhes` e `executado_em`.

**Estados/campos que mudam:** `CallSession.tentativas_processamento` e `erro_mensagem`; criação de `LogAutomacao`.

**Eventos de socket:** nenhum.

**Pontos em aberto observados:**
1. **Reprocessamento sempre falha e as tentativas se esgotam.** A chamada a `processarGravacao3CPlus` usa o caminho sem `/api` (`:109`), que responde 404 (I5). Chamada sem usuário, `processarGravacao3CPlus` também responderia 401 (`processarGravacao3CPlus/entry.ts:44-47`). Pelo código, cada execução incrementa `tentativas_processamento` (`:101-103`) e registra falha; após 3 execuções a sessão recebe `erro_mensagem` de "Falha definitiva" (`:94-96`).
2. **Execução sem autenticação.** Sem usuário, a função roda sem autenticação (`:37`), inclusive com `forcar` e sem `empresaId`, e altera `CallSession` de todas as empresas.
3. **`LogAutomacao` fora do schema.** `LogAutomacao.jsonc` declara `status` com `sucesso|erro` e não tem os campos `tipo` e `executado_em`. A função grava `status:'parcial'`, `tipo` e `executado_em` (`:156-159`); a gravação não é rejeitada (I8).
4. **Só 50 sessões candidatas.** `CallSession.filter` sem `limit` (`:64`) traz no máximo 50 registros (I1).

### 8.7 `purgeGravacoes`

**Gatilho:** nenhum chamador. O comentário diz "Nunca exposto ao frontend como ação direta de usuário" (`entry.ts:29-31`); pela natureza da função (ciclo de vida LGPD), é uma rotina periódica, e não há agendamento.

**Autenticação:** apenas usuário autenticado (`:10-11`). **Não confere papel nem vínculo** com o `empresaId`. Grava como service role.

**Passo a passo:**
1. [`:32-34`] `GravacaoLigacao.filter({empresaId})`.
2. Fase 1 [`:36-51`]: gravação com `expires_at` vencido, sem `deleted_at` e com `retention_policy` diferente de `legal_hold`/`permanent`. **Update** `deleted_at` e `purge_scheduled_at` (+30 dias).
3. Fase 2 [`:54-74`]: gravação com `deleted_at` há mais de 30 dias. **Update**: `lead_nome`, `lead_nome_original`, `lead_telefone` e `lead_telefone_original` recebem "[DADO REMOVIDO…]"; `transcricao`, `transcricao_anonimizada` e `analise_ia` recebem null; grava `purged_at`.
4. Fase 3 [`:77-97`]: `TranscriptionJob` com `status='processing'` e `iniciado_em` há mais de 5 min. **Update** `status='stuck'` e `stuck_detected_at`; na `GravacaoLigacao` correspondente, `transcricao_status='stuck'`.
5. Resposta: `{soft_deleted, purged, stuck_reset, erros, executado_em}`.

**Estados/campos que mudam:**
- `GravacaoLigacao`: `deleted_at`, `purge_scheduled_at`, campos de dados pessoais, `purged_at`, `transcricao_status`.
- `TranscriptionJob`: `status`, `stuck_detected_at`.

**Eventos de socket:** nenhum.

**Pontos em aberto observados:**
1. **Rotina de retenção não roda.** Não há chamador nem agendamento, então soft-delete e expurgo LGPD não acontecem.
2. **Qualquer usuário pode disparar.** Basta estar autenticado para executar soft-delete e expurgo de dados pessoais em qualquer `empresaId` (`:10-16`).
3. **Fase 3 sem registros para tratar.** `TranscriptionJob` só aparece nesta função (grep em `backend/functions`, `backend/src` e `frontend/src`); não encontrei quem crie esses registros.
4. **Quem grava `expires_at`.** Só `buscarGravacoes3CPlus/entry.ts:209-210` grava `expires_at` e `retention_policy='standard'`. `retention_policy` também é gravado pelo front em `frontend/src/pages/Gravacoes.jsx:274`.
5. **Só 50 gravações por execução.** `GravacaoLigacao.filter` sem `limit` (`:32`) traz no máximo 50 registros (I1).

### 8.8 `limparGravacoesInvalidas`

**Gatilho:** nenhum chamador (grep em `frontend/src` e `backend`).

**Autenticação:** usuário autenticado com `users.role==='admin'` ou `UserProfile.role` `admin`/`gestor` (`entry.ts:25-28`). O perfil é buscado só por `user_email`, sem empresa. Grava como service role.

**Passo a passo:**
1. [`:31-39`] `GravacaoLigacao.filter({empresaId})` e seleciona as gravações não expurgadas **sem** `sdr_email`, `lead_nome` e `lead_telefone`.
2. [`:44-58`] Com `confirmar=false` (padrão), só conta e devolve uma amostra.
3. [`:61-74`] Com `confirmar=true`: **GravacaoLigacao.delete**, exclusão física, de cada gravação inválida.

**Estados/campos que mudam:** exclusão de registros de `GravacaoLigacao`.

**Eventos de socket:** nenhum.

**Pontos em aberto observados:**
1. **Permissão sem ligação com a empresa.** A permissão vem do `UserProfile.role` de qualquer perfil do e-mail (`:25-27`). Não há verificação de que o usuário pertence ao `empresaId` enviado.
2. **Só 50 gravações avaliadas.** `GravacaoLigacao.filter` sem `limit` (`:31`) traz no máximo 50 registros (I1).
3. **Relação com o repair.** Os registros que esta função apaga são os mesmos que `repairGravacoes3CPlus` tenta completar (sem `sdr_email`/`lead_nome`); nenhuma das duas tem chamador.
