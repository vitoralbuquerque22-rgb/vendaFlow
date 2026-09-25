import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { PAGE_PERMISSIONS, FEATURE_PERMISSIONS } from "@/components/lib/pagePermissions";
import { DEFAULT_ROLE, getNivel } from "@/components/lib/systemRoles";
import { useEmpresaAtual } from "./useEmpresaAtual";

const IMPERSONATION_KEY = "vf_impersonation";
const HMAC_KEY = "vf_imp_sig";

function computeSignature(payload) {
  const str = JSON.stringify(payload);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return `vf1_${btoa(String(hash ^ 0x5a3c9e7f))}`;
}

export function getImpersonation() {
  try {
    const raw = sessionStorage.getItem(IMPERSONATION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const sig = sessionStorage.getItem(HMAC_KEY);
    if (sig !== computeSignature(data)) {
      sessionStorage.removeItem(IMPERSONATION_KEY);
      sessionStorage.removeItem(HMAC_KEY);
      return null;
    }
    return data;
  } catch { return null; }
}

export function setImpersonation(data) {
  if (data) {
    sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify(data));
    sessionStorage.setItem(HMAC_KEY, computeSignature(data));
  } else {
    sessionStorage.removeItem(IMPERSONATION_KEY);
    sessionStorage.removeItem(HMAC_KEY);
  }
}

export function usePermissions() {
  const { empresaId, isLoading: empresaLoading } = useEmpresaAtual();
  const impersonation = getImpersonation();

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const { data: userProfile } = useQuery({
    queryKey: ["userProfile", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      return profiles[0] || null;
    },
    enabled: !!user?.email,
    staleTime: 5 * 60_000,
  });

  const { data: vinculoEmpresa, isLoading: vinculoLoading } = useQuery({
    queryKey: ["vinculo-empresa", empresaId, user?.email],
    queryFn: async () => {
      if (!empresaId || !user?.email) return null;
      const vinculos = await base44.entities.VinculoEmpresa.filter({
        empresaId,
        userEmail: user.email,
        status: "ativo"
      });
      return vinculos?.[0] || null;
    },
    enabled: !!empresaId && !!user?.email,
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Normaliza roles genéricos da plataforma (ex: "user") que não existem no sistema de permissões
  const rawRoleResolved = vinculoEmpresa?.papel || userProfile?.role || user?.role || DEFAULT_ROLE;
  const rawRole = rawRoleResolved === "user" ? "sdr" : rawRoleResolved;
  const isSuperAdmin = user?.role === "super_admin" || user?.role === "admin" || rawRole === "super_admin";
  const isImpersonating = isSuperAdmin && !!impersonation;
  const effectiveRole = (isImpersonating && impersonation?.papel) ? impersonation.papel : rawRole;

  const canAccessPage = (pageName) => {
    if (!pageName) return true;
    if (isSuperAdmin && !isImpersonating) return true;
    if (effectiveRole === "admin") return true;
    if (userProfile?.permissions?.pages?.[pageName]?.read) return true;
    const pagePerms = PAGE_PERMISSIONS[pageName];
    if (!pagePerms) return true;
    return pagePerms[effectiveRole]?.read || false;
  };

  const canPerformAction = (pageName, action) => {
    if (!pageName || !action) return false;
    if (isSuperAdmin && !isImpersonating) return true;
    if (effectiveRole === "admin") return true;
    if (userProfile?.permissions?.pages?.[pageName]?.[action]) return true;
    const pagePerms = PAGE_PERMISSIONS[pageName];
    if (!pagePerms) return false;
    return pagePerms[effectiveRole]?.[action] || false;
  };

  const hasFeature = (featureName) => {
    if (!featureName) return false;
    if (isSuperAdmin && !isImpersonating) return true;
    if (effectiveRole === "admin") return true;
    if (userProfile?.permissions?.features?.[featureName]) return true;
    const featurePerms = FEATURE_PERMISSIONS[featureName];
    if (!featurePerms) return false;
    return featurePerms[effectiveRole] || false;
  };

  // isLoadingPermissions: true enquanto dados críticos de role ainda não chegaram
  const isLoadingPermissions = !user || empresaLoading || (!!empresaId && !!user?.email && vinculoLoading);

  return {
    user,
    userProfile,
    effectiveRole,
    rawRole,
    isSuperAdmin,
    isImpersonating,
    impersonation,
    isLoadingPermissions,
    canAccessPage,
    canPerformAction,
    hasFeature,
    nivel: getNivel(effectiveRole),
    isAdmin: effectiveRole === "admin",
    isGestorEmpresa: effectiveRole === "gestor_empresa",
    isGerenteEmpresa: effectiveRole === "gerente_empresa",
    isGerenteFilial: effectiveRole === "gerente_filial",
    isSupervisor: effectiveRole === "supervisor",
    isSDR: effectiveRole === "sdr",
    isCloser: effectiveRole === "closer",
    isCS: effectiveRole === "cs",
    isSocialSeller: effectiveRole === "social_seller",
    isGestor: effectiveRole === "gestor",
  };
}