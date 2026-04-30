import { Listing } from '../models/Listing.js';
import { Category } from '../models/Category.js';

const buildFilter = ({ q, categoryIds, location, minPrice, maxPrice, status, seller }) => {
  const filter = {};
  if (status) filter.status = status;
  if (categoryIds && categoryIds.length === 1) filter.category = categoryIds[0];
  else if (categoryIds && categoryIds.length > 1) filter.category = { $in: categoryIds };
  if (seller) filter.seller = seller;
  if (location) filter.location = { $regex: location, $options: 'i' };
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = Number(minPrice);
    if (maxPrice !== undefined) filter.price.$lte = Number(maxPrice);
  }
  if (q) filter.$text = { $search: q };
  return filter;
};

const expandCategoryWithDescendants = async (category) => {
  if (!category) return null;
  const children = await Category.find({ parent: category }).select('_id').lean();
  return [category, ...children.map((c) => String(c._id))];
};

const buildSort = (sort, hasTextSearch) => {
  switch (sort) {
    case 'price_asc':
      return { boosted: -1, price: 1 };
    case 'price_desc':
      return { boosted: -1, price: -1 };
    case 'popular':
      return { boosted: -1, views: -1, createdAt: -1 };
    case 'latest':
    default:
      return hasTextSearch
        ? { score: { $meta: 'textScore' }, boosted: -1, createdAt: -1 }
        : { boosted: -1, createdAt: -1 };
  }
};

export const listingRepository = {
  create: (data) => Listing.create(data),

  findById: (id) =>
    Listing.findById(id)
      .populate('seller', 'name email phone location avatar createdAt')
      .populate('category', 'name slug icon'),

  updateById: (id, update) =>
    Listing.findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .populate('seller', 'name email phone location avatar')
      .populate('category', 'name slug icon'),

  deleteById: (id) => Listing.findByIdAndDelete(id),

  incrementViews: (id) => Listing.findByIdAndUpdate(id, { $inc: { views: 1 } }),

  list: async ({ page = 1, limit = 12, sort = 'latest', ...filters }) => {
    const categoryIds = await expandCategoryWithDescendants(filters.category);
    const filter = buildFilter({ ...filters, categoryIds });
    const hasText = !!filter.$text;
    const sortBy = buildSort(sort, hasText);

    const projection = hasText ? { score: { $meta: 'textScore' } } : null;

    const [items, total] = await Promise.all([
      Listing.find(filter, projection)
        .sort(sortBy)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('seller', 'name avatar location')
        .populate('category', 'name slug icon'),
      Listing.countDocuments(filter),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  },

  similar: ({ categoryId, excludeId, limit = 6 }) =>
    Listing.find({
      category: categoryId,
      _id: { $ne: excludeId },
      status: 'published',
    })
      .sort({ boosted: -1, createdAt: -1 })
      .limit(limit)
      .populate('seller', 'name avatar')
      .populate('category', 'name slug'),
};
