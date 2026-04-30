import { body } from 'express-validator';

export const registerValidator = [
  body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Name 2-80 chars'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
  body('phone').optional().isString().trim().isLength({ max: 20 }),
  body('location').optional().isString().trim().isLength({ max: 120 }),
];

export const loginValidator = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
];

export const refreshValidator = [
  body('refreshToken').isString().notEmpty().withMessage('Refresh token required'),
];
