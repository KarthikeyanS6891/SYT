import { useEffect, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { PrivateRoute } from '@/components/common/PrivateRoute';
import { AuthModal } from '@/components/auth/AuthModal';
import { useAppDispatch, useAppSelector } from '@/store';
import { bootstrapAuth, clear } from '@/store/slices/authSlice';
import { closeAuthModal, setUnread } from '@/store/slices/uiSlice';
import { tokenStorage } from '@/services/api';
import { disconnectSocket, getSocket, reconnectSocketWithToken } from '@/services/socket';
import { messageApi } from '@/services/messageService';
import { useThemeBootstrap } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';

import Home from '@/pages/Home';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ListingDetails from '@/pages/ListingDetails';
import PostAd from '@/pages/PostAd';
import Profile from '@/pages/Profile';
import PublicProfile from '@/pages/PublicProfile';
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

  // Keep the chat socket's identity in sync with the authenticated user. Without
  // this, a socket connected as one user stays connected (with that user's stale
  // auth handshake) across logout/login on the same tab, since getSocket() reuses
  // any still-connected instance regardless of which account is now active.
  const prevUserId = useRef<string | null>(null);
  useEffect(() => {
    const currentId = user?._id ?? null;
    if (currentId !== prevUserId.current) {
      if (currentId) {
        reconnectSocketWithToken();
      } else if (prevUserId.current) {
        disconnectSocket();
      }
      prevUserId.current = currentId;
    }
  }, [user?._id]);

  // Keep the navbar's unread badge live app-wide, not just while the user is on
  // /chat: fetch the current total on login, then keep it fresh as new messages
  // arrive over the socket (previously bumpUnread/resetUnread were unused dead
  // code and the badge only ever reflected a stale, last-visited-/chat value).
  useEffect(() => {
    if (!user) {
      dispatch(setUnread(0));
      return;
    }
    let active = true;
    const refreshUnread = async () => {
      try {
        const { data } = await messageApi.conversations();
        if (!active) return;
        const total = data.items.reduce(
          (acc, c) => acc + Number((c.unread as any)?.[user._id] || 0),
          0
        );
        dispatch(setUnread(total));
      } catch {
        /* ignore — badge just stays at its last known value */
      }
    };
    refreshUnread();

    const socket = getSocket();
    socket.on('chat:notify', refreshUnread);
    socket.on('chat:message', refreshUnread);
    return () => {
      active = false;
      socket.off('chat:notify', refreshUnread);
      socket.off('chat:message', refreshUnread);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, dispatch]);

  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/listings/:id" element={<ListingDetails />} />
          <Route path="/users/:id" element={<PublicProfile />} />
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
