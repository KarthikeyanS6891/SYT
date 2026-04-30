import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { userApi } from '@/services/userService';
import { listingApi } from '@/services/listingService';
import { errorMessage } from '@/services/api';
import { Loader } from '@/components/common/Loader';
import { ListingGrid } from '@/components/listings/ListingGrid';
import { useAuth } from '@/hooks/useAuth';
import { initials, timeAgo } from '@/utils/format';
import type { Listing, Pagination, PublicUser } from '@/types';

export default function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [meta, setMeta] = useState<Pagination | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingListings, setLoadingListings] = useState(true);

  useEffect(() => {
    if (!id) return;
    if (me && me._id === id) {
      navigate('/profile', { replace: true });
      return;
    }
    setLoadingUser(true);
    userApi
      .getPublicProfile(id)
      .then(({ data }) => setUser(data.user))
      .catch((err) => {
        toast.error(errorMessage(err, 'User not found'));
        navigate('/');
      })
      .finally(() => setLoadingUser(false));

    setLoadingListings(true);
    listingApi
      .list({ seller: id, limit: 24, sort: 'latest' })
      .then(({ data, meta }) => {
        setListings(data.items);
        setMeta(meta as Pagination);
      })
      .catch(() => null)
      .finally(() => setLoadingListings(false));
  }, [id, me, navigate]);

  if (loadingUser || !user) return <Loader />;

  return (
    <div className="public-profile">
      <div className="profile-hero card">
        <div className="profile-hero-bg" />
        <div className="profile-hero-content">
          <span
            className="avatar profile-avatar"
            style={user.avatar ? { backgroundImage: `url(${user.avatar})` } : {}}
          >
            {!user.avatar && initials(user.name)}
          </span>
          <div className="profile-info">
            <h1>{user.name}</h1>
            <div className="profile-meta">
              {user.location && (
                <span title="Location">📍 {user.location}</span>
              )}
              <span title="Joined">🗓️ Member since {timeAgo(user.createdAt)}</span>
              <span title="Listings">📦 {meta?.total ?? 0} {meta?.total === 1 ? 'listing' : 'listings'}</span>
            </div>
          </div>
        </div>
      </div>

      <h2 className="title" style={{ marginTop: 24 }}>
        Listings by {user.name}
      </h2>

      {loadingListings ? (
        <Loader />
      ) : listings.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 32 }}>📦</div>
          <p>{user.name} has no published listings yet.</p>
          <Link to="/" className="btn ghost sm">Browse all listings</Link>
        </div>
      ) : (
        <ListingGrid items={listings} />
      )}
    </div>
  );
}
