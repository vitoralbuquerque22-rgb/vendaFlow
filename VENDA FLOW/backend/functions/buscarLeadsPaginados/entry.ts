import { createClientFromRequest } from "../../src/sdk.ts";

export default async (req) => {
  try {
    const api = createClientFromRequest(req);
    const user = await api.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      empresaId,
      pagina = 1,
      itensPorPagina = 20,
      busca = '',
      status = '',
      origem = '',
      sdrEmail = '',
      dataInicio = '',
      dataFim = '',
      apenasDoSDR = false,
      ordenacaoCampo = 'created_date',
      ordenacaoDirecao = 'desc',
    } = await req.json();

    if (!empresaId) return Response.json({ error: 'empresaId obrigatório' }, { status: 400 });

    const paginaNum = Math.max(1, parseInt(pagina));
    const porPagina = Math.max(1, parseInt(itensPorPagina));

    // Filtro indexável
    const filtro = { empresaId };
    if (status && status !== 'todos') filtro.status = status;
    if (origem && origem !== 'todas') filtro.origem = origem;
    if (apenasDoSDR && sdrEmail) {
      filtro.sdr_responsavel = sdrEmail;
    } else if (sdrEmail && sdrEmail !== 'todos' && sdrEmail !== 'sem_atribuicao') {
      filtro.sdr_responsavel = sdrEmail;
    }

    const sortPrefix = ordenacaoDirecao === 'asc' ? '' : '-';
    const sortField = `${sortPrefix}${ordenacaoCampo}`;

    // Filtros não-indexáveis
    const temBusca = !!(busca && busca.trim());
    const temDataInicio = !!dataInicio;
    const temDataFim = !!dataFim;
    const temSemAtribuicao = sdrEmail === 'sem_atribuicao';
    const precisaVarredura = temBusca || temDataInicio || temDataFim || temSemAtribuicao;

    const dataInicioTs = temDataInicio ? new Date(dataInicio).getTime() : null;
    const dataFimTs = temDataFim ? new Date(dataFim + 'T23:59:59').getTime() : null;
    const termoLower = temBusca ? busca.toLowerCase().trim() : '';

    const passaFiltro = (lead) => {
      if (temSemAtribuicao && lead.sdr_responsavel) return false;
      if (dataInicioTs && (!lead.created_date || new Date(lead.created_date).getTime() < dataInicioTs)) return false;
      if (dataFimTs && (!lead.created_date || new Date(lead.created_date).getTime() > dataFimTs)) return false;
      if (temBusca) {
        return (
          lead.nome?.toLowerCase().includes(termoLower) ||
          lead.empresa?.toLowerCase().includes(termoLower) ||
          lead.telefone?.includes(termoLower) ||
          lead.email?.toLowerCase().includes(termoLower)
        );
      }
      return true;
    };

    // Busca em lotes de 500 para encontrar os matches desta página
    // Para quando tiver (paginaNum * porPagina + 1) matches — assim sabe se há próxima página
    const LOTE = 500;
    const necessario = paginaNum * porPagina + 1; // +1 para detectar "tem próxima página"
    const matches = [];
    let offset = 0;
    let esgotou = false;

    while (matches.length < necessario && !esgotou) {
      const lote = await api.entities.Lead.filter(filtro, sortField, LOTE, offset);
      if (!lote || lote.length === 0) { esgotou = true; break; }

      if (precisaVarredura) {
        for (const lead of lote) {
          if (passaFiltro(lead)) matches.push(lead);
        }
      } else {
        for (const lead of lote) matches.push(lead);
      }

      if (lote.length < LOTE) { esgotou = true; break; }
      offset += LOTE;
    }

    const temProxima = matches.length > paginaNum * porPagina;
    const inicio = (paginaNum - 1) * porPagina;
    const leads = matches.slice(inicio, inicio + porPagina);

    // Total estimado: se esgotou, é exato; senão, sabemos pelo menos quantos temos
    const totalExato = esgotou ? matches.length : null;
    // Para paginação: se não esgotou, estimamos pelo menos mais uma página
    const totalParaUI = totalExato !== null ? totalExato : (paginaNum * porPagina + (temProxima ? porPagina : 0));
    const totalPaginas = Math.max(1, Math.ceil(totalParaUI / porPagina));

    const contadores = {
      novo: matches.filter(l => l.status === 'novo').length,
      em_cadencia: matches.filter(l => l.status === 'em_cadencia').length,
      reuniao_agendada: matches.filter(l => l.status === 'reuniao_agendada').length,
      total: totalParaUI,
    };

    return Response.json({
      leads,
      total: totalParaUI,
      totalExato: totalExato !== null,
      temProxima,
      totalPaginas,
      pagina: paginaNum,
      contadores,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
};
