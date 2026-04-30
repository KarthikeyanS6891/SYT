import axios, { AxiosError, AxiosRequestConfig } from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';

export const TOKEN_KEY = 'syt:accessToken';
export const REFRESH_KEY = 'syt:refreshToken';

export const tokenStorage = {
  getAccess: () => localStorage.getItem(TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (access: string, refresh: string) => {
    localStorage.setItem(TOKEN_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  setAccess: (access: string) => localStorage.setItem(TOKEN_KEY, access),
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = tokenStorage.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

const refreshAccess = async (): Promise<string | null> => {
  const refreshToken = tokenStorage.getRefresh();
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });
    const access = data?.data?.accessToken;
    const refresh = data?.data?.refreshToken;
    if (access && refresh) {
      tokenStorage.set(access, refresh);
      return access;
    }
  } catch {
    tokenStorage.clear();
  }
  return null;
};

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;

    if (status === 401 && original && !original._retry && !original.url?.includes('/auth/')) {
      original._retry = true;
      refreshing = refreshing || refreshAccess();
      const newToken = await refreshing;
      refreshing = null;
      if (newToken) {
        original.headers = { ...(original.headers || {}), Authorization: `Bearer ${newToken}` };
        return api.request(original);
      }
      tokenStorage.clear();
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }

    return Promise.reject(error);
  }
);

export const unwrap = <T>(p: Promise<{ data: { data: T; meta?: any; message: string } }>) =>
  p.then((r) => ({ data: r.data.data, meta: r.data.meta, message: r.data.message }));

export const errorMessage = (err: unknown, fallback = 'Something went wrong') => {
  const e = err as AxiosError<{ message?: string; details?: any[] }>;
  const msg = e?.response?.data?.message || e?.message || fallback;
  return msg;
};

export default api;
