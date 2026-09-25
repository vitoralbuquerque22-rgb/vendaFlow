/**
 * tarefaService — toda lógica de acesso a Tarefa passa por aqui.
 */
import { base44 } from "@/api/base44Client";

const Tarefas = () => base44.entities.Tarefa;

// ── Queries ─────────────────────────────────────────────────
export async function listarTarefas(empresaId, { apenasDoSDR, sdrEmail } = {}) {
  if (!empresaId) return [];
  if (apenasDoSDR && sdrEmail) {
    return Tarefas().filter({ empresaId, sdr_email: sdrEmail });
  }
  return Tarefas().filter({ empresaId });
}

export async function listarProximosContatos(empresaId, { limit = 200 } = {}) {
  if (!empresaId) return [];
  // Retorna TODOS os próximos contatos pendentes (passados e futuros) — o card filtra visualmente
  const todasTarefas = await Tarefas().filter({ empresaId, status: "pendente" });
  const apenasProximoContato = todasTarefas
    .filter(t => t.origem === "proximo_contato")
    .sort((a, b) => new Date(a.data_prevista) - new Date(b.data_prevista));

  // Deduplica por lead (mantém o mais próximo)
  const porLead = new Map();
  for (const t of apenasProximoContato) {
    const key = t.lead_id || t.id;
    if (!porLead.has(key)) porLead.set(key, t);
  }
  return Array.from(porLead.values()).slice(0, limit);
}

export async function buscarTarefasPendentesDoLead(empresaId, leadId) {
  if (!empresaId || !leadId) return [];
  return Tarefas().filter({ empresaId, lead_id: leadId, status: "pendente" });
}

// ── Mutations ────────────────────────────────────────────────
export async function criarTarefa(dados) {
  return Tarefas().create(dados);
}

export async function atualizarTarefa(id, dados) {
  return Tarefas().update(id, dados);
}

export async function encerrarTarefasAutomaticamente(tarefas, motivo) {
  return Promise.all(
    tarefas.map(t =>
      Tarefas().update(t.id, {
        status: "encerrada_automaticamente",
        motivo_encerramento: motivo,
      })
    )
  );
}

export async function criarTarefasDaCadencia(empresaId, lead, sdrEmail, cadencia, dataBase = new Date(), overrides = {}) {
  const leadId = lead.id || lead.lead_id;

  // Deduplicação: se já existem tarefas pendentes desta cadência para este lead, não recriar
  if (leadId && cadencia.id) {
    const existentes = await Tarefas().filter({ empresaId, lead_id: leadId, cadencia_id: cadencia.id, status: "pendente" });
    if (existentes.length > 0) return existentes;
  }

  const hoje = new Date(dataBase);
  return Promise.all(
    (cadencia.etapas || []).map(etapa => {
      const dataEtapa = new Date(hoje);
      dataEtapa.setDate(dataEtapa.getDate() + (etapa.dia - 1));
      return Tarefas().create({
        empresaId,
        lead_id: lead.id || lead.lead_id,
        lead_nome: lead.nome || lead.lead_nome,
        lead_telefone: lead.telefone || lead.lead_telefone,
        lead_empresa: lead.empresa || lead.lead_empresa,
        sdr_email: sdrEmail,
        tipo: etapa.tipo,
        data_prevista: dataEtapa.toISOString().split("T")[0],
        periodo: etapa.periodo,
        status: "pendente",
        dia_cadencia: etapa.dia,
        cadencia_id: cadencia.id,
        script_id: etapa.script_id || "",
        campanha: lead.campanha || overrides.campanha || "",
        equipe: lead.equipe || overrides.equipe || "",
        produto_id: overrides.produto_id || lead.produto_id || "",
        produto_nome: overrides.produto_nome || lead.produto_nome || "",
      });
    })
  );
}