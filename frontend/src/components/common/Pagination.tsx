import { FC, useMemo } from 'react';

interface PaginationProps {
  page: number;
  pages: number;
  onChange: (page: number) => void;
  /** Number of page links to show on each side of the current page. */
  siblings?: number;
}

type PageItem = number | 'left-ellipsis' | 'right-ellipsis';

/**
 * Build a condensed list of page items: always the first and last page, the
 * current page with `siblings` neighbours, and ellipses for the gaps —
 * e.g. `1 … 14 15 [16] 17 18 … 357`.
 */
function buildPageItems(page: number, pages: number, siblings: number): PageItem[] {
  const shown = new Set<number>([1, pages]);
  for (let p = page - siblings; p <= page + siblings; p++) {
    if (p >= 1 && p <= pages) shown.add(p);
  }

  const sorted = [...shown].sort((a, b) => a - b);
  const items: PageItem[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev) {
      if (p - prev === 2) {
        // Only a single page is missing — show it instead of an ellipsis.
        items.push(prev + 1);
      } else if (p - prev > 2) {
        items.push(p <= page ? 'left-ellipsis' : 'right-ellipsis');
      }
    }
    items.push(p);
    prev = p;
  }
  return items;
}

export const Pagination: FC<PaginationProps> = ({ page, pages, onChange, siblings = 2 }) => {
  const items = useMemo(() => buildPageItems(page, pages, siblings), [page, pages, siblings]);

  if (pages <= 1) return null;

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        ‹ Prev
      </button>
      {items.map((item) =>
        typeof item === 'number' ? (
          <button
            key={item}
            type="button"
            className={item === page ? 'active' : ''}
            aria-current={item === page ? 'page' : undefined}
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        ) : (
          <span key={item} className="pagination-ellipsis" aria-hidden="true">
            …
          </span>
        )
      )}
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= pages}
        aria-label="Next page"
      >
        Next ›
      </button>
    </nav>
  );
};
