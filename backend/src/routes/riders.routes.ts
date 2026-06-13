import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { getNearbyRiders, updateAvailability, updateLocation } from '../controllers/riders.controller';
import { Role } from '../types';

const router = Router();

router.get('/nearby', authenticateJWT, asyncHandler(getNearbyRiders));
router.put('/availability', authenticateJWT, requireRole(Role.RIDER), asyncHandler(updateAvailability));
router.put('/location', authenticateJWT, requireRole(Role.RIDER), asyncHandler(updateLocation));

export default router;
