import { z } from 'zod';
import { TripStatus } from '../types';

export const createTripSchema = z.object({
  body: z.object({
    originLat: z.number(),
    originLng: z.number(),
    originAddress: z.string().min(1),
    destLat: z.number(),
    destLng: z.number(),
    destAddress: z.string().min(1),
    negotiatedPrice: z.number().optional(),
  }),
});

export const updateTripStatusSchema = z.object({
  body: z.object({
    status: z.enum([
      TripStatus.ACCEPTED,
      TripStatus.EN_ROUTE,
      TripStatus.IN_PROGRESS,
      TripStatus.COMPLETED,
      TripStatus.CANCELLED,
    ]),
  }),
});

export const rateTripSchema = z.object({
  body: z.object({
    rating: z.number().int().min(1).max(5),
  }),
});

export type CreateTripInput = z.infer<typeof createTripSchema>['body'];
