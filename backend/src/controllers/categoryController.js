import { Category } from '../models/Category.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { success, created } from '../utils/response.js';
import { AppError } from '../utils/AppError.js';

export const listCategories = asyncHandler(async (_req, res) => {
  const items = await Category.find().sort({ order: 1, name: 1 });
  success(res, { items });
});

export const createCategory = asyncHandler(async (req, res) => {
  const { name, slug, icon, parent, order } = req.body;
  if (!name || !slug) throw AppError.badRequest('Name and slug required');
  const category = await Category.create({ name, slug, icon, parent, order });
  created(res, { category });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!category) throw AppError.notFound('Category not found');
  success(res, { category });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) throw AppError.notFound('Category not found');
  success(res, { ok: true }, 'Deleted');
});
