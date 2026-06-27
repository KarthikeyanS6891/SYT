import { describe, it, expect } from 'vitest';
import {
  api,
  createCategory,
  createListing,
} from '../helpers/index.js';

const suggest = (query = {}) => api().get('/api/v1/search/suggest').query(query);

describe('GET /search/suggest', () => {
  describe('short / empty terms', () => {
    it('returns empty result for a term shorter than 2 chars', async () => {
      // Seed data that *would* match so we know the short-circuit is what empties it.
      await createCategory({ name: 'Apple', slug: 'apple' });
      await createListing({ title: 'Apple thing', status: 'published' });

      const res = await suggest({ q: 'a' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({ categories: [], listings: [], total: 0 });
    });

    it('treats a missing q as empty (length < 2) and returns empty result', async () => {
      await createCategory({ name: 'Apple', slug: 'apple' });
      const res = await suggest({});
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ categories: [], listings: [], total: 0 });
    });

    it('treats a whitespace-only q as empty after trim', async () => {
      const res = await suggest({ q: '   ' });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ categories: [], listings: [], total: 0 });
    });

    it('accepts exactly 2 chars (boundary) without short-circuiting', async () => {
      await createCategory({ name: 'Apple', slug: 'apple' });
      const res = await suggest({ q: 'ap' });
      expect(res.status).toBe(200);
      expect(res.body.data.categories.map((c) => c.name)).toContain('Apple');
      expect(res.body.data.total).toBe(1);
    });
  });

  describe('category matching', () => {
    it('matches a category by name (case-insensitive)', async () => {
      await createCategory({ name: 'Electronics', slug: 'electronics' });
      await createCategory({ name: 'Furniture', slug: 'furniture' });

      const res = await suggest({ q: 'ELECTRO' });
      expect(res.status).toBe(200);
      expect(res.body.data.categories).toHaveLength(1);
      expect(res.body.data.categories[0].name).toBe('Electronics');
      // listings array key is always present
      expect(res.body.data.listings).toEqual([]);
    });

    it('matches a category by slug (case-insensitive)', async () => {
      // name deliberately does NOT contain the term; only the slug does.
      await createCategory({ name: 'Mobiles', slug: 'smartphones' });

      const res = await suggest({ q: 'SMARTphone' });
      expect(res.status).toBe(200);
      expect(res.body.data.categories).toHaveLength(1);
      expect(res.body.data.categories[0].slug).toBe('smartphones');
    });
  });

  describe('listing matching', () => {
    it('matches published listings by title', async () => {
      await createListing({ title: 'Vintage Trumpet', status: 'published' });
      await createListing({ title: 'Office Chair', status: 'published' });

      const res = await suggest({ q: 'trumpet' });
      expect(res.status).toBe(200);
      expect(res.body.data.listings).toHaveLength(1);
      expect(res.body.data.listings[0].title).toBe('Vintage Trumpet');
    });

    it('does NOT return a draft listing whose title matches', async () => {
      await createListing({ title: 'Rare Guitar', status: 'published' });
      await createListing({ title: 'Rare Guitar', status: 'draft' });

      const res = await suggest({ q: 'guitar' });
      expect(res.status).toBe(200);
      expect(res.body.data.listings).toHaveLength(1);
      // The single returned one must be the published doc.
      expect(res.body.data.listings).toHaveLength(1);
    });

    it('does NOT match listings by description (title only)', async () => {
      await createListing({
        title: 'Office Chair',
        description: 'A vintage trumpet styled brass colored chair indeed.',
        status: 'published',
      });

      const res = await suggest({ q: 'trumpet' });
      expect(res.status).toBe(200);
      expect(res.body.data.listings).toHaveLength(0);
    });

    it('returns a curated set of listing fields and populates category', async () => {
      const category = await createCategory({ name: 'Music', slug: 'music' });
      await createListing({
        title: 'Yamaha Keyboard',
        category,
        price: 15000,
        currency: 'INR',
        location: 'Bengaluru',
        status: 'published',
      });

      const res = await suggest({ q: 'yamaha' });
      expect(res.status).toBe(200);
      expect(res.body.data.listings).toHaveLength(1);
      const listing = res.body.data.listings[0];
      expect(listing.title).toBe('Yamaha Keyboard');
      expect(listing.price).toBe(15000);
      expect(listing.currency).toBe('INR');
      expect(listing.location).toBe('Bengaluru');
      // category is populated down to name/slug only
      expect(listing.category).toMatchObject({ name: 'Music', slug: 'music' });
      // description is NOT selected
      expect(listing.description).toBeUndefined();
    });
  });

  describe('total', () => {
    it('total === categories.length + listings.length', async () => {
      await createCategory({ name: 'Camera Gear', slug: 'camera-gear' });
      await createCategory({ name: 'Camera Bags', slug: 'camera-bags' });
      await createListing({ title: 'Camera Tripod', status: 'published' });

      const res = await suggest({ q: 'camera' });
      expect(res.status).toBe(200);
      const { categories, listings, total } = res.body.data;
      expect(categories.length).toBe(2);
      expect(listings.length).toBe(1);
      expect(total).toBe(categories.length + listings.length);
      expect(total).toBe(3);
    });

    it('returns zeros when nothing matches', async () => {
      await createCategory({ name: 'Books', slug: 'books' });
      await createListing({ title: 'Notebook', status: 'published' });

      const res = await suggest({ q: 'zzzznomatch' });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ categories: [], listings: [], total: 0 });
    });
  });

  describe('limit', () => {
    it('defaults to 6 results per collection when no limit is given', async () => {
      // 8 matching published listings; default limit should cap at 6.
      const category = await createCategory({ name: 'Widgets', slug: 'widgets' });
      for (let i = 0; i < 8; i += 1) {
        await createListing({ title: `Gadget number ${i}`, category, status: 'published' });
      }

      const res = await suggest({ q: 'gadget' });
      expect(res.status).toBe(200);
      expect(res.body.data.listings).toHaveLength(6);
    });

    it('honors an explicit limit below the default', async () => {
      const category = await createCategory({ name: 'Gizmos', slug: 'gizmos' });
      for (let i = 0; i < 5; i += 1) {
        await createListing({ title: `Doohickey ${i}`, category, status: 'published' });
      }

      const res = await suggest({ q: 'doohickey', limit: 2 });
      expect(res.status).toBe(200);
      expect(res.body.data.listings).toHaveLength(2);
    });

    it('caps the limit at 12 even when a larger value is requested', async () => {
      const category = await createCategory({ name: 'Trinkets', slug: 'trinkets' });
      for (let i = 0; i < 15; i += 1) {
        await createListing({ title: `Bauble item ${i}`, category, status: 'published' });
      }

      const res = await suggest({ q: 'bauble', limit: 50 });
      expect(res.status).toBe(200);
      // Math.min(Number(limit) || 6, 12) => 12
      expect(res.body.data.listings).toHaveLength(12);
    });

    it('falls back to the default limit (6) for a non-numeric limit', async () => {
      const category = await createCategory({ name: 'Sundries', slug: 'sundries' });
      for (let i = 0; i < 8; i += 1) {
        await createListing({ title: `Knickknack ${i}`, category, status: 'published' });
      }

      // Number('abc') || 6 => 6
      const res = await suggest({ q: 'knickknack', limit: 'abc' });
      expect(res.status).toBe(200);
      expect(res.body.data.listings).toHaveLength(6);
    });
  });

  describe('regex special characters (escapeRegex)', () => {
    it.each([
      ['a+b'],
      ['c('],
      ['foo)'],
      ['x*y'],
      ['a[b'],
      ['back\\slash'],
    ])('does not crash and returns 200 for query %j', async (q) => {
      // Seed something harmless so the query path runs against real data.
      await createCategory({ name: 'Harmless Category', slug: 'harmless-category' });
      await createListing({ title: 'Harmless listing here', status: 'published' });

      const res = await suggest({ q });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('categories');
      expect(res.body.data).toHaveProperty('listings');
      expect(typeof res.body.data.total).toBe('number');
    });

    it('treats a special char literally (does not act as a regex operator)', async () => {
      // "a+b" as a literal must match a category literally containing "a+b",
      // and must NOT match plain "ab" (which an unescaped a+b regex would).
      await createCategory({ name: 'C a+b D', slug: 'c-a-plus-b-d' });
      await createCategory({ name: 'aaab', slug: 'aaab' });

      const res = await suggest({ q: 'a+b' });
      expect(res.status).toBe(200);
      const names = res.body.data.categories.map((c) => c.name);
      expect(names).toContain('C a+b D');
      expect(names).not.toContain('aaab');
    });
  });

  describe('multi-token / OR matching', () => {
    it('matches any token (tokens are OR-joined)', async () => {
      await createCategory({ name: 'Red Bicycle', slug: 'red-bicycle' });
      await createCategory({ name: 'Green Helmet', slug: 'green-helmet' });
      await createCategory({ name: 'Blue Kettle', slug: 'blue-kettle' });

      // "bicycle helmet" => matches Red Bicycle OR Green Helmet, not Blue Kettle.
      const res = await suggest({ q: 'bicycle helmet' });
      expect(res.status).toBe(200);
      const names = res.body.data.categories.map((c) => c.name).sort();
      expect(names).toEqual(['Green Helmet', 'Red Bicycle']);
    });
  });
});
