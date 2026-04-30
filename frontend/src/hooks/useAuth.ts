import { useAppSelector } from '@/store';

export const useAuth = () => {
  const auth = useAppSelector((s) => s.auth);
  return {
    user: auth.user,
    isAuthenticated: !!auth.user,
    isAdmin: auth.user?.role === 'admin',
    status: auth.status,
    initialized: auth.initialized,
    error: auth.error,
  };
};
