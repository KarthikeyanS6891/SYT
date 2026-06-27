import { describe, it, expect } from 'vitest';
import {
  api,
  createUser,
  createListing,
  authFor,
} from '../helpers/index.js';
import { Listing } from '../../src/models/Listing.js';
import { Favorite } from '../../src/models/Favorite.js';

const NONEXISTENT_ID = '64b7f9a2f1c2a3b4c5d6e7f8';

describe('Favorites - auth required', () => {
  it('GET /favorites returns 401 without a token', async () => {
    const res = await api().get('/api/v1/favorites');
    expect(res.status).toBe(401);
  });

  it('POST /favorites/:listingId returns 401 without a token', async () => {
    const listing = await createListing();
    const res = await api().post(`/api/v1/favorites/${listing._id}`);
    expect(res.status).toBe(401);
    // Auth is enforced before any DB write, so nothing is persisted.
    expect(await Favorite.countDocuments({})).toBe(0);
  });

  it('DELETE /favorites/:listingId returns 401 without a token', async () => {
    const listing = await createListing();
    const res = await api().delete(`/api/v1/favorites/${listing._id}`);
    expect(res.status).toBe(401);
  });
});

describe('POST /favorites/:listingId (add)', () => {
  it('adds a favorite and returns 200 with { ok: true }', async () => {
    const user = await createUser();
    const listing = await createListing();

    const res = await api()
      .post(`/api/v1/favorites/${listing._id}`)
      .set(authFor(user));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/added to favorites/i);
    expect(res.body.data).toEqual({ ok: true });

    const favs = await Favorite.find({ user: user._id });
    expect(favs).toHaveLength(1);
    expect(String(favs[0].listing)).toBe(listing._id.toString());
  });

  it('is idempotent: adding the same listing twice keeps a single Favorite doc', async () => {
    const user = await createUser();
    const listing = await createListing();

    const first = await api()
      .post(`/api/v1/favorites/${listing._id}`)
      .set(authFor(user));
    const second = await api()
      .post(`/api/v1/favorites/${listing._id}`)
      .set(authFor(user));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.data).toEqual({ ok: true });

    expect(await Favorite.countDocuments({ user: user._id, listing: listing._id })).toBe(1);
  });

  it('lets two different users favorite the same listing independently', async () => {
    const userA = await createUser();
    const userB = await createUser();
    const listing = await createListing();

    await api().post(`/api/v1/favorites/${listing._id}`).set(authFor(userA));
    await api().post(`/api/v1/favorites/${listing._id}`).set(authFor(userB));

    expect(await Favorite.countDocuments({ listing: listing._id })).toBe(2);
  });

  it('returns 404 when the listing does not exist', async () => {
    const user = await createUser();
    const res = await api()
      .post(`/api/v1/favorites/${NONEXISTENT_ID}`)
      .set(authFor(user));

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/listing not found/i);
    expect(await Favorite.countDocuments({})).toBe(0);
  });

  it('returns 400 for a malformed listingId', async () => {
    const user = await createUser();
    const res = await api()
      .post('/api/v1/favorites/not-a-mongo-id')
      .set(authFor(user));

    expect(res.status).toBe(400);
    // CastError on findById -> errorHandler -> "Invalid _id: not-a-mongo-id"
    expect(res.body.message).toMatch(/invalid/i);
    expect(await Favorite.countDocuments({})).toBe(0);
  });
});

describe('DELETE /favorites/:listingId (remove)', () => {
  it('removes an existing favorite and returns 200', async () => {
    const user = await createUser();
    const listing = await createListing();
    await Favorite.create({ user: user._id, listing: listing._id });

    const res = await api()
      .delete(`/api/v1/favorites/${listing._id}`)
      .set(authFor(user));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/removed from favorites/i);
    expect(res.body.data).toEqual({ ok: true });

    expect(await Favorite.countDocuments({ user: user._id, listing: listing._id })).toBe(0);
  });

  it('returns 200 when removing a listing that is not favorited', async () => {
    const user = await createUser();
    const listing = await createListing();

    const res = await api()
      .delete(`/api/v1/favorites/${listing._id}`)
      .set(authFor(user));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ ok: true });
  });

  it('only removes the caller own favorite, not another user favorite', async () => {
    const owner = await createUser();
    const other = await createUser();
    const listing = await createListing();
    await Favorite.create({ user: owner._id, listing: listing._id });
    await Favorite.create({ user: other._id, listing: listing._id });

    const res = await api()
      .delete(`/api/v1/favorites/${listing._id}`)
      .set(authFor(owner));

    expect(res.status).toBe(200);
    expect(await Favorite.countDocuments({ user: owner._id, listing: listing._id })).toBe(0);
    // The other user's favorite is untouched.
    expect(await Favorite.countDocuments({ user: other._id, listing: listing._id })).toBe(1);
  });
});

describe('GET /favorites (list)', () => {
  it('returns the user favorites with pagination meta', async () => {
    const user = await createUser();
    const listing = await createListing();
    await Favorite.create({ user: user._id, listing: listing._id });

    const res = await api().get('/api/v1/favorites').set(authFor(user));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.meta).toEqual({ page: 1, limit: 12, total: 1, pages: 1 });
  });

  it('each item has isFavorite:true and a favoriteId', async () => {
    const user = await createUser();
    const listing = await createListing();
    const fav = await Favorite.create({ user: user._id, listing: listing._id });

    const res = await api().get('/api/v1/favorites').set(authFor(user));

    expect(res.status).toBe(200);
    const item = res.body.data.items[0];
    expect(item.isFavorite).toBe(true);
    expect(item.favoriteId).toBe(fav._id.toString());
    // The item is the listing JSON merged with the favorite metadata.
    expect(item._id).toBe(listing._id.toString());
    expect(item.title).toBe(listing.title);
  });

  it('only returns the caller favorites, not other users favorites', async () => {
    const user = await createUser();
    const other = await createUser();
    const mine = await createListing();
    const theirs = await createListing();
    await Favorite.create({ user: user._id, listing: mine._id });
    await Favorite.create({ user: other._id, listing: theirs._id });

    const res = await api().get('/api/v1/favorites').set(authFor(user));

    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0]._id).toBe(mine._id.toString());
  });

  it('returns an empty list with zeroed meta when the user has no favorites', async () => {
    const user = await createUser();
    const res = await api().get('/api/v1/favorites').set(authFor(user));

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.meta).toEqual({ page: 1, limit: 12, total: 0, pages: 0 });
  });

  it('honors page & limit query params in the meta', async () => {
    const user = await createUser();
    const a = await createListing();
    const b = await createListing();
    await Favorite.create({ user: user._id, listing: a._id });
    await Favorite.create({ user: user._id, listing: b._id });

    const res = await api()
      .get('/api/v1/favorites')
      .query({ page: 1, limit: 1 })
      .set(authFor(user));

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.meta).toEqual({ page: 1, limit: 1, total: 2, pages: 2 });
  });

  it('caps the limit at 50', async () => {
    const user = await createUser();
    const res = await api()
      .get('/api/v1/favorites')
      .query({ limit: 1000 })
      .set(authFor(user));

    expect(res.status).toBe(200);
    expect(res.body.meta.limit).toBe(50);
  });

  it('excludes a favorite whose listing was deleted from the DB', async () => {
    const user = await createUser();
    const keep = await createListing();
    const gone = await createListing();
    await Favorite.create({ user: user._id, listing: keep._id });
    await Favorite.create({ user: user._id, listing: gone._id });

    // Delete the underlying Listing doc directly, leaving a dangling favorite.
    await Listing.deleteOne({ _id: gone._id });

    const res = await api().get('/api/v1/favorites').set(authFor(user));

    expect(res.status).toBe(200);
    // Only the surviving listing's favorite shows up in items.
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0]._id).toBe(keep._id.toString());
    expect(res.body.data.items.every((i) => i.isFavorite === true)).toBe(true);

    // NOTE (current behavior): total/pages come from countDocuments, which still
    // counts the dangling favorite. So total stays 2 even though items has 1.
    expect(res.body.meta.total).toBe(2);
  });
});
