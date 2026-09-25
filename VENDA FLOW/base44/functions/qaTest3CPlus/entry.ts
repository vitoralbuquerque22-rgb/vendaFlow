import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Tokens lidos de variáveis de ambiente — nunca hardcoded
  const TOKEN_J = Deno.env.get('QA_TOKEN_J');
  const TOKEN_G = Deno.env.get('QA_TOKEN_G');

  if (!TOKEN_J || !TOKEN_G) {
    return Response.json({
      error: 'Tokens QA não configurados. Configure QA_TOKEN_J e QA_TOKEN_G nas variáveis de ambiente.'
    }, { status: 500 });
  }

  return Response.json({
    message: 'QA endpoint disponível. Use as funções executarComando3CPlus ou acaoAgente3CPlus para testes.',
    tokens_configurados: true
  });
});