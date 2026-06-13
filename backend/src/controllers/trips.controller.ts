import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import * as tripService from '../services/trip.service';
import { Role, TripStatus } from '../types';

export async function createTrip(req: Request, res: Response): Promise<void> {
  const trip = await tripService.createTrip(req.user!.userId, req.body);
  sendSuccess(res, { trip }, 201);
}

export async function acceptTrip(req: Request, res: Response): Promise<void> {
  const trip = await tripService.acceptTrip(req.params.id, req.user!.userId);
  sendSuccess(res, { trip });
}

export async function updateTripStatus(req: Request, res: Response): Promise<void> {
  const trip = await tripService.updateTripStatus(
    req.params.id,
    req.user!.userId,
    req.user!.role as Role,
    req.body.status as TripStatus
  );
  sendSuccess(res, { trip });
}

export async function rateTrip(req: Request, res: Response): Promise<void> {
  const trip = await tripService.rateTrip(
    req.params.id,
    req.user!.userId,
    req.user!.role as Role,
    req.body.rating as number
  );
  sendSuccess(res, { trip });
}

export async function listTrips(req: Request, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const result = await tripService.listTrips(req.user!.userId, req.user!.role as Role, page, limit);
  sendSuccess(res, result);
}
