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
    // Sorted, joined participant IDs. Used instead of a raw unique index on the
    // `participants` array, because Mongo treats array fields as multikey indexes
    // (one index entry per element), which lets unrelated participant sets collide
    // on a shared element (see backend/src/models/Conversation.js history / REVIEW.md).
    participantsKey: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

conversationSchema.pre('validate', function computeParticipantsKey(next) {
  if (this.participants && this.participants.length) {
    this.participantsKey = this.participants
      .map((p) => String(p))
      .sort()
      .join('_');
  }
  next();
});

conversationSchema.index({ participantsKey: 1, listing: 1 }, { unique: true });

export const Conversation = mongoose.model('Conversation', conversationSchema);
