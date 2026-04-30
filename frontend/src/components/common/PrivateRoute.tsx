import { FC, ReactNode, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAppDispatch } from '@/store';
import { openAuthModal } from '@/store/slices/uiSlice';
import { Loader } from './Loader';

interface Props {
  children: ReactNode;
  adminOnly?: boolean;
}

export const PrivateRoute: FC<Props> = ({ children, adminOnly }) => {
  const { user, initialized, isAdmin } = useAuth();
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (initialized && !user) dispatch(openAuthModal('login'));
  }, [initialized, user, dispatch]);

  if (!initialized) return <Loader />;
  if (!user) return <Navigate to="/" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
};
