import { Router } from 'express';
import { upload } from '../middleware/upload.js';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/uploadController.js';

const router = Router();

router.post('/images', authenticate, upload.array('images', 10), ctrl.uploadImages);

export default router;
