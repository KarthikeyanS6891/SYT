import mongoose from 'mongoose';

const favoriteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

favoriteSchema.index({ user: 1, listing: 1 }, { unique: true });

export const Favorite = mongoose.model('Favorite', favoriteSchema);
