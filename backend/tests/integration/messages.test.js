import { describe, it, expect } from 'vitest';
import {
  api,
  createUser,
  createListing,
  authFor,
} from '../helpers/index.js';
import { Conversation } from '../../src/models/Conversation.js';
import { Message } from '../../src/models/Message.js';

const NONEXISTENT_ID = '64b7f9a2f1c2a3b4c5d6e7f8';

/** Start a conversation between `buyer` and the seller of `listing` via the API. */
const startConvo = (buyer, listing, message = 'Is this still available?') =>
  api()
    .post('/api/v1/messages/conversations')
    .set(authFor(buyer))
    .send({ listingId: listing._id.toString(), message });

describe('messages — auth gate', () => {
  it.each([
    ['GET', '/api/v1/messages/conversations'],
    ['POST', '/api/v1/messages/conversations'],
    ['GET', `/api/v1/messages/conversations/${NONEXISTENT_ID}`],
    ['POST', `/api/v1/messages/conversations/${NONEXISTENT_ID}/messages`],
    ['POST', `/api/v1/messages/conversations/${NONEXISTENT_ID}/read`],
  ])('rejects %s %s without a token (401)', async (method, path) => {
    const res = await api()[method.toLowerCase()](path).send({});
    expect(res.status).toBe(401);
  });
});

describe('POST /messages/conversations (start)', () => {
  it('creates a conversation and a message for a buyer messaging another listing (201)', async () => {
    const seller = await createUser();
    const buyer = await createUser();
    const listing = await createListing({ seller });

    const res = await startConvo(buyer, listing, 'Hello, interested!');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Message sent');
    expect(res.body.data.conversation).toBeTruthy();
    expect(res.body.data.message).toBeTruthy();
    expect(res.body.data.message.body).toBe('Hello, interested!');
    // sender is populated with name/avatar; raw id still serializes under _id
    expect(res.body.data.message.sender._id).toBe(buyer._id.toString());

    // conversation links the listing and includes both participants
    expect(res.body.data.conversation.listing._id).toBe(listing._id.toString());
    const participantIds = res.body.data.conversation.participants.map((p) => p._id);
    expect(participantIds).toContain(buyer._id.toString());
    expect(participantIds).toContain(seller._id.toString());

    // exactly one conversation + one message persisted
    expect(await Conversation.countDocuments()).toBe(1);
    expect(await Message.countDocuments()).toBe(1);
  });

  it('reuses the same conversation on a second start for the same listing+buyer', async () => {
    const seller = await createUser();
    const buyer = await createUser();
    const listing = await createListing({ seller });

    const first = await startConvo(buyer, listing, 'First message');
    const second = await startConvo(buyer, listing, 'Second message');

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.conversation._id).toBe(first.body.data.conversation._id);

    // no duplicate conversation, but two messages
    expect(await Conversation.countDocuments()).toBe(1);
    expect(await Message.countDocuments()).toBe(2);
  });

  it('allows a second, different buyer to start a conversation about the same listing (201)', async () => {
    // Regression test for the multikey-unique-index bug: participants is an array,
    // so a naive unique index on { participants, listing } collides once the seller
    // is shared across two otherwise-distinct conversations.
    const seller = await createUser();
    const buyer1 = await createUser();
    const buyer2 = await createUser();
    const listing = await createListing({ seller });

    const first = await startConvo(buyer1, listing, 'Is this still available?');
    const second = await startConvo(buyer2, listing, 'I am interested too!');

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.conversation._id).not.toBe(first.body.data.conversation._id);

    expect(await Conversation.countDocuments()).toBe(2);
    expect(await Message.countDocuments()).toBe(2);
  });

  it('rejects messaging your OWN listing with 400', async () => {
    const owner = await createUser();
    const listing = await createListing({ seller: owner });

    const res = await startConvo(owner, listing);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/your own listing/i);
    expect(await Conversation.countDocuments()).toBe(0);
  });

  it('returns 404 when the listing does not exist', async () => {
    const buyer = await createUser();
    const res = await api()
      .post('/api/v1/messages/conversations')
      .set(authFor(buyer))
      .send({ listingId: NONEXISTENT_ID, message: 'Hi there' });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/listing not found/i);
  });

  it.each([
    ['non-mongo listingId', { listingId: 'not-a-mongo-id', message: 'Hello' }],
    ['missing listingId', { message: 'Hello' }],
    ['empty message', { listingId: NONEXISTENT_ID, message: '' }],
    ['whitespace-only message', { listingId: NONEXISTENT_ID, message: '   ' }],
    ['too-long message', { listingId: NONEXISTENT_ID, message: 'x'.repeat(2001) }],
  ])('rejects validation: %s with 400', async (_label, payload) => {
    const buyer = await createUser();
    const res = await api()
      .post('/api/v1/messages/conversations')
      .set(authFor(buyer))
      .send(payload);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/validation failed/i);
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it('accepts a message of exactly 2000 chars (boundary)', async () => {
    const seller = await createUser();
    const buyer = await createUser();
    const listing = await createListing({ seller });
    const res = await startConvo(buyer, listing, 'y'.repeat(2000));
    expect(res.status).toBe(201);
    expect(res.body.data.message.body).toHaveLength(2000);
  });

  it('increments the seller unread count after a start', async () => {
    const seller = await createUser();
    const buyer = await createUser();
    const listing = await createListing({ seller });

    const res = await startConvo(buyer, listing);
    const convoId = res.body.data.conversation._id;

    const convo = await Conversation.findById(convoId);
    expect(convo.unread.get(seller._id.toString())).toBeGreaterThanOrEqual(1);
    // the buyer (sender) is not credited an unread message
    expect(convo.unread.get(buyer._id.toString()) || 0).toBe(0);
  });
});

describe('POST /messages/conversations/:id/messages (send)', () => {
  it('lets a participant send a message (201)', async () => {
    const seller = await createUser();
    const buyer = await createUser();
    const listing = await createListing({ seller });
    const started = await startConvo(buyer, listing);
    const convoId = started.body.data.conversation._id;

    // the seller replies
    const res = await api()
      .post(`/api/v1/messages/conversations/${convoId}/messages`)
      .set(authFor(seller))
      .send({ body: 'Yes, it is available.' });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Message sent');
    expect(res.body.data.message.body).toBe('Yes, it is available.');
    expect(res.body.data.message.sender._id).toBe(seller._id.toString());
    expect(await Message.countDocuments({ conversation: convoId })).toBe(2);
  });

  it('increments the recipient unread count when a participant sends', async () => {
    const seller = await createUser();
    const buyer = await createUser();
    const listing = await createListing({ seller });
    const started = await startConvo(buyer, listing);
    const convoId = started.body.data.conversation._id;

    // seller replies -> buyer's unread should now be >= 1
    await api()
      .post(`/api/v1/messages/conversations/${convoId}/messages`)
      .set(authFor(seller))
      .send({ body: 'Replying now.' });

    const convo = await Conversation.findById(convoId);
    expect(convo.unread.get(buyer._id.toString())).toBeGreaterThanOrEqual(1);
  });

  it('forbids a non-participant from sending (403)', async () => {
    const seller = await createUser();
    const buyer = await createUser();
    const stranger = await createUser();
    const listing = await createListing({ seller });
    const started = await startConvo(buyer, listing);
    const convoId = started.body.data.conversation._id;

    const res = await api()
      .post(`/api/v1/messages/conversations/${convoId}/messages`)
      .set(authFor(stranger))
      .send({ body: 'Let me in.' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/not a participant/i);
  });

  it('returns 404 for a non-existent conversation', async () => {
    const user = await createUser();
    const res = await api()
      .post(`/api/v1/messages/conversations/${NONEXISTENT_ID}/messages`)
      .set(authFor(user))
      .send({ body: 'Anybody there?' });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/conversation not found/i);
  });

  it.each([
    ['non-mongo id', NONEXISTENT_ID.replace(/.$/, ''), { body: 'Hi' }, 400],
    ['empty body', NONEXISTENT_ID, { body: '' }, 400],
    ['whitespace-only body', NONEXISTENT_ID, { body: '   ' }, 400],
    ['too-long body', NONEXISTENT_ID, { body: 'z'.repeat(2001) }, 400],
  ])('rejects validation: %s', async (_label, id, payload, expected) => {
    const user = await createUser();
    const res = await api()
      .post(`/api/v1/messages/conversations/${id}/messages`)
      .set(authFor(user))
      .send(payload);
    expect(res.status).toBe(expected);
    expect(res.body.message).toMatch(/validation failed/i);
  });
});

describe('GET /messages/conversations (list)', () => {
  it("returns the caller's conversations", async () => {
    const seller = await createUser();
    const buyer = await createUser();
    const other = await createUser();
    const listingA = await createListing({ seller });
    const listingB = await createListing({ seller });

    await startConvo(buyer, listingA);
    await startConvo(other, listingB);

    // buyer sees only the conversation they participate in
    const buyerRes = await api()
      .get('/api/v1/messages/conversations')
      .set(authFor(buyer));
    expect(buyerRes.status).toBe(200);
    expect(buyerRes.body.data.items).toHaveLength(1);
    const partIds = buyerRes.body.data.items[0].participants.map((p) => p._id);
    expect(partIds).toContain(buyer._id.toString());

    // seller participates in both
    const sellerRes = await api()
      .get('/api/v1/messages/conversations')
      .set(authFor(seller));
    expect(sellerRes.body.data.items).toHaveLength(2);
  });

  it('returns an empty list when the caller has no conversations', async () => {
    const lonely = await createUser();
    const res = await api()
      .get('/api/v1/messages/conversations')
      .set(authFor(lonely));
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });
});

describe('GET /messages/conversations/:id (getMessages)', () => {
  it('returns messages in chronological order and resets unread to 0 for the caller', async () => {
    const seller = await createUser();
    const buyer = await createUser();
    const listing = await createListing({ seller });
    const started = await startConvo(buyer, listing, 'First');
    const convoId = started.body.data.conversation._id;

    // seller sends a couple more so there are several messages, and unread climbs
    await api()
      .post(`/api/v1/messages/conversations/${convoId}/messages`)
      .set(authFor(seller))
      .send({ body: 'Second' });
    await api()
      .post(`/api/v1/messages/conversations/${convoId}/messages`)
      .set(authFor(seller))
      .send({ body: 'Third' });

    // before reading, buyer has unread > 0
    const before = await Conversation.findById(convoId);
    expect(before.unread.get(buyer._id.toString())).toBeGreaterThanOrEqual(1);

    const res = await api()
      .get(`/api/v1/messages/conversations/${convoId}`)
      .set(authFor(buyer));
    expect(res.status).toBe(200);
    expect(res.body.data.items.map((m) => m.body)).toEqual(['First', 'Second', 'Third']);
    expect(res.body.data.conversation._id).toBe(convoId);
    expect(res.body.data.total).toBe(3);

    // reading resets the buyer's unread to 0
    const after = await Conversation.findById(convoId);
    expect(after.unread.get(buyer._id.toString())).toBe(0);
  });

  it('forbids a non-participant (403)', async () => {
    const seller = await createUser();
    const buyer = await createUser();
    const stranger = await createUser();
    const listing = await createListing({ seller });
    const started = await startConvo(buyer, listing);
    const convoId = started.body.data.conversation._id;

    const res = await api()
      .get(`/api/v1/messages/conversations/${convoId}`)
      .set(authFor(stranger));
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/not a participant/i);
  });

  it('returns 404 for a non-existent conversation', async () => {
    const user = await createUser();
    const res = await api()
      .get(`/api/v1/messages/conversations/${NONEXISTENT_ID}`)
      .set(authFor(user));
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/conversation not found/i);
  });
});

describe('POST /messages/conversations/:id/read', () => {
  it('lets a participant mark read and resets their unread (200)', async () => {
    const seller = await createUser();
    const buyer = await createUser();
    const listing = await createListing({ seller });
    const started = await startConvo(buyer, listing);
    const convoId = started.body.data.conversation._id;

    // seller has unread = 1 from the buyer's start
    const before = await Conversation.findById(convoId);
    expect(before.unread.get(seller._id.toString())).toBeGreaterThanOrEqual(1);

    const res = await api()
      .post(`/api/v1/messages/conversations/${convoId}/read`)
      .set(authFor(seller))
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.data.ok).toBe(true);

    const after = await Conversation.findById(convoId);
    expect(after.unread.get(seller._id.toString())).toBe(0);

    // all messages are now marked read by the seller
    const messages = await Message.find({ conversation: convoId });
    for (const m of messages) {
      expect(m.readBy.map(String)).toContain(seller._id.toString());
    }
  });

  it('forbids a non-participant (403)', async () => {
    const seller = await createUser();
    const buyer = await createUser();
    const stranger = await createUser();
    const listing = await createListing({ seller });
    const started = await startConvo(buyer, listing);
    const convoId = started.body.data.conversation._id;

    const res = await api()
      .post(`/api/v1/messages/conversations/${convoId}/read`)
      .set(authFor(stranger))
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/not a participant/i);
  });

  it('returns 404 for a non-existent conversation', async () => {
    const user = await createUser();
    const res = await api()
      .post(`/api/v1/messages/conversations/${NONEXISTENT_ID}/read`)
      .set(authFor(user))
      .send({});
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/conversation not found/i);
  });
});

describe('conversation set up directly via DB', () => {
  it('a participant of a directly-created conversation can fetch its messages', async () => {
    const seller = await createUser();
    const buyer = await createUser();
    const listing = await createListing({ seller });

    const convo = await Conversation.create({
      listing: listing._id,
      participants: [buyer._id, seller._id],
      unread: { [seller._id.toString()]: 0, [buyer._id.toString()]: 0 },
    });
    await Message.create({
      conversation: convo._id,
      sender: buyer._id,
      body: 'Directly created message',
    });

    const res = await api()
      .get(`/api/v1/messages/conversations/${convo._id}`)
      .set(authFor(buyer));
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].body).toBe('Directly created message');
  });
});
