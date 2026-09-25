import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { format, addDays, parseISO, isBefore, isAfter } from 'npm:date-fns@3.6.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const hoje = format(new Date(), 'yyyy-MM-dd');
    const programacoes = await base44.asServiceRole.entities.ProgramacaoDistribuicao.filter({ ativa: true });

    let totalProcessadas = 0;
    let totalLeadsDistribuidos = 0;

    for (const prog of programacoes) {
      const dataInicio = parseISO(prog.data_inicio);
      const dataFim    = parseISO(prog.data_fim);
      const hojeDate   = new Date();

      if (isBefore(hojeDate, dataInicio)) continue;

      if (isAfter(hojeDate, dataFim)) {
        await base44.asServiceRole.entities.ProgramacaoDistribuicao.update(prog.id, { status: 'concluida', ativa: false });
        continue;
      }

      if (prog.status === 'aguardando') {
        await base44.asServiceRole.entities.ProgramacaoDistribuicao.update(prog.id, { status: 'em_andamento' });
      }

      const empresaId = prog.empresaId;
      if (!empresaId) continue;

      // CORRIGIDO: filtrar por empresaId — nunca buscar leads cross-tenant
      const todosLeads = await base44.asServiceRole.entities.Lead.filter({ empresaId });
      const leadsDisponiveis = todosLeads.filter(lead => {
        if (lead.sdr_responsavel) return false;
        const filtro = prog.filtro_leads || {};
        if (filtro.status && lead.status !== filtro.status) return false;
        if (filtro.origem && lead.origem !== filtro.origem) return false;
        if (filtro.campanha && lead.campanha !== filtro.campanha) return false;
        return true;
      });

      const sdrs = prog.sdrs_atribuidos || [];
      if (sdrs.length === 0) continue;

      let indice = prog.ultimo_indice_fila || 0;
      let distribuidos = 0;

      for (const lead of leadsDisponiveis) {
        if (distribuidos >= (prog.total_leads || leadsDisponiveis.length)) break;

        const sdrEmail = sdrs[indice % sdrs.length];
        indice = (indice + 1) % sdrs.length;

        await base44.asServiceRole.entities.Lead.update(lead.id, {
          sdr_responsavel: sdrEmail,
          data_atribuicao: new Date().toISOString(),
          status: lead.status === 'novo' ? 'novo' : lead.status,
        });

        await base44.asServiceRole.entities.Tarefa.create({
          empresaId,
          lead_id:       lead.id,
          lead_nome:     lead.nome,
          lead_telefone: lead.telefone,
          sdr_email:     sdrEmail,
          tipo:          'ligacao',
          data_prevista: hoje,
          periodo:       'manha',
          status:        'pendente',
          cadencia_id:   prog.cadencia_id || null,
          campanha:      lead.campanha || null,
        });

        distribuidos++;
        totalLeadsDistribuidos++;
      }

      await base44.asServiceRole.entities.ProgramacaoDistribuicao.update(prog.id, {
        ultimo_indice_fila: indice,
        ultima_execucao: new Date().toISOString(),
        leads_distribuidos_total: (prog.leads_distribuidos_total || 0) + distribuidos,
      });

      totalProcessadas++;
    }

    return Response.json({ ok: true, programacoes: totalProcessadas, leads_distribuidos: totalLeadsDistribuidos });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});