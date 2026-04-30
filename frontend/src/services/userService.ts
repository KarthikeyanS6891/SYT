import api, { unwrap } from './api';
import type { PublicUser } from '@/types';

export const userApi = {
  getPublicProfile: (id: string) =>
    unwrap(
      api.get<{ data: { user: PublicUser }; meta: any; message: string }>(`/users/${id}`)
    ),
};
