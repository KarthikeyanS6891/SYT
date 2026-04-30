import { Router } from 'express';
import * as ctrl from '../controllers/adminController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/stats', ctrl.stats);
router.get('/users', ctrl.listUsers);
router.patch('/users/:id', ctrl.setUserDisabled);
router.patch('/listings/:id/status', ctrl.setListingStatus);

export default router;
