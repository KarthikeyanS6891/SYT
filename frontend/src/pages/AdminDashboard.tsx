import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { unwrap, errorMessage } from '@/services/api';
import { listingApi } from '@/services/listingService';
import { Loader } from '@/components/common/Loader';
import { Button } from '@/components/common/Button';
import { formatPrice, timeAgo, initials } from '@/utils/format';
import type { Listing, User, ListingStatus } from '@/types';

interface Stats {
  users: number;
  listings: number;
  published: number;
  disabled: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tab, setTab] = useState<'listings' | 'users'>('listings');
  const [listings, setListings] = useState<Listing[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const loadStats = async () => {
    try {
      const { data } = await unwrap<Stats>(api.get('/admin/stats'));
      setStats(data);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const loadListings = async () => {
    setLoading(true);
    try {
      const { data } = await listingApi.list({ limit: 50, sort: 'latest' });
      setListings(data.items);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data } = await unwrap<{ items: User[] }>(
        api.get('/admin/users', { params: { q, limit: 50 } })
      );
      setUsers(data.items);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (tab === 'listings') loadListings();
    else loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const setListingStatus = async (id: string, status: ListingStatus) => {
    try {
      await unwrap(api.patch(`/admin/listings/${id}/status`, { status }));
      toast.success('Listing updated');
      setListings((prev) => prev.map((l) => (l._id === id ? { ...l, status } : l)));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const toggleUser = async (id: string, disabled: boolean) => {
    try {
      await unwrap(api.patch(`/admin/users/${id}`, { disabled }));
      toast.success(disabled ? 'User disabled' : 'User enabled');
      setUsers((prev) => prev.map((u) => (u._id === id ? { ...u, disabled } : u)));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <h1 className="title">Admin Dashboard</h1>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
        {[
          { label: 'Users', value: stats?.users ?? '—' },
          { label: 'Listings', value: stats?.listings ?? '—' },
          { label: 'Published', value: stats?.published ?? '—' },
          { label: 'Disabled', value: stats?.disabled ?? '—' },
        ].map((s) => (
          <div key={s.label} className="card">
            <div className="text-sm muted">{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="row" style={{ marginBottom: 12, gap: 4 }}>
        <button className={`btn ${tab === 'listings' ? '' : 'ghost'} sm`} onClick={() => setTab('listings')}>
          Listings
        </button>
        <button className={`btn ${tab === 'users' ? '' : 'ghost'} sm`} onClick={() => setTab('users')}>
          Users
        </button>
      </div>

      {loading ? (
        <Loader />
      ) : tab === 'listings' ? (
        <div className="col">
          {listings.map((l) => (
            <div key={l._id} className="card row" style={{ gap: 12 }}>
              <div
                style={{
                  width: 80, height: 60, borderRadius: 6, background: '#f3f4f6',
                  backgroundImage: l.images[0] ? `url(${l.images[0].url})` : undefined,
                  backgroundSize: 'cover', backgroundPosition: 'center',
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <a href={`/listings/${l._id}`} className="bold">{l.title}</a>
                <div className="text-sm muted">
                  {formatPrice(l.price, l.currency)} · {l.location} · {timeAgo(l.createdAt)}
                </div>
                <span className={`badge ${l.status === 'published' ? 'success' : 'muted'}`}>
                  {l.status}
                </span>
              </div>
              <div className="row" style={{ gap: 6 }}>
                {l.status !== 'disabled' ? (
                  <Button size="sm" variant="danger" onClick={() => setListingStatus(l._id, 'disabled')}>
                    Disable
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setListingStatus(l._id, 'published')}>
                    Re-enable
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            <input
              className="input"
              placeholder="Search users by name or email"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
              style={{ maxWidth: 360 }}
            />
            <Button variant="secondary" onClick={loadUsers}>Search</Button>
          </div>
          <div className="col">
            {users.map((u) => (
              <div key={u._id} className="card row" style={{ gap: 12 }}>
                <span
                  className="avatar"
                  style={u.avatar ? { backgroundImage: `url(${u.avatar})` } : {}}
                >
                  {!u.avatar && initials(u.name)}
                </span>
                <div style={{ flex: 1 }}>
                  <div className="bold">{u.name}</div>
                  <div className="text-sm muted">
                    {u.email} · {u.role} · {timeAgo(u.createdAt)}
                  </div>
                </div>
                <span className={`badge ${u.disabled ? 'warn' : 'success'}`}>
                  {u.disabled ? 'Disabled' : 'Active'}
                </span>
                {u.role !== 'admin' && (
                  u.disabled ? (
                    <Button size="sm" onClick={() => toggleUser(u._id, false)}>Enable</Button>
                  ) : (
                    <Button size="sm" variant="danger" onClick={() => toggleUser(u._id, true)}>Disable</Button>
                  )
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
