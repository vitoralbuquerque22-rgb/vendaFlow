/**
 * campanhaService — toda lógica de acesso a CampanhaAgendada, CampanhaVendaFlow,
 * EmailTemplate, EmailEnvio e LandingPage passa por aqui.
 */
import { base44 } from "@/api/base44Client";

const CampanhasAgendadas  = () => base44.entities.CampanhaAgendada;
const CampanhasVendaFlow  = () => base44.entities.CampanhaVendaFlow;
const EmailTemplates      = () => base44.entities.EmailTemplate;
const EmailEnvios         = () => base44.entities.EmailEnvio;
const LandingPages        = () => base44.entities.LandingPage;
const Scripts             = () => base44.entities.Script;

// ── CampanhaAgendada ─────────────────────────────────────────

export async function listarCampanhasAgendadas(empresaId) {
  if (!empresaId) return [];
  return CampanhasAgendadas().filter({ empresaId }, "-created_date");
}

export async function criarCampanhaAgendada(dados) {
  return CampanhasAgendadas().create(dados);
}

export async function atualizarCampanhaAgendada(id, dados) {
  return CampanhasAgendadas().update(id, dados);
}

export async function excluirCampanhaAgendada(id) {
  return CampanhasAgendadas().delete(id);
}

// ── CampanhaVendaFlow ────────────────────────────────────────

export async function listarCampanhasVendaFlow(empresaId) {
  if (!empresaId) return [];
  return CampanhasVendaFlow().filter({ empresaId }, "-created_date");
}

export async function criarCampanhaVendaFlow(dados) {
  return CampanhasVendaFlow().create(dados);
}

export async function atualizarCampanhaVendaFlow(id, dados) {
  return CampanhasVendaFlow().update(id, dados);
}

// ── EmailTemplate ────────────────────────────────────────────

export async function listarEmailTemplates(empresaId) {
  if (!empresaId) return [];
  return EmailTemplates().filter({ empresaId }, "-created_date");
}

export async function criarEmailTemplate(dados) {
  return EmailTemplates().create(dados);
}

export async function atualizarEmailTemplate(id, dados) {
  return EmailTemplates().update(id, dados);
}

export async function excluirEmailTemplate(id) {
  return EmailTemplates().delete(id);
}

// ── EmailEnvio ───────────────────────────────────────────────

export async function listarEmailEnvios(empresaId, { limit = 200 } = {}) {
  if (!empresaId) return [];
  return EmailEnvios().filter({ empresaId }, "-created_date", limit);
}

export async function criarEmailEnvio(dados) {
  return EmailEnvios().create(dados);
}

// ── LandingPage ──────────────────────────────────────────────

export async function listarLandingPages(empresaId) {
  if (!empresaId) return [];
  return LandingPages().filter({ empresaId }, "-created_date");
}

export async function buscarLandingPagePorId(id) {
  if (!id) return null;
  const results = await LandingPages().filter({ id });
  return results[0] || null;
}

export async function criarLandingPage(dados) {
  return LandingPages().create(dados);
}

export async function atualizarLandingPage(id, dados) {
  return LandingPages().update(id, dados);
}

export async function excluirLandingPage(id) {
  return LandingPages().delete(id);
}

// ── Script ───────────────────────────────────────────────────

export async function listarScripts(empresaId) {
  if (!empresaId) return [];
  return Scripts().filter({ empresaId }, "-created_date");
}

export async function criarScript(dados) {
  return Scripts().create(dados);
}

export async function atualizarScript(id, dados) {
  return Scripts().update(id, dados);
}

export async function excluirScript(id) {
  return Scripts().delete(id);
}