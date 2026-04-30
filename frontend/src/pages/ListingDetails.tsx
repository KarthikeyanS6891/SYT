import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { listingApi } from '@/services/listingService';
import { favoriteApi } from '@/services/favoriteService';
import { messageApi } from '@/services/messageService';
import { errorMessage } from '@/services/api';
import { Loader } from '@/components/common/Loader';
import { Button } from '@/components/common/Button';
import { ListingGrid } from '@/components/listings/ListingGrid';
import { useAuth } from '@/hooks/useAuth';
import { formatPrice, timeAgo, initials } from '@/utils/format';
import type { Listing, User } from '@/types';

export default function ListingDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [similar, setSimilar] = useState<Listing[]>([]);
  const [isFav, setIsFav] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [contactMsg, setContactMsg] = useState('Hi! Is this still available?');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setActiveImage(0);
    listingApi
      .get(id)
      .then(({ data }) => {
        setListing(data.listing);
        setIsFav(data.isFavorite);
      })
      .catch((err) => {
        toast.error(errorMessage(err));
        navigate('/');
      })
      .finally(() => setLoading(false));

    listingApi.similar(id).then(({ data }) => setSimilar(data.items)).catch(() => null);
  }, [id, navigate]);

  const total = listing?.images.length || 0;
  const goPrev = useCallback(
    () => setActiveImage((i) => (total === 0 ? 0 : (i - 1 + total) % total)),
    [total]
  );
  const goNext = useCallback(
    () => setActiveImage((i) => (total === 0 ? 0 : (i + 1) % total)),
    [total]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goPrev, goNext]);

  if (loading || !listing) return <Loader />;

  const seller = listing.seller as User;
  const isOwner = user && seller && user._id === seller._id;
  const cover = listing.images[activeImage]?.url;

  const toggleFav = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      if (isFav) await favoriteApi.remove(listing._id);
      else await favoriteApi.add(listing._id);
      setIsFav(!isFav);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const sharePage = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: listing.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard');
      }
    } catch {
      /* user cancelled */
    }
  };

  const sendMessage = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!contactMsg.trim()) return;
    setSending(true);
    try {
      const { data } = await messageApi.start({ listingId: listing._id, message: contactMsg });
      toast.success('Message sent');
      navigate(`/chat/${data.conversation._id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="listing-page">
      <div className="listing-main">
        <div className="gallery-v2">
          <div className="gallery-stage">
            {cover ? (
              <img src={cover} alt={listing.title} className="gallery-img" />
            ) : (
              <div className="gallery-empty">No image</div>
            )}
            {total > 1 && (
              <>
                <button
                  type="button"
                  className="gallery-nav prev"
                  onClick={goPrev}
                  aria-label="Previous image"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="gallery-nav next"
                  onClick={goNext}
                  aria-label="Next image"
                >
                  ›
                </button>
                <span className="gallery-counter">
                  {activeImage + 1} / {total}
                </span>
              </>
            )}
            {listing.boosted && <span className="badge gallery-tag">★ Featured</span>}
          </div>

          {total > 1 && (
            <div className="gallery-strip">
              {listing.images.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  className={`gallery-thumb ${i === activeImage ? 'active' : ''}`}
                  style={{ backgroundImage: `url(${img.url})` }}
                  onClick={() => setActiveImage(i)}
                  aria-label={`View image ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="card listing-description">
          <h3 style={{ margin: '0 0 8px' }}>Description</h3>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{listing.description}</p>
          <div className="row" style={{ marginTop: 16, gap: 8, flexWrap: 'wrap' }}>
            <span className="badge muted">{listing.condition}</span>
            {isOwner && (
              <Button onClick={() => navigate(`/post/${listing._id}`)} size="sm" variant="secondary">
                Edit listing
              </Button>
            )}
          </div>
        </div>
      </div>

      <aside className="listing-sidebar">
        <div className="card price-card">
          <div className="row between" style={{ alignItems: 'flex-start', gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="price-big">
                <span className="rupee">₹</span>{' '}
                {formatPrice(listing.price, listing.currency).replace(/[^\d,.]/g, '').trim()}
              </div>
              <div className="price-title">{listing.title}</div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button
                type="button"
                className="icon-btn"
                onClick={sharePage}
                aria-label="Share listing"
                title="Share"
              >
                ↗
              </button>
              <button
                type="button"
                className={`icon-btn ${isFav ? 'fav-active' : ''}`}
                onClick={toggleFav}
                aria-label={isFav ? 'Remove from favorites' : 'Save listing'}
                title={isFav ? 'Saved' : 'Save'}
              >
                {isFav ? '♥' : '♡'}
              </button>
            </div>
          </div>
          <div className="price-meta">
            <span>{listing.location}</span>
            <span>{timeAgo(listing.createdAt)}</span>
          </div>
        </div>

        <div className="card">
          <Link
            to={`/users/${seller._id}`}
            className="row"
            style={{ gap: 12, color: 'inherit' }}
          >
            <span
              className="avatar"
              style={{
                width: 52, height: 52, fontSize: 16,
                ...(seller.avatar ? { backgroundImage: `url(${seller.avatar})` } : {}),
              }}
            >
              {!seller.avatar && initials(seller.name)}
            </span>
            <div style={{ flex: 1 }}>
              <div className="text-xs muted">Posted by</div>
              <div className="bold" style={{ fontSize: 15 }}>{seller.name}</div>
              <div className="text-xs muted">Member since {timeAgo(seller.createdAt)}</div>
            </div>
            <span className="muted">›</span>
          </Link>

          {!isOwner && (
            <>
              <textarea
                className="textarea"
                style={{ marginTop: 14 }}
                value={contactMsg}
                onChange={(e) => setContactMsg(e.target.value)}
                placeholder="Type a message"
                rows={3}
              />
              <Button block onClick={sendMessage} loading={sending} style={{ marginTop: 8 }}>
                Chat with seller
              </Button>
            </>
          )}
        </div>

        <div className="card posted-in">
          <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>Posted in</h4>
          <div className="muted text-sm">{listing.location}</div>
        </div>
      </aside>

      {similar.length > 0 && (
        <div className="listing-similar">
          <h2 className="title">Similar listings</h2>
          <ListingGrid items={similar} />
        </div>
      )}
    </div>
  );
}
