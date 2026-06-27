import { describe, it, expect } from 'vitest';
import {
  createUser,
  createListing,
  geoPoint,
} from '../helpers/index.js';
import { User } from '../../src/models/User.js';
import { Listing } from '../../src/models/Listing.js';
import { Favorite } from '../../src/models/Favorite.js';
import { Conversation } from '../../src/models/Conversation.js';
import { Message } from '../../src/models/Message.js';

// ---------------------------------------------------------------------------
// User model
// ---------------------------------------------------------------------------
describe('User model', () => {
  it('hashes the password on save (stored value is a bcrypt hash, not plaintext)', async () => {
    // createUser does not select password, so re-fetch with +password.
    const created = await createUser({ password: 'password123' });
    const fresh = await User.findById(created._id).select('+password');
    expect(fresh.password).toBeTruthy();
    expect(fresh.password).not.toBe('password123');
    // bcryptjs hashes start with $2a$ / $2b$ / $2y$
    expect(fresh.password.startsWith('$2')).toBe(true);
    expect(fresh.password.length).toBeGreaterThan(50);
  });

  it('re-hashes only when the password is modified', async () => {
    const created = await createUser({ password: 'password123' });
    const first = await User.findById(created._id).select('+password');
    const firstHash = first.password;

    // Modify an unrelated field; the password should NOT be re-hashed.
    first.name = 'New Name';
    await first.save();
    const afterUnrelated = await User.findById(created._id).select('+password');
    expect(afterUnrelated.password).toBe(firstHash);

    // Now change the password; a new hash should be produced.
    afterUnrelated.password = 'brandnewpass';
    await afterUnrelated.save();
    const afterChange = await User.findById(created._id).select('+password');
    expect(afterChange.password).not.toBe(firstHash);
    expect(afterChange.password.startsWith('$2')).toBe(true);
    expect(await afterChange.comparePassword('brandnewpass')).toBe(true);
  });

  it('comparePassword returns true for correct and false for wrong password', async () => {
    const created = await createUser({ password: 'password123' });
    const fresh = await User.findById(created._id).select('+password');
    expect(await fresh.comparePassword('password123')).toBe(true);
    expect(await fresh.comparePassword('wrongpassword')).toBe(false);
  });

  it('saves a google-only user (password null) and comparePassword resolves false', async () => {
    const user = await User.create({
      name: 'Google User',
      email: `google_${Date.now()}@example.com`,
      password: null,
      googleId: 'g1',
      authProvider: 'google',
    });
    expect(user._id).toBeTruthy();
    expect(user.googleId).toBe('g1');
    expect(user.authProvider).toBe('google');

    const fresh = await User.findById(user._id).select('+password');
    // No password was stored.
    expect(fresh.password == null).toBe(true);
    // comparePassword short-circuits to false when no password is set.
    expect(await fresh.comparePassword('anything')).toBe(false);
    expect(await fresh.comparePassword('')).toBe(false);
  });

  it('toPublicJSON strips password, refreshTokens and __v', async () => {
    const created = await createUser({ password: 'password123' });
    // Load with the normally-hidden fields populated to prove they get stripped.
    const fresh = await User.findById(created._id).select('+password +refreshTokens');
    fresh.refreshTokens = ['rt-1', 'rt-2'];

    const pub = fresh.toPublicJSON();
    expect(pub.password).toBeUndefined();
    expect(pub.refreshTokens).toBeUndefined();
    expect(pub.__v).toBeUndefined();
    // Non-secret fields survive.
    expect(pub.name).toBe('Test User');
    expect(pub.email).toBe(fresh.email);
    expect(pub._id).toBeTruthy();
  });

  it('lowercases and trims email on save', async () => {
    const user = await User.create({
      name: 'Casey',
      email: '  MixedCase@Example.COM  ',
      password: 'password123',
    });
    expect(user.email).toBe('mixedcase@example.com');
  });

  it('throws a duplicate-key error (11000) for a duplicate email', async () => {
    const email = `dup_${Date.now()}@example.com`;
    await User.create({ name: 'A', email, password: 'password123' });
    let err;
    try {
      await User.create({ name: 'B', email, password: 'password123' });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe(11000);
  });

  it('requires a password when there is no googleId (validation error)', async () => {
    let err;
    try {
      await User.create({
        name: 'No Password',
        email: `nopass_${Date.now()}@example.com`,
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.name).toBe('ValidationError');
    expect(err.errors.password).toBeTruthy();
  });

  it('does NOT require a password when googleId is set', async () => {
    const user = await User.create({
      name: 'Has Google',
      email: `hasgoogle_${Date.now()}@example.com`,
      googleId: 'g-no-pass',
      authProvider: 'google',
    });
    expect(user._id).toBeTruthy();
    expect(user.password == null).toBe(true);
  });

  it('enforces the minlength of 6 on a (local) password', async () => {
    let err;
    try {
      await User.create({
        name: 'Shorty',
        email: `short_${Date.now()}@example.com`,
        password: '123',
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.name).toBe('ValidationError');
    expect(err.errors.password).toBeTruthy();
  });

  it('defaults role to "user" and disabled to false', async () => {
    const user = await createUser();
    expect(user.role).toBe('user');
    expect(user.disabled).toBe(false);
    expect(Array.isArray(user.refreshTokens)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Listing model
// ---------------------------------------------------------------------------
describe('Listing model', () => {
  it('saves a valid GeoJSON Point', async () => {
    const listing = await createListing({ geo: geoPoint(12.97, 77.59) });
    expect(listing.geo.type).toBe('Point');
    // geoPoint stores [lng, lat]
    expect(listing.geo.coordinates).toEqual([77.59, 12.97]);

    const inDb = await Listing.findById(listing._id);
    expect(inDb.geo.coordinates).toEqual([77.59, 12.97]);
  });

  it('rejects out-of-range coordinates ([200, 0]) with a ValidationError', async () => {
    let err;
    try {
      await createListing({ geo: { type: 'Point', coordinates: [200, 0] } });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.name).toBe('ValidationError');
  });

  it('rejects coordinates of the wrong length ([1]) with a ValidationError', async () => {
    let err;
    try {
      await createListing({ geo: { type: 'Point', coordinates: [1] } });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.name).toBe('ValidationError');
  });

  it('rejects a non-"Point" geo type with a ValidationError', async () => {
    let err;
    try {
      await createListing({ geo: { type: 'Polygon', coordinates: [77.59, 12.97] } });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.name).toBe('ValidationError');
  });

  it('rejects an out-of-range latitude ([0, 200]) with a ValidationError', async () => {
    let err;
    try {
      await createListing({ geo: { type: 'Point', coordinates: [0, 200] } });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.name).toBe('ValidationError');
  });

  describe('isBoostActive virtual', () => {
    it('is false when boosted is false', async () => {
      const listing = await createListing({ boosted: false });
      expect(listing.isBoostActive).toBe(false);
    });

    it('is true when boosted with no boostExpiresAt', async () => {
      const listing = await createListing({ boosted: true });
      expect(listing.boostExpiresAt == null).toBe(true);
      expect(listing.isBoostActive).toBe(true);
    });

    it('is true when boosted with a future boostExpiresAt', async () => {
      const future = new Date(Date.now() + 60 * 60 * 1000);
      const listing = await createListing({ boosted: true, boostExpiresAt: future });
      expect(listing.isBoostActive).toBe(true);
    });

    it('is false when boosted with a PAST boostExpiresAt', async () => {
      const past = new Date(Date.now() - 60 * 60 * 1000);
      const listing = await createListing({ boosted: true, boostExpiresAt: past });
      expect(listing.isBoostActive).toBe(false);
    });

    it('includes isBoostActive in toJSON output', async () => {
      const listing = await createListing({ boosted: true });
      const json = listing.toJSON();
      expect(json).toHaveProperty('isBoostActive');
      expect(json.isBoostActive).toBe(true);
    });
  });

  it('defaults status to "draft", currency to "INR" and condition to "used" via direct model create', async () => {
    // createListing forces status:'published'; build a bare doc to see defaults.
    const seller = await createUser();
    const listing = await createListing({
      seller,
      status: undefined,
      currency: undefined,
      condition: undefined,
    });
    expect(listing.status).toBe('draft');
    expect(listing.currency).toBe('INR');
    expect(listing.condition).toBe('used');
  });

  it('rejects a negative price with a ValidationError', async () => {
    let err;
    try {
      await createListing({ price: -1 });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.name).toBe('ValidationError');
    expect(err.errors.price).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Favorite model
// ---------------------------------------------------------------------------
describe('Favorite model', () => {
  it('requires both user and listing', async () => {
    let err;
    try {
      await Favorite.create({});
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.name).toBe('ValidationError');
    expect(err.errors.user).toBeTruthy();
    expect(err.errors.listing).toBeTruthy();
  });

  it('requires a listing when only user is given', async () => {
    const user = await createUser();
    let err;
    try {
      await Favorite.create({ user: user._id });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.name).toBe('ValidationError');
    expect(err.errors.listing).toBeTruthy();
  });

  it('throws a duplicate-key error (11000) for the same user+listing pair', async () => {
    const user = await createUser();
    const listing = await createListing();
    await Favorite.create({ user: user._id, listing: listing._id });

    let err;
    try {
      await Favorite.create({ user: user._id, listing: listing._id });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe(11000);
  });

  it('allows the same user to favorite two different listings', async () => {
    const user = await createUser();
    const a = await createListing();
    const b = await createListing();
    await Favorite.create({ user: user._id, listing: a._id });
    const second = await Favorite.create({ user: user._id, listing: b._id });
    expect(second._id).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Conversation model
// ---------------------------------------------------------------------------
describe('Conversation model', () => {
  it('throws a duplicate-key error (11000) for the same participants + listing', async () => {
    const userA = await createUser();
    const userB = await createUser();
    const listing = await createListing();

    await Conversation.create({
      listing: listing._id,
      participants: [userA._id, userB._id],
    });

    let err;
    try {
      await Conversation.create({
        listing: listing._id,
        participants: [userA._id, userB._id],
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe(11000);
  });

  it('requires a listing', async () => {
    const userA = await createUser();
    const userB = await createUser();
    let err;
    try {
      await Conversation.create({ participants: [userA._id, userB._id] });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.name).toBe('ValidationError');
    expect(err.errors.listing).toBeTruthy();
  });

  it('allows the same participants for a different listing', async () => {
    const userA = await createUser();
    const userB = await createUser();
    const listingA = await createListing();
    const listingB = await createListing();

    await Conversation.create({
      listing: listingA._id,
      participants: [userA._id, userB._id],
    });
    const second = await Conversation.create({
      listing: listingB._id,
      participants: [userA._id, userB._id],
    });
    expect(second._id).toBeTruthy();
    // Defaults applied.
    expect(second.lastMessage).toBeNull();
    expect(second.lastMessageAt instanceof Date).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Message model
// ---------------------------------------------------------------------------
describe('Message model', () => {
  const setup = async () => {
    const userA = await createUser();
    const userB = await createUser();
    const listing = await createListing();
    const conversation = await Conversation.create({
      listing: listing._id,
      participants: [userA._id, userB._id],
    });
    return { sender: userA, conversation };
  };

  it('requires a body', async () => {
    const { sender, conversation } = await setup();
    let err;
    try {
      await Message.create({ conversation: conversation._id, sender: sender._id });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.name).toBe('ValidationError');
    expect(err.errors.body).toBeTruthy();
  });

  it('rejects a body longer than 2000 chars with a ValidationError', async () => {
    const { sender, conversation } = await setup();
    let err;
    try {
      await Message.create({
        conversation: conversation._id,
        sender: sender._id,
        body: 'x'.repeat(2001),
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.name).toBe('ValidationError');
    expect(err.errors.body).toBeTruthy();
  });

  it('accepts a body of exactly 2000 chars', async () => {
    const { sender, conversation } = await setup();
    const msg = await Message.create({
      conversation: conversation._id,
      sender: sender._id,
      body: 'x'.repeat(2000),
    });
    expect(msg._id).toBeTruthy();
    expect(msg.body).toHaveLength(2000);
    expect(Array.isArray(msg.readBy)).toBe(true);
  });

  it('requires a conversation and sender', async () => {
    let err;
    try {
      await Message.create({ body: 'hello there' });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.name).toBe('ValidationError');
    expect(err.errors.conversation).toBeTruthy();
    expect(err.errors.sender).toBeTruthy();
  });
});
