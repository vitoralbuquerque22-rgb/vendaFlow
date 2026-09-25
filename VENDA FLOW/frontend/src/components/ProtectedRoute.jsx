import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

// Rotas que exigem role 'admin' (admin global da plataforma) — SDRs/gestores de tenant não podem acessar
const SUPER_ADMIN_ROUTES = ['/DashboardAdmin', '/GerenciamentoEmpresas', '/DebugEmpresas'];

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement }) {
  const { isAuthenticated, isLoadingAuth, authError } = useAuth();

  const { data: user, isLoading: loadingUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.auth.me(),
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });

  if (isLoadingAuth || (isAuthenticated && loadingUser)) {
    return fallback;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    return unauthenticatedElement;
  }

  if (!isAuthenticated) {
    return unauthenticatedElement;
  }

  // Verificação de role para rotas super-admin — segunda camada além do canAccessPage() do layout
  const currentPath = '/' + window.location.pathname.split('/').filter(Boolean)[0];
  if (SUPER_ADMIN_ROUTES.includes(currentPath) && user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}