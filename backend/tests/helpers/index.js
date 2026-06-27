import supertest from 'supertest';
import app from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { Category } from '../../src/models/Category.js';
import { Listing } from '../../src/models/Listing.js';
import { signAccessToken, signRefreshToken } from '../../src/utils/jwt.js';

export { app };

// supertest agent bound to the real Express app (no network listener needed).
export const api = () => supertest(app);

let seq = 0;
const uniq = () => `${Date.now()}_${seq++}`;

/**
 * Create a persisted user. Password is hashed by the model's pre-save hook.
 * Pass `password: null` + a `googleId` for a Google-only account.
 */
export const createUser = (overrides = {}) =>
  User.create({
    name: 'Test User',
    email: `user_${uniq()}@example.com`,
    password: 'password123',
    ...overrides,
  });

export const createAdmin = (overrides = {}) =>
  createUser({ name: 'Admin User', role: 'admin', ...overrides });

const idOf = (docOrId) => (docOrId && docOrId._id ? docOrId._id : docOrId);

/** Mint a valid access token for a user document. */
export const tokenFor = (user) =>
  signAccessToken({ sub: idOf(user).toString(), role: user.role || 'user' });

/** Mint a refresh token (NOT stored on the user unless you push it). */
export const refreshTokenFor = (user) =>
  signRefreshToken({ sub: idOf(user).toString(), role: user.role || 'user' });

/** Authorization header object for supertest `.set(...)`. */
export const authFor = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` });

export const createCategory = (overrides = {}) =>
  Category.create({
    name: `Category ${uniq()}`,
    slug: `category-${uniq()}`,
    icon: '📦',
    ...overrides,
  });

/**
 * Create a published listing. `seller` and `category` accept a doc or an id;
 * if omitted they are created automatically.
 */
export const createListing = async (overrides = {}) => {
  const seller = overrides.seller || (await createUser());
  const category = overrides.category || (await createCategory());
  const { seller: _s, category: _c, ...rest } = overrides;
  return Listing.create({
    seller: idOf(seller),
    title: 'Test listing title',
    description: 'A sufficiently long description for validation purposes.',
    category: idOf(category),
    price: 1000,
    currency: 'INR',
    condition: 'used',
    location: 'Bengaluru',
    status: 'published',
    images: [{ url: 'http://example.com/img.jpg', key: 'img.jpg' }],
    ...rest,
  });
};

/** Convenience GeoJSON point from human-friendly lat/lng. */
export const geoPoint = (lat, lng) => ({ type: 'Point', coordinates: [lng, lat] });
