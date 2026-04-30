import { Router } from 'express';
import * as ctrl from '../controllers/categoryController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', ctrl.listCategories);
router.post('/', authenticate, requireAdmin, ctrl.createCategory);
router.patch('/:id', authenticate, requireAdmin, ctrl.updateCategory);
router.delete('/:id', authenticate, requireAdmin, ctrl.deleteCategory);

export default router;
