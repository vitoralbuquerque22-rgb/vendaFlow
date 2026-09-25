/**
 * empresaService — acesso a Empresa passa por aqui.
 */
import { base44 } from "@/api/base44Client";

const Empresas          = () => base44.entities.Empresa;
const EmpresasVendedoras = () => base44.entities.EmpresaVendedora;
const UserProfiles       = () => base44.entities.UserProfile;

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