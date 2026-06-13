import { Router } from 'express';
import authRoutes from './auth.routes';
import tripsRoutes from './trips.routes';
import ridersRoutes from './riders.routes';
import adminRoutes from './admin.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/trips', tripsRoutes);
router.use('/riders', ridersRoutes);
router.use('/admin', adminRoutes);

router.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

export default router;
