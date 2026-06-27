import { describe, it, expect } from 'vitest';
import {
  api,
  createUser,
  createAdmin,
  createCategory,
  authFor,
} from '../helpers/index.js';
import { Category } from '../../src/models/Category.js';

const NON_EXISTENT_ID = '64b7f9a2f1c2a3b4c5d6e7f8';

const newCategoryBody = (over = {}) => ({
  name: `Electronics ${Date.now()}_${Math.random().toString(36).slice(2)}`,
  slug: `electronics-${Date.now()}_${Math.random().toString(36).slice(2)}`,
  ...over,
});

describe('GET /categories (public list)', () => {
  it('returns an empty list when there are no categories', async () => {
    const res = await api().get('/api/v1/categories');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toEqual([]);
  });

  it('does not require authentication', async () => {
    await createCategory();
    const res = await api().get('/api/v1/categories');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
  });

  it('returns categories sorted by order then name', async () => {
    // Insert deliberately out of final order to prove the sort runs.
    await createCategory({ name: 'Zeta', slug: 'zeta', order: 2 });
    await createCategory({ name: 'Beta', slug: 'beta', order: 1 });
    await createCategory({ name: 'Charlie', slug: 'charlie', order: 1 });
    await createCategory({ name: 'Alpha', slug: 'alpha', order: 1 });

    const res = await api().get('/api/v1/categories');
    expect(res.status).toBe(200);
    // order 1 group first (sorted by name), then order 2.
    expect(res.body.data.items.map((c) => c.name)).toEqual([
      'Alpha',
      'Beta',
      'Charlie',
      'Zeta',
    ]);
  });

  it('breaks ties on equal order by name alphabetically', async () => {
    await createCategory({ name: 'Mango', slug: 'mango', order: 0 });
    await createCategory({ name: 'Apple', slug: 'apple', order: 0 });

    const res = await api().get('/api/v1/categories');
    expect(res.body.data.items.map((c) => c.name)).toEqual(['Apple', 'Mango']);
  });
});

describe('POST /categories (create)', () => {
  it('lets an admin create a category and returns 201 with the category', async () => {
    const admin = await createAdmin();
    const body = newCategoryBody({ icon: '💻', order: 3 });
    const res = await api().post('/api/v1/categories').set(authFor(admin)).send(body);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Created');
    expect(res.body.data.category.name).toBe(body.name);
    expect(res.body.data.category.slug).toBe(body.slug);
    expect(res.body.data.category.icon).toBe('💻');
    expect(res.body.data.category.order).toBe(3);
    expect(res.body.data.category._id).toBeTruthy();

    const inDb = await Category.findById(res.body.data.category._id);
    expect(inDb).not.toBeNull();
    expect(inDb.name).toBe(body.name);
  });

  it('lowercases the slug (model setter)', async () => {
    const admin = await createAdmin();
    const res = await api()
      .post('/api/v1/categories')
      .set(authFor(admin))
      .send(newCategoryBody({ slug: 'MixedCaseSlug' }));
    expect(res.status).toBe(201);
    expect(res.body.data.category.slug).toBe('mixedcaseslug');
  });

  it('accepts a parent id to create a child category', async () => {
    const admin = await createAdmin();
    const parent = await createCategory();
    const res = await api()
      .post('/api/v1/categories')
      .set(authFor(admin))
      .send(newCategoryBody({ parent: parent._id.toString() }));
    expect(res.status).toBe(201);
    expect(res.body.data.category.parent).toBe(parent._id.toString());
  });

  it('forbids a normal authenticated user with 403', async () => {
    const user = await createUser();
    const res = await api()
      .post('/api/v1/categories')
      .set(authFor(user))
      .send(newCategoryBody());
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/admin only/i);
    expect(await Category.countDocuments()).toBe(0);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await api().post('/api/v1/categories').send(newCategoryBody());
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/token missing/i);
    expect(await Category.countDocuments()).toBe(0);
  });

  it('rejects a missing name with 400', async () => {
    const admin = await createAdmin();
    const res = await api()
      .post('/api/v1/categories')
      .set(authFor(admin))
      .send({ slug: 'no-name-here' });
    expect(res.status).toBe(400);
    // Controller does its own guard, not express-validator.
    expect(res.body.message).toMatch(/name and slug required/i);
  });

  it('rejects a missing slug with 400', async () => {
    const admin = await createAdmin();
    const res = await api()
      .post('/api/v1/categories')
      .set(authFor(admin))
      .send({ name: 'No Slug Here' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/name and slug required/i);
  });

  it('rejects a duplicate slug with 409', async () => {
    const admin = await createAdmin();
    const existing = await createCategory({ slug: 'dup-slug' });
    const res = await api()
      .post('/api/v1/categories')
      .set(authFor(admin))
      // unique name, colliding slug -> slug duplicate key
      .send(newCategoryBody({ slug: existing.slug }));
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/duplicate value for field/i);
  });

  it('rejects a duplicate name with 409', async () => {
    const admin = await createAdmin();
    const existing = await createCategory({ name: 'Unique Name Here' });
    const res = await api()
      .post('/api/v1/categories')
      .set(authFor(admin))
      // unique slug, colliding name -> name duplicate key
      .send(newCategoryBody({ name: existing.name }));
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/duplicate value for field/i);
  });
});

describe('PATCH /categories/:id (update)', () => {
  it('lets an admin update a category and returns 200', async () => {
    const admin = await createAdmin();
    const cat = await createCategory({ name: 'Old Name', order: 0 });
    const res = await api()
      .patch(`/api/v1/categories/${cat._id}`)
      .set(authFor(admin))
      .send({ name: 'New Name', order: 7 });

    expect(res.status).toBe(200);
    expect(res.body.data.category.name).toBe('New Name');
    expect(res.body.data.category.order).toBe(7);

    const inDb = await Category.findById(cat._id);
    expect(inDb.name).toBe('New Name');
    expect(inDb.order).toBe(7);
  });

  it('returns 404 for a non-existent id', async () => {
    const admin = await createAdmin();
    const res = await api()
      .patch(`/api/v1/categories/${NON_EXISTENT_ID}`)
      .set(authFor(admin))
      .send({ name: 'Whatever' });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/category not found/i);
  });

  it('forbids a non-admin from updating with 403', async () => {
    const user = await createUser();
    const cat = await createCategory({ name: 'Untouched' });
    const res = await api()
      .patch(`/api/v1/categories/${cat._id}`)
      .set(authFor(user))
      .send({ name: 'Hijacked' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/admin only/i);

    const inDb = await Category.findById(cat._id);
    expect(inDb.name).toBe('Untouched');
  });

  it('rejects an unauthenticated update with 401', async () => {
    const cat = await createCategory();
    const res = await api()
      .patch(`/api/v1/categories/${cat._id}`)
      .send({ name: 'No Auth' });
    expect(res.status).toBe(401);
  });

  it('returns 400 for a malformed (non-ObjectId) id', async () => {
    const admin = await createAdmin();
    const res = await api()
      .patch('/api/v1/categories/not-a-valid-id')
      .set(authFor(admin))
      .send({ name: 'Whatever' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /categories/:id', () => {
  it('lets an admin delete a category and returns 200', async () => {
    const admin = await createAdmin();
    const cat = await createCategory();
    const res = await api()
      .delete(`/api/v1/categories/${cat._id}`)
      .set(authFor(admin));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Deleted');
    expect(res.body.data.ok).toBe(true);
    expect(await Category.findById(cat._id)).toBeNull();
  });

  it('returns 404 for a non-existent id', async () => {
    const admin = await createAdmin();
    const res = await api()
      .delete(`/api/v1/categories/${NON_EXISTENT_ID}`)
      .set(authFor(admin));
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/category not found/i);
  });

  it('forbids a non-admin from deleting with 403', async () => {
    const user = await createUser();
    const cat = await createCategory();
    const res = await api()
      .delete(`/api/v1/categories/${cat._id}`)
      .set(authFor(user));
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/admin only/i);
    expect(await Category.findById(cat._id)).not.toBeNull();
  });

  it('rejects an unauthenticated delete with 401', async () => {
    const cat = await createCategory();
    const res = await api().delete(`/api/v1/categories/${cat._id}`);
    expect(res.status).toBe(401);
    expect(await Category.findById(cat._id)).not.toBeNull();
  });

  it('returns 400 for a malformed (non-ObjectId) id', async () => {
    const admin = await createAdmin();
    const res = await api()
      .delete('/api/v1/categories/not-a-valid-id')
      .set(authFor(admin));
    expect(res.status).toBe(400);
  });
});
