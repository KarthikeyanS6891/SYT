import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppDispatch } from '@/store';
import { openAuthModal } from '@/store/slices/uiSlice';

export default function Login() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(openAuthModal('login'));
  }, [dispatch]);
  return <Navigate to="/" replace />;
}
