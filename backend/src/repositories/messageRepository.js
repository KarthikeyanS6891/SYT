import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';

export const conversationRepository = {
  findByListingAndUsers: (listingId, userIds) =>
    Conversation.findOne({
      listing: listingId,
      participants: { $all: userIds, $size: userIds.length },
    }),

  create: (data) => Conversation.create(data),

  findById: (id) =>
    Conversation.findById(id)
      .populate('participants', 'name avatar')
      .populate('listing', 'title price images status seller'),

  updateById: (id, update) =>
    Conversation.findByIdAndUpdate(id, update, { new: true })
      .populate('participants', 'name avatar')
      .populate('listing', 'title price images status seller'),

  listForUser: ({ userId, page = 1, limit = 20 }) =>
    Conversation.find({ participants: userId })
      .sort({ lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('participants', 'name avatar')
      .populate('listing', 'title price images status seller')
      .populate('lastMessage'),
};

export const messageRepository = {
  create: (data) => Message.create(data),

  listByConversation: async ({ conversationId, page = 1, limit = 50 }) => {
    const [items, total] = await Promise.all([
      Message.find({ conversation: conversationId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('sender', 'name avatar'),
      Message.countDocuments({ conversation: conversationId }),
    ]);
    return { items: items.reverse(), total, page, limit, pages: Math.ceil(total / limit) };
  },

  markRead: (conversationId, userId) =>
    Message.updateMany(
      { conversation: conversationId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    ),
};
