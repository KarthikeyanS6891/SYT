import { FC, useEffect, useMemo, useRef, useState } from 'react';
import type { Category } from '@/types';

interface Props {
  categories: Category[];
  selectedCategory?: string;
  onSelect: (categoryId: string | undefined) => void;
}

const QUICK_PICK_SLUGS = [
  'cars',
  'motorcycles',
  'mobile-phones',
  'sale-houses-apartments',
  'rent-houses-apartments',
  'beds-wardrobes',
  'tvs-video-audio',
];

export const CategoryMegaMenu: FC<Props> = ({ categories, selectedCategory, onSelect }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const today = useMemo(
    () =>
      new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    []
  );

  const { parents, childrenOf, bySlug } = useMemo(() => {
    const parents = categories
      .filter((c) => !c.parent)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const childrenOf = (parentId: string) =>
      categories
        .filter((c) => String(c.parent) === String(parentId))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const bySlug: Record<string, Category> = {};
    categories.forEach((c) => {
      bySlug[c.slug] = c;
    });
    return { parents, childrenOf, bySlug };
  }, [categories]);

  const quickPicks = QUICK_PICK_SLUGS.map((s) => bySlug[s]).filter(Boolean) as Category[];

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const choose = (id: string | undefined) => {
    onSelect(id);
    setOpen(false);
  };

  return (
    <div className="cat-bar-wrap" ref={wrapRef}>
      <div className="cat-bar">
        <button
          type="button"
          className={`cat-all-btn ${open ? 'active' : ''}`}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className="cat-hamburger" aria-hidden="true">
            <span /><span /><span />
          </span>
          ALL CATEGORIES
        </button>

        <div className="cat-pills">
          {quickPicks.map((c) => (
            <button
              key={c._id}
              type="button"
              className={`cat-pill ${selectedCategory === c._id ? 'active' : ''}`}
              onClick={() => choose(selectedCategory === c._id ? undefined : c._id)}
            >
              {c.name}
            </button>
          ))}
        </div>

        <span className="cat-date">{today}</span>
      </div>

      {open && (
        <div className="cat-mega" role="dialog" aria-label="All categories">
          <button
            type="button"
            className="cat-mega-close"
            onClick={() => setOpen(false)}
            aria-label="Close categories"
          >
            ⌃
          </button>
          <div className="cat-mega-grid">
            {parents.map((p) => {
              const kids = childrenOf(p._id);
              return (
                <div key={p._id} className="cat-group">
                  <h4
                    className={`cat-group-title ${selectedCategory === p._id ? 'active' : ''}`}
                    onClick={() => choose(p._id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === 'Enter' ? choose(p._id) : null)}
                  >
                    <span className="cat-icon" aria-hidden="true">{p.icon}</span>
                    {p.name}
                  </h4>
                  {kids.length > 0 && (
                    <ul>
                      {kids.map((child) => (
                        <li
                          key={child._id}
                          className={selectedCategory === child._id ? 'active' : ''}
                          onClick={() => choose(child._id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => (e.key === 'Enter' ? choose(child._id) : null)}
                        >
                          {child.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
