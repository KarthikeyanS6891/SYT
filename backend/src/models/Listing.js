import mongoose from 'mongoose';

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    key: { type: String },
  },
  { _id: false }
);

const listingSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, required: true, maxlength: 5000 },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    price: { type: Number, required: true, min: 0, index: true },
    currency: { type: String, default: 'INR' },
    condition: { type: String, enum: ['new', 'used', 'refurbished'], default: 'used' },
    location: { type: String, required: true, trim: true, index: true },
    images: { type: [imageSchema], default: [] },
    status: {
      type: String,
      enum: ['draft', 'published', 'sold', 'disabled'],
      default: 'draft',
      index: true,
    },
    boosted: { type: Boolean, default: false },
    boostExpiresAt: { type: Date },
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);

listingSchema.index({ title: 'text', description: 'text', location: 'text' });
listingSchema.index({ status: 1, createdAt: -1 });
listingSchema.index({ category: 1, price: 1 });

listingSchema.virtual('isBoostActive').get(function () {
  if (!this.boosted) return false;
  if (!this.boostExpiresAt) return true;
  return this.boostExpiresAt.getTime() > Date.now();
});

listingSchema.set('toJSON', { virtuals: true });
listingSchema.set('toObject', { virtuals: true });

export const Listing = mongoose.model('Listing', listingSchema);
