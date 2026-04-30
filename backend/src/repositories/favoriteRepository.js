import { Favorite } from '../models/Favorite.js';

export const favoriteRepository = {
  add: (user, listing) =>
    Favorite.findOneAndUpdate(
      { user, listing },
      { $setOnInsert: { user, listing } },
      { upsert: true, new: true }
    ),

  remove: (user, listing) => Favorite.findOneAndDelete({ user, listing }),

  exists: async (user, listing) => {
    const fav = await Favorite.exists({ user, listing });
    return Boolean(fav);
  },

  listByUser: async ({ user, page = 1, limit = 12 }) => {
    const [items, total] = await Promise.all([
      Favorite.find({ user })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({
          path: 'listing',
          populate: [
            { path: 'seller', select: 'name avatar location' },
            { path: 'category', select: 'name slug icon' },
          ],
        }),
      Favorite.countDocuments({ user }),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  },

  listingIdsByUser: async (user) => {
    const docs = await Favorite.find({ user }).select('listing -_id').lean();
    return docs.map((d) => String(d.listing));
  },
};
