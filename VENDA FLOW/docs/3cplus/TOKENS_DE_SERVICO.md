# 3C Plus — Tokens de serviço

Fonte: tutorial "Tokens de serviço" do painel 3C Plus (Configurações → Tokens de serviço), recebido em 25/09/2026,
e testes feitos contra a API real no mesmo dia.

## Visão geral

O token de serviço é a credencial das integrações, no lugar do token pessoal de um usuário. Ele **pertence à
organização**, não a uma pessoa.

- É exibido **uma única vez**, na criação. Depois o painel mostra só os caracteres iniciais e finais; não há como
  recuperá-lo. Perdeu? Revogue e gere outro.
- Guarde em gerenciador de segredos ou variável de ambiente. **Nunca** no repositório.
- O prazo de validade é definido na criação.
- Cada requisição fica registrada com o token que a originou (rastreabilidade).
- A revogação leva **até 1 minuto** para propagar.

## ⚠️ Descontinuação do token pessoal — 01/10/2026

A partir de **01/10/2026**, requisições com o `api_token` pessoal de um usuário retornam **401**.

Migração:
1. Crie um token de serviço com o mesmo papel usado hoje pela integração.
2. Troque a credencial na configuração. O método de envio (header ou query string) não muda.
3. Valide com uma requisição de teste.
4. Revogue o token pessoal.

**Integrações que agem em nome de um agente** precisam de um passo a mais: enviar o header `X-Agent-Id` com o id
do agente representado. O token pessoal identificava o agente implicitamente; o token de serviço não é de um usuário
e pode operar por **qualquer agente ativo** da organização.

## Autenticação

Endereço base: o domínio da organização — `https://oficinasmaster.3c.plus/api/v1`.

**Header (recomendado)**
```
Authorization: Bearer 3cs_...
```

**Query string** (aceito, mas a URL fica registrada em logs de servidor, proxies e histórico do navegador)
```
?api_token=3cs_...
```

```bash
curl "https://oficinasmaster.3c.plus/api/v1/campaigns?api_token=3cs_SEU_TOKEN"
```

## Papéis

O papel é definido na criação e **não pode ser alterado** (no papel supervisor, só as equipes podem ser editadas).
Use o menor escopo suficiente.

| Papel | Escopo | Exemplo |
|---|---|---|
| Gestor | Organização inteira (equivale ao perfil de gestor) | `curl -H "Authorization: Bearer 3cs_..." https://oficinasmaster.3c.plus/api/v1/campaigns` |
| Supervisor | Só as equipes designadas ("Editar equipes" muda sem revogar) | `curl -H "Authorization: Bearer 3cs_..." https://oficinasmaster.3c.plus/api/v1/agents` |
| Agente | Um agente por requisição, pelo header `X-Agent-Id` (agente ativo) | `curl -H "Authorization: Bearer 3cs_..." -H "X-Agent-Id: 123" https://oficinasmaster.3c.plus/api/v1/me` |

## Erros

| Código | Significado |
|---|---|
| 401 | Credencial inválida, expirada ou revogada |
| 400 | `X-Agent-Id` ausente, ou id que não corresponde a agente ativo |
| 403 | O papel do token não dá acesso ao recurso (ex.: token de agente em rota de gestor) |

## Recomendações para produção

- **Armazenamento:** gerenciador de segredos ou variável de ambiente; nunca versionar.
- **Segregação:** um token por integração, para revogar uma sem afetar as outras.
- **Rotação:** prazos curtos. Gere o novo, troque, valide e só então revogue o antigo.

## Validação contra a API real (25/09/2026)

Testes somente de leitura com os tokens da organização.

| Teste | Documentação | Resultado |
|---|---|---|
| Gestor com `Authorization: Bearer` | aceito | 200 ✅ |
| Gestor com `?api_token=` | aceito | 200 ✅ |
| Token inválido | 401 | 401 `Token de serviço inválido` ✅ |
| Agente + `X-Agent-Id` válido (`GET /me`) | aceito | 200 — responde como o agente informado ✅ |
| Agente **sem** `X-Agent-Id` | 400 | 400 ✅ |
| Agente + `X-Agent-Id` inativo ou inexistente | 400 | **401** ⚠️ divergente — trate 400 e 401 como "agente inválido" |
| Agente em rota de gestor (`GET /agents`) | 403 | 403 ✅ |
| Agente em rota de agente (`GET /agent/campaigns`) | aceito | 200 ✅ |
| Gestor enviando `X-Agent-Id` | não documentado | 400 `só é aceito em tokens de papel agente` |
| Socket com token de agente, só `token` | não documentado | recusado (`Authentication error`) |
| Socket com token de agente e `query: { token, agent_id }` | não documentado | conecta |
| Página `/extension` (ramal) com token de agente | não documentado | **não funciona**: a página chama `/me` sem `X-Agent-Id` → 400. Ver [RAMAL_WEBRTC.md](RAMAL_WEBRTC.md) |

## Como o VendaFlow usa

- `Integracao.configuracao.token_gestor` — token de serviço, papel gestor (monitoramento, campanhas, relatórios).
- `Integracao.configuracao.token_servico_agente` — token de serviço, papel agente (ações de cada SDR).
- `UserProfile.id_3cplus` — id do agente de cada SDR, enviado em `X-Agent-Id`. Se estiver vazio, o backend descobre
  pelo ramal (`UserProfile.ramal_3cplus` × `GET /agents`) e grava.
- Os tokens **nunca saem do servidor**: a API devolve esses campos mascarados (`••••••••`) para o navegador, e o
  socket do 3C é aberto pelo backend. Código: `backend/src/telefonia3c.ts`, `backend/src/ponte3c.ts`.
