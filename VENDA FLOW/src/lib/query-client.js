import { QueryClient } from '@tanstack/react-query';

// Constantes de staleTime por domínio — importar onde necessário
export const STALE_TIMES = {
  REALTIME: 0,           // telefonia, dados que mudam a cada segundo
  FAST: 30_000,          // 30s — status de agentes, softphone
  STANDARD: 60_000,      // 1min — listas de leads, tarefas (já é o default global)
  SLOW: 5 * 60_000,      // 5min — config de empresa, permissões, perfil
  STATIC: 30 * 60_000,   // 30min — dados que raramente mudam (inteligência comercial)
};

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			staleTime: 60_000,
		},
	},
});