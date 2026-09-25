import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

/**
 * Hook para obter a empresa atual do usuário
 * Retorna o empresaId da empresa selecionada pelo usuário
 */
export function useEmpresaAtual() {
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60_000,
  });

  // Admin global: impersonação via localStorage
  const impersonatedId = user?.role === "admin"
    ? (typeof window !== "undefined" ? localStorage.getItem("impersonated_empresa_id") : null)
    : null;
  const impersonatedNome = user?.role === "admin"
    ? (typeof window !== "undefined" ? localStorage.getItem("impersonated_empresa_nome") : null)
    : null;

  // Primeiro tenta usar empresaAtualId do user
  const empresaIdDoUser = user?.empresaAtualId;
  
  // Se não tiver empresaAtualId, tenta buscar via VinculoEmpresa
  const { data: vinculoPorEmail, isLoading: vinculoEmailLoading } = useQuery({
    queryKey: ["vinculo-por-email", user?.email],
    queryFn: async () => {
      if (!user?.email || empresaIdDoUser) return null;
      try {
        const vinculos = await api.entities.VinculoEmpresa.filter({
          userEmail: user.email,
          status: "ativo"
        });
        return vinculos?.[0] || null;
      } catch {
        return null;
      }
    },
    enabled: !!user?.email && !empresaIdDoUser && !impersonatedId,
    staleTime: 5 * 60_000,
  });

  // Impersonação tem prioridade máxima para admins globais
  const empresaId = impersonatedId || empresaIdDoUser || vinculoPorEmail?.empresaId || null;
  // isLoading: true enquanto user não carregou OU enquanto a query de vínculo por email ainda está em flight
  const isLoading = !user || (!empresaIdDoUser && !impersonatedId && vinculoEmailLoading);
  const isImpersonating = !!impersonatedId;

  return {
    empresaId,
    isLoading,
    hasEmpresa: !!empresaId,
    isImpersonating,
    impersonatedNome,
  };
}