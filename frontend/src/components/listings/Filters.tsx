import { FC } from 'react';
import { ListingFilters } from '@/types';

interface Props {
  filters: ListingFilters;
  onChange: (next: ListingFilters) => void;
}

export const Filters: FC<Props> = ({ filters, onChange }) => {
  const update = (patch: Partial<ListingFilters>) => onChange({ ...filters, ...patch, page: 1 });

  return (
    <div className="filters">
      <input
        className="input"
        placeholder="Location"
        value={filters.location || ''}
        onChange={(e) => update({ location: e.target.value || undefined })}
      />

      <input
        className="input"
        placeholder="Min price"
        type="number"
        value={filters.minPrice ?? ''}
        onChange={(e) => update({ minPrice: e.target.value ? Number(e.target.value) : undefined })}
      />

      <input
        className="input"
        placeholder="Max price"
        type="number"
        value={filters.maxPrice ?? ''}
        onChange={(e) => update({ maxPrice: e.target.value ? Number(e.target.value) : undefined })}
      />

      <select
        className="select"
        value={filters.sort || 'latest'}
        onChange={(e) => update({ sort: e.target.value as ListingFilters['sort'] })}
      >
        <option value="latest">Latest</option>
        <option value="price_asc">Price: Low to High</option>
        <option value="price_desc">Price: High to Low</option>
        <option value="popular">Most popular</option>
      </select>
    </div>
  );
};
