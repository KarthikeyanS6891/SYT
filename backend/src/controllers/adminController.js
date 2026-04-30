import { adminService } from '../services/adminService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/response.js';

export const listUsers = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const data = await adminService.listUsers({ page, limit, q: req.query.q });
  success(res, { items: data.items }, 'OK', 200, {
    page: data.page, limit: data.limit, total: data.total, pages: data.pages,
  });
});

export const setUserDisabled = asyncHandler(async (req, res) => {
  const { disabled } = req.body;
  const user = await adminService.setUserDisabled(req.params.id, Boolean(disabled));
  success(res, { user });
});

export const setListingStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const listing = await adminService.setListingStatus(req.params.id, status);
  success(res, { listing });
});

export const stats = asyncHandler(async (_req, res) => {
  const data = await adminService.stats();
  success(res, data);
});
