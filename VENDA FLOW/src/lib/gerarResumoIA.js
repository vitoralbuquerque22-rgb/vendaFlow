import { base44 } from "@/api/base44Client";

/**
 * Gera um resumo IA da atividade via InvokeLLM e atualiza o campo observacao.
 * Chamado de forma fire-and-forget — não bloqueia o fluxo principal.
 */
export async function gerarResumoIA(atividadeId, dados) {
  try {
    const { resultado, observacao, temperatura, dor_principal, urgencia, tipo_proximo_contato, data_proximo_contato } = dados;

    const prompt = `Você é um assistente de CRM. Com base nos dados abaixo de uma ligação de vendas, gere um resumo profissional em até 3 linhas, destacando os pontos mais relevantes para o próximo contato.

Resultado: ${resultado || '—'}
Observações do SDR: ${observacao || '—'}
Temperatura do lead: ${temperatura || '—'}
Dor principal: ${dor_principal || '—'}
Urgência: ${urgencia || '—'}
Próximo contato: ${data_proximo_contato ? `${tipo_proximo_contato || 'contato'} em ${data_proximo_contato}` : '—'}

Responda apenas com o resumo, sem introdução nem formatação markdown.`;

    const resposta = await base44.integrations.Core.InvokeLLM({ prompt });

    if (atividadeId && resposta) {
      const resumoFinal = observacao
        ? `${observacao}\n\n💡 Resumo IA: ${resposta}`
        : `💡 Resumo IA: ${resposta}`;
      await base44.entities.Atividade.update(atividadeId, { observacao: resumoFinal });
    }
  } catch (e) {
    console.error('[gerarResumoIA] erro:', e.message);
  }
}