# Contrato de Telefonia 3C Plus

Este documento define o padrão de integração para todas as funções que utilizam a API do 3C Plus.

## Onde fica cada dado

| Dado          | Fonte primária              | Fallback                        |
|---------------|-----------------------------|---------------------------------|
| token agente  | UserProfile.token_3cplus    | Integracao.mapeamento_agentes   |
| ramal agente  | UserProfile.ramal_3cplus    | Integracao.mapeamento_ramais    |
| token gestor  | Integracao.token_gestor     | —                               |
| domínio       | Integracao.dominio          | —                               |

## Endpoint para ligar

```
POST https://3c.fluxoti.com/api/v1/click2call

Headers:
  Authorization: Bearer {token_gestor}
  Content-Type: application/x-www-form-urlencoded

Body:
  extension={ramal}&phone={telefone}
```

**Respostas esperadas:**
- `200/201`: Sucesso — dados da chamada no JSON response
- `204`: Sucesso assíncrono — chamada sendo processada
- `422`: Agente não logado (AGENT_NOT_LOGGED) — peça ao agente para logar na campanha
- `5xx`: Erro do servidor

## Nunca usar

- ❌ `/agents/manual-call` — endpoint não existe (causa 502)
- ❌ `token_gestor` para ações de agente — use token_agente
- ❌ Ramal direto da integração — sempre buscar no UserProfile primeiro

## Padrão de tratamento de erro

Quando o ramal ou token não existir, retorne:
- `400` — se ramal não encontrado
- `424` — se token_gestor não configurado
- `502` — se click2call falhar

Sempre reverta lock e sessão antes de retornar erro.

## Funções que aplicam este contrato

- `iniciarLigacao3CPlus` — ligar via "Ligar Agora"
- `iniciarDiscagemManual3CPlus` — ligar via numpad manual
- `executarComando3CPlus` — proxy seguro para ações
- `finalizarLigacao3CPlus` — encerrar chamada