import { validationResult } from 'express-validator';
import { AppError } from '../utils/AppError.js';

export const validate = (req, _res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const details = errors.array().map((e) => ({ path: e.path, message: e.msg }));
  next(AppError.badRequest('Validation failed', details));
};
