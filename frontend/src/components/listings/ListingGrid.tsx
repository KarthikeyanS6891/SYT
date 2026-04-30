import { FC } from 'react';
import { Listing } from '@/types';
import { ListingCard } from './ListingCard';

interface Props {
  items: Listing[];
  onToggleFavorite?: (id: string, next: boolean) => void;
  emptyText?: string;
}

export const ListingGrid: FC<Props> = ({ items, onToggleFavorite, emptyText = 'No listings found.' }) => {
  if (!items.length) {
    return <div className="empty-state">{emptyText}</div>;
  }
  return (
    <div className="grid">
      {items.map((listing) => (
        <ListingCard key={listing._id} listing={listing} onToggleFavorite={onToggleFavorite} />
      ))}
    </div>
  );
};
