import { body, param } from 'express-validator';

export const startConversationValidator = [
  body('listingId').isMongoId(),
  body('message').isString().trim().isLength({ min: 1, max: 2000 }),
];

export const sendMessageValidator = [
  param('id').isMongoId(),
  body('body').isString().trim().isLength({ min: 1, max: 2000 }),
];
