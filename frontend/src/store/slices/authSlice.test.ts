import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeStore, makeUser } from '@/test/utils';
import { tokenStorage, TOKEN_KEY, REFRESH_KEY } from '@/services/api';

// Mock the auth service so no real network happens. Service methods are already
// "unwrapped" — they resolve to { data, meta, message }.
vi.mock('@/services/authService', () => ({
  authApi: {
    register: vi.fn(),
    login: vi.fn(),
    me: vi.fn(),
    logout: vi.fn(),
    googleLogin: vi.fn(),
  },
}));

import { authApi } from '@/services/authService';
import authReducer, {
  setUser,
  clear,
  loginThunk,
  registerThunk,
  googleLoginThunk,
  bootstrapAuth,
  logoutThunk,
} from './authSlice';

// Build an unwrapped AuthResponse-shaped result for the login/register/google thunks.
const authResult = (user = makeUser()) => ({
  data: { user, accessToken: 'access-tok', refreshToken: 'refresh-tok' },
  meta: null,
  message: 'OK',
});

const meResult = (user = makeUser()) => ({
  data: { user },
  meta: null,
  message: 'OK',
});

// A fake axios error whose shape errorMessage() understands.
const apiError = (message: string, status = 401) => ({
  isAxiosError: true,
  message: 'Request failed',
  response: { status, data: { message } },
});

const freshStore = () => makeStore();

beforeEach(() => {
  // setup.ts clears localStorage + resets mocks after each test, but make
  // intent explicit at the start of each test too.
  localStorage.clear();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Reducer logic (pure, no store needed)
// ---------------------------------------------------------------------------
describe('authSlice reducers', () => {
  const initial = authReducer(undefined, { type: '@@INIT' });

  it('has the expected initial state', () => {
    expect(initial).toEqual({
      user: null,
      status: 'idle',
      error: null,
      initialized: false,
    });
  });

  it('setUser(user) sets the user and status "authenticated"', () => {
    const user = makeUser({ name: 'Alice' });
    const next = authReducer(initial, setUser(user));
    expect(next.user).toEqual(user);
    expect(next.status).toBe('authenticated');
  });

  it('setUser(null) sets status "unauthenticated" and clears user', () => {
    const authed = authReducer(initial, setUser(makeUser()));
    const next = authReducer(authed, setUser(null));
    expect(next.user).toBeNull();
    expect(next.status).toBe('unauthenticated');
  });

  it('clear() resets user, status (unauthenticated) and error', () => {
    const dirty = {
      user: makeUser(),
      status: 'error' as const,
      error: 'boom',
      initialized: true,
    };
    const next = authReducer(dirty, clear());
    expect(next.user).toBeNull();
    expect(next.status).toBe('unauthenticated');
    expect(next.error).toBeNull();
    // clear() does not touch initialized
    expect(next.initialized).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// loginThunk
// ---------------------------------------------------------------------------
describe('loginThunk', () => {
  it('on success stores tokens and sets user + status "authenticated"', async () => {
    const user = makeUser({ name: 'Logged In' });
    (authApi.login as any).mockResolvedValue(authResult(user));
    const setSpy = vi.spyOn(tokenStorage, 'set');
    const store = freshStore();

    const result = await store.dispatch(
      loginThunk({ email: 'a@b.com', password: 'pw' })
    );

    expect(loginThunk.fulfilled.match(result)).toBe(true);
    expect(authApi.login).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw' });
    expect(setSpy).toHaveBeenCalledWith('access-tok', 'refresh-tok');
    // tokens actually persisted via the real tokenStorage
    expect(localStorage.getItem(TOKEN_KEY)).toBe('access-tok');
    expect(localStorage.getItem(REFRESH_KEY)).toBe('refresh-tok');

    const state = store.getState().auth;
    expect(state.user).toEqual(user);
    expect(state.status).toBe('authenticated');
    expect(state.error).toBeNull();
  });

  it('on failure sets status "error" and the error message, no tokens stored', async () => {
    (authApi.login as any).mockRejectedValue(apiError('Bad credentials'));
    const setSpy = vi.spyOn(tokenStorage, 'set');
    const store = freshStore();

    const result = await store.dispatch(
      loginThunk({ email: 'a@b.com', password: 'wrong' })
    );

    expect(loginThunk.rejected.match(result)).toBe(true);
    expect(setSpy).not.toHaveBeenCalled();
    const state = store.getState().auth;
    expect(state.status).toBe('error');
    expect(state.error).toBe('Bad credentials');
    expect(state.user).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('falls back to "Login failed" when the error carries no message', async () => {
    (authApi.login as any).mockRejectedValue({});
    const store = freshStore();
    await store.dispatch(loginThunk({ email: 'a@b.com', password: 'x' }));
    expect(store.getState().auth.error).toBe('Login failed');
  });

  it('sets status "loading" while pending', () => {
    const store = freshStore();
    // dispatch the pending action directly to assert the pending reducer
    store.dispatch({ type: loginThunk.pending.type });
    expect(store.getState().auth.status).toBe('loading');
    expect(store.getState().auth.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// registerThunk
// ---------------------------------------------------------------------------
describe('registerThunk', () => {
  it('on success sets user/authenticated and stores tokens', async () => {
    const user = makeUser({ name: 'New User' });
    (authApi.register as any).mockResolvedValue(authResult(user));
    const setSpy = vi.spyOn(tokenStorage, 'set');
    const store = freshStore();

    const payload = { name: 'New User', email: 'n@b.com', password: 'pw' };
    const result = await store.dispatch(registerThunk(payload));

    expect(registerThunk.fulfilled.match(result)).toBe(true);
    expect(authApi.register).toHaveBeenCalledWith(payload);
    expect(setSpy).toHaveBeenCalledWith('access-tok', 'refresh-tok');
    const state = store.getState().auth;
    expect(state.user).toEqual(user);
    expect(state.status).toBe('authenticated');
  });

  it('on failure sets status "error" and message', async () => {
    (authApi.register as any).mockRejectedValue(apiError('Email taken'));
    const store = freshStore();
    await store.dispatch(
      registerThunk({ name: 'X', email: 'x@b.com', password: 'pw' })
    );
    const state = store.getState().auth;
    expect(state.status).toBe('error');
    expect(state.error).toBe('Email taken');
  });

  it('falls back to "Registration failed" without a message', async () => {
    (authApi.register as any).mockRejectedValue({});
    const store = freshStore();
    await store.dispatch(
      registerThunk({ name: 'X', email: 'x@b.com', password: 'pw' })
    );
    expect(store.getState().auth.error).toBe('Registration failed');
  });
});

// ---------------------------------------------------------------------------
// googleLoginThunk
// ---------------------------------------------------------------------------
describe('googleLoginThunk', () => {
  it('on success sets user/authenticated and stores tokens', async () => {
    const user = makeUser({ name: 'Google User' });
    (authApi.googleLogin as any).mockResolvedValue(authResult(user));
    const setSpy = vi.spyOn(tokenStorage, 'set');
    const store = freshStore();

    const result = await store.dispatch(googleLoginThunk('google-credential'));

    expect(googleLoginThunk.fulfilled.match(result)).toBe(true);
    expect(authApi.googleLogin).toHaveBeenCalledWith('google-credential');
    expect(setSpy).toHaveBeenCalledWith('access-tok', 'refresh-tok');
    const state = store.getState().auth;
    expect(state.user).toEqual(user);
    expect(state.status).toBe('authenticated');
  });

  it('on failure sets status "error" and message', async () => {
    (authApi.googleLogin as any).mockRejectedValue(apiError('Google rejected'));
    const store = freshStore();
    await store.dispatch(googleLoginThunk('bad-credential'));
    const state = store.getState().auth;
    expect(state.status).toBe('error');
    expect(state.error).toBe('Google rejected');
  });

  it('falls back to "Google login failed" without a message', async () => {
    (authApi.googleLogin as any).mockRejectedValue({});
    const store = freshStore();
    await store.dispatch(googleLoginThunk('bad'));
    expect(store.getState().auth.error).toBe('Google login failed');
  });
});

// ---------------------------------------------------------------------------
// bootstrapAuth
// ---------------------------------------------------------------------------
describe('bootstrapAuth', () => {
  it('with no access token resolves to null and leaves unauthenticated + initialized', async () => {
    const store = freshStore();
    const result = await store.dispatch(bootstrapAuth());

    expect(bootstrapAuth.fulfilled.match(result)).toBe(true);
    expect(result.payload).toBeNull();
    // never calls /auth/me when there's no token
    expect(authApi.me).not.toHaveBeenCalled();
    const state = store.getState().auth;
    expect(state.user).toBeNull();
    expect(state.status).toBe('unauthenticated');
    expect(state.initialized).toBe(true);
  });

  it('with a token, me() success sets user + authenticated + initialized', async () => {
    tokenStorage.set('access-tok', 'refresh-tok');
    const user = makeUser({ name: 'Bootstrapped' });
    (authApi.me as any).mockResolvedValue(meResult(user));
    const store = freshStore();

    const result = await store.dispatch(bootstrapAuth());

    expect(bootstrapAuth.fulfilled.match(result)).toBe(true);
    expect(authApi.me).toHaveBeenCalledTimes(1);
    const state = store.getState().auth;
    expect(state.user).toEqual(user);
    expect(state.status).toBe('authenticated');
    expect(state.initialized).toBe(true);
  });

  it('with a token, me() 401 failure clears tokens and leaves unauthenticated + initialized', async () => {
    tokenStorage.set('access-tok', 'refresh-tok');
    (authApi.me as any).mockRejectedValue(apiError('Unauthorized', 401));
    const clearSpy = vi.spyOn(tokenStorage, 'clear');
    const store = freshStore();

    const result = await store.dispatch(bootstrapAuth());

    expect(bootstrapAuth.rejected.match(result)).toBe(true);
    expect(clearSpy).toHaveBeenCalled();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
    const state = store.getState().auth;
    expect(state.user).toBeNull();
    expect(state.status).toBe('unauthenticated');
    expect(state.initialized).toBe(true);
  });

  it('with a token, me() network/5xx failure does NOT clear tokens (regression: a transient blip used to silently log the user out)', async () => {
    tokenStorage.set('access-tok', 'refresh-tok');
    (authApi.me as any).mockRejectedValue(apiError('Server error', 500));
    const clearSpy = vi.spyOn(tokenStorage, 'clear');
    const store = freshStore();

    const result = await store.dispatch(bootstrapAuth());

    expect(bootstrapAuth.rejected.match(result)).toBe(true);
    expect(clearSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem(TOKEN_KEY)).toBe('access-tok');
    expect(localStorage.getItem(REFRESH_KEY)).toBe('refresh-tok');
    const state = store.getState().auth;
    expect(state.status).toBe('unauthenticated');
  });

  it('with a token, a network error with no response at all does NOT clear tokens', async () => {
    tokenStorage.set('access-tok', 'refresh-tok');
    (authApi.me as any).mockRejectedValue({ isAxiosError: true, message: 'Network Error' });
    const clearSpy = vi.spyOn(tokenStorage, 'clear');
    const store = freshStore();

    await store.dispatch(bootstrapAuth());

    expect(clearSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem(TOKEN_KEY)).toBe('access-tok');
  });

  it('sets status "loading" while pending', () => {
    const store = freshStore();
    store.dispatch({ type: bootstrapAuth.pending.type });
    expect(store.getState().auth.status).toBe('loading');
  });
});

// ---------------------------------------------------------------------------
// logoutThunk
// ---------------------------------------------------------------------------
describe('logoutThunk', () => {
  it('clears user -> unauthenticated and clears tokens (calls api.logout with refresh)', async () => {
    tokenStorage.set('access-tok', 'refresh-tok');
    (authApi.logout as any).mockResolvedValue({ data: null, meta: null, message: 'OK' });
    const clearSpy = vi.spyOn(tokenStorage, 'clear');
    // start from an authenticated store
    const store = makeStore({
      auth: {
        user: makeUser(),
        status: 'authenticated',
        error: null,
        initialized: true,
      },
    });

    const result = await store.dispatch(logoutThunk());

    expect(logoutThunk.fulfilled.match(result)).toBe(true);
    expect(authApi.logout).toHaveBeenCalledWith('refresh-tok');
    expect(clearSpy).toHaveBeenCalled();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
    const state = store.getState().auth;
    expect(state.user).toBeNull();
    expect(state.status).toBe('unauthenticated');
  });

  it('still clears tokens & state when there is no refresh token (skips api.logout)', async () => {
    // no tokens set
    const clearSpy = vi.spyOn(tokenStorage, 'clear');
    const store = makeStore({
      auth: {
        user: makeUser(),
        status: 'authenticated',
        error: null,
        initialized: true,
      },
    });

    const result = await store.dispatch(logoutThunk());

    expect(logoutThunk.fulfilled.match(result)).toBe(true);
    expect(authApi.logout).not.toHaveBeenCalled();
    expect(clearSpy).toHaveBeenCalled();
    expect(store.getState().auth.user).toBeNull();
    expect(store.getState().auth.status).toBe('unauthenticated');
  });

  it('ignores a failing api.logout but still clears tokens & state', async () => {
    tokenStorage.set('access-tok', 'refresh-tok');
    (authApi.logout as any).mockRejectedValue(apiError('server down'));
    const store = makeStore({
      auth: {
        user: makeUser(),
        status: 'authenticated',
        error: null,
        initialized: true,
      },
    });

    const result = await store.dispatch(logoutThunk());

    // the thunk swallows the error and resolves
    expect(logoutThunk.fulfilled.match(result)).toBe(true);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    const state = store.getState().auth;
    expect(state.user).toBeNull();
    expect(state.status).toBe('unauthenticated');
  });
});
