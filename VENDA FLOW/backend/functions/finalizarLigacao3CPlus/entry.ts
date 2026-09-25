import { createClientFromRequest } from "../../src/sdk.ts";
import { chamar3C, credencialAgente, respostaErro3C, type Credencial3C } from "../../src/telefonia3c.ts";

// Credenciais e URL base do 3C Plus vêm do módulo central telefonia3c.ts
// (token de serviço de agente + X-Agent-Id; token pessoal só na transição).

/**
 * finalizarLigacao3CPlus
 *
 * Encerra uma sessão de chamada. Chamado pelo frontend quando:
 *   a) O agente clica "Finalizar atendimento" no modal
 *   b) A função sincronizarTelefonia3CPlus detecta call-was-finished
 *
 * Responsabilidades:
 *   1. Validar que o SPIN foi preenchido (bloqueia se não foi)
 *   2. Salvar SpinResposta como entidade separada
 *   3. Criar Atividade no histórico do lead
 *   4. Liberar lock do lead
 *   5. Atualizar status do lead conforme resultado
 *   6. Disparar processamento de gravação (se URL disponível)
 *   7. Encerrar CallSession
 *
 * Regra crítica: não pode finalizar sem SPIN preenchido.
 * Exceção: se o lead não atendeu (resultado = nao_atendeu, ocupado, etc.)
 * o SPIN não é exigido.
 */

// Resultados que NÃO exigem SPIN (lead não atendeu)
const RESULTADOS_SEM_SPIN = new Set([
  'nao_atendeu',
  'ocupado',
  'caixa_postal',
  'numero_invalido',
  // Campanha automática — ligação pode cair antes do SDR preencher SPIN
  // O qualify no 3C já é feito, SPIN pode ser preenchido depois via atividade
  'outro',
]);

// Mapeamento resultado CRM → nome de qualificação 3C Plus
// Nomes conforme lista de qualificações "Padrão" cadastrada no 3C Plus da empresa
// A qualificação controla o comportamento do discador (repetir, não discar, etc)
const RESULTADO_PARA_QUALIFICACAO_3C = {
  'nao_atendeu':         'Sem contato / Ligação caiu',       // Negativo, Repetir
  'ocupado':             'Sem contato / Ligação caiu',       // Negativo, Repetir
  'caixa_postal':        'Sem contato / Ligação caiu',       // Negativo, Repetir
  'numero_invalido':     'Telefone incorreto / Engano',      // Negativo, Não discar novamente para o telefone
  'atendeu':             'Em negociação whatsApp',            // Positivo, Não discar novamente para o cliente
  'reuniao_agendada':    'Agendamento/Reunião',              // Positivo, Não discar novamente para o telefone
  'reuniao_confirmada':  'Agendamento/Reunião',              // Positivo, Não discar novamente para o telefone
  'qualificado':         'Venda feita por telefone',          // Positivo, Não discar novamente para o cliente, Conversão + CPC
  'venda_realizada':     'Venda feita por telefone',          // Positivo, Não discar novamente para o cliente, Conversão + CPC
  'sem_interesse':       'Sem interesse',                     // Positivo, Não discar novamente para o cliente
  'desqualificado':      'Desqualificado',                    // Positivo, Não discar novamente para o telefone
  'respondeu':           'Em negociação whatsApp',            // Positivo, Não discar novamente para o cliente
  'contrato_enviado':    'Em negociação whatsApp',            // Positivo, Não discar novamente para o cliente
  'reagendada':          'Agendamento / Retorno',             // Positivo, Não discar novamente para o cliente, CPC + Agendamento
};

// Qualificações padrão do sistema 3C Plus (IDs negativos, sempre disponíveis)
// Usadas como fallback quando a qualificação personalizada não é encontrada
const QUALIFICACOES_SISTEMA_3C = {
  'Não qualificada':         -2,  // Negativo, Repetir
  'Caixa Postal':            -3,  // Negativo, Repetir
  'Mudo':                    -4,  // Negativo, Repetir
  'Limite de tempo excedido': -5,  // Negativo, Repetir
};

// Mapeamento resultado → qualificação padrão do sistema como fallback
const RESULTADO_PARA_QUALIF_SISTEMA = {
  'nao_atendeu':     -2,  // Não qualificada
  'ocupado':         -2,  // Não qualificada
  'caixa_postal':    -3,  // Caixa Postal
  'numero_invalido': -2,  // Não qualificada (fallback)
};

// ID da lista de qualificações preferencial — lido dinamicamente da configuração do tenant (cfgHangup.qualification_list_id)
// Esta constante foi removida; a lógica agora usa cfgHangup.qualification_list_id com fallback de varredura.

// Mapeamento resultado → status do Lead
const RESULTADO_PARA_STATUS = {
  'atendeu':           'respondeu',
  'reuniao_agendada':  'reuniao_agendada',
  'qualificado':       'qualificado',
  'sem_interesse':     'sem_interesse',
  'desqualificado':    'desqualificado',
};

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const api = createClientFromRequest(req);
    const user = await api.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    let body;

    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Corpo da requisição inválido' }, { status: 400 });
    }

    console.log('[finalizarLigacao3CPlus] body recebido:', JSON.stringify(body, null, 2));

    // Suporte ao novo formato com crmData (compatível com formato antigo)
    const crmData = body.crmData || {};
    const resultado = crmData.resultado || body.resultado;
    const spin = crmData.spin || body.spin || null;
    const observacao = crmData.observacao || body.observacao || '';
    const qualificationIdFromFrontend = crmData.qualification_id || body.qualification_id || null;
    const novoStatusLeadFromFrontend = crmData.novo_status_lead || body.novo_status_lead || null;

    // Re-injetar no body para compatibilidade com o restante do código
    body.resultado = resultado;
    body.spin = spin;
    body.observacao = observacao;
    body.qualification_id = qualificationIdFromFrontend;
    body.novo_status_lead = novoStatusLeadFromFrontend;

    if (!body.empresaId || !body.call_session_id || !body.resultado) {
      console.log('[finalizarLigacao3CPlus] 400 - campos faltando:', {
        empresaId: body.empresaId,
        call_session_id: body.call_session_id,
        resultado: body.resultado,
      });
      return Response.json(
        { error: 'empresaId, call_session_id e resultado são obrigatórios' },
        { status: 400 }
      );
    }

    // -------------------------------------------------------
    // 1. Buscar CallSession — buscar por .get(id)
    // -------------------------------------------------------
    // JUSTIFICATIVA: Finalização de ligação — ação do usuário autenticado (SDR), mas requer
    // escrita em CallSession, Atividade, SpinResposta e Lead do outro usuário dono do lead.
    // O RLS do Lead/Atividade filtra por empresaId, não por SDR individual, portanto
    // asServiceRole é necessário para atualizar recursos pertencentes a outro SDR (ex: lead travado).
    let sessao;
    try {
      sessao = await api.asServiceRole.entities.CallSession.get(body.call_session_id);
    } catch (e) {
      return Response.json({ error: 'Sessão de chamada não encontrada', call_session_id: body.call_session_id }, { status: 404 });
    }

    if (!sessao) {
      return Response.json({ error: 'Sessão de chamada não encontrada' }, { status: 404 });
    }

    // Validar tenant
    if (sessao.empresaId !== body.empresaId) {
      return Response.json({ error: 'Sessão não pertence a esta empresa' }, { status: 403 });
    }

    // -----------------------------------------------------------------------
    // RESOLUÇÃO DA CREDENCIAL — antecipada para poder usar em qualquer early-return
    // Opera como o agente do usuário logado (o SDR que está finalizando).
    // Falha de credencial NÃO bloqueia a finalização: apenas pula as ações no 3C Plus.
    // -----------------------------------------------------------------------
    const credAgente: Credencial3C | null = await credencialAgente(api, body.empresaId, user.email)
      .catch((e) => {
        console.warn('[finalizarLigacao3CPlus] credencial 3C Plus indisponível — ações no 3C serão puladas:', e.message);
        return null;
      });
    const cfgHangup = credAgente?.config || {};

    // Early-return: sessão já finalizada — apenas sair do ACW se ainda necessário
    if (sessao.status === 'finished') {
      if (credAgente) {
        // Chamar ambos endpoints para garantir saída do ACW em qualquer cenário
        await Promise.allSettled([
          chamar3C(credAgente, '/agent/manual_call_acw/exit', { method: 'POST', timeoutMs: 5000 }).catch(() => {}),
          chamar3C(credAgente, '/agent/acw/exit', { method: 'POST', timeoutMs: 5000 }).catch(() => {}),
        ]);
      }
      return Response.json(
        { success: true, aviso: 'Sessão já finalizada — ACW encerrado', call_session_id: body.call_session_id },
        { status: 200 }
      );
    }

    // -------------------------------------------------------
    // 2. Validar SPIN obrigatório
    // -------------------------------------------------------
    // Campanha automática: não exige SPIN — qualificação mínima é suficiente
    const origemCampanha = sessao.origem === 'campanha_automatica';
    const exigeSpin = !RESULTADOS_SEM_SPIN.has(body.resultado) && !origemCampanha;

    console.log('[finalizarLigacao3CPlus] resultado:', body.resultado, '| exigeSpin:', exigeSpin);

    if (exigeSpin) {
      const spin = body.spin || {};
      const camposPreenchidos = [
        spin.situacao,
        spin.problema,
        spin.implicacao,
        spin.necessidade,
        spin.proximo_passo,
      ].filter(v => v && String(v).trim().length > 0);

      console.log('[finalizarLigacao3CPlus] spin recebido:', JSON.stringify(spin, null, 2));
      console.log('[finalizarLigacao3CPlus] campos preenchidos:', camposPreenchidos.length, '/', 5, camposPreenchidos);

      // Exige ao menos 3 dos 5 campos preenchidos
      if (camposPreenchidos.length < 3) {
        console.log('[finalizarLigacao3CPlus] 422 - SPIN_REQUIRED: apenas', camposPreenchidos.length, 'campo(s) preenchido(s)');
        return Response.json(
          {
            error: 'SPIN incompleto',
            codigo: 'SPIN_REQUIRED',
            mensagem: 'Preencha pelo menos Situação, Problema e Próximo Passo antes de finalizar.',
            campos_preenchidos: camposPreenchidos.length,
            campos_necessarios: 3,
          },
          { status: 422 }
        );
      }
    }

    const agora = new Date();
    const iniciadaEm = sessao.iniciada_em ? new Date(sessao.iniciada_em) : agora;
    const duracaoCalculada = body.duracao_segundos ??
      Math.floor((agora.getTime() - iniciadaEm.getTime()) / 1000);

    // -------------------------------------------------------
    // 3. Encerrar ligação no 3C Plus (end-call)
    // (credencial já resolvida acima — credAgente disponível)
    // -------------------------------------------------------
    // Declarado no escopo externo para poder ser retornado no final (fora do if).
    let qualificacaoRegistrada = false;

    if (credAgente) {
      // Autenticação via headers (Bearer + X-Agent-Id) montados por chamar3C

      // ── Hangup: POST /agent/call/{call-id}/hangup ──────────────────
      if (sessao.chamada_id_3cplus) {
        try {
          const rHangup = await chamar3C(
            credAgente,
            `/agent/call/${sessao.chamada_id_3cplus}/hangup`,
            { method: 'POST', form: {}, timeoutMs: 5000 }
          );
          console.log(`[finalizarLigacao3CPlus] hangup → ${rHangup.status}`);
        } catch (e) {
          console.warn('[finalizarLigacao3CPlus] hangup falhou (não crítico):', e.message);
        }
      }

      // ── ETAPA 1: Qualificar chamada no 3C Plus ──────────────────
      // IMPORTANTE: A qualificação DEVE acontecer ANTES do ACW exit.
      // O 3C Plus fica em TPA aguardando a qualificação. Sequência:
      //   qualify → acw/exit → agente volta a ocioso → próxima ligação
      if (sessao.chamada_id_3cplus) {
        try {
          const qualifEndpoint = (sessao.origem === 'campanha_automatica' || sessao.origem === 'power_dialer')
            ? `/agent/call/${sessao.chamada_id_3cplus}/qualify`
            : `/agent/manual_call/${sessao.chamada_id_3cplus}/qualify`;
          const qualifNote = body.observacao || body.spin?.proximo_passo || '';

          // ID direto informado pelo agente — usa sem busca adicional
          let qualificationId = body.qualification_id ? Number(body.qualification_id) : null;
          let nomeQualif = null;

          if (!qualificationId) {
            // Determinar pelo resultado/status_lead automaticamente
            const chaveQualif = (body.novo_status_lead === 'sem_interesse' || body.novo_status_lead === 'desqualificado')
              ? body.novo_status_lead
              : body.resultado;
            nomeQualif = RESULTADO_PARA_QUALIFICACAO_3C[chaveQualif];

            if (nomeQualif) {
              // Buscar na lista configurada no tenant
              const prefListId = cfgHangup.qualification_list_id ? String(cfgHangup.qualification_list_id) : null;

              if (prefListId) {
                const rListPref = await chamar3C(
                  credAgente,
                  `/qualification_lists/${prefListId}/qualifications`,
                  { timeoutMs: 5000 }
                ).catch(() => null);

                if (rListPref?.ok) {
                  const data = await rListPref.json().catch(() => ({}));
                  const match = (data?.data || []).find(
                    q => q.name?.toLowerCase().trim() === nomeQualif.toLowerCase().trim()
                  );
                  if (match) qualificationId = match.id;
                }
              }

              // Fallback: varrer todas as listas em PARALELO (evita timeout sequencial)
              if (!qualificationId) {
                const rAllLists = await chamar3C(credAgente, '/qualification_lists', { timeoutMs: 5000 })
                  .catch(() => null);

                if (rAllLists?.ok) {
                  const allListsData = await rAllLists.json().catch(() => ({}));
                  const listsToSearch = (allListsData?.data || []).filter(ql => !prefListId || String(ql.id) !== prefListId);
                  const results = await Promise.allSettled(
                    listsToSearch.map(ql =>
                      chamar3C(
                        credAgente,
                        `/qualification_lists/${ql.id}/qualifications`,
                        { timeoutMs: 4000 }
                      ).then(r => r.ok ? r.json() : null).catch(() => null)
                    )
                  );
                  for (const r of results) {
                    if (r.status === 'fulfilled' && r.value) {
                      const match = (r.value?.data || []).find(
                        q => q.name?.toLowerCase().trim() === nomeQualif.toLowerCase().trim()
                      );
                      if (match) { qualificationId = match.id; break; }
                    }
                  }
                }
              }

              // Fallback final: usar qualificação padrão do sistema (IDs negativos)
              if (!qualificationId) {
                const chaveQualifFallback = (body.novo_status_lead === 'sem_interesse' || body.novo_status_lead === 'desqualificado')
                  ? body.novo_status_lead : body.resultado;
                const fallbackSistema = RESULTADO_PARA_QUALIF_SISTEMA[chaveQualifFallback];
                if (fallbackSistema) {
                  qualificationId = fallbackSistema;
                  console.log('[finalizarLigacao3CPlus] usando qualificação padrão do sistema:', qualificationId);
                }
              }
            }

            // Fallback UNIVERSAL: sem qualquer qualificação resolvida, pegar a
            // primeira qualificação real da lista padrão/CRM da conta. Segundo a
            // doc do 3C, ligação sem qualificação deixa o agente preso em TPA —
            // então sempre enviamos alguma qualificação antes do acw/exit.
            if (!qualificationId) {
              const rLists = await chamar3C(credAgente, '/qualification_lists', { timeoutMs: 5000 })
                .catch(() => null);
              if (rLists?.ok) {
                const listsData = await rLists.json().catch(() => ({}));
                const lists = (listsData?.data || []).filter(l => (l.qualification_count ?? 1) > 0);
                const listaEscolhida = lists.find(l => l.type === 4)
                  || lists.find(l => String(l.name || '').toLowerCase().includes('padr'))
                  || lists[0];
                if (listaEscolhida) {
                  const rQ = await chamar3C(
                    credAgente,
                    `/qualification_lists/${listaEscolhida.id}/qualifications`,
                    { timeoutMs: 5000 }
                  ).catch(() => null);
                  if (rQ?.ok) {
                    const qData = await rQ.json().catch(() => ({}));
                    qualificationId = (qData?.data || [])[0]?.id || null;
                    if (qualificationId) console.log('[finalizarLigacao3CPlus] fallback universal → 1ª qualificação da lista', listaEscolhida.id, ':', qualificationId);
                  }
                }
              }
            }
          } else {
            console.log('[finalizarLigacao3CPlus] usando qualification_id direto informado pelo agente:', qualificationId);
          }

          if (qualificationId) {
            // Enviado como application/x-www-form-urlencoded (mesmo formato de antes)
            const qualifForm = {
              qualification_id:   String(qualificationId),
              qualification_note: String(qualifNote),
            };
            const rQualif = await chamar3C(credAgente, qualifEndpoint, {
              method: 'POST', form: qualifForm, timeoutMs: 5000,
            });
            console.log('[finalizarLigacao3CPlus] qualify →', rQualif.status, '| qualification_id:', qualificationId, '| nome:', nomeQualif || '(ID direto)');
            qualificacaoRegistrada = rQualif.ok;

            // Se o endpoint escolhido falhou, tentar o outro tipo (manual ↔ campanha).
            // Cenário comum: chamada tabulada no endpoint errado deixa o TPA preso.
            if (!rQualif.ok) {
              const qualifEndpointAlt = qualifEndpoint.includes('/manual_call/')
                ? `/agent/call/${sessao.chamada_id_3cplus}/qualify`
                : `/agent/manual_call/${sessao.chamada_id_3cplus}/qualify`;
              const rQualifAlt = await chamar3C(credAgente, qualifEndpointAlt, {
                method: 'POST', form: qualifForm, timeoutMs: 5000,
              }).catch(() => null);
              if (rQualifAlt) {
                console.log('[finalizarLigacao3CPlus] qualify (fallback alt) →', rQualifAlt.status);
                qualificacaoRegistrada = qualificacaoRegistrada || rQualifAlt.ok;
              }
            }
          } else {
            console.warn('[finalizarLigacao3CPlus] qualify: qualification_id não encontrado para resultado:', body.resultado);
          }
        } catch (e) {
          console.warn('[finalizarLigacao3CPlus] qualify falhou (não crítico):', e.message);
        }
      }

    } // fim if (credAgente)

    // ── ETAPA 2: Sair do ACW/TPA — executa SEMPRE (com ou sem chamada_id_3cplus, mesmo se qualify falhou) ──
    // O 3C Plus espera: qualificar → sair do TPA → agente volta a ocioso.
    // Chamar AMBOS endpoints (manual + campanha) para cobrir qualquer cenário.
    if (credAgente) {
      if (!qualificacaoRegistrada) {
        console.warn('[finalizarLigacao3CPlus] qualify não registrada — executando acw/exit mesmo assim para liberar o agente do TPA');
      }
      const acwExitEndpoints = [
        '/agent/manual_call_acw/exit',
        '/agent/acw/exit',
      ];
      await Promise.allSettled(
        acwExitEndpoints.map(path =>
          chamar3C(credAgente, path, { method: 'POST', timeoutMs: 5000 })
            .then(r => console.log(`[finalizarLigacao3CPlus] acw/exit → ${r.status} (${path.includes('manual') ? 'manual' : 'campaign'})`))
            .catch(e => console.warn(`[finalizarLigacao3CPlus] acw/exit falhou (${path.includes('manual') ? 'manual' : 'campaign'}):`, e.message))
        )
      );
      console.log('[finalizarLigacao3CPlus] fluxo completo: qualify=' + qualificacaoRegistrada + ' → acw/exit executado');
    } else {
      console.warn('[finalizarLigacao3CPlus] credencial 3C Plus ausente — ACW não pôde ser encerrado diretamente. TPA pode ficar preso.');
    }

    // -------------------------------------------------------
    // 4. Salvar SpinResposta (se SPIN preenchido)
    // -------------------------------------------------------
    let spinRespostaId = null;

    if (exigeSpin && body.spin && sessao.lead_id) {
      const spinDoc = await api.asServiceRole.entities.SpinResposta.create({
        empresaId:     body.empresaId,
        lead_id:       sessao.lead_id,
        call_session_id: body.call_session_id,
        sdr_email:     user.email,
        situacao:      body.spin.situacao || '',
        problema:      body.spin.problema || '',
        implicacao:    body.spin.implicacao || '',
        necessidade:   body.spin.necessidade || '',
        proximo_passo: body.spin.proximo_passo || '',
        data_ligacao:  agora.toISOString(),
      });
      spinRespostaId = spinDoc.id;
    }

    // -------------------------------------------------------
    // 5. Criar Atividade no histórico do lead
    // -------------------------------------------------------
    // Atividade.lead_id é obrigatório no schema. Em ligações manuais/campanha
    // sem lead identificado, sessao.lead_id vem vazio → o create falharia com 422
    // e derrubaria toda a finalização (500). Nesse caso, apenas pulamos o registro
    // de histórico (não há lead para associar) e seguimos encerrando a sessão/ACW.
    let atividade = null;
    if (sessao.lead_id) {
      atividade = await api.asServiceRole.entities.Atividade.create({
        empresaId:          body.empresaId,
        tipo:               'ligacao',
        resultado:          body.resultado,
        duracao_segundos:   duracaoCalculada,
        observacao:         body.observacao || (exigeSpin && body.spin?.proximo_passo
          ? `Próximo passo: ${body.spin.proximo_passo}`
          : ''),
        sdr_email:          user.email,
        lead_id:            sessao.lead_id,
        lead_nome:          sessao.lead_nome,
        lead_telefone:      sessao.lead_telefone,
        chamada_id_3cplus:  sessao.chamada_id_3cplus || '',
        gravacao_url:       body.gravacao_url || sessao.gravacao_url || '',
        tpa_segundos:       0,
        origem_sincronizacao: 'manual',
      });
    } else {
      console.log('[finalizarLigacao3CPlus] sem lead_id — Atividade não registrada (ligação sem lead identificado)');
    }

    // -------------------------------------------------------
    // 6. Atualizar status do Lead + liberar lock
    // -------------------------------------------------------
    const novoStatusLead = novoStatusLeadFromFrontend ||
      RESULTADO_PARA_STATUS[body.resultado] ||
      undefined;

    const updateLead = {
      is_locked_for_call: false,
      lock_agent_email:   null,
      lock_at:            null,
      call_session_id:    null,
      ultima_ligacao_em:  agora.toISOString(),
    };

    // Buscar total atual de ligações — usar .get(id)
    if (sessao.lead_id) {
      try {
        const leadAtual = await api.asServiceRole.entities.Lead.get(sessao.lead_id);
        if (leadAtual) {
          updateLead.total_ligacoes = (leadAtual.total_ligacoes || 0) + 1;
        }
      } catch {}
    }

    if (novoStatusLead) {
      updateLead.status = novoStatusLead;
    }

    if (sessao.lead_id) {
      await api.asServiceRole.entities.Lead.update(sessao.lead_id, updateLead);
    }

    // -------------------------------------------------------
    // 7. Finalizar CallSession
    // -------------------------------------------------------
    await api.asServiceRole.entities.CallSession.update(body.call_session_id, {
      status:           'finished',
      finalizada_em:    agora.toISOString(),
      duracao_segundos: duracaoCalculada,
      spin_preenchido:  exigeSpin && !!body.spin,
      spin_respostas:   body.spin || null,
      gravacao_url:     body.gravacao_url || sessao.gravacao_url || null,
      atividade_id:     atividade?.id || null,
    });

    // -------------------------------------------------------
    // 8. Disparar processamento de gravação (se URL disponível)
    // -------------------------------------------------------
    let gravacaoAgendada = false;
    const gravacaoUrl = body.gravacao_url || sessao.gravacao_url;

    if (gravacaoUrl) {
      try {
        const urlSelf = new URL(req.url);
        const baseUrl = `${urlSelf.protocol}//${urlSelf.host}`;

        fetch(`${baseUrl}/functions/processarGravacao3CPlus`, {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': req.headers.get('Authorization') || '',
          },
          body: JSON.stringify({
            empresaId:       body.empresaId,
            call_session_id: body.call_session_id,
            gravacao_url:    gravacaoUrl,
          }),
        }).catch(() => {});

        gravacaoAgendada = true;
      } catch { /* não bloqueia */ }
    }

    return Response.json(
      {
        success:                  true,
        call_session_id:          body.call_session_id,
        atividade_id:             atividade?.id || null,
        spin_resposta_id:         spinRespostaId,
        gravacao_agendada:        gravacaoAgendada,
        lead_status_atualizado:   novoStatusLead || null,
        qualificacao_registrada:  qualificacaoRegistrada,
        qualify_pendente:         !qualificacaoRegistrada && !!credAgente,
        mensagem:                 'Ligação finalizada com sucesso.',
      },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );

  } catch (error) {
    console.error('[finalizarLigacao3CPlus]', error.message);
    return respostaErro3C(error, { 'Access-Control-Allow-Origin': '*' });
  }
};
