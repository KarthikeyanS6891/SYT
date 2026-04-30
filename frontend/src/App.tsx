import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { PrivateRoute } from '@/components/common/PrivateRoute';
import { AuthModal } from '@/components/auth/AuthModal';
import { useAppDispatch, useAppSelector } from '@/store';
import { bootstrapAuth, clear } from '@/store/slices/authSlice';
import { closeAuthModal } from '@/store/slices/uiSlice';
import { tokenStorage } from '@/services/api';
import { useThemeBootstrap } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';

import Home from '@/pages/Home';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ListingDetails from '@/pages/ListingDetails';
import PostAd from '@/pages/PostAd';
import Profile from '@/pages/Profile';
import Chat from '@/pages/Chat';
import MyListings from '@/pages/MyListings';
import Favorites from '@/pages/Favorites';
import AdminDashboard from '@/pages/AdminDashboard';
import NotFound from '@/pages/NotFound';

export default function App() {
  const dispatch = useAppDispatch();
  useThemeBootstrap();
  const { user } = useAuth();
  const authModalOpen = useAppSelector((s) => s.ui.authModal.open);

  useEffect(() => {
    dispatch(bootstrapAuth());
    const onLogout = () => {
      tokenStorage.clear();
      dispatch(clear());
    };
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, [dispatch]);

  useEffect(() => {
    if (user && authModalOpen) dispatch(closeAuthModal());
  }, [user, authModalOpen, dispatch]);

  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/listings/:id" element={<ListingDetails />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/post" element={<PrivateRoute><PostAd /></PrivateRoute>} />
          <Route path="/post/:id" element={<PrivateRoute><PostAd /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
          <Route path="/my-listings" element={<PrivateRoute><MyListings /></PrivateRoute>} />
          <Route path="/favorites" element={<PrivateRoute><Favorites /></PrivateRoute>} />
          <Route path="/chat" element={<PrivateRoute><Chat /></PrivateRoute>} />
          <Route path="/chat/:id" element={<PrivateRoute><Chat /></PrivateRoute>} />
          <Route
            path="/admin"
            element={<PrivateRoute adminOnly><AdminDashboard /></PrivateRoute>}
          />

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <AuthModal />
    </>
  );
}
