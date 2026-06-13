import { Request, Response } from 'express';
import { prisma } from '../db';
import { sendSuccess, sendError } from '../utils/response';
import { calculateDistance } from '../services/pricing.service';

const DEFAULT_RADIUS_KM = 10;

export async function getNearbyRiders(req: Request, res: Response): Promise<void> {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  const radiusKm = parseFloat(req.query.radiusKm as string) || DEFAULT_RADIUS_KM;

  if (isNaN(lat) || isNaN(lng)) {
    sendError(res, 'lat and lng query params are required', 400, 'VALIDATION_ERROR');
    return;
  }

  const riders = await prisma.riderProfile.findMany({
    where: {
      isAvailable: true,
      subscriptionStatus: 'ACTIVE',
      latitude: { not: null },
      longitude: { not: null },
    },
    include: { user: { select: { id: true, name: true } } },
  });

  const nearby = riders
    .filter((r) => {
      if (r.latitude == null || r.longitude == null) return false;
      const dist = calculateDistance(lat, lng, r.latitude, r.longitude);
      return dist <= radiusKm;
    })
    .map((r) => ({
      id: r.id,
      userId: r.userId,
      name: r.user.name,
      lat: r.latitude,
      lng: r.longitude,
      avgRating: r.avgRating,
      totalRides: r.totalRides,
    }));

  sendSuccess(res, { riders: nearby });
}

export async function updateAvailability(req: Request, res: Response): Promise<void> {
  const { isAvailable } = req.body as { isAvailable: boolean };

  const profile = await prisma.riderProfile.findUnique({
    where: { userId: req.user!.userId },
    select: { subscriptionStatus: true },
  });

  if (!profile) {
    sendError(res, 'Rider profile not found', 404, 'NOT_FOUND');
    return;
  }

  if (isAvailable && profile.subscriptionStatus !== 'ACTIVE') {
    sendError(res, 'Active subscription required to go available', 403, 'SUBSCRIPTION_REQUIRED');
    return;
  }

  const updated = await prisma.riderProfile.update({
    where: { userId: req.user!.userId },
    data: { isAvailable },
  });

  sendSuccess(res, { isAvailable: updated.isAvailable });
}

export async function updateLocation(req: Request, res: Response): Promise<void> {
  const { lat, lng } = req.body as { lat: number; lng: number };

  await prisma.riderProfile.update({
    where: { userId: req.user!.userId },
    data: { latitude: lat, longitude: lng },
  });

  sendSuccess(res, { updated: true });
}
