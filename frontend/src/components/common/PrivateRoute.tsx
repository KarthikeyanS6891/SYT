import { FC, ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
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
  const location = useLocation();

  useEffect(() => {
    if (initialized && !user) dispatch(openAuthModal('login'));
  }, [initialized, user, dispatch]);

  if (!initialized) return <Loader />;
  // Carry the originally-requested location so AuthModal can send the user back
  // here after a successful login, instead of always landing on the homepage.
  if (!user) return <Navigate to="/" replace state={{ from: location }} />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
};
