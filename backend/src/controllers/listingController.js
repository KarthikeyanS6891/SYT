import { listingService } from '../services/listingService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { success, created } from '../utils/response.js';

const parseFilters = (q) => ({
  q: q.q,
  category: q.category,
  location: q.location,
  seller: q.seller,
  minPrice: q.minPrice !== undefined ? Number(q.minPrice) : undefined,
  maxPrice: q.maxPrice !== undefined ? Number(q.maxPrice) : undefined,
  sort: q.sort || 'latest',
  page: Number(q.page) || 1,
  limit: Math.min(Number(q.limit) || 12, 50),
});

export const createListing = asyncHandler(async (req, res) => {
  const listing = await listingService.create(req.user._id, req.body);
  created(res, { listing }, 'Listing created');
});

export const updateListing = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const listing = await listingService.update(req.user._id, req.params.id, req.body, { isAdmin });
  success(res, { listing }, 'Listing updated');
});

export const deleteListing = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  await listingService.remove(req.user._id, req.params.id, { isAdmin });
  success(res, { ok: true }, 'Listing deleted');
});

export const getListing = asyncHandler(async (req, res) => {
  const viewerId = req.user?._id;
  const data = await listingService.getById(req.params.id, { viewerId });
  success(res, data);
});

export const listListings = asyncHandler(async (req, res) => {
  const filters = parseFilters(req.query);
  const result = await listingService.list(filters, { viewerId: req.user?._id });
  success(res, { items: result.items }, 'OK', 200, {
    page: result.page, limit: result.limit, total: result.total, pages: result.pages,
  });
});

export const myListings = asyncHandler(async (req, res) => {
  const filters = parseFilters(req.query);
  filters.status = req.query.status;
  const result = await listingService.listMine(req.user._id, filters);
  success(res, { items: result.items }, 'OK', 200, {
    page: result.page, limit: result.limit, total: result.total, pages: result.pages,
  });
});

export const similarListings = asyncHandler(async (req, res) => {
  const items = await listingService.similar(req.params.id);
  success(res, { items });
});

export const toggleBoost = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const listing = await listingService.toggleBoost(req.user._id, req.params.id, { isAdmin });
  success(res, { listing }, 'Boost toggled');
});
