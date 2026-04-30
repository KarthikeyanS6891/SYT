import { Router } from 'express';
import * as ctrl from '../controllers/listingController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createListingValidator,
  updateListingValidator,
  listListingValidator,
} from '../validators/listingValidators.js';

const router = Router();

router.get('/', optionalAuth, listListingValidator, validate, ctrl.listListings);
router.get('/mine', authenticate, ctrl.myListings);
router.get('/:id', optionalAuth, ctrl.getListing);
router.get('/:id/similar', ctrl.similarListings);

router.post('/', authenticate, createListingValidator, validate, ctrl.createListing);
router.patch('/:id', authenticate, updateListingValidator, validate, ctrl.updateListing);
router.delete('/:id', authenticate, ctrl.deleteListing);
router.post('/:id/boost', authenticate, ctrl.toggleBoost);

export default router;
