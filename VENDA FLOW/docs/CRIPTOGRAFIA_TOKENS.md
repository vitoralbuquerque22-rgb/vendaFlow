> **Legado.** Este documento trata do token **pessoal** de cada agente (`UserProfile.token_3cplus`), que o 3C Plus
> descontinua em 01/10/2026. Com tokens de serviço, os tokens ficam em `Integracao.configuracao` e nunca saem do
> servidor (a API os devolve mascarados). Ver `docs/3cplus/TOKENS_DE_SERVICO.md`.

# Criptografia de Tokens 3C Plus (AES-256-GCM)

## ⚠️ ANTES DE PROMOVER PARA PRODUÇÃO

### 1. Gerar e configurar TOKEN_ENCRYPTION_KEY

```bash
openssl rand -base64 32
```

Copie o resultado para a variável `TOKEN_ENCRYPTION_KEY` no arquivo `.env` da raiz do projeto
e reinicie a API (`docker compose restart api`).

> A chave deve ter exatamente 32 bytes (256 bits) encodados em base64.
> NUNCA commitar essa chave no repositório.

### 2. Migrar tokens legados (uma vez só)

Após configurar a KEY, chamar a function `migrarTokens3CPlus` (admin only):

```bash
# Logado como admin, pelo console do navegador no sistema:
#   await api.functions.invoke("migrarTokens3CPlus", {})
# ou via HTTP: POST /api/functions/migrarTokens3CPlus  (Authorization: Bearer <token do admin>)
```

Resposta esperada:
```json
{
  "success": true,
  "migrados": 15,
  "ja_encriptados": 0,
  "erros": [],
  "total_processados": 15
}
```

A operação é **idempotente** — pode ser chamada múltiplas vezes sem risco.

### 3. Fluxo a partir daí

- Tokens novos salvos via `salvarTokenAgente3CPlus` já chegam encriptados.
- Todos os backends (`executarComando3CPlus`, `iniciarLigacao3CPlus`, etc.) decriptam automaticamente.
- O frontend (`ConfiguracaoToken3CPlus`) nunca mais persiste o token plain diretamente.
- O hangup no frontend usa `executarComando3CPlus` via backend — o token plain nunca trafega no browser.

## Formato do ciphertext

```
enc:<iv_base64>:<ciphertext_base64>
```

Tokens sem prefixo `enc:` são tratados como plain (compatibilidade retroativa).

## Functions envolvidas

| Function | Papel |
|---|---|
| `salvarTokenAgente3CPlus` | Encripta e persiste token do agente |
| `migrarTokens3CPlus` | Migra tokens legados (admin only, idempotente) |
| `executarComando3CPlus` | Decripta antes de usar |
| `iniciarLigacao3CPlus` | Decripta antes de usar |
| `iniciarDiscagemManual3CPlus` | Decripta antes de usar |
| `finalizarLigacao3CPlus` | Decripta antes de usar |
| `ligarAgoraLead3CPlus` | Decripta antes de usar |
| `sincronizarAgentes3CPlus` | Encripta ao salvar token obtido da API 3C |
| `powerDialer3CPlus` | Decripta antes de usar |
| `_shared/getTelefonia3CPlus` | Decripta antes de retornar |