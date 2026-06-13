import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { Role } from '../types';
import {
  getDashboard,
  getRiders,
  approveRider,
  setRiderStatus,
  getClients,
  getAdminTrips,
  cancelTrip,
  getConfig,
  updateConfig,
  createSubscription,
  getSubscriptions,
} from '../controllers/admin.controller';

const router = Router();

router.use(authenticateJWT, requireRole(Role.ADMIN));

router.get('/dashboard', asyncHandler(getDashboard));
router.get('/riders', asyncHandler(getRiders));
router.put('/riders/:id/approve', asyncHandler(approveRider));
router.put('/riders/:id/status', asyncHandler(setRiderStatus));
router.get('/clients', asyncHandler(getClients));
router.get('/trips', asyncHandler(getAdminTrips));
router.put('/trips/:id/cancel', asyncHandler(cancelTrip));
router.get('/config', asyncHandler(getConfig));
router.put('/config', asyncHandler(updateConfig));
router.post('/subscriptions', asyncHandler(createSubscription));
router.get('/subscriptions', asyncHandler(getSubscriptions));

export default router;
