/**
 * cadenciaService — toda lógica de acesso a Cadencia passa por aqui.
 */
import { api } from "@/api/client";

const Cadencias = () => api.entities.Cadencia;

export async function listarCadencias(empresaId, { apenasAtivas = true } = {}) {
  if (!empresaId) return [];
  const filtro = { empresaId };
  if (apenasAtivas) filtro.ativa = true;
  return Cadencias().filter(filtro);
}

export async function buscarCadenciaPorId(id) {
  if (!id) return null;
  const results = await Cadencias().filter({ id });
  return results[0] || null;
}

export async function listarCadenciasCloser() {
  const todas = await Cadencias().list();
  return todas.filter(c => c.tipo_cadencia === "closer" && c.ativa);
}

export async function criarCadencia(dados) {
  return Cadencias().create(dados);
}

export async function atualizarCadencia(id, dados) {
  return Cadencias().update(id, dados);
}

export async function excluirCadencia(id) {
  return Cadencias().delete(id);
}