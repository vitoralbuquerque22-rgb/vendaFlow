/**
 * Feature Flags — Sprint 7.5
 *
 * SaaS multi-tenant: cada flag pode ser sobrescrita por tenant.
 * Flags globais definidas aqui; overrides por tenant via UserProfile.permissions.features
 * ou via empresa.configuracao (quando disponível).
 *
 * Uso:
 *   import { useFeatureFlag, FLAGS } from "@/lib/featureFlags";
 *   const enabled = useFeatureFlag(FLAGS.COCKPIT_ANALYTICS);
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// ── Flags disponíveis ─────────────────────────────────────────
export const FLAGS = {
  COCKPIT_ANALYTICS:    "cockpit_analytics",
  COCKPIT_SCORE:        "cockpit_score",
  COCKPIT_IA:           "cockpit_ia",
  COCKPIT_DASHBOARD:    "cockpit_dashboard",
  COCKPIT_KPIS:         "cockpit_kpis",
  LEAD_HEALTH_SCORE:    "lead_health_score",
  INTELIGENCIA_COMERCIAL: "inteligencia_comercial",
};

// ── Defaults globais (tudo ligado por ora) ───────────────────
const DEFAULTS = {
  [FLAGS.COCKPIT_ANALYTICS]:        true,
  [FLAGS.COCKPIT_SCORE]:            true,
  [FLAGS.COCKPIT_IA]:               true,
  [FLAGS.COCKPIT_DASHBOARD]:        true,
  [FLAGS.COCKPIT_KPIS]:             true,
  [FLAGS.LEAD_HEALTH_SCORE]:        true,
  [FLAGS.INTELIGENCIA_COMERCIAL]:   true,
};

/**
 * useFeatureFlag(flag, empresaId?)
 * Ajuste 8: resolve por camadas — tenant_features da empresa > perfil do usuário > defaults globais.
 *
 * Hierarquia:
 *   1. empresa.tenant_features[flag]    (configuração SaaS por tenant)
 *   2. user.permissions.features[flag]  (override individual)
 *   3. DEFAULTS[flag]                   (fallback global)
 */
export function useFeatureFlag(flag, empresaId) {
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
    staleTime: 60000,
  });

  const { data: empresa } = useQuery({
    queryKey: ["empresa-flags", empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      const rows = await base44.entities.Empresa.filter({ id: empresaId });
      return rows?.[0] || null;
    },
    enabled: !!empresaId,
    staleTime: 120000,
  });

  return useMemo(() => {
    // Camada 1 — tenant_features da empresa
    const tenantFeatures = empresa?.tenant_features || {};
    if (flag in tenantFeatures) return !!tenantFeatures[flag];
    // Camada 2 — perfil do usuário
    const userFeatures = user?.permissions?.features || {};
    if (flag in userFeatures) return !!userFeatures[flag];
    // Camada 3 — default global
    return DEFAULTS[flag] ?? false;
  }, [empresa, user, flag]);
}

/**
 * useFeatureFlags(flags[], empresaId?)
 * Retorna objeto { [flag]: boolean } para múltiplas flags de uma vez.
 */
export function useFeatureFlags(flags, empresaId) {
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
    staleTime: 60000,
  });

  const { data: empresa } = useQuery({
    queryKey: ["empresa-flags", empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      const rows = await base44.entities.Empresa.filter({ id: empresaId });
      return rows?.[0] || null;
    },
    enabled: !!empresaId,
    staleTime: 120000,
  });

  return useMemo(() => {
    const tenantFeatures = empresa?.tenant_features || {};
    const userFeatures   = user?.permissions?.features || {};
    return flags.reduce((acc, flag) => {
      if (flag in tenantFeatures) acc[flag] = !!tenantFeatures[flag];
      else if (flag in userFeatures) acc[flag] = !!userFeatures[flag];
      else acc[flag] = DEFAULTS[flag] ?? false;
      return acc;
    }, {});
  }, [empresa, user, flags]);
}