import api, { unwrap } from './api';
import type { AuthResponse, User } from '@/types';

export const authApi = {
  register: (payload: {
    name: string; email: string; password: string; phone?: string; location?: string;
  }) => unwrap(api.post<{ data: AuthResponse; meta: any; message: string }>('/auth/register', payload)),

  login: (payload: { email: string; password: string }) =>
    unwrap(api.post<{ data: AuthResponse; meta: any; message: string }>('/auth/login', payload)),

  me: () => unwrap(api.get<{ data: { user: User }; meta: any; message: string }>('/auth/me')),

  logout: (refreshToken: string) =>
    unwrap(api.post<{ data: any; meta: any; message: string }>('/auth/logout', { refreshToken })),

  googleLogin: (credential: string) =>
    unwrap(api.post<{ data: AuthResponse; meta: any; message: string }>('/auth/google', { credential })),
};
