import { Router } from 'express';
import * as ctrl from '../controllers/searchController.js';

const router = Router();

router.get('/suggest', ctrl.suggest);

export default router;
