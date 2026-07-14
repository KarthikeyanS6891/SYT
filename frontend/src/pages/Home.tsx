import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Filters } from '@/components/listings/Filters';
import { CategoryMegaMenu } from '@/components/listings/CategoryMegaMenu';
import { ListingGrid } from '@/components/listings/ListingGrid';
import { Loader } from '@/components/common/Loader';
import { Pagination } from '@/components/common/Pagination';
import { listingApi, categoryApi } from '@/services/listingService';
import { favoriteApi } from '@/services/favoriteService';
import { errorMessage } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { useAppDispatch } from '@/store';
import { openAuthModal } from '@/store/slices/uiSlice';
import { useDebounce } from '@/hooks/useDebounce';
import type { Category, Listing, ListingFilters, Pagination as PaginationMeta } from '@/types';

export default function Home() {
  const [params, setParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const dispatch = useAppDispatch();
  const [items, setItems] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
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
        setMeta(meta as PaginationMeta);
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
      dispatch(openAuthModal('login'));
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

  const browsing = !filters.q && !filters.category;

  return (
    <>
      {!browsing && <h1 className="visually-hidden">Browse listings</h1>}
      {browsing && (
        <section className="home-hero" aria-label="Welcome">
          <p className="hero-eyebrow">Sell Your Things</p>
          <h1 className="hero-title">Your city's bazaar, online.</h1>
          <p className="hero-sub">
            Buy and sell cars, phones, furniture and almost anything — with people nearby.
          </p>
          <div className="hero-cta">
            <Link to="/post" className="btn">+ Post your ad</Link>
            <span className="hero-note">It's free and takes a minute</span>
          </div>
          <div className="hero-tags" aria-hidden="true">
            <span className="hero-tag">₹ 499</span>
            <span className="hero-tag">₹ 12,500</span>
            <span className="hero-tag">₹ 4,85,000</span>
          </div>
        </section>
      )}
      <CategoryMegaMenu
        categories={categories}
        selectedCategory={filters.category}
        onSelect={(id) => updateFilters({ ...filters, category: id })}
      />
      <Filters filters={filters} onChange={updateFilters} />
      {filters.q && (
        <div className="results-banner text-sm">
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
          {meta && <Pagination page={meta.page} pages={meta.pages} onChange={goPage} />}
        </>
      )}
    </>
  );
}
