import { User } from '../models/User.js';
import { Listing } from '../models/Listing.js';
import { userRepository } from '../repositories/userRepository.js';
import { AppError } from '../utils/AppError.js';

export const adminService = {
  async listUsers({ page, limit, q }) {
    const [items, total] = await userRepository.list({ page, limit, q });
    return {
      items: items.map((u) => u.toPublicJSON()),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  },

  async setUserDisabled(userId, disabled) {
    const user = await User.findByIdAndUpdate(
      userId,
      { disabled, ...(disabled ? { refreshTokens: [] } : {}) },
      { new: true }
    );
    if (!user) throw AppError.notFound('User not found');
    return user.toPublicJSON();
  },

  async setListingStatus(listingId, status) {
    if (!['draft', 'published', 'sold', 'disabled'].includes(status)) {
      throw AppError.badRequest('Invalid status');
    }
    const listing = await Listing.findByIdAndUpdate(listingId, { status }, { new: true });
    if (!listing) throw AppError.notFound('Listing not found');
    return listing;
  },

  async stats() {
    const [users, listings, published, disabled] = await Promise.all([
      User.countDocuments(),
      Listing.countDocuments(),
      Listing.countDocuments({ status: 'published' }),
      Listing.countDocuments({ status: 'disabled' }),
    ]);
    return { users, listings, published, disabled };
  },
};
