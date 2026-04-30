import { Category } from '../models/Category.js';
import { Listing } from '../models/Listing.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const searchService = {
  async suggest({ q, limit = 6 }) {
    const term = (q || '').trim();
    if (term.length < 2) return { categories: [], listings: [], total: 0 };

    const tokens = term.split(/\s+/).filter(Boolean).map(escapeRegex);
    const regex = new RegExp(tokens.join('|'), 'i');

    const [categories, listings] = await Promise.all([
      Category.find({ $or: [{ name: regex }, { slug: regex }] })
        .sort({ parent: 1, order: 1 })
        .limit(limit)
        .lean(),
      Listing.find({ status: 'published', title: regex })
        .sort({ boosted: -1, views: -1, createdAt: -1 })
        .limit(limit)
        .select('title price currency images location category')
        .populate('category', 'name slug')
        .lean(),
    ]);

    return {
      categories,
      listings,
      total: categories.length + listings.length,
    };
  },
};
