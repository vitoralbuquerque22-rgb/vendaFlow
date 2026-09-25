import { createClientFromRequest } from "../../src/sdk.ts";

export default async (req) => {
  try {
    const api = createClientFromRequest(req);
    const user = await api.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lead_id } = await req.json();

    if (!lead_id) {
      return Response.json({ error: 'lead_id obrigatório' }, { status: 400 });
    }

    // Buscar dados do lead — usa token do usuário, RLS garante que só vê leads do próprio tenant
    const leads = await api.entities.Lead.filter({ id: lead_id });
    const lead = leads[0];
    if (!lead) {
      return Response.json({ error: 'Lead não encontrado' }, { status: 404 });
    }

    // Verificação explícita de ownership: empresaId do lead deve bater com o do usuário autenticado
    const empresaId = lead.empresaId;
    if (!empresaId || (user.empresaAtualId && empresaId !== user.empresaAtualId)) {
      return Response.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Buscar atividades e envios escopados ao tenant
    const atividades = await api.entities.Atividade.filter({ lead_id, empresaId });
    const envios = await api.entities.EmailEnvio.filter({ lead_id, empresaId });

    // Calcular Score de Perfil (0-40)
    let scorePerfil = 0;
    const detalhes = {
      formulario_completo: false,
      cargo_decisor: false,
      empresa_adequada: false,
      produto_definido: false,
      total_cliques: 0,
      respondeu_email: false,
      reuniao_agendada: false,
      reuniao_realizada: false,
      lead_aquecido: false,
      multiplas_interacoes: false,
      interesse_multiplos_produtos: false
    };

    // Formulário completo
    if (lead.respostas_formulario) {
      scorePerfil += 10;
      detalhes.formulario_completo = true;
    }

    // Cargo decisor
    const cargosDecisores = ['diretor', 'gerente', 'ceo', 'dono', 'proprietário', 'sócio'];
    if (lead.cargo && cargosDecisores.some(c => lead.cargo.toLowerCase().includes(c))) {
      scorePerfil += 10;
      detalhes.cargo_decisor = true;
    }

    // Empresa adequada (tem empresa cadastrada)
    if (lead.empresa) {
      scorePerfil += 10;
      detalhes.empresa_adequada = true;
    }

    // Produto de interesse definido
    if (lead.produto_interesse) {
      scorePerfil += 10;
      detalhes.produto_definido = true;
    }

    // Calcular Score de Engajamento (0-60)
    let scoreEngajamento = 0;

    // Cliques em email (5 pontos cada, max 20)
    const totalCliques = envios.filter(e => e.clicou).length;
    detalhes.total_cliques = totalCliques;
    scoreEngajamento += Math.min(totalCliques * 5, 20);

    // Resposta a email/WhatsApp
    const respondeu = atividades.some(a => 
      (a.tipo === 'email' || a.tipo === 'whatsapp') && a.resultado === 'respondeu'
    );
    if (respondeu) {
      scoreEngajamento += 15;
      detalhes.respondeu_email = true;
    }

    // Reunião agendada
    if (lead.status === 'reuniao_agendada' || lead.data_reuniao) {
      scoreEngajamento += 20;
      detalhes.reuniao_agendada = true;
    }

    // Reunião realizada
    const reuniaoRealizada = atividades.some(a => a.tipo === 'realizar_reuniao');
    if (reuniaoRealizada || lead.status === 'reuniao_realizada') {
      scoreEngajamento += 25;
      detalhes.reuniao_realizada = true;
    }

    // Calcular Score de Comportamento (0-30)
    let scoreComportamento = 0;

    // Lead aquecido (respondeu em menos de 24h)
    const atividadesRecentes = atividades.filter(a => {
      const dataAtividade = new Date(a.created_date);
      const agora = new Date();
      const diffHoras = (agora - dataAtividade) / (1000 * 60 * 60);
      return diffHoras <= 24 && a.resultado === 'respondeu';
    });
    if (atividadesRecentes.length > 0) {
      scoreComportamento += 10;
      detalhes.lead_aquecido = true;
    }

    // Múltiplas interações (3+ atividades)
    if (atividades.length >= 3) {
      scoreComportamento += 10;
      detalhes.multiplas_interacoes = true;
    }

    // Interesse em múltiplos produtos
    const produtosUnicos = new Set(atividades.map(a => a.produto_id).filter(Boolean));
    if (produtosUnicos.size > 1) {
      scoreComportamento += 10;
      detalhes.interesse_multiplos_produtos = true;
    }

    // Score Total
    const scoreTotal = scorePerfil + scoreEngajamento + scoreComportamento;

    // Determinar temperatura
    let temperatura = 'frio';
    if (scoreTotal >= 80) temperatura = 'quente';
    else if (scoreTotal >= 50) temperatura = 'morno';

    // Buscar score anterior
    const scoresAnteriores = await api.entities.LeadScore.filter({ lead_id });
    const scoreAnterior = scoresAnteriores[0];

    // Criar histórico
    const historico = scoreAnterior?.historico_scores || [];
    if (scoreAnterior && scoreAnterior.score_total !== scoreTotal) {
      historico.push({
        data: new Date().toISOString(),
        score_anterior: scoreAnterior.score_total,
        score_novo: scoreTotal,
        motivo: 'Recalculo automático',
        acao: 'Sistema'
      });
    }

    // Salvar ou atualizar score
    const scoreData = {
      lead_id,
      lead_nome: lead.nome,
      score_total: scoreTotal,
      score_perfil: scorePerfil,
      score_engajamento: scoreEngajamento,
      score_comportamento: scoreComportamento,
      temperatura,
      detalhes_pontuacao: detalhes,
      historico_scores: historico.slice(-10), // Manter últimos 10
      ultima_atualizacao: new Date().toISOString()
    };

    if (scoreAnterior) {
      await api.entities.LeadScore.update(scoreAnterior.id, scoreData);
    } else {
      await api.entities.LeadScore.create(scoreData);
    }

    return Response.json({
      success: true,
      score: scoreData
    });

  } catch (error) {
    console.error('Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
};
