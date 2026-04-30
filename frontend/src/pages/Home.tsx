import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Filters } from '@/components/listings/Filters';
import { CategoryMegaMenu } from '@/components/listings/CategoryMegaMenu';
import { ListingGrid } from '@/components/listings/ListingGrid';
import { Loader } from '@/components/common/Loader';
import { listingApi, categoryApi } from '@/services/listingService';
import { favoriteApi } from '@/services/favoriteService';
import { errorMessage } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import type { Category, Listing, ListingFilters, Pagination } from '@/types';

export default function Home() {
  const [params, setParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [meta, setMeta] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);

  const filters: ListingFilters = useMemo(
    () => ({
      q: params.get('q') || undefined,
      category: params.get('category') || undefined,
      location: params.get('location') || undefined,
      minPrice: params.get('minPrice') ? Number(params.get('minPrice')) : undefined,
      maxPrice: params.get('maxPrice') ? Number(params.get('maxPrice')) : undefined,
      sort: (params.get('sort') as ListingFilters['sort']) || 'latest',
      page: params.get('page') ? Number(params.get('page')) : 1,
      limit: 12,
    }),
    [params]
  );

  const debouncedFilters = useDebounce(filters, 300);

  useEffect(() => {
    categoryApi.list().then(({ data }) => setCategories(data.items)).catch(() => null);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listingApi
      .list(debouncedFilters)
      .then(({ data, meta }) => {
        if (!active) return;
        setItems(data.items);
        setMeta(meta as Pagination);
      })
      .catch((err) => toast.error(errorMessage(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [debouncedFilters]);

  const updateFilters = (next: ListingFilters) => {
    const usp = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== null) usp.set(k, String(v));
    });
    setParams(usp);
  };

  const goPage = (page: number) => updateFilters({ ...filters, page });

  const toggleFavorite = async (id: string, next: boolean) => {
    if (!isAuthenticated) {
      toast.error('Login to save favorites');
      return;
    }
    try {
      if (next) await favoriteApi.add(id);
      else await favoriteApi.remove(id);
      setItems((prev) => prev.map((l) => (l._id === id ? { ...l, isFavorite: next } : l)));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <CategoryMegaMenu
        categories={categories}
        selectedCategory={filters.category}
        onSelect={(id) => updateFilters({ ...filters, category: id })}
      />
      <Filters filters={filters} onChange={updateFilters} />
      {filters.q && (
        <div className="text-sm muted" style={{ marginBottom: 12 }}>
          Showing results for "<b>{filters.q}</b>"
        </div>
      )}

      {loading ? (
        <Loader />
      ) : (
        <>
          <ListingGrid
            items={items}
            onToggleFavorite={toggleFavorite}
            emptyText="No listings match your filters."
          />
          {meta && meta.pages > 1 && (
            <div className="pagination">
              {Array.from({ length: meta.pages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  className={p === meta.page ? 'active' : ''}
                  onClick={() => goPage(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
