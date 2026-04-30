import { Router } from 'express';
import * as ctrl from '../controllers/favoriteController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', ctrl.listFavorites);
router.post('/:listingId', ctrl.addFavorite);
router.delete('/:listingId', ctrl.removeFavorite);

export default router;
