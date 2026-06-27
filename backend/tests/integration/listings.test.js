import { describe, it, expect, beforeEach } from 'vitest';
import {
  api,
  createUser,
  createAdmin,
  createCategory,
  createListing,
  authFor,
  geoPoint,
} from '../helpers/index.js';
import { Listing } from '../../src/models/Listing.js';
import { Favorite } from '../../src/models/Favorite.js';

const BLR = { latitude: 12.971599, longitude: 77.594566 };
const MAA = { latitude: 13.0827, longitude: 80.2707 };

const validBody = (over = {}) => ({
  title: 'Sony WH-1000XM5',
  description: 'Wireless ANC headphones in great condition with case.',
  price: 22000,
  location: 'Bengaluru',
  status: 'published',
  ...over,
});

describe('POST /listings (create)', () => {
  let seller;
  let category;
  beforeEach(async () => {
    seller = await createUser();
    category = await createCategory();
  });

  it('creates a listing and returns 201', async () => {
    const res = await api()
      .post('/api/v1/listings')
      .set(authFor(seller))
      .send(validBody({ category: category._id.toString() }));
    expect(res.status).toBe(201);
    expect(res.body.data.listing.title).toBe('Sony WH-1000XM5');
    expect(res.body.data.listing.seller).toBe(seller._id.toString());
  });

  it('requires authentication', async () => {
    const res = await api()
      .post('/api/v1/listings')
      .send(validBody({ category: category._id.toString() }));
    expect(res.status).toBe(401);
  });

  it.each([
    ['short title', { title: 'ab' }],
    ['short description', { description: 'too short' }],
    ['missing category', { category: undefined }],
    ['negative price', { price: -5 }],
    ['invalid category id', { category: 'not-a-mongo-id' }],
  ])('rejects %s with 400', async (_label, over) => {
    const body = validBody({ category: category._id.toString(), ...over });
    const res = await api().post('/api/v1/listings').set(authFor(seller)).send(body);
    expect(res.status).toBe(400);
  });

  // ---- GEO / MAP FEATURE ----
  describe('geo coordinates', () => {
    it('stores latitude/longitude as a GeoJSON point ([lng, lat])', async () => {
      const res = await api()
        .post('/api/v1/listings')
        .set(authFor(seller))
        .send(validBody({ category: category._id.toString(), ...BLR }));
      expect(res.status).toBe(201);
      expect(res.body.data.listing.geo).toEqual({
        type: 'Point',
        coordinates: [BLR.longitude, BLR.latitude],
      });
      const inDb = await Listing.findById(res.body.data.listing._id);
      expect(inDb.geo.coordinates).toEqual([BLR.longitude, BLR.latitude]);
    });

    it('creates a listing without coordinates (geo absent)', async () => {
      const res = await api()
        .post('/api/v1/listings')
        .set(authFor(seller))
        .send(validBody({ category: category._id.toString() }));
      expect(res.status).toBe(201);
      expect(res.body.data.listing.geo == null).toBe(true);
    });

    it('rejects latitude without longitude (must be paired)', async () => {
      const res = await api()
        .post('/api/v1/listings')
        .set(authFor(seller))
        .send(validBody({ category: category._id.toString(), latitude: 12.97 }));
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.details)).toMatch(/together/i);
    });

    it('rejects longitude without latitude (must be paired)', async () => {
      const res = await api()
        .post('/api/v1/listings')
        .set(authFor(seller))
        .send(validBody({ category: category._id.toString(), longitude: 77.59 }));
      expect(res.status).toBe(400);
    });

    it.each([
      ['latitude > 90', { latitude: 99, longitude: 77 }],
      ['latitude < -90', { latitude: -99, longitude: 77 }],
      ['longitude > 180', { latitude: 12, longitude: 200 }],
      ['longitude < -180', { latitude: 12, longitude: -200 }],
    ])('rejects out-of-range %s with 400', async (_label, coords) => {
      const res = await api()
        .post('/api/v1/listings')
        .set(authFor(seller))
        .send(validBody({ category: category._id.toString(), ...coords }));
      expect(res.status).toBe(400);
    });
  });
});

describe('GET /listings/:id', () => {
  it('returns a published listing and increments views', async () => {
    const listing = await createListing({ geo: geoPoint(BLR.latitude, BLR.longitude) });
    const res = await api().get(`/api/v1/listings/${listing._id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.listing._id).toBe(listing._id.toString());
    expect(res.body.data.listing.geo.coordinates).toEqual([BLR.longitude, BLR.latitude]);
    expect(res.body.data.isFavorite).toBe(false);

    // views increment is fire-and-forget; allow it to settle
    await new Promise((r) => setTimeout(r, 50));
    const fresh = await Listing.findById(listing._id);
    expect(fresh.views).toBeGreaterThanOrEqual(1);
  });

  it('returns isFavorite=true for an authenticated user who favorited it', async () => {
    const viewer = await createUser();
    const listing = await createListing();
    await Favorite.create({ user: viewer._id, listing: listing._id });
    const res = await api().get(`/api/v1/listings/${listing._id}`).set(authFor(viewer));
    expect(res.body.data.isFavorite).toBe(true);
  });

  it('returns 404 for a non-existent id', async () => {
    const res = await api().get('/api/v1/listings/64b7f9a2f1c2a3b4c5d6e7f8');
    expect(res.status).toBe(404);
  });

  it('returns 400 for a malformed id', async () => {
    const res = await api().get('/api/v1/listings/not-an-id');
    expect(res.status).toBe(400);
  });

  it('hides a disabled listing from non-owners (404) but shows it to the owner', async () => {
    const owner = await createUser();
    const listing = await createListing({ seller: owner, status: 'disabled' });

    const anon = await api().get(`/api/v1/listings/${listing._id}`);
    expect(anon.status).toBe(404);

    const ownerRes = await api().get(`/api/v1/listings/${listing._id}`).set(authFor(owner));
    expect(ownerRes.status).toBe(200);
  });
});

describe('GET /listings (list & filters)', () => {
  it('lists only published listings with pagination meta', async () => {
    const seller = await createUser();
    await createListing({ seller, status: 'published' });
    await createListing({ seller, status: 'draft' });

    const res = await api().get('/api/v1/listings');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.meta).toMatchObject({ page: 1, total: 1 });
  });

  it('orders boosted listings first', async () => {
    const cat = await createCategory();
    await createListing({ category: cat, title: 'Plain', boosted: false });
    const boosted = await createListing({ category: cat, title: 'Boosted', boosted: true });

    const res = await api().get('/api/v1/listings');
    expect(res.body.data.items[0]._id).toBe(boosted._id.toString());
  });

  it('filters by location (case-insensitive regex)', async () => {
    await createListing({ location: 'Bengaluru' });
    await createListing({ location: 'Chennai' });
    const res = await api().get('/api/v1/listings').query({ location: 'chenn' });
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].location).toBe('Chennai');
  });

  it('filters by price range', async () => {
    await createListing({ price: 500 });
    await createListing({ price: 5000 });
    const res = await api().get('/api/v1/listings').query({ minPrice: 1000, maxPrice: 9999 });
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].price).toBe(5000);
  });

  it('sorts by price ascending and descending', async () => {
    const cat = await createCategory();
    await createListing({ category: cat, price: 300 });
    await createListing({ category: cat, price: 900 });

    const asc = await api().get('/api/v1/listings').query({ sort: 'price_asc' });
    expect(asc.body.data.items.map((l) => l.price)).toEqual([300, 900]);

    const desc = await api().get('/api/v1/listings').query({ sort: 'price_desc' });
    expect(desc.body.data.items.map((l) => l.price)).toEqual([900, 300]);
  });

  it('filters by category including descendants', async () => {
    const parent = await createCategory();
    const child = await createCategory({ parent: parent._id });
    await createListing({ category: child, title: 'In child cat' });
    await createListing({ title: 'In unrelated cat' });

    const res = await api().get('/api/v1/listings').query({ category: parent._id.toString() });
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].title).toBe('In child cat');
  });

  it('full-text searches by query term', async () => {
    await createListing({ title: 'Vintage Trumpet', description: 'brass instrument' });
    await createListing({ title: 'Office Chair', description: 'ergonomic seat' });
    const res = await api().get('/api/v1/listings').query({ q: 'trumpet' });
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].title).toBe('Vintage Trumpet');
  });

  it('marks favorited items for an authenticated viewer', async () => {
    const viewer = await createUser();
    const listing = await createListing();
    await Favorite.create({ user: viewer._id, listing: listing._id });
    const res = await api().get('/api/v1/listings').set(authFor(viewer));
    expect(res.body.data.items[0].isFavorite).toBe(true);
  });

  it('rejects an invalid sort value with 400', async () => {
    const res = await api().get('/api/v1/listings').query({ sort: 'cheapest' });
    expect(res.status).toBe(400);
  });
});

describe('GET /listings/mine', () => {
  it('returns the caller listings of any status', async () => {
    const owner = await createUser();
    await createListing({ seller: owner, status: 'published' });
    await createListing({ seller: owner, status: 'draft' });
    await createListing(); // someone else

    const res = await api().get('/api/v1/listings/mine').set(authFor(owner));
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
  });

  it('filters mine by status', async () => {
    const owner = await createUser();
    await createListing({ seller: owner, status: 'published' });
    await createListing({ seller: owner, status: 'draft' });
    const res = await api()
      .get('/api/v1/listings/mine')
      .query({ status: 'draft' })
      .set(authFor(owner));
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].status).toBe('draft');
  });

  it('requires authentication', async () => {
    const res = await api().get('/api/v1/listings/mine');
    expect(res.status).toBe(401);
  });
});

describe('GET /listings/:id/similar', () => {
  it('returns same-category published listings excluding itself', async () => {
    const cat = await createCategory();
    const base = await createListing({ category: cat });
    await createListing({ category: cat });
    await createListing(); // different category

    const res = await api().get(`/api/v1/listings/${base._id}/similar`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0]._id).not.toBe(base._id.toString());
  });

  it('returns 404 for a non-existent listing', async () => {
    const res = await api().get('/api/v1/listings/64b7f9a2f1c2a3b4c5d6e7f8/similar');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /listings/:id (update)', () => {
  it('lets the owner update fields', async () => {
    const owner = await createUser();
    const listing = await createListing({ seller: owner });
    const res = await api()
      .patch(`/api/v1/listings/${listing._id}`)
      .set(authFor(owner))
      .send({ title: 'Updated title', price: 999 });
    expect(res.status).toBe(200);
    expect(res.body.data.listing.title).toBe('Updated title');
    expect(res.body.data.listing.price).toBe(999);
  });

  it('forbids a non-owner from updating (403)', async () => {
    const listing = await createListing();
    const stranger = await createUser();
    const res = await api()
      .patch(`/api/v1/listings/${listing._id}`)
      .set(authFor(stranger))
      .send({ title: 'Hijacked title' });
    expect(res.status).toBe(403);
  });

  it('lets an admin update any listing', async () => {
    const listing = await createListing();
    const admin = await createAdmin();
    const res = await api()
      .patch(`/api/v1/listings/${listing._id}`)
      .set(authFor(admin))
      .send({ title: 'Admin edited title' });
    expect(res.status).toBe(200);
  });

  it('returns 404 when updating a non-existent listing', async () => {
    const owner = await createUser();
    const res = await api()
      .patch('/api/v1/listings/64b7f9a2f1c2a3b4c5d6e7f8')
      .set(authFor(owner))
      .send({ title: 'Whatever title' });
    expect(res.status).toBe(404);
  });

  describe('geo updates', () => {
    it('moves the pin to new coordinates', async () => {
      const owner = await createUser();
      const listing = await createListing({
        seller: owner,
        geo: geoPoint(BLR.latitude, BLR.longitude),
      });
      const res = await api()
        .patch(`/api/v1/listings/${listing._id}`)
        .set(authFor(owner))
        .send({ ...MAA });
      expect(res.status).toBe(200);
      expect(res.body.data.listing.geo.coordinates).toEqual([MAA.longitude, MAA.latitude]);
    });

    it('clears the pin when both coordinates are null and still applies other fields', async () => {
      const owner = await createUser();
      const listing = await createListing({
        seller: owner,
        geo: geoPoint(BLR.latitude, BLR.longitude),
      });
      const res = await api()
        .patch(`/api/v1/listings/${listing._id}`)
        .set(authFor(owner))
        .send({ latitude: null, longitude: null, price: 4321 });
      expect(res.status).toBe(200);
      expect(res.body.data.listing.geo == null).toBe(true);
      expect(res.body.data.listing.price).toBe(4321);
      const inDb = await Listing.findById(listing._id);
      expect(inDb.geo == null).toBe(true);
    });

    it('rejects an out-of-range coordinate on update with 400', async () => {
      const owner = await createUser();
      const listing = await createListing({ seller: owner });
      const res = await api()
        .patch(`/api/v1/listings/${listing._id}`)
        .set(authFor(owner))
        .send({ latitude: 91, longitude: 10 });
      expect(res.status).toBe(400);
    });
  });
});

describe('DELETE /listings/:id', () => {
  it('lets the owner delete a listing', async () => {
    const owner = await createUser();
    const listing = await createListing({ seller: owner });
    const res = await api().delete(`/api/v1/listings/${listing._id}`).set(authFor(owner));
    expect(res.status).toBe(200);
    expect(await Listing.findById(listing._id)).toBeNull();
  });

  it('forbids a non-owner from deleting (403)', async () => {
    const listing = await createListing();
    const stranger = await createUser();
    const res = await api().delete(`/api/v1/listings/${listing._id}`).set(authFor(stranger));
    expect(res.status).toBe(403);
    expect(await Listing.findById(listing._id)).not.toBeNull();
  });

  it('returns 404 for a non-existent listing', async () => {
    const owner = await createUser();
    const res = await api()
      .delete('/api/v1/listings/64b7f9a2f1c2a3b4c5d6e7f8')
      .set(authFor(owner));
    expect(res.status).toBe(404);
  });
});

describe('POST /listings/:id/boost', () => {
  it('toggles the boosted flag on and off', async () => {
    const owner = await createUser();
    const listing = await createListing({ seller: owner, boosted: false });

    const on = await api().post(`/api/v1/listings/${listing._id}/boost`).set(authFor(owner));
    expect(on.status).toBe(200);
    expect(on.body.data.listing.boosted).toBe(true);
    expect(on.body.data.listing.boostExpiresAt).toBeTruthy();

    const off = await api().post(`/api/v1/listings/${listing._id}/boost`).set(authFor(owner));
    expect(off.body.data.listing.boosted).toBe(false);
  });

  it('forbids a non-owner from boosting (403)', async () => {
    const listing = await createListing();
    const stranger = await createUser();
    const res = await api().post(`/api/v1/listings/${listing._id}/boost`).set(authFor(stranger));
    expect(res.status).toBe(403);
  });
});
