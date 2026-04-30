import { searchService } from '../services/searchService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/response.js';

export const suggest = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 6, 12);
  const data = await searchService.suggest({ q: req.query.q, limit });
  success(res, data);
});
