import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'http';
import { io as Client } from 'socket.io-client';
import { initSocket } from '../../src/sockets/index.js';
import { createUser, createListing, tokenFor } from '../helpers/index.js';
import { Conversation } from '../../src/models/Conversation.js';
import { Message } from '../../src/models/Message.js';

// ---------------------------------------------------------------------------
// Real socket.io server lifecycle. The HTTP server / io server are recreated
// per test so the DB-wiping afterEach in tests/setup.js stays consistent and
// no open handles leak between tests.
// ---------------------------------------------------------------------------
let httpServer;
let ioServer;
let port;
const clients = [];

beforeEach(async () => {
  httpServer = createServer();
  ioServer = initSocket(httpServer);
  await new Promise((resolve) => httpServer.listen(0, resolve));
  port = httpServer.address().port;
});

afterEach(async () => {
  // Disconnect every client we opened during the test.
  while (clients.length) {
    const c = clients.pop();
    try {
      c.removeAllListeners();
      c.disconnect();
    } catch {
      // ignore
    }
  }
  if (ioServer) ioServer.close();
  if (httpServer && httpServer.listening) {
    await new Promise((resolve) => httpServer.close(resolve));
  }
  ioServer = undefined;
  httpServer = undefined;
});

/** Open a client and resolve once connected (or reject on connect_error). */
const connect = (token) =>
  new Promise((resolve, reject) => {
    const c = Client(`http://localhost:${port}`, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    clients.push(c);
    c.on('connect', () => resolve(c));
    c.on('connect_error', (err) => reject(err));
  });

/** Wait for a named event on a client, with a timeout so flakes fail fast. */
const waitFor = (client, event, timeout = 4000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for "${event}"`)),
      timeout
    );
    client.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

/** Emit with an ack callback wrapped in a promise. */
const emitAck = (client, event, data, timeout = 4000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ack of "${event}"`)),
      timeout
    );
    client.emit(event, data, (ack) => {
      clearTimeout(timer);
      resolve(ack);
    });
  });

/** Assert that an event does NOT arrive within the window. */
const expectNoEvent = (client, event, window = 600) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, window);
    client.once(event, (payload) => {
      clearTimeout(timer);
      reject(new Error(`Did not expect "${event}" but got ${JSON.stringify(payload)}`));
    });
  });

/** Create a Conversation doc directly between two users for a listing. */
const makeConversation = async (buyer, seller, listing) =>
  Conversation.create({
    listing: listing._id,
    participants: [buyer._id, seller._id],
    unread: { [String(seller._id)]: 0, [String(buyer._id)]: 0 },
  });

describe('socket handshake auth', () => {
  it('rejects a connection with no token (connect_error fires)', async () => {
    await expect(connect(undefined)).rejects.toThrow();
  });

  it('rejects a connection with a malformed/invalid token', async () => {
    await expect(connect('not.a.real.jwt')).rejects.toThrow();
  });

  it('connects with a valid token', async () => {
    const user = await createUser();
    const c = await connect(tokenFor(user));
    expect(c.connected).toBe(true);
  });
});

describe('chat:join', () => {
  it('lets a participant join the conversation room', async () => {
    const buyer = await createUser();
    const seller = await createUser();
    const listing = await createListing({ seller });
    const convo = await makeConversation(buyer, seller, listing);

    const c = await connect(tokenFor(buyer));
    const ack = await emitAck(c, 'chat:join', { conversationId: String(convo._id) });
    expect(ack).toEqual({ ok: true });
  });

  it('rejects a non-participant with ok:false', async () => {
    const buyer = await createUser();
    const seller = await createUser();
    const stranger = await createUser();
    const listing = await createListing({ seller });
    const convo = await makeConversation(buyer, seller, listing);

    const c = await connect(tokenFor(stranger));
    const ack = await emitAck(c, 'chat:join', { conversationId: String(convo._id) });
    expect(ack.ok).toBe(false);
    expect(ack.error).toMatch(/not a participant/i);
  });

  it('rejects joining a non-existent conversation with ok:false', async () => {
    const user = await createUser();
    const c = await connect(tokenFor(user));
    // A syntactically valid but unknown ObjectId.
    const missingId = '64b7f0f0f0f0f0f0f0f0f0f0';
    const ack = await emitAck(c, 'chat:join', { conversationId: missingId });
    expect(ack.ok).toBe(false);
    expect(ack.error).toMatch(/not a participant/i);
  });

  it('returns ok:false with an error message for a malformed conversation id', async () => {
    const user = await createUser();
    const c = await connect(tokenFor(user));
    // A cast error inside ensureParticipant is caught and surfaced via cb.
    const ack = await emitAck(c, 'chat:join', { conversationId: 'not-an-object-id' });
    expect(ack.ok).toBe(false);
    expect(typeof ack.error).toBe('string');
  });
});

describe('chat:send', () => {
  it('delivers chat:message to the room and chat:notify to the other user', async () => {
    const buyer = await createUser({ name: 'Buyer Bob' });
    const seller = await createUser({ name: 'Seller Sue' });
    const listing = await createListing({ seller });
    const convo = await makeConversation(buyer, seller, listing);
    const conversationId = String(convo._id);

    const buyerClient = await connect(tokenFor(buyer));
    const sellerClient = await connect(tokenFor(seller));

    expect((await emitAck(buyerClient, 'chat:join', { conversationId })).ok).toBe(true);
    expect((await emitAck(sellerClient, 'chat:join', { conversationId })).ok).toBe(true);

    // Recipient listeners established before the send.
    const messageP = waitFor(sellerClient, 'chat:message');
    const notifyP = waitFor(sellerClient, 'chat:notify');

    const ack = await emitAck(buyerClient, 'chat:send', {
      conversationId,
      body: 'Hello there',
    });

    expect(ack.ok).toBe(true);
    expect(ack.message).toBeTruthy();
    expect(ack.message.body).toBe('Hello there');
    // sender is populated with name + avatar (no leak of full doc fields).
    expect(ack.message.sender).toBeTruthy();
    expect(ack.message.sender.name).toBe('Buyer Bob');

    const messageEvt = await messageP;
    expect(messageEvt.message.body).toBe('Hello there');
    expect(messageEvt.message.conversation).toBe(conversationId);

    const notifyEvt = await notifyP;
    expect(notifyEvt.conversationId).toBe(conversationId);
    expect(notifyEvt.message.body).toBe('Hello there');

    // Message was actually persisted.
    const stored = await Message.find({ conversation: convo._id });
    expect(stored).toHaveLength(1);
    expect(stored[0].body).toBe('Hello there');

    // unread incremented for the recipient (seller), not the sender.
    const fresh = await Conversation.findById(convo._id);
    expect(fresh.unread.get(String(seller._id))).toBe(1);
    expect(fresh.unread.get(String(buyer._id))).toBe(0);
    expect(String(fresh.lastMessage)).toBe(String(stored[0]._id));
  });

  it('the sender also receives chat:message (io.to includes the whole room)', async () => {
    const buyer = await createUser();
    const seller = await createUser();
    const listing = await createListing({ seller });
    const convo = await makeConversation(buyer, seller, listing);
    const conversationId = String(convo._id);

    const buyerClient = await connect(tokenFor(buyer));
    await emitAck(buyerClient, 'chat:join', { conversationId });

    const selfMessageP = waitFor(buyerClient, 'chat:message');
    await emitAck(buyerClient, 'chat:send', { conversationId, body: 'echo' });

    const evt = await selfMessageP;
    expect(evt.message.body).toBe('echo');
  });

  it('the sender does NOT receive its own chat:notify', async () => {
    const buyer = await createUser();
    const seller = await createUser();
    const listing = await createListing({ seller });
    const convo = await makeConversation(buyer, seller, listing);
    const conversationId = String(convo._id);

    const buyerClient = await connect(tokenFor(buyer));
    await emitAck(buyerClient, 'chat:join', { conversationId });

    const noNotify = expectNoEvent(buyerClient, 'chat:notify');
    await emitAck(buyerClient, 'chat:send', { conversationId, body: 'no self notify' });
    await noNotify;
  });

  it('acks ok:false when a non-participant tries to send', async () => {
    const buyer = await createUser();
    const seller = await createUser();
    const stranger = await createUser();
    const listing = await createListing({ seller });
    const convo = await makeConversation(buyer, seller, listing);
    const conversationId = String(convo._id);

    const strangerClient = await connect(tokenFor(stranger));
    const ack = await emitAck(strangerClient, 'chat:send', {
      conversationId,
      body: 'I should not be allowed',
    });

    expect(ack.ok).toBe(false);
    expect(ack.error).toMatch(/not a participant/i);

    const stored = await Message.find({ conversation: convo._id });
    expect(stored).toHaveLength(0);
  });

  it('acks ok:false when sending to a non-existent conversation', async () => {
    const user = await createUser();
    const c = await connect(tokenFor(user));
    const ack = await emitAck(c, 'chat:send', {
      conversationId: '64b7f0f0f0f0f0f0f0f0f0f0',
      body: 'into the void',
    });
    expect(ack.ok).toBe(false);
    expect(ack.error).toMatch(/conversation not found/i);
  });

  it('notifies a recipient on their user room even when they have not joined', async () => {
    const buyer = await createUser();
    const seller = await createUser();
    const listing = await createListing({ seller });
    const convo = await makeConversation(buyer, seller, listing);
    const conversationId = String(convo._id);

    const buyerClient = await connect(tokenFor(buyer));
    const sellerClient = await connect(tokenFor(seller));
    await emitAck(buyerClient, 'chat:join', { conversationId });
    // seller deliberately does NOT join the conversation room.

    const notifyP = waitFor(sellerClient, 'chat:notify');
    await emitAck(buyerClient, 'chat:send', { conversationId, body: 'ping' });

    const notifyEvt = await notifyP;
    expect(notifyEvt.conversationId).toBe(conversationId);
    expect(notifyEvt.message.body).toBe('ping');
  });
});

describe('chat:read', () => {
  it('broadcasts chat:read to the other participant and acks ok:true', async () => {
    const buyer = await createUser();
    const seller = await createUser();
    const listing = await createListing({ seller });
    const convo = await makeConversation(buyer, seller, listing);
    const conversationId = String(convo._id);

    // Seed a message from buyer so there is something to mark read.
    await Message.create({ conversation: convo._id, sender: buyer._id, body: 'hi' });

    const buyerClient = await connect(tokenFor(buyer));
    const sellerClient = await connect(tokenFor(seller));
    await emitAck(buyerClient, 'chat:join', { conversationId });
    await emitAck(sellerClient, 'chat:join', { conversationId });

    const readP = waitFor(buyerClient, 'chat:read');
    const ack = await emitAck(sellerClient, 'chat:read', { conversationId });
    expect(ack).toEqual({ ok: true });

    const readEvt = await readP;
    expect(readEvt.userId).toBe(String(seller._id));
    expect(readEvt.conversationId).toBe(conversationId);

    // The reader's unread counter was reset and messages marked read.
    const fresh = await Conversation.findById(convo._id);
    expect(fresh.unread.get(String(seller._id))).toBe(0);
    const msgs = await Message.find({ conversation: convo._id });
    expect(msgs[0].readBy.map(String)).toContain(String(seller._id));
  });

  it('does NOT echo chat:read back to the reader (socket.to excludes sender)', async () => {
    const buyer = await createUser();
    const seller = await createUser();
    const listing = await createListing({ seller });
    const convo = await makeConversation(buyer, seller, listing);
    const conversationId = String(convo._id);

    const sellerClient = await connect(tokenFor(seller));
    await emitAck(sellerClient, 'chat:join', { conversationId });

    const noEcho = expectNoEvent(sellerClient, 'chat:read');
    await emitAck(sellerClient, 'chat:read', { conversationId });
    await noEcho;
  });

  it('acks ok:false when a non-participant marks read', async () => {
    const buyer = await createUser();
    const seller = await createUser();
    const stranger = await createUser();
    const listing = await createListing({ seller });
    const convo = await makeConversation(buyer, seller, listing);
    const conversationId = String(convo._id);

    const strangerClient = await connect(tokenFor(stranger));
    const ack = await emitAck(strangerClient, 'chat:read', { conversationId });
    expect(ack.ok).toBe(false);
    expect(ack.error).toMatch(/not a participant/i);
  });
});

describe('chat:typing', () => {
  it('relays typing:true to the other participant in the room', async () => {
    const buyer = await createUser();
    const seller = await createUser();
    const listing = await createListing({ seller });
    const convo = await makeConversation(buyer, seller, listing);
    const conversationId = String(convo._id);

    const buyerClient = await connect(tokenFor(buyer));
    const sellerClient = await connect(tokenFor(seller));
    await emitAck(buyerClient, 'chat:join', { conversationId });
    await emitAck(sellerClient, 'chat:join', { conversationId });

    const typingP = waitFor(sellerClient, 'chat:typing');
    buyerClient.emit('chat:typing', { conversationId, isTyping: true });

    const evt = await typingP;
    expect(evt.userId).toBe(String(buyer._id));
    expect(evt.isTyping).toBe(true);
  });

  it('coerces isTyping to a boolean (false) and does not echo to the sender', async () => {
    const buyer = await createUser();
    const seller = await createUser();
    const listing = await createListing({ seller });
    const convo = await makeConversation(buyer, seller, listing);
    const conversationId = String(convo._id);

    const buyerClient = await connect(tokenFor(buyer));
    const sellerClient = await connect(tokenFor(seller));
    await emitAck(buyerClient, 'chat:join', { conversationId });
    await emitAck(sellerClient, 'chat:join', { conversationId });

    const typingP = waitFor(sellerClient, 'chat:typing');
    const noEcho = expectNoEvent(buyerClient, 'chat:typing');
    // Omit isTyping entirely -> Boolean(undefined) === false.
    buyerClient.emit('chat:typing', { conversationId });

    const evt = await typingP;
    expect(evt.userId).toBe(String(buyer._id));
    expect(evt.isTyping).toBe(false);
    await noEcho;
  });
});
