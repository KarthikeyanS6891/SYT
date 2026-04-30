import { AppError } from '../utils/AppError.js';
import { config } from '../config/index.js';

export const notFound = (req, res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
};

export const errorHandler = (err, req, res, _next) => {
  let status = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details;

  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation error';
    details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
  }

  if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = `Duplicate value for field: ${field}`;
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    status = 413;
    message = 'File too large (max 8 MB per image)';
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    status = 400;
    message = 'Too many files (max 10 images)';
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    status = 400;
    message = `Unexpected file field: ${err.field}`;
  }

  if (err.name === 'JsonWebTokenError') {
    status = 401;
    message = 'Invalid token';
  }
  if (err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Token expired';
  }

  if (config.env !== 'test') {
    console.error(`[error] ${status} ${req.method} ${req.originalUrl} - ${message}`);
    if (status >= 500) console.error(err.stack);
  }

  res.status(status).json({
    success: false,
    message,
    details,
    ...(config.env === 'development' && { stack: err.stack }),
  });
};
