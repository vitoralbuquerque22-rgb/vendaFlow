/**
 * empresaService — acesso a Empresa passa por aqui.
 */
import { api } from "@/api/client";

const Empresas          = () => api.entities.Empresa;
const EmpresasVendedoras = () => api.entities.EmpresaVendedora;
const UserProfiles       = () => api.entities.UserProfile;

export async function buscarEmpresaPorId(empresaId) {
  if (!empresaId) return null;
  return await Empresas().get(empresaId);
}

export async function listarEmpresasVendedoras({ apenasAtivas = true } = {}) {
  const filtro = apenasAtivas ? { ativa: true } : {};
  return EmpresasVendedoras().filter(filtro);
}

export async function listarUserProfiles() {
  return UserProfiles().list();
}