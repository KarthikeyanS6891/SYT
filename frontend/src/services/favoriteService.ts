import api, { unwrap } from './api';
import type { Listing } from '@/types';

export const favoriteApi = {
  list: (params: { page?: number; limit?: number } = {}) =>
    unwrap(
      api.get<{ data: { items: Listing[] }; meta: any; message: string }>('/favorites', { params })
    ),
  add: (listingId: string) =>
    unwrap(api.post<{ data: any; meta: any; message: string }>(`/favorites/${listingId}`)),
  remove: (listingId: string) =>
    unwrap(api.delete<{ data: any; meta: any; message: string }>(`/favorites/${listingId}`)),
};
