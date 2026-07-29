import { describe, it, expect } from 'vitest';
import {
  createUser,
  createCategory,
  createListing,
} from '../helpers/index.js';
import { userRepository } from '../../src/repositories/userRepository.js';
import { favoriteRepository } from '../../src/repositories/favoriteRepository.js';
import {
  conversationRepository,
  messageRepository,
} from '../../src/repositories/messageRepository.js';
import { listingRepository } from '../../src/repositories/listingRepository.js';
import { User } from '../../src/models/User.js';
import { Favorite } from '../../src/models/Favorite.js';
import { Conversation } from '../../src/models/Conversation.js';
import { Message } from '../../src/models/Message.js';
import { Listing } from '../../src/models/Listing.js';

// ---------------------------------------------------------------------------
// userRepository
// ---------------------------------------------------------------------------
describe('userRepository', () => {
  it('create() persists a user and findById() returns it', async () => {
    const created = await userRepository.create({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'password123',
    });
    expect(created._id).toBeTruthy();
    expect(created.name).toBe('Alice');

    const found = await userRepository.findById(created._id);
    expect(found).not.toBeNull();
    expect(found._id.toString()).toBe(created._id.toString());
    expect(found.email).toBe('alice@example.com');
  });

  it('findByEmail() without options hides password and refreshTokens (select:false)', async () => {
    await userRepository.create({
      name: 'Bob',
      email: 'bob@example.com',
      password: 'password123',
    });
    const user = await userRepository.findByEmail('bob@example.com');
    expect(user).not.toBeNull();
    expect(user.password).toBeUndefined();
    expect(user.refreshTokens).toBeUndefined();
  });

  it('findByEmail(email, { withPassword: true }) returns password (hashed) and refreshTokens', async () => {
    const created = await userRepository.create({
      name: 'Carol',
      email: 'carol@example.com',
      password: 'password123',
    });
    await userRepository.pushRefreshToken(created._id, 'rt-1');

    const user = await userRepository.findByEmail('carol@example.com', {
      withPassword: true,
    });
    expect(user.password).toBeTruthy();
    // password is bcrypt-hashed by the pre-save hook, not the plaintext
    expect(user.password).not.toBe('password123');
    expect(Array.isArray(user.refreshTokens)).toBe(true);
    expect(user.refreshTokens).toContain('rt-1');
  });

  it('findByGoogleId() finds a Google account', async () => {
    const created = await userRepository.create({
      name: 'Greg',
      email: 'greg@example.com',
      password: null,
      googleId: 'google-xyz-123',
      authProvider: 'google',
    });
    const found = await userRepository.findByGoogleId('google-xyz-123');
    expect(found).not.toBeNull();
    expect(found._id.toString()).toBe(created._id.toString());

    const missing = await userRepository.findByGoogleId('does-not-exist');
    expect(missing).toBeNull();
  });

  it('updateById() applies the update and returns the new doc', async () => {
    const user = await createUser({ name: 'Old Name' });
    const updated = await userRepository.updateById(user._id, { name: 'New Name' });
    expect(updated.name).toBe('New Name');

    const fresh = await User.findById(user._id);
    expect(fresh.name).toBe('New Name');
  });

  it('pushRefreshToken / pullRefreshToken / setRefreshTokens mutate the stored array', async () => {
    const user = await createUser();
    const readTokens = async () => {
      const doc = await User.findById(user._id).select('+refreshTokens');
      return doc.refreshTokens;
    };

    // initially empty
    expect(await readTokens()).toEqual([]);

    await userRepository.pushRefreshToken(user._id, 'token-a');
    await userRepository.pushRefreshToken(user._id, 'token-b');
    expect(await readTokens()).toEqual(['token-a', 'token-b']);

    await userRepository.pullRefreshToken(user._id, 'token-a');
    expect(await readTokens()).toEqual(['token-b']);

    await userRepository.setRefreshTokens(user._id, []);
    expect(await readTokens()).toEqual([]);
  });

  it('list() with no q returns all users sorted by createdAt desc plus a total count', async () => {
    const u1 = await userRepository.create({
      name: 'First',
      email: 'first@example.com',
      password: 'password123',
      createdAt: new Date('2020-01-01'),
    });
    const u2 = await userRepository.create({
      name: 'Second',
      email: 'second@example.com',
      password: 'password123',
      createdAt: new Date('2021-01-01'),
    });
    const u3 = await userRepository.create({
      name: 'Third',
      email: 'third@example.com',
      password: 'password123',
      createdAt: new Date('2022-01-01'),
    });

    const [items, total] = await userRepository.list();
    expect(total).toBe(3);
    expect(items.map((u) => u._id.toString())).toEqual([
      u3._id.toString(),
      u2._id.toString(),
      u1._id.toString(),
    ]);
  });

  it('list({ q }) filters by name OR email via case-insensitive regex', async () => {
    await userRepository.create({
      name: 'Zoe Zebra',
      email: 'zoe@example.com',
      password: 'password123',
    });
    await userRepository.create({
      name: 'Quentin',
      email: 'special-needle@mailbox.com',
      password: 'password123',
    });
    await userRepository.create({
      name: 'Ignore Me',
      email: 'nope@elsewhere.com',
      password: 'password123',
    });

    // matches by name (case-insensitive)
    const [byName, nameTotal] = await userRepository.list({ q: 'zebra' });
    expect(nameTotal).toBe(1);
    expect(byName[0].name).toBe('Zoe Zebra');

    // matches by email
    const [byEmail, emailTotal] = await userRepository.list({ q: 'needle' });
    expect(emailTotal).toBe(1);
    expect(byEmail[0].email).toBe('special-needle@mailbox.com');

    // regex metacharacters in q are escaped, not interpreted
    const [byMeta, metaTotal] = await userRepository.list({ q: '.*' });
    expect(metaTotal).toBe(0);
    expect(byMeta).toHaveLength(0);
  });

  it('list({ page, limit }) paginates with skip/limit', async () => {
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await userRepository.create({
        name: `User ${i}`,
        email: `paginate_${i}@example.com`,
        password: 'password123',
        createdAt: new Date(2020, 0, i + 1),
      });
    }

    const [page1, total1] = await userRepository.list({ page: 1, limit: 2 });
    const [page2, total2] = await userRepository.list({ page: 2, limit: 2 });
    const [page3, total3] = await userRepository.list({ page: 3, limit: 2 });

    expect(total1).toBe(5);
    expect(total2).toBe(5);
    expect(total3).toBe(5);
    expect(page1).toHaveLength(2);
    expect(page2).toHaveLength(2);
    expect(page3).toHaveLength(1);

    // no overlap across pages
    const ids = [...page1, ...page2, ...page3].map((u) => u._id.toString());
    expect(new Set(ids).size).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// favoriteRepository
// ---------------------------------------------------------------------------
describe('favoriteRepository', () => {
  it('add() is an idempotent upsert (calling twice yields one doc)', async () => {
    const user = await createUser();
    const listing = await createListing();

    const first = await favoriteRepository.add(user._id, listing._id);
    const second = await favoriteRepository.add(user._id, listing._id);

    expect(first._id.toString()).toBe(second._id.toString());
    const count = await Favorite.countDocuments({ user: user._id, listing: listing._id });
    expect(count).toBe(1);
  });

  it('remove() deletes the favorite', async () => {
    const user = await createUser();
    const listing = await createListing();
    await favoriteRepository.add(user._id, listing._id);

    const removed = await favoriteRepository.remove(user._id, listing._id);
    expect(removed).not.toBeNull();
    expect(removed.listing.toString()).toBe(listing._id.toString());
    expect(await Favorite.countDocuments({ user: user._id })).toBe(0);
  });

  it('exists() returns true then false', async () => {
    const user = await createUser();
    const listing = await createListing();

    expect(await favoriteRepository.exists(user._id, listing._id)).toBe(false);
    await favoriteRepository.add(user._id, listing._id);
    expect(await favoriteRepository.exists(user._id, listing._id)).toBe(true);
    await favoriteRepository.remove(user._id, listing._id);
    expect(await favoriteRepository.exists(user._id, listing._id)).toBe(false);
  });

  it('listByUser() returns paginated shape with populated listing', async () => {
    const user = await createUser();
    const l1 = await createListing();
    const l2 = await createListing();
    await favoriteRepository.add(user._id, l1._id);
    await favoriteRepository.add(user._id, l2._id);

    const result = await favoriteRepository.listByUser({ user: user._id, page: 1, limit: 12 });
    expect(result).toMatchObject({ total: 2, page: 1, limit: 12, pages: 1 });
    expect(result.items).toHaveLength(2);
    // listing is populated (a document with a title), plus nested seller/category
    const populated = result.items[0].listing;
    expect(populated.title).toBeTruthy();
    expect(populated.seller).toBeTruthy();
    expect(populated.seller.name).toBeTruthy();
    expect(populated.category).toBeTruthy();
    expect(populated.category.slug).toBeTruthy();
  });

  it('listByUser() paginates and computes pages with Math.ceil', async () => {
    const user = await createUser();
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const listing = await createListing();
      // eslint-disable-next-line no-await-in-loop
      await favoriteRepository.add(user._id, listing._id);
    }

    const result = await favoriteRepository.listByUser({ user: user._id, page: 1, limit: 2 });
    expect(result.total).toBe(3);
    expect(result.pages).toBe(2); // ceil(3/2)
    expect(result.items).toHaveLength(2);
  });

  it('listingIdsByUser() returns an array of string ids', async () => {
    const user = await createUser();
    const l1 = await createListing();
    const l2 = await createListing();
    await favoriteRepository.add(user._id, l1._id);
    await favoriteRepository.add(user._id, l2._id);

    const ids = await favoriteRepository.listingIdsByUser(user._id);
    expect(Array.isArray(ids)).toBe(true);
    expect(ids).toHaveLength(2);
    ids.forEach((id) => expect(typeof id).toBe('string'));
    expect(ids.sort()).toEqual([l1._id.toString(), l2._id.toString()].sort());
  });

  it('listingIdsByUser() returns an empty array when the user has no favorites', async () => {
    const user = await createUser();
    expect(await favoriteRepository.listingIdsByUser(user._id)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// conversationRepository & messageRepository
// ---------------------------------------------------------------------------
describe('conversationRepository', () => {
  it('create() persists a conversation', async () => {
    const a = await createUser();
    const b = await createUser();
    const listing = await createListing({ seller: a });

    const convo = await conversationRepository.create({
      listing: listing._id,
      participants: [a._id, b._id],
    });
    expect(convo._id).toBeTruthy();
    expect(convo.participants).toHaveLength(2);
  });

  it('findByListingAndUsers() matches the exact participant set (size + all)', async () => {
    const a = await createUser();
    const b = await createUser();
    const c = await createUser();
    const listing = await createListing({ seller: a });

    await conversationRepository.create({
      listing: listing._id,
      participants: [a._id, b._id],
    });

    // exact match (order-independent)
    const match = await conversationRepository.findByListingAndUsers(listing._id, [
      b._id,
      a._id,
    ]);
    expect(match).not.toBeNull();

    // a superset of participants must NOT match ($size guards against it)
    const noMatch = await conversationRepository.findByListingAndUsers(listing._id, [
      a._id,
      b._id,
      c._id,
    ]);
    expect(noMatch).toBeNull();

    // different listing must not match
    const otherListing = await createListing({ seller: a });
    const wrongListing = await conversationRepository.findByListingAndUsers(otherListing._id, [
      a._id,
      b._id,
    ]);
    expect(wrongListing).toBeNull();
  });

  it('findById() returns the conversation with populated participants and listing', async () => {
    const a = await createUser({ name: 'Seller Sam' });
    const b = await createUser({ name: 'Buyer Bea' });
    const listing = await createListing({ seller: a, title: 'A Nice Bike' });
    const convo = await conversationRepository.create({
      listing: listing._id,
      participants: [a._id, b._id],
    });

    const found = await conversationRepository.findById(convo._id);
    expect(found._id.toString()).toBe(convo._id.toString());
    // participants populated with name/avatar
    expect(found.participants.every((p) => typeof p.name === 'string')).toBe(true);
    // listing populated with title/price
    expect(found.listing.title).toBe('A Nice Bike');
    expect(found.listing.price).toBeDefined();
  });

  it('updateById() updates and returns the populated doc', async () => {
    const a = await createUser();
    const b = await createUser();
    const listing = await createListing({ seller: a });
    const convo = await conversationRepository.create({
      listing: listing._id,
      participants: [a._id, b._id],
    });
    const msg = await messageRepository.create({
      conversation: convo._id,
      sender: a._id,
      body: 'hi there',
    });

    const updated = await conversationRepository.updateById(convo._id, {
      lastMessage: msg._id,
    });
    expect(updated.lastMessage.toString()).toBe(msg._id.toString());
    // still populated after update
    expect(updated.listing.title).toBeTruthy();
    expect(updated.participants[0].name).toBeTruthy();
  });

  it('listForUser() returns conversations sorted by lastMessageAt desc', async () => {
    const me = await createUser();
    const other1 = await createUser();
    const other2 = await createUser();
    const listing1 = await createListing({ seller: me });
    const listing2 = await createListing({ seller: me });

    const older = await conversationRepository.create({
      listing: listing1._id,
      participants: [me._id, other1._id],
      lastMessageAt: new Date('2020-01-01'),
    });
    const newer = await conversationRepository.create({
      listing: listing2._id,
      participants: [me._id, other2._id],
      lastMessageAt: new Date('2024-01-01'),
    });

    const convos = await conversationRepository.listForUser({ userId: me._id });
    expect(convos.map((c) => c._id.toString())).toEqual([
      newer._id.toString(),
      older._id.toString(),
    ]);
    // populated
    expect(convos[0].participants[0].name).toBeTruthy();
    expect(convos[0].listing.title).toBeTruthy();
  });

  it('listForUser() only returns conversations the user participates in', async () => {
    const me = await createUser();
    const other = await createUser();
    const stranger = await createUser();
    const listing = await createListing({ seller: other });

    await conversationRepository.create({
      listing: listing._id,
      participants: [other._id, stranger._id],
    });

    const convos = await conversationRepository.listForUser({ userId: me._id });
    expect(convos).toHaveLength(0);
  });

  it('findByListingAndUsers() finds separate conversations for two different buyers on the same listing', async () => {
    const seller = await createUser();
    const buyer1 = await createUser();
    const buyer2 = await createUser();
    const listing = await createListing({ seller });

    const convo1 = await conversationRepository.create({
      listing: listing._id,
      participants: [buyer1._id, seller._id],
    });
    const convo2 = await conversationRepository.create({
      listing: listing._id,
      participants: [buyer2._id, seller._id],
    });

    const found1 = await conversationRepository.findByListingAndUsers(listing._id, [
      buyer1._id,
      seller._id,
    ]);
    const found2 = await conversationRepository.findByListingAndUsers(listing._id, [
      buyer2._id,
      seller._id,
    ]);

    expect(found1._id.toString()).toBe(convo1._id.toString());
    expect(found2._id.toString()).toBe(convo2._id.toString());
  });
});

describe('messageRepository', () => {
  const setupConversation = async () => {
    const a = await createUser();
    const b = await createUser();
    const listing = await createListing({ seller: a });
    const convo = await conversationRepository.create({
      listing: listing._id,
      participants: [a._id, b._id],
    });
    return { a, b, listing, convo };
  };

  it('create() persists a message', async () => {
    const { a, convo } = await setupConversation();
    const msg = await messageRepository.create({
      conversation: convo._id,
      sender: a._id,
      body: 'first message',
    });
    expect(msg._id).toBeTruthy();
    expect(msg.body).toBe('first message');
    expect(msg.readBy).toEqual([]);
  });

  it('listByConversation() returns messages oldest-first (reversed internally) with totals', async () => {
    const { a, convo } = await setupConversation();
    const m1 = await messageRepository.create({
      conversation: convo._id,
      sender: a._id,
      body: 'one',
      createdAt: new Date('2020-01-01'),
    });
    const m2 = await messageRepository.create({
      conversation: convo._id,
      sender: a._id,
      body: 'two',
      createdAt: new Date('2020-01-02'),
    });
    const m3 = await messageRepository.create({
      conversation: convo._id,
      sender: a._id,
      body: 'three',
      createdAt: new Date('2020-01-03'),
    });

    const result = await messageRepository.listByConversation({ conversationId: convo._id });
    expect(result).toMatchObject({ total: 3, page: 1, limit: 50, pages: 1 });
    // oldest first
    expect(result.items.map((m) => m._id.toString())).toEqual([
      m1._id.toString(),
      m2._id.toString(),
      m3._id.toString(),
    ]);
    // sender populated
    expect(result.items[0].sender.name).toBeTruthy();
  });

  it('listByConversation() paginates: page 1 returns the newest slice, oldest-first within it', async () => {
    const { a, convo } = await setupConversation();
    const created = [];
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const m = await messageRepository.create({
        conversation: convo._id,
        sender: a._id,
        body: `msg ${i}`,
        createdAt: new Date(2020, 0, i + 1),
      });
      created.push(m);
    }
    // created = [oldest, middle, newest]

    const result = await messageRepository.listByConversation({
      conversationId: convo._id,
      page: 1,
      limit: 2,
    });
    expect(result.total).toBe(3);
    expect(result.pages).toBe(2); // ceil(3/2)
    expect(result.items).toHaveLength(2);
    // page 1 = the two NEWEST docs (sort desc, then reversed -> oldest-first within page)
    expect(result.items.map((m) => m.body)).toEqual(['msg 1', 'msg 2']);
  });

  it('markRead() uses $addToSet so a user is not added twice', async () => {
    const { a, b, convo } = await setupConversation();
    const msg = await messageRepository.create({
      conversation: convo._id,
      sender: a._id,
      body: 'mark me',
    });

    await messageRepository.markRead(convo._id, b._id);
    let fresh = await Message.findById(msg._id);
    expect(fresh.readBy.map((id) => id.toString())).toEqual([b._id.toString()]);

    // calling again must not duplicate the reader
    await messageRepository.markRead(convo._id, b._id);
    fresh = await Message.findById(msg._id);
    expect(fresh.readBy.map((id) => id.toString())).toEqual([b._id.toString()]);
  });

  it('markRead() only touches messages the user has not already read', async () => {
    const { a, b, convo } = await setupConversation();
    // message already read by b
    const already = await Message.create({
      conversation: convo._id,
      sender: a._id,
      body: 'already read',
      readBy: [b._id],
    });
    // unread message
    const unread = await messageRepository.create({
      conversation: convo._id,
      sender: a._id,
      body: 'unread',
    });

    const res = await messageRepository.markRead(convo._id, b._id);
    // only the unread message matched the { readBy: { $ne: userId } } filter
    expect(res.modifiedCount).toBe(1);

    const freshUnread = await Message.findById(unread._id);
    expect(freshUnread.readBy.map((id) => id.toString())).toContain(b._id.toString());
    const freshAlready = await Message.findById(already._id);
    expect(freshAlready.readBy.map((id) => id.toString())).toEqual([b._id.toString()]);
  });
});

// ---------------------------------------------------------------------------
// listingRepository
// ---------------------------------------------------------------------------
describe('listingRepository', () => {
  it('similar() returns same-category published listings excluding the given id', async () => {
    const cat = await createCategory();
    const base = await createListing({ category: cat });
    const sameCat = await createListing({ category: cat });
    await createListing(); // different (auto) category

    const result = await listingRepository.similar({
      categoryId: cat._id,
      excludeId: base._id,
    });
    expect(result).toHaveLength(1);
    expect(result[0]._id.toString()).toBe(sameCat._id.toString());
  });

  it('similar() excludes non-published listings', async () => {
    const cat = await createCategory();
    const base = await createListing({ category: cat });
    await createListing({ category: cat, status: 'draft' });

    const result = await listingRepository.similar({
      categoryId: cat._id,
      excludeId: base._id,
    });
    expect(result).toHaveLength(0);
  });

  it('similar() respects the limit option', async () => {
    const cat = await createCategory();
    const base = await createListing({ category: cat });
    await createListing({ category: cat });
    await createListing({ category: cat });
    await createListing({ category: cat });

    const result = await listingRepository.similar({
      categoryId: cat._id,
      excludeId: base._id,
      limit: 2,
    });
    expect(result).toHaveLength(2);
  });

  it('list({ sort: "popular" }) orders by boosted then views', async () => {
    const cat = await createCategory();
    const plainLowViews = await createListing({ category: cat, boosted: false, views: 1 });
    const plainHighViews = await createListing({ category: cat, boosted: false, views: 100 });
    const boostedLowViews = await createListing({ category: cat, boosted: true, views: 0 });

    const result = await listingRepository.list({ sort: 'popular', category: cat._id });
    const order = result.items.map((l) => l._id.toString());
    // boosted first, then by views desc
    expect(order).toEqual([
      boostedLowViews._id.toString(),
      plainHighViews._id.toString(),
      plainLowViews._id.toString(),
    ]);
  });

  it('list({ seller }) filters by seller via buildFilter', async () => {
    const seller = await createUser();
    await createListing({ seller });
    await createListing({ seller });
    await createListing(); // different seller

    const result = await listingRepository.list({ seller: seller._id });
    expect(result.total).toBe(2);
    expect(
      result.items.every((l) => l.seller._id.toString() === seller._id.toString())
    ).toBe(true);
  });

  it('list() returns the paginated shape with populated seller/category', async () => {
    const seller = await createUser();
    await createListing({ seller });

    const result = await listingRepository.list({ seller: seller._id, page: 1, limit: 12 });
    expect(result).toMatchObject({ page: 1, limit: 12, total: 1, pages: 1 });
    expect(result.items[0].seller.name).toBeTruthy();
    expect(result.items[0].category.slug).toBeTruthy();
  });

  it('incrementViews() increments the views counter', async () => {
    const listing = await createListing({ views: 0 });

    await listingRepository.incrementViews(listing._id);
    let fresh = await Listing.findById(listing._id);
    expect(fresh.views).toBe(1);

    await listingRepository.incrementViews(listing._id);
    fresh = await Listing.findById(listing._id);
    expect(fresh.views).toBe(2);
  });

  it('findById() populates seller and category', async () => {
    const listing = await createListing();
    const found = await listingRepository.findById(listing._id);
    expect(found.seller.name).toBeTruthy();
    expect(found.seller.email).toBeTruthy();
    expect(found.category.slug).toBeTruthy();
  });
});
