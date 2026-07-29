import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, authedState, makeUser } from '@/test/utils';
import { act, waitFor } from '@testing-library/react';

// Keep this test focused on the login/logout <-> socket-sync effect in App.tsx.
// Every page/layout component is heavy (data fetching, maps, etc.) and irrelevant
// here, so they're stubbed out to plain markers.
vi.mock('@/components/layout/Layout', () => ({
  Layout: () => <div data-testid="layout" />,
}));
vi.mock('@/components/auth/AuthModal', () => ({ AuthModal: () => null }));
vi.mock('@/components/common/PrivateRoute', () => ({
  PrivateRoute: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/pages/Home', () => ({ default: () => null }));
vi.mock('@/pages/Login', () => ({ default: () => null }));
vi.mock('@/pages/Register', () => ({ default: () => null }));
vi.mock('@/pages/ListingDetails', () => ({ default: () => null }));
vi.mock('@/pages/PostAd', () => ({ default: () => null }));
vi.mock('@/pages/Profile', () => ({ default: () => null }));
vi.mock('@/pages/PublicProfile', () => ({ default: () => null }));
vi.mock('@/pages/Chat', () => ({ default: () => null }));
vi.mock('@/pages/MyListings', () => ({ default: () => null }));
vi.mock('@/pages/Favorites', () => ({ default: () => null }));
vi.mock('@/pages/AdminDashboard', () => ({ default: () => null }));
vi.mock('@/pages/NotFound', () => ({ default: () => null }));

const fakeSocket = { on: vi.fn(), off: vi.fn(), emit: vi.fn() };
const reconnectSocketWithToken = vi.fn(() => fakeSocket);
const disconnectSocket = vi.fn();
vi.mock('@/services/socket', () => ({
  getSocket: vi.fn(() => fakeSocket),
  disconnectSocket: (...args: unknown[]) => disconnectSocket(...args),
  reconnectSocketWithToken: (...args: unknown[]) => reconnectSocketWithToken(...args),
}));

// App also dispatches bootstrapAuth() on mount, which (when a token is present)
// calls authApi.me() to re-validate the session. Stub it to resolve with the
// SAME user id as whatever's preloaded, so its async fulfillment never itself
// causes a spurious user-id transition (and thus a spurious socket call) that
// would race with the explicit store.dispatch() calls under test below.
vi.mock('@/services/authService', () => ({ authApi: { me: vi.fn() } }));

const conversations = vi.fn();
vi.mock('@/services/messageService', () => ({ messageApi: { conversations: (...a: unknown[]) => conversations(...a) } }));

import App from './App';
import { setUser, clear } from '@/store/slices/authSlice';
import { authApi } from '@/services/authService';
import { tokenStorage } from '@/services/api';

/** Preload an authenticated session AND make bootstrapAuth's re-validation a no-op. */
const mountAuthenticated = (userId: string) => {
  tokenStorage.set('fake-access', 'fake-refresh');
  (authApi.me as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: { user: makeUser({ _id: userId }) },
    meta: {},
    message: 'OK',
  });
  return renderWithProviders(<App />, { preloadedState: authedState({ _id: userId }) });
};

beforeEach(() => {
  reconnectSocketWithToken.mockClear();
  disconnectSocket.mockClear();
  fakeSocket.on.mockClear();
  fakeSocket.off.mockClear();
  conversations.mockReset().mockResolvedValue({ data: { items: [] }, meta: {}, message: 'OK' });
});

describe('App — chat socket identity sync', () => {
  it('reconnects the socket with a fresh token once a user is authenticated on mount', () => {
    mountAuthenticated('u1');
    expect(reconnectSocketWithToken).toHaveBeenCalledTimes(1);
    expect(disconnectSocket).not.toHaveBeenCalled();
  });

  it('does not touch the socket on mount when logged out', () => {
    renderWithProviders(<App />);
    expect(reconnectSocketWithToken).not.toHaveBeenCalled();
    expect(disconnectSocket).not.toHaveBeenCalled();
  });

  it('disconnects the socket when the user logs out (regression: stale identity persisted after logout)', () => {
    const { store } = mountAuthenticated('u1');
    reconnectSocketWithToken.mockClear();

    act(() => {
      store.dispatch(clear());
    });

    expect(disconnectSocket).toHaveBeenCalledTimes(1);
    expect(reconnectSocketWithToken).not.toHaveBeenCalled();
  });

  it('reconnects with a fresh token when a different user logs in on the same tab', () => {
    const { store } = mountAuthenticated('u1');
    reconnectSocketWithToken.mockClear();

    act(() => {
      store.dispatch(setUser(makeUser({ _id: 'u2' })));
    });

    expect(reconnectSocketWithToken).toHaveBeenCalledTimes(1);
    expect(disconnectSocket).not.toHaveBeenCalled();
  });

  it('does not reconnect on unrelated re-renders when the user id is unchanged', () => {
    const { store } = mountAuthenticated('u1');
    reconnectSocketWithToken.mockClear();

    act(() => {
      // setUser with the same _id but a changed field (e.g. name) — identity unchanged.
      store.dispatch(setUser(makeUser({ _id: 'u1', name: 'New Name' })));
    });

    expect(reconnectSocketWithToken).not.toHaveBeenCalled();
    expect(disconnectSocket).not.toHaveBeenCalled();
  });
});

describe('App — app-wide unread badge sync', () => {
  it('fetches conversations and sets the unread total on login, app-wide (not just on /chat)', async () => {
    conversations.mockResolvedValue({
      data: { items: [{ _id: 'c1', unread: { u1: 2 } }, { _id: 'c2', unread: { u1: 3, other: 9 } }] },
      meta: {},
      message: 'OK',
    });
    const { store } = mountAuthenticated('u1');

    await waitFor(() => expect(store.getState().ui.unreadCount).toBe(5));
  });

  it('subscribes to chat:notify / chat:message and refreshes the unread total when they fire', async () => {
    conversations.mockResolvedValue({
      data: { items: [{ _id: 'c1', unread: { u1: 1 } }] },
      meta: {},
      message: 'OK',
    });
    const { store } = mountAuthenticated('u1');
    await waitFor(() => expect(store.getState().ui.unreadCount).toBe(1));

    conversations.mockResolvedValue({
      data: { items: [{ _id: 'c1', unread: { u1: 4 } }] },
      meta: {},
      message: 'OK',
    });
    const notifyHandler = fakeSocket.on.mock.calls.find((c) => c[0] === 'chat:notify')?.[1];
    expect(notifyHandler).toBeTruthy();
    await act(async () => {
      notifyHandler();
    });

    await waitFor(() => expect(store.getState().ui.unreadCount).toBe(4));
  });

  it('resets the unread badge to 0 on logout', async () => {
    conversations.mockResolvedValue({
      data: { items: [{ _id: 'c1', unread: { u1: 7 } }] },
      meta: {},
      message: 'OK',
    });
    const { store } = mountAuthenticated('u1');
    await waitFor(() => expect(store.getState().ui.unreadCount).toBe(7));

    act(() => {
      store.dispatch(clear());
    });

    expect(store.getState().ui.unreadCount).toBe(0);
  });
});
