import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { listingApi } from '@/services/listingService';
import { errorMessage } from '@/services/api';
import { Loader } from '@/components/common/Loader';
import { Button } from '@/components/common/Button';
import { formatPrice, timeAgo } from '@/utils/format';
import type { Listing } from '@/types';

export default function MyListings() {
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const load = () => {
    setLoading(true);
    listingApi
      .mine({ status: statusFilter || undefined, limit: 50 })
      .then(({ data }) => setItems(data.items))
      .catch((err) => toast.error(errorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const remove = async (id: string) => {
    if (!confirm('Delete this listing?')) return;
    try {
      await listingApi.remove(id);
      toast.success('Deleted');
      setItems((prev) => prev.filter((l) => l._id !== id));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const toggleBoost = async (id: string) => {
    try {
      const { data } = await listingApi.toggleBoost(id);
      toast.success(data.listing.boosted ? 'Boosted!' : 'Boost removed');
      setItems((prev) => prev.map((l) => (l._id === id ? data.listing : l)));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <div className="row between" style={{ marginBottom: 12 }}>
        <h1 className="title" style={{ margin: 0 }}>My Listings</h1>
        <Link to="/post" className="btn">+ New Listing</Link>
      </div>

      <div className="row" style={{ marginBottom: 12, gap: 4 }}>
        {[
          { v: '', label: 'All' },
          { v: 'published', label: 'Published' },
          { v: 'draft', label: 'Drafts' },
          { v: 'sold', label: 'Sold' },
          { v: 'disabled', label: 'Disabled' },
        ].map((s) => (
          <button
            key={s.v}
            className={`btn ${statusFilter === s.v ? '' : 'ghost'} sm`}
            onClick={() => setStatusFilter(s.v)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Loader />
      ) : items.length === 0 ? (
        <div className="empty-state">No listings yet. <Link to="/post">Post your first ad</Link></div>
      ) : (
        <div className="col">
          {items.map((l) => (
            <div key={l._id} className="card row" style={{ gap: 12 }}>
              <div
                style={{
                  width: 100, height: 80, borderRadius: 8, background: '#f3f4f6',
                  backgroundImage: l.images[0] ? `url(${l.images[0].url})` : undefined,
                  backgroundSize: 'cover', backgroundPosition: 'center', flex: '0 0 auto',
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link to={`/listings/${l._id}`} className="bold">{l.title}</Link>
                <div className="text-sm muted">
                  {formatPrice(l.price, l.currency)} · {l.location} · {timeAgo(l.createdAt)}
                </div>
                <div className="row" style={{ gap: 6, marginTop: 6 }}>
                  <span className={`badge ${l.status === 'published' ? 'success' : 'muted'}`}>
                    {l.status}
                  </span>
                  {l.boosted && <span className="badge">★ Boosted</span>}
                  <span className="badge muted">{l.views} views</span>
                </div>
              </div>
              <div className="col" style={{ gap: 6 }}>
                <Link to={`/post/${l._id}`} className="btn secondary sm">Edit</Link>
                <Button size="sm" variant="ghost" onClick={() => toggleBoost(l._id)}>
                  {l.boosted ? 'Unboost' : 'Boost'}
                </Button>
                <Button size="sm" variant="danger" onClick={() => remove(l._id)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
