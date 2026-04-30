import { FC, MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Listing } from '@/types';
import { formatPrice, timeAgo } from '@/utils/format';

interface Props {
  listing: Listing;
  onToggleFavorite?: (id: string, isFavorite: boolean) => void;
}

export const ListingCard: FC<Props> = ({ listing, onToggleFavorite }) => {
  const navigate = useNavigate();
  const cover = listing.images?.[0]?.url;

  const handleFav = (e: MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite?.(listing._id, !listing.isFavorite);
  };

  return (
    <div className="listing-card" onClick={() => navigate(`/listings/${listing._id}`)}>
      <div className="thumb" style={cover ? { backgroundImage: `url(${cover})` } : {}} />
      {listing.boosted && <span className="badge boost-badge">★ Featured</span>}
      {onToggleFavorite && (
        <button className="fav-btn" onClick={handleFav} aria-label="Toggle favorite">
          {listing.isFavorite ? '♥' : '♡'}
        </button>
      )}
      <div className="body">
        <div className="price">{formatPrice(listing.price, listing.currency)}</div>
        <h3>{listing.title}</h3>
        <div className="row between meta">
          <span>{listing.location}</span>
          <span>{timeAgo(listing.createdAt)}</span>
        </div>
      </div>
    </div>
  );
};
