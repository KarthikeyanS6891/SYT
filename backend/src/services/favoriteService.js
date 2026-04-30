import { favoriteRepository } from '../repositories/favoriteRepository.js';
import { listingRepository } from '../repositories/listingRepository.js';
import { AppError } from '../utils/AppError.js';

export const favoriteService = {
  async add(userId, listingId) {
    const listing = await listingRepository.findById(listingId);
    if (!listing) throw AppError.notFound('Listing not found');
    return favoriteRepository.add(userId, listingId);
  },

  async remove(userId, listingId) {
    return favoriteRepository.remove(userId, listingId);
  },

  async list(userId, { page, limit }) {
    const result = await favoriteRepository.listByUser({ user: userId, page, limit });
    result.items = result.items
      .filter((f) => f.listing)
      .map((f) => ({ ...f.listing.toJSON(), favoriteId: f._id, isFavorite: true }));
    return result;
  },
};
