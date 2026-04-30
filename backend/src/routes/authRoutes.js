import { Router } from 'express';
import * as ctrl from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import {
  registerValidator,
  loginValidator,
  refreshValidator,
} from '../validators/authValidators.js';

const router = Router();

router.post('/register', authLimiter, registerValidator, validate, ctrl.register);
router.post('/login', authLimiter, loginValidator, validate, ctrl.login);
router.post('/google', authLimiter, ctrl.googleLogin);
router.post('/refresh', refreshValidator, validate, ctrl.refresh);
router.post('/logout', authenticate, ctrl.logout);
router.post('/logout-all', authenticate, ctrl.logoutAll);
router.get('/me', authenticate, ctrl.me);

export default router;
