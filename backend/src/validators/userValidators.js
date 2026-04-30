import { body } from 'express-validator';

export const updateProfileValidator = [
  body('name').optional().trim().isLength({ min: 2, max: 80 }),
  body('phone').optional().isString().trim().isLength({ max: 20 }),
  body('location').optional().isString().trim().isLength({ max: 120 }),
  body('avatar').optional().isString(),
];

export const changePasswordValidator = [
  body('currentPassword').isString().notEmpty(),
  body('newPassword').isLength({ min: 6 }),
];
