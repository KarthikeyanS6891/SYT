import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      required: true,
      index: true,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    unread: {
      type: Map,
      of: Number,
      default: () => new Map(),
    },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1, listing: 1 }, { unique: true });

export const Conversation = mongoose.model('Conversation', conversationSchema);
