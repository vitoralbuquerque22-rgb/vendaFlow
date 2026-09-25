/**
 * scriptService — toda lógica de acesso a Script passa por aqui.
 */
import { base44 } from "@/api/base44Client";

const Scripts = () => base44.entities.Script;

export async function listarScripts(empresaId) {
  if (!empresaId) return [];
  return Scripts().filter({ empresaId });
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