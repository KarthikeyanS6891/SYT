import { describe, it, expect } from 'vitest';
import {
  api,
  createUser,
  createAdmin,
  createListing,
  authFor,
} from '../helpers/index.js';
import { User } from '../../src/models/User.js';
import { Listing } from '../../src/models/Listing.js';

const NONEXISTENT_ID = '64b7f9a2f1c2a3b4c5d6e7f8';

describe('Admin auth guard (every /admin route requires an admin)', () => {
  const routes = [
    ['get', '/api/v1/admin/stats'],
    ['get', '/api/v1/admin/users'],
    ['patch', `/api/v1/admin/users/${NONEXISTENT_ID}`],
    ['patch', `/api/v1/admin/listings/${NONEXISTENT_ID}/status`],
  ];

  it.each(routes)('%s %s returns 401 without a token', async (method, path) => {
    const res = await api()[method](path).send({});
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it.each(routes)('%s %s returns 403 for a normal user', async (method, path) => {
    const user = await createUser();
    const res = await api()[method](path).set(authFor(user)).send({});
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/admin only/i);
  });
});

describe('GET /admin/stats', () => {
  it('returns user/listing counts reflecting created data', async () => {
    const admin = await createAdmin();
    const seller = await createUser(); // a second, non-admin user; reused as seller

    // Reuse one seller so the user count is deterministic and not inflated by
    // the helper auto-creating a fresh seller per listing.
    // 2 published, 1 sold, 1 disabled, 1 draft
    await createListing({ seller, status: 'published' });
    await createListing({ seller, status: 'published' });
    await createListing({ seller, status: 'sold' });
    await createListing({ seller, status: 'disabled' });
    await createListing({ seller, status: 'draft' });

    const res = await api().get('/api/v1/admin/stats').set(authFor(admin));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      users: 2, // admin + the shared seller
      listings: 5,
      published: 2,
      disabled: 1,
    });
  });

  it('returns zeroed listing counts when only users exist', async () => {
    const admin = await createAdmin();
    const res = await api().get('/api/v1/admin/stats').set(authFor(admin));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      users: 1,
      listings: 0,
      published: 0,
      disabled: 0,
    });
  });
});

describe('GET /admin/users', () => {
  it('returns a paginated list with meta and no password/refreshTokens', async () => {
    const admin = await createAdmin();
    await createUser();
    await createUser();

    const res = await api().get('/api/v1/admin/users').set(authFor(admin));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.items).toHaveLength(3); // admin + 2 users
    expect(res.body.meta).toMatchObject({
      page: 1,
      limit: 20,
      total: 3,
      pages: 1,
    });

    for (const item of res.body.data.items) {
      expect(item.password).toBeUndefined();
      expect(item.refreshTokens).toBeUndefined();
      expect(item.email).toBeTruthy();
    }
  });

  it('filters by name via ?q= (case-insensitive)', async () => {
    const admin = await createAdmin();
    await createUser({ name: 'Alice Wonderland' });
    await createUser({ name: 'Bob Builder' });

    const res = await api()
      .get('/api/v1/admin/users')
      .query({ q: 'alice' })
      .set(authFor(admin));

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].name).toBe('Alice Wonderland');
    expect(res.body.meta.total).toBe(1);
  });

  it('filters by email via ?q=', async () => {
    const admin = await createAdmin();
    const target = await createUser({ email: 'findme_unique@example.com' });
    await createUser({ email: 'other@example.com' });

    const res = await api()
      .get('/api/v1/admin/users')
      .query({ q: 'findme_unique' })
      .set(authFor(admin));

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0]._id).toBe(target._id.toString());
  });

  it('honours pagination via ?page= and ?limit=', async () => {
    const admin = await createAdmin();
    await createUser();
    await createUser(); // total 3 users

    const res = await api()
      .get('/api/v1/admin/users')
      .query({ page: 2, limit: 2 })
      .set(authFor(admin));

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1); // 3 total, page 2 of size 2
    expect(res.body.meta).toMatchObject({
      page: 2,
      limit: 2,
      total: 3,
      pages: 2,
    });
  });

  it('caps the page size at 50', async () => {
    const admin = await createAdmin();
    const res = await api()
      .get('/api/v1/admin/users')
      .query({ limit: 999 })
      .set(authFor(admin));
    expect(res.status).toBe(200);
    expect(res.body.meta.limit).toBe(50);
  });
});

describe('PATCH /admin/users/:id (disable / enable)', () => {
  it('disables a user and clears their refresh tokens', async () => {
    const admin = await createAdmin();
    const target = await createUser();
    // Seed a refresh token directly so we can prove it gets cleared.
    await User.updateOne({ _id: target._id }, { refreshTokens: ['rt-1', 'rt-2'] });

    const res = await api()
      .patch(`/api/v1/admin/users/${target._id}`)
      .set(authFor(admin))
      .send({ disabled: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.disabled).toBe(true);
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.user.refreshTokens).toBeUndefined();

    const fresh = await User.findById(target._id).select('+refreshTokens');
    expect(fresh.disabled).toBe(true);
    expect(fresh.refreshTokens).toHaveLength(0);
  });

  it('re-enables a disabled user', async () => {
    const admin = await createAdmin();
    const target = await createUser({ disabled: true });

    const res = await api()
      .patch(`/api/v1/admin/users/${target._id}`)
      .set(authFor(admin))
      .send({ disabled: false });

    expect(res.status).toBe(200);
    expect(res.body.data.user.disabled).toBe(false);

    const fresh = await User.findById(target._id);
    expect(fresh.disabled).toBe(false);
  });

  it('coerces a missing disabled flag to false (re-enable)', async () => {
    const admin = await createAdmin();
    const target = await createUser({ disabled: true });

    const res = await api()
      .patch(`/api/v1/admin/users/${target._id}`)
      .set(authFor(admin))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.user.disabled).toBe(false);
  });

  it('returns 404 for a non-existent user id', async () => {
    const admin = await createAdmin();
    const res = await api()
      .patch(`/api/v1/admin/users/${NONEXISTENT_ID}`)
      .set(authFor(admin))
      .send({ disabled: true });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/user not found/i);
  });

  it('returns 400 for a malformed user id (CastError)', async () => {
    const admin = await createAdmin();
    const res = await api()
      .patch('/api/v1/admin/users/not-a-mongo-id')
      .set(authFor(admin))
      .send({ disabled: true });

    expect(res.status).toBe(400);
  });
});

describe('PATCH /admin/listings/:id/status', () => {
  it('updates a listing to a valid status (sold)', async () => {
    const admin = await createAdmin();
    const listing = await createListing({ status: 'published' });

    const res = await api()
      .patch(`/api/v1/admin/listings/${listing._id}/status`)
      .set(authFor(admin))
      .send({ status: 'sold' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.listing.status).toBe('sold');

    const fresh = await Listing.findById(listing._id);
    expect(fresh.status).toBe('sold');
  });

  it.each(['draft', 'published', 'sold', 'disabled'])(
    'accepts the valid status %s',
    async (status) => {
      const admin = await createAdmin();
      const listing = await createListing({ status: 'published' });
      const res = await api()
        .patch(`/api/v1/admin/listings/${listing._id}/status`)
        .set(authFor(admin))
        .send({ status });
      expect(res.status).toBe(200);
      expect(res.body.data.listing.status).toBe(status);
    }
  );

  it('rejects an invalid status with 400', async () => {
    const admin = await createAdmin();
    const listing = await createListing();

    const res = await api()
      .patch(`/api/v1/admin/listings/${listing._id}/status`)
      .set(authFor(admin))
      .send({ status: 'archived' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid status/i);

    const fresh = await Listing.findById(listing._id);
    expect(fresh.status).not.toBe('archived');
  });

  it('rejects a missing status with 400', async () => {
    const admin = await createAdmin();
    const listing = await createListing();

    const res = await api()
      .patch(`/api/v1/admin/listings/${listing._id}/status`)
      .set(authFor(admin))
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid status/i);
  });

  it('returns 404 for a non-existent listing id (valid status)', async () => {
    const admin = await createAdmin();
    const res = await api()
      .patch(`/api/v1/admin/listings/${NONEXISTENT_ID}/status`)
      .set(authFor(admin))
      .send({ status: 'sold' });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/listing not found/i);
  });

  it('returns 400 for a malformed listing id (CastError, valid status)', async () => {
    const admin = await createAdmin();
    const res = await api()
      .patch('/api/v1/admin/listings/not-a-mongo-id/status')
      .set(authFor(admin))
      .send({ status: 'sold' });

    expect(res.status).toBe(400);
  });
});
