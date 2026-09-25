# Telefonia — Test Suite

Specs TDD para o sistema de telefonia 3C Plus integrado ao VendaFLOW.

## Arquivos

| Arquivo | Módulo | Cobertura |
|---|---|---|
| `useTelefoniaAgent.spec.js` | `contexts/telefonia/useTelefoniaAgent` | Estado do agente, cronômetros, eventos Socket |
| `useTelefoniaSocket.spec.js` | `contexts/telefonia/useTelefoniaSocket` | Conexão WS, roteamento de 15+ eventos 3C Plus |
| `useTelefoniaActions.spec.js` | `contexts/telefonia/useTelefoniaActions` | iniciarLigacao, finalizarLigacao, executarComando |
| `useExtensaoChrome.spec.js` | `hooks/useExtensaoChrome` | Handshake PING/PONG, retry, cleanup |
| `TelefoniaContext.spec.js` | `contexts/TelefoniaContext` | Integração, interface pública, hangup |

## Como rodar

```bash
# Todos os testes de telefonia
npx jest __tests__/telefonia/ --verbose

# Um arquivo específico
npx jest __tests__/telefonia/useTelefoniaSocket.spec.js --verbose

# Com coverage
npx jest __tests__/telefonia/ --coverage
```

## Contratos monitorados

Estes testes **quebrarão propositalmente** se:

- Os nomes de eventos Socket.IO mudarem (`call-was-connected`, `call-was-finished`, etc.)
- O protocolo de handshake da extensão mudar (`VENDAFLOW_PING`, `VENDAFLOW_PONG`, `VENDAFLOW_EXTENSION_READY`)
- A interface pública do `TelefoniaContext` perder propriedades
- A URL de conexão WebSocket mudar de formato (`https://{dominio}.3c.plus`)
- As funções backend invocadas mudarem de nome (`iniciarLigacao3CPlus`, `finalizarLigacao3CPlus`, etc.)
- O `hangupManualCall` parar de chamar `/agent/manual_call/exit`

## Setup (jest.config.js)

```js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterFramework: ['@testing-library/jest-dom'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
``