import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppDispatch } from '@/store';
import { openAuthModal } from '@/store/slices/uiSlice';

export default function Register() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(openAuthModal('register'));
  }, [dispatch]);
  return <Navigate to="/" replace />;
}
