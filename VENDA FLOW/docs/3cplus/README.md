# Documentação 3C Plus

Documentação do 3C Plus (discador, telefonia e API) reunida para o VendaFlow, mais o que foi validado contra a
conta real da organização. Última atualização: 25/09/2026.

| Documento | Conteúdo |
|---|---|
| [TOKENS_DE_SERVICO.md](TOKENS_DE_SERVICO.md) | **Autenticação.** Tokens de serviço, papéis, `X-Agent-Id`, descontinuação do token pessoal em 01/10/2026, validação real |
| [GUIAS.md](GUIAS.md) | Fluxos: tela do agente, ligação manual, envio de listas, webhook, biblioteca de dados, omnichannel, domínios |
| [EVENTOS_SOCKET.md](EVENTOS_SOCKET.md) | Eventos em tempo real: conexão, os 40 eventos oficiais, eventos observados, códigos de status |
| [RAMAL_WEBRTC.md](RAMAL_WEBRTC.md) | Como o ramal SIP/WebRTC é registrado (JsSIP) e por que a página `/extension` não serve mais |
| [API_REFERENCIA.md](API_REFERENCIA.md) | Referência de todos os endpoints (210 operações), gerada do swagger |
| [API_MODELOS.md](API_MODELOS.md) | Modelos de dados (119), gerados do swagger |
| [INTEGRACAO_3CPLUS.md](INTEGRACAO_3CPLUS.md) | Como o VendaFlow integra: credenciais, backend, ponte de eventos, frontend, pendências |
| `swagger.json` | Especificação oficial (idêntica a https://app.3c.plus/api/v1/swagger.json em 25/09/2026) |
| `3C SWAGGER.pdf` | PDF da especificação |

## Atualizar a referência da API

```bash
cd docs/3cplus
curl -o swagger.json https://app.3c.plus/api/v1/swagger.json
node gerar-referencia.mjs
```

## Fontes oficiais

- Swagger UI: https://api-docs.3c.plus/
- Central de ajuda: https://alo.3cplusnow.com/help (categoria "API e integração")
- Postman: API Discador https://documenter.getpostman.com/view/25269027/2sA3JT1cqi · API Omni https://documenter.getpostman.com/view/25269027/2sA3JT1cqe
- Desenvolvedores: https://3cplusnow.com/desenvolvedores/
- SDK JavaScript: https://github.com/3C-Plus/3cplusv2-sdk
- Status da plataforma: https://status.3c.plus/
