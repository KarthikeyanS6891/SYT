import { storageService } from '../services/storageService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { success } from '../utils/response.js';

export const uploadImages = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw AppError.badRequest('No files uploaded');
  }
  const images = req.files.map((f) => storageService.fromMulter(f));
  success(res, { images }, 'Uploaded');
});
