import { conversationRepository, messageRepository } from '../repositories/messageRepository.js';
import { listingRepository } from '../repositories/listingRepository.js';
import { Conversation } from '../models/Conversation.js';
import { AppError } from '../utils/AppError.js';

const incrementUnread = async (conversationId, recipientId) => {
  await Conversation.updateOne(
    { _id: conversationId },
    { $inc: { [`unread.${recipientId}`]: 1 } }
  );
};

const resetUnread = async (conversationId, userId) => {
  await Conversation.updateOne(
    { _id: conversationId },
    { $set: { [`unread.${userId}`]: 0 } }
  );
};

export const messageService = {
  async startOrSend({ buyerId, listingId, body }) {
    const listing = await listingRepository.findById(listingId);
    if (!listing) throw AppError.notFound('Listing not found');
    const sellerId = String(listing.seller._id);
    if (sellerId === String(buyerId)) {
      throw AppError.badRequest('You cannot message your own listing');
    }

    const participants = [buyerId, sellerId];
    let convo = await conversationRepository.findByListingAndUsers(listingId, participants);
    if (!convo) {
      convo = await conversationRepository.create({
        listing: listingId,
        participants,
        unread: { [sellerId]: 0, [buyerId]: 0 },
      });
    }

    const message = await messageRepository.create({
      conversation: convo._id,
      sender: buyerId,
      body,
    });

    const recipient = participants.find((p) => String(p) !== String(buyerId));
    await Promise.all([
      conversationRepository.updateById(convo._id, {
        lastMessage: message._id,
        lastMessageAt: new Date(),
      }),
      incrementUnread(convo._id, recipient),
    ]);

    const populated = await message.populate('sender', 'name avatar');
    const fresh = await conversationRepository.findById(convo._id);
    return { conversation: fresh, message: populated };
  },

  async send({ conversationId, senderId, body }) {
    const convo = await conversationRepository.findById(conversationId);
    if (!convo) throw AppError.notFound('Conversation not found');
    const isParticipant = convo.participants.some((p) => String(p._id) === String(senderId));
    if (!isParticipant) throw AppError.forbidden('Not a participant');

    const message = await messageRepository.create({
      conversation: convo._id,
      sender: senderId,
      body,
    });

    const recipient = convo.participants.find((p) => String(p._id) !== String(senderId));
    await Promise.all([
      conversationRepository.updateById(convo._id, {
        lastMessage: message._id,
        lastMessageAt: new Date(),
      }),
      incrementUnread(convo._id, recipient._id),
    ]);

    return message.populate('sender', 'name avatar');
  },

  async listConversations(userId, { page, limit }) {
    const items = await conversationRepository.listForUser({ userId, page, limit });
    return items;
  },

  async getMessages({ conversationId, userId, page, limit }) {
    const convo = await conversationRepository.findById(conversationId);
    if (!convo) throw AppError.notFound('Conversation not found');
    const isParticipant = convo.participants.some((p) => String(p._id) === String(userId));
    if (!isParticipant) throw AppError.forbidden('Not a participant');

    await Promise.all([
      messageRepository.markRead(conversationId, userId),
      resetUnread(conversationId, userId),
    ]);

    const result = await messageRepository.listByConversation({ conversationId, page, limit });
    return { conversation: convo, ...result };
  },

  async markRead({ conversationId, userId }) {
    const convo = await conversationRepository.findById(conversationId);
    if (!convo) throw AppError.notFound('Conversation not found');
    const isParticipant = convo.participants.some((p) => String(p._id) === String(userId));
    if (!isParticipant) throw AppError.forbidden('Not a participant');
    await Promise.all([
      messageRepository.markRead(conversationId, userId),
      resetUnread(conversationId, userId),
    ]);
    return { ok: true };
  },
};
