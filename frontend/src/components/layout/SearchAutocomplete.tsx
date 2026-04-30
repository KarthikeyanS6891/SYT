import { FC, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { useDebounce } from '@/hooks/useDebounce';
import { formatPrice } from '@/utils/format';
import type { Category, Listing } from '@/types';

interface Suggestions {
  categories: Category[];
  listings: (Pick<Listing, '_id' | 'title' | 'price' | 'currency' | 'images' | 'location'> & {
    category?: { _id: string; name: string };
  })[];
}

interface FlatItem {
  type: 'category' | 'listing' | 'free';
  id?: string;
  index: number;
  payload?: any;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const Highlighted: FC<{ text: string; query: string }> = ({ text, query }) => {
  if (!query.trim()) return <>{text}</>;
  const tokens = query.trim().split(/\s+/).filter(Boolean).map(escapeRegex);
  if (!tokens.length) return <>{text}</>;
  const re = new RegExp(`(${tokens.join('|')})`, 'gi');
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        re.test(p) ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>
      )}
    </>
  );
};

export const SearchAutocomplete: FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Suggestions>({ categories: [], listings: [] });
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounced = useDebounce(query, 220);

  // Fetch suggestions
  useEffect(() => {
    const term = debounced.trim();
    if (term.length < 2) {
      setResults({ categories: [], listings: [] });
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .get('/search/suggest', { params: { q: term, limit: 6 } })
      .then((r) => {
        if (cancelled) return;
        setResults({
          categories: r.data?.data?.categories || [],
          listings: r.data?.data?.listings || [],
        });
        setActiveIdx(-1);
      })
      .catch(() => null)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  // Click-outside
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const flat: FlatItem[] = useMemo(() => {
    const items: FlatItem[] = [];
    let i = 0;
    results.categories.forEach((c) => items.push({ type: 'category', id: c._id, index: i++, payload: c }));
    results.listings.forEach((l) => items.push({ type: 'listing', id: l._id, index: i++, payload: l }));
    if (query.trim().length >= 2) items.push({ type: 'free', index: i++ });
    return items;
  }, [results, query]);

  const goTo = (item: FlatItem) => {
    setOpen(false);
    if (item.type === 'category') {
      navigate(`/?category=${item.id}`);
    } else if (item.type === 'listing') {
      navigate(`/listings/${item.id}`);
    } else {
      navigate(`/?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (activeIdx >= 0 && flat[activeIdx]) {
      goTo(flat[activeIdx]);
    } else {
      const q = query.trim();
      navigate(q ? `/?q=${encodeURIComponent(q)}` : '/');
      setOpen(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => (i + 1 >= flat.length ? 0 : i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? flat.length - 1 : i - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showPanel = open && query.trim().length >= 2;
  const noMatches = !loading && results.categories.length === 0 && results.listings.length === 0;

  return (
    <div className="search-ac" ref={wrapRef}>
      <form onSubmit={onSubmit} role="search">
        <div className="search-ac-input">
          <span className="search-ac-icon" aria-hidden="true">🔍</span>
          <input
            className="input"
            placeholder="Search cars, phones, properties, brands…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            aria-autocomplete="list"
            aria-expanded={showPanel}
            aria-controls="search-ac-panel"
          />
          {query && (
            <button
              type="button"
              className="search-ac-clear"
              onClick={() => {
                setQuery('');
                setResults({ categories: [], listings: [] });
              }}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </form>

      {showPanel && (
        <div id="search-ac-panel" className="search-ac-panel" role="listbox">
          {loading && (
            <div className="search-ac-status">
              <span className="spinner" /> Searching…
            </div>
          )}

          {!loading && results.categories.length > 0 && (
            <>
              <div className="search-ac-section">Categories</div>
              {results.categories.map((c) => {
                const item = flat.find((f) => f.type === 'category' && f.id === c._id)!;
                return (
                  <div
                    key={c._id}
                    className={`search-ac-item ${activeIdx === item.index ? 'active' : ''}`}
                    role="option"
                    aria-selected={activeIdx === item.index}
                    onMouseEnter={() => setActiveIdx(item.index)}
                    onClick={() => goTo(item)}
                  >
                    <span className="search-ac-thumb cat">{c.icon || '📂'}</span>
                    <div className="search-ac-body">
                      <div className="search-ac-title">
                        <Highlighted text={c.name} query={query} />
                      </div>
                      <div className="search-ac-sub">
                        {c.parent ? 'Subcategory' : 'Category'}
                      </div>
                    </div>
                    <span className="search-ac-arrow">↗</span>
                  </div>
                );
              })}
            </>
          )}

          {!loading && results.listings.length > 0 && (
            <>
              <div className="search-ac-section">Listings</div>
              {results.listings.map((l) => {
                const item = flat.find((f) => f.type === 'listing' && f.id === l._id)!;
                const cover = l.images?.[0]?.url;
                return (
                  <div
                    key={l._id}
                    className={`search-ac-item ${activeIdx === item.index ? 'active' : ''}`}
                    role="option"
                    aria-selected={activeIdx === item.index}
                    onMouseEnter={() => setActiveIdx(item.index)}
                    onClick={() => goTo(item)}
                  >
                    <span
                      className="search-ac-thumb img"
                      style={cover ? { backgroundImage: `url(${cover})` } : {}}
                    />
                    <div className="search-ac-body">
                      <div className="search-ac-title">
                        <Highlighted text={l.title} query={query} />
                      </div>
                      <div className="search-ac-sub">
                        {formatPrice(l.price, l.currency)} · {l.location}
                        {l.category?.name ? ` · ${l.category.name}` : ''}
                      </div>
                    </div>
                    <span className="search-ac-arrow">↗</span>
                  </div>
                );
              })}
            </>
          )}

          {!loading && noMatches && (
            <div className="search-ac-empty">
              No matches for "<b>{query}</b>"
            </div>
          )}

          <div
            className={`search-ac-item search-ac-free ${
              activeIdx === flat.length - 1 ? 'active' : ''
            }`}
            role="option"
            aria-selected={activeIdx === flat.length - 1}
            onMouseEnter={() => setActiveIdx(flat.length - 1)}
            onClick={() => goTo(flat[flat.length - 1])}
          >
            <span className="search-ac-thumb cat">↵</span>
            <div className="search-ac-body">
              <div className="search-ac-title">
                See all results for "<b>{query}</b>"
              </div>
              <div className="search-ac-sub">Press Enter</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
