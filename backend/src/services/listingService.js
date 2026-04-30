import { listingRepository } from '../repositories/listingRepository.js';
import { favoriteRepository } from '../repositories/favoriteRepository.js';
import { storageService } from './storageService.js';
import { AppError } from '../utils/AppError.js';

const sanitize = (input, allowed) =>
  Object.fromEntries(
    Object.entries(input).filter(([k, v]) => allowed.includes(k) && v !== undefined)
  );

export const listingService = {
  async create(userId, data) {
    const allowed = [
      'title', 'description', 'category', 'price', 'currency',
      'condition', 'location', 'images', 'status',
    ];
    const payload = sanitize(data, allowed);
    return listingRepository.create({ ...payload, seller: userId });
  },

  async update(userId, id, data, { isAdmin = false } = {}) {
    const listing = await listingRepository.findById(id);
    if (!listing) throw AppError.notFound('Listing not found');
    if (!isAdmin && String(listing.seller._id) !== String(userId)) {
      throw AppError.forbidden('Not your listing');
    }
    const allowed = [
      'title', 'description', 'category', 'price', 'currency',
      'condition', 'location', 'images', 'status',
    ];
    const update = sanitize(data, allowed);
    return listingRepository.updateById(id, update);
  },

  async remove(userId, id, { isAdmin = false } = {}) {
    const listing = await listingRepository.findById(id);
    if (!listing) throw AppError.notFound('Listing not found');
    if (!isAdmin && String(listing.seller._id) !== String(userId)) {
      throw AppError.forbidden('Not your listing');
    }
    await Promise.all((listing.images || []).map((img) => storageService.delete(img.key).catch(() => null)));
    await listingRepository.deleteById(id);
    return { ok: true };
  },

  async getById(id, { viewerId } = {}) {
    const listing = await listingRepository.findById(id);
    if (!listing) throw AppError.notFound('Listing not found');
    if (listing.status === 'disabled' && (!viewerId || String(viewerId) !== String(listing.seller._id))) {
      throw AppError.notFound('Listing not found');
    }
    listingRepository.incrementViews(id).catch(() => null);
    let isFavorite = false;
    if (viewerId) {
      isFavorite = await favoriteRepository.exists(viewerId, id);
    }
    return { listing: listing.toJSON(), isFavorite };
  },

  async list(filters, { viewerId } = {}) {
    const result = await listingRepository.list({ ...filters, status: filters.status || 'published' });
    if (viewerId) {
      const favIds = new Set(await favoriteRepository.listingIdsByUser(viewerId));
      result.items = result.items.map((l) => {
        const obj = l.toJSON();
        obj.isFavorite = favIds.has(String(l._id));
        return obj;
      });
    } else {
      result.items = result.items.map((l) => l.toJSON());
    }
    return result;
  },

  async listMine(userId, filters) {
    return listingRepository.list({ ...filters, seller: userId, status: filters.status });
  },

  async similar(id) {
    const listing = await listingRepository.findById(id);
    if (!listing) throw AppError.notFound('Listing not found');
    return listingRepository.similar({
      categoryId: listing.category._id,
      excludeId: listing._id,
    });
  },

  async toggleBoost(userId, id, { isAdmin = false } = {}) {
    const listing = await listingRepository.findById(id);
    if (!listing) throw AppError.notFound('Listing not found');
    if (!isAdmin && String(listing.seller._id) !== String(userId)) {
      throw AppError.forbidden('Not your listing');
    }
    const boosted = !listing.boosted;
    return listingRepository.updateById(id, {
      boosted,
      boostExpiresAt: boosted ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null,
    });
  },
};
