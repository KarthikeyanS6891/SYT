import { useEffect, useState } from 'react';
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

  if (loading || !listing) return <Loader />;

  const seller = listing.seller as User;
  const isOwner = user && seller && user._id === seller._id;

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
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
      <div>
        <div className="gallery">
          <div
            className="main"
            style={{
              backgroundImage: listing.images[activeImage]?.url
                ? `url(${listing.images[activeImage].url})`
                : undefined,
            }}
          />
          {listing.images.length > 1 && (
            <div className="thumbs">
              {listing.images.slice(0, 5).map((img, i) => (
                <div
                  key={i}
                  className={`thumb ${i === activeImage ? 'active' : ''}`}
                  style={{ backgroundImage: `url(${img.url})` }}
                  onClick={() => setActiveImage(i)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="row between">
            <div>
              <h1 style={{ margin: 0, fontSize: 24 }}>{formatPrice(listing.price, listing.currency)}</h1>
              <h2 style={{ margin: '4px 0', fontSize: 18, fontWeight: 500 }}>{listing.title}</h2>
              <div className="muted text-sm">
                {listing.location} · {timeAgo(listing.createdAt)}
              </div>
            </div>
            <div className="row">
              {listing.boosted && <span className="badge">★ Featured</span>}
              <span className="badge muted">{listing.condition}</span>
            </div>
          </div>

          <h3 style={{ marginTop: 20 }}>Description</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{listing.description}</p>

          <div className="row" style={{ marginTop: 16, gap: 8 }}>
            <Button onClick={toggleFav} variant="secondary">
              {isFav ? '♥ Saved' : '♡ Save'}
            </Button>
            {isOwner && (
              <Button onClick={() => navigate(`/post/${listing._id}`)} variant="ghost">
                Edit
              </Button>
            )}
          </div>
        </div>
      </div>

      <aside className="col">
        <div className="card">
          <div className="row" style={{ gap: 12 }}>
            <span
              className="avatar"
              style={{
                width: 48, height: 48,
                ...(seller.avatar ? { backgroundImage: `url(${seller.avatar})` } : {}),
              }}
            >
              {!seller.avatar && initials(seller.name)}
            </span>
            <div>
              <div className="bold">{seller.name}</div>
              <div className="text-xs muted">Member since {timeAgo(seller.createdAt)}</div>
            </div>
          </div>

          {!isOwner && (
            <>
              <textarea
                className="textarea"
                style={{ marginTop: 12 }}
                value={contactMsg}
                onChange={(e) => setContactMsg(e.target.value)}
                placeholder="Type a message"
                rows={3}
              />
              <Button block onClick={sendMessage} loading={sending} style={{ marginTop: 8 }}>
                Send Message
              </Button>
            </>
          )}
          {seller.phone && (
            <div className="text-sm" style={{ marginTop: 12 }}>
              <Link to={`/users/${seller._id}`} className="muted">View seller profile</Link>
            </div>
          )}
        </div>
      </aside>

      {similar.length > 0 && (
        <div style={{ gridColumn: '1 / -1', marginTop: 16 }}>
          <h2 className="title">Similar listings</h2>
          <ListingGrid items={similar} />
        </div>
      )}
    </div>
  );
}
