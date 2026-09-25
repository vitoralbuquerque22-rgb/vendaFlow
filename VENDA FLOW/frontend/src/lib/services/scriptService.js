/**
 * scriptService — toda lógica de acesso a Script passa por aqui.
 */
import { api } from "@/api/client";

const Scripts = () => api.entities.Script;

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