import { body, query, param } from 'express-validator';

export const createListingValidator = [
  body('title').trim().isLength({ min: 3, max: 140 }),
  body('description').isString().isLength({ min: 10, max: 5000 }),
  body('category').isMongoId().withMessage('Valid category id required'),
  body('price').isFloat({ min: 0 }),
  body('currency').optional().isString().isLength({ min: 1, max: 8 }),
  body('condition').optional().isIn(['new', 'used', 'refurbished']),
  body('location').isString().trim().isLength({ min: 2, max: 120 }),
  body('status').optional().isIn(['draft', 'published']),
  body('images').optional().isArray({ max: 10 }),
];

export const updateListingValidator = [
  param('id').isMongoId(),
  body('title').optional().trim().isLength({ min: 3, max: 140 }),
  body('description').optional().isString().isLength({ min: 10, max: 5000 }),
  body('category').optional().isMongoId(),
  body('price').optional().isFloat({ min: 0 }),
  body('condition').optional().isIn(['new', 'used', 'refurbished']),
  body('location').optional().isString().trim().isLength({ min: 2, max: 120 }),
  body('status').optional().isIn(['draft', 'published', 'sold']),
  body('images').optional().isArray({ max: 10 }),
];

export const listListingValidator = [
  query('q').optional().isString(),
  query('category').optional().isMongoId(),
  query('location').optional().isString(),
  query('seller').optional().isMongoId(),
  query('minPrice').optional().isFloat({ min: 0 }),
  query('maxPrice').optional().isFloat({ min: 0 }),
  query('sort').optional().isIn(['latest', 'price_asc', 'price_desc', 'popular']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
];
