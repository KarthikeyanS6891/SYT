import { FC, ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader } from './Loader';

interface Props {
  children: ReactNode;
  adminOnly?: boolean;
}

export const PrivateRoute: FC<Props> = ({ children, adminOnly }) => {
  const { user, initialized, isAdmin } = useAuth();
  const location = useLocation();

  if (!initialized) return <Loader />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
};
