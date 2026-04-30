import { Router } from 'express';
import * as ctrl from '../controllers/messageController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  startConversationValidator,
  sendMessageValidator,
} from '../validators/messageValidators.js';

const router = Router();

router.use(authenticate);

router.get('/conversations', ctrl.listConversations);
router.post('/conversations', startConversationValidator, validate, ctrl.startConversation);
router.get('/conversations/:id', ctrl.getMessages);
router.post('/conversations/:id/messages', sendMessageValidator, validate, ctrl.sendMessage);
router.post('/conversations/:id/read', ctrl.markRead);

export default router;
