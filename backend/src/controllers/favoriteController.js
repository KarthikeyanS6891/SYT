import { favoriteService } from '../services/favoriteService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/response.js';

export const addFavorite = asyncHandler(async (req, res) => {
  await favoriteService.add(req.user._id, req.params.listingId);
  success(res, { ok: true }, 'Added to favorites');
});

export const removeFavorite = asyncHandler(async (req, res) => {
  await favoriteService.remove(req.user._id, req.params.listingId);
  success(res, { ok: true }, 'Removed from favorites');
});

export const listFavorites = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Math.min(Number(req.query.limit) || 12, 50);
  const result = await favoriteService.list(req.user._id, { page, limit });
  success(res, { items: result.items }, 'OK', 200, {
    page: result.page, limit: result.limit, total: result.total, pages: result.pages,
  });
});
