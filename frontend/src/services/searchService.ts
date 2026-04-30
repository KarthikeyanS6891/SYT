import api, { unwrap } from './api';
import type { Category, Listing } from '@/types';

export interface SearchSuggestions {
  categories: Category[];
  listings: Pick<Listing, '_id' | 'title' | 'price' | 'currency' | 'images' | 'location'> & {
    category?: { _id: string; name: string; slug: string };
  };
  total: number;
}

export const searchApi = {
  suggest: (q: string, limit = 6) =>
    unwrap(
      api.get<{
        data: SearchSuggestions;
        meta: any;
        message: string;
      }>('/search/suggest', { params: { q, limit } })
    ),
};
