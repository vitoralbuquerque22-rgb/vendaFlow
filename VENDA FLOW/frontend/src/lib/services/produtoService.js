/**
 * produtoService — toda lógica de acesso a Produto passa por aqui.
 */
import { api } from "@/api/client";

const Produtos = () => api.entities.Produto;

export async function listarProdutos(empresaId) {
  if (!empresaId) return [];
  return Produtos().filter({ empresaId });
}

export async function buscarProdutoPorId(empresaId, produtoId) {
  if (!empresaId || !produtoId) return null;
  const results = await Produtos().filter({ empresaId, id: produtoId });
  return results[0] || null;
}

export async function criarProduto(dados) {
  return Produtos().create(dados);
}

export async function atualizarProduto(id, dados) {
  return Produtos().update(id, dados);
}

export async function excluirProduto(id) {
  return Produtos().delete(id);
}