import { Router } from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import listingRoutes from './listingRoutes.js';
import categoryRoutes from './categoryRoutes.js';
import favoriteRoutes from './favoriteRoutes.js';
import messageRoutes from './messageRoutes.js';
import adminRoutes from './adminRoutes.js';
import uploadRoutes from './uploadRoutes.js';

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/listings', listingRoutes);
router.use('/categories', categoryRoutes);
router.use('/favorites', favoriteRoutes);
router.use('/messages', messageRoutes);
router.use('/admin', adminRoutes);
router.use('/uploads', uploadRoutes);

export default router;
