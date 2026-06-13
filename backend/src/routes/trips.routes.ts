import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticateJWT } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { requireActiveSubscription } from '../middleware/subscription.middleware';
import {
  createTrip,
  acceptTrip,
  updateTripStatus,
  rateTrip,
  listTrips,
} from '../controllers/trips.controller';
import { createTripSchema, updateTripStatusSchema, rateTripSchema } from '../validators/trip.validator';

const router = Router();

router.use(authenticateJWT);

router.get('/', asyncHandler(listTrips));
router.post('/', validate(createTripSchema), asyncHandler(createTrip));
router.put('/:id/accept', requireActiveSubscription, asyncHandler(acceptTrip));
router.put('/:id/status', validate(updateTripStatusSchema), asyncHandler(updateTripStatus));
router.post('/:id/rate', validate(rateTripSchema), asyncHandler(rateTrip));

export default router;
