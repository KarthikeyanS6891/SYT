import api, { unwrap } from './api';
import type { Category, Listing, ListingFilters, ListingImage } from '@/types';

// Coordinates travel as flat fields; null clears the pin on update.
export type ListingPayload = Partial<Listing> & {
  latitude?: number | null;
  longitude?: number | null;
};

export const listingApi = {
  list: (filters: ListingFilters = {}) =>
    unwrap(
      api.get<{ data: { items: Listing[] }; meta: any; message: string }>('/listings', {
        params: filters,
      })
    ),

  mine: (params: { status?: string; page?: number; limit?: number } = {}) =>
    unwrap(
      api.get<{ data: { items: Listing[] }; meta: any; message: string }>('/listings/mine', {
        params,
      })
    ),

  get: (id: string) =>
    unwrap(api.get<{ data: { listing: Listing; isFavorite: boolean }; meta: any; message: string }>(
      `/listings/${id}`
    )),

  similar: (id: string) =>
    unwrap(api.get<{ data: { items: Listing[] }; meta: any; message: string }>(
      `/listings/${id}/similar`
    )),

  create: (payload: ListingPayload & { category: string; images: ListingImage[] }) =>
    unwrap(api.post<{ data: { listing: Listing }; meta: any; message: string }>('/listings', payload)),

  update: (id: string, payload: ListingPayload) =>
    unwrap(api.patch<{ data: { listing: Listing }; meta: any; message: string }>(
      `/listings/${id}`,
      payload
    )),

  remove: (id: string) =>
    unwrap(api.delete<{ data: any; meta: any; message: string }>(`/listings/${id}`)),

  toggleBoost: (id: string) =>
    unwrap(api.post<{ data: { listing: Listing }; meta: any; message: string }>(
      `/listings/${id}/boost`
    )),
};

export const categoryApi = {
  list: () =>
    unwrap(api.get<{ data: { items: Category[] }; meta: any; message: string }>('/categories')),
};
