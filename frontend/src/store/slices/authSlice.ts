import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authApi } from '@/services/authService';
import { tokenStorage } from '@/services/api';
import { errorMessage } from '@/services/api';
import type { User } from '@/types';

export interface AuthState {
  user: User | null;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated' | 'error';
  error: string | null;
  initialized: boolean;
}

const initialState: AuthState = {
  user: null,
  status: 'idle',
  error: null,
  initialized: false,
};

export const bootstrapAuth = createAsyncThunk('auth/bootstrap', async (_, { rejectWithValue }) => {
  if (!tokenStorage.getAccess()) return null;
  try {
    const { data } = await authApi.me();
    return data.user as User;
  } catch (err) {
    // Only clear tokens on an actual auth failure (401 — the axios interceptor
    // already does this itself once its own refresh attempt fails). A transient
    // network error or a 5xx from /auth/me does not mean the session is invalid;
    // wiping tokens here would log the user out over a blip they could recover from.
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 401) tokenStorage.clear();
    return rejectWithValue(errorMessage(err));
  }
});

export const loginThunk = createAsyncThunk(
  'auth/login',
  async (payload: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const { data } = await authApi.login(payload);
      tokenStorage.set(data.accessToken, data.refreshToken);
      return data.user;
    } catch (err) {
      return rejectWithValue(errorMessage(err, 'Login failed'));
    }
  }
);

export const registerThunk = createAsyncThunk(
  'auth/register',
  async (
    payload: { name: string; email: string; password: string; phone?: string; location?: string },
    { rejectWithValue }
  ) => {
    try {
      const { data } = await authApi.register(payload);
      tokenStorage.set(data.accessToken, data.refreshToken);
      return data.user;
    } catch (err) {
      return rejectWithValue(errorMessage(err, 'Registration failed'));
    }
  }
);

export const googleLoginThunk = createAsyncThunk(
  'auth/googleLogin',
  async (credential: string, { rejectWithValue }) => {
    try {
      const { data } = await authApi.googleLogin(credential);
      tokenStorage.set(data.accessToken, data.refreshToken);
      return data.user;
    } catch (err) {
      return rejectWithValue(errorMessage(err, 'Google login failed'));
    }
  }
);

export const logoutThunk = createAsyncThunk('auth/logout', async () => {
  const refresh = tokenStorage.getRefresh();
  try {
    if (refresh) await authApi.logout(refresh);
  } catch {
    /* ignore */
  } finally {
    tokenStorage.clear();
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<User | null>) {
      state.user = action.payload;
      state.status = action.payload ? 'authenticated' : 'unauthenticated';
    },
    clear(state) {
      state.user = null;
      state.status = 'unauthenticated';
      state.error = null;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(bootstrapAuth.pending, (s) => {
        s.status = 'loading';
      })
      .addCase(bootstrapAuth.fulfilled, (s, a) => {
        s.user = a.payload;
        s.status = a.payload ? 'authenticated' : 'unauthenticated';
        s.initialized = true;
      })
      .addCase(bootstrapAuth.rejected, (s) => {
        s.user = null;
        s.status = 'unauthenticated';
        s.initialized = true;
      })
      .addCase(loginThunk.pending, (s) => {
        s.status = 'loading';
        s.error = null;
      })
      .addCase(loginThunk.fulfilled, (s, a) => {
        s.user = a.payload;
        s.status = 'authenticated';
      })
      .addCase(loginThunk.rejected, (s, a) => {
        s.status = 'error';
        s.error = a.payload as string;
      })
      .addCase(registerThunk.pending, (s) => {
        s.status = 'loading';
        s.error = null;
      })
      .addCase(registerThunk.fulfilled, (s, a) => {
        s.user = a.payload;
        s.status = 'authenticated';
      })
      .addCase(registerThunk.rejected, (s, a) => {
        s.status = 'error';
        s.error = a.payload as string;
      })
      .addCase(googleLoginThunk.pending, (s) => {
        s.status = 'loading';
        s.error = null;
      })
      .addCase(googleLoginThunk.fulfilled, (s, a) => {
        s.user = a.payload;
        s.status = 'authenticated';
      })
      .addCase(googleLoginThunk.rejected, (s, a) => {
        s.status = 'error';
        s.error = a.payload as string;
      })
      .addCase(logoutThunk.fulfilled, (s) => {
        s.user = null;
        s.status = 'unauthenticated';
      });
  },
});

export const { setUser, clear, clearError } = authSlice.actions;
export default authSlice.reducer;
