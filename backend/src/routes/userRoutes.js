import { Router } from 'express';
import * as ctrl from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  updateProfileValidator,
  changePasswordValidator,
} from '../validators/userValidators.js';

const router = Router();

router.get('/me', authenticate, ctrl.getProfile);
router.patch('/me', authenticate, updateProfileValidator, validate, ctrl.updateProfile);
router.post('/me/password', authenticate, changePasswordValidator, validate, ctrl.changePassword);
router.get('/:id', ctrl.getPublicProfile);

export default router;
