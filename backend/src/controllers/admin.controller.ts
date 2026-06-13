import { Request, Response } from 'express';
import { prisma } from '../db';
import { sendSuccess, sendError } from '../utils/response';
import { activateSubscription } from '../services/subscription.service';
import { RiderStatus, SubscriptionStatus, TripStatus } from '../types';

export async function getDashboard(_req: Request, res: Response): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    activeRiders,
    expiredSubscriptions,
    totalClients,
    tripsToday,
    completedTrips,
    revenueResult,
  ] = await prisma.$transaction([
    prisma.riderProfile.count({ where: { subscriptionStatus: SubscriptionStatus.ACTIVE } }),
    prisma.riderProfile.count({ where: { subscriptionStatus: SubscriptionStatus.EXPIRED } }),
    prisma.user.count({ where: { role: 'CLIENT' } }),
    prisma.trip.count({ where: { createdAt: { gte: today } } }),
    prisma.trip.count({ where: { status: TripStatus.COMPLETED } }),
    prisma.subscription.aggregate({
      _sum: { amount: true },
      where: { status: SubscriptionStatus.ACTIVE },
    }),
  ]);

  // Trips per day (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentTrips = await prisma.trip.findMany({
    where: { createdAt: { gte: sevenDaysAgo } },
    select: { createdAt: true, status: true },
  });

  const tripsPerDay: Record<string, number> = {};
  recentTrips.forEach((t) => {
    const day = t.createdAt.toISOString().split('T')[0];
    tripsPerDay[day] = (tripsPerDay[day] ?? 0) + 1;
  });

  sendSuccess(res, {
    metrics: {
      activeRiders,
      expiredSubscriptions,
      totalClients,
      tripsToday,
      completedTrips,
      subscriptionRevenue: revenueResult._sum.amount ?? 0,
    },
    charts: { tripsPerDay },
  });
}

export async function getRiders(req: Request, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const skip = (page - 1) * limit;
  const status = req.query.status as RiderStatus | undefined;

  const where = status ? { status } : {};

  const [riders, total] = await prisma.$transaction([
    prisma.riderProfile.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: { user: { select: { id: true, name: true, email: true, phone: true, createdAt: true } } },
    }),
    prisma.riderProfile.count({ where }),
  ]);

  sendSuccess(res, { items: riders, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function approveRider(req: Request, res: Response): Promise<void> {
  const profile = await prisma.riderProfile.findUnique({ where: { id: req.params.id } });
  if (!profile) {
    sendError(res, 'Rider profile not found', 404, 'NOT_FOUND');
    return;
  }

  const updated = await prisma.riderProfile.update({
    where: { id: req.params.id },
    data: { status: RiderStatus.APPROVED },
  });

  sendSuccess(res, { profile: updated });
}

export async function setRiderStatus(req: Request, res: Response): Promise<void> {
  const { status } = req.body as { status: RiderStatus };
  const updated = await prisma.riderProfile.update({
    where: { id: req.params.id },
    data: { status },
  });
  sendSuccess(res, { profile: updated });
}

export async function getClients(req: Request, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const skip = (page - 1) * limit;

  const [clients, total] = await prisma.$transaction([
    prisma.user.findMany({
      where: { role: 'CLIENT' },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, phone: true, createdAt: true },
    }),
    prisma.user.count({ where: { role: 'CLIENT' } }),
  ]);

  sendSuccess(res, { items: clients, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function getAdminTrips(req: Request, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const skip = (page - 1) * limit;

  const [trips, total] = await prisma.$transaction([
    prisma.trip.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, name: true } },
        rider: { select: { id: true, name: true } },
      },
    }),
    prisma.trip.count(),
  ]);

  sendSuccess(res, { items: trips, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function cancelTrip(req: Request, res: Response): Promise<void> {
  const trip = await prisma.trip.findUnique({ where: { id: req.params.id } });
  if (!trip) {
    sendError(res, 'Trip not found', 404, 'NOT_FOUND');
    return;
  }

  const updated = await prisma.trip.update({
    where: { id: req.params.id },
    data: { status: TripStatus.CANCELLED },
  });

  sendSuccess(res, { trip: updated });
}

export async function getConfig(_req: Request, res: Response): Promise<void> {
  const configs = await prisma.appConfig.findMany();
  const result = configs.reduce<Record<string, string>>((acc, c) => {
    acc[c.key] = c.value;
    return acc;
  }, {});
  sendSuccess(res, { config: result });
}

export async function updateConfig(req: Request, res: Response): Promise<void> {
  const entries = req.body as Record<string, string>;
  const updates = await prisma.$transaction(
    Object.entries(entries).map(([key, value]) =>
      prisma.appConfig.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )
  );
  sendSuccess(res, { updated: updates.length });
}

export async function createSubscription(req: Request, res: Response): Promise<void> {
  const { riderId, months = 1 } = req.body as { riderId: string; months?: number };
  const result = await activateSubscription(riderId, months);
  sendSuccess(res, result, 201);
}

export async function getSubscriptions(req: Request, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const skip = (page - 1) * limit;

  const [subs, total] = await prisma.$transaction([
    prisma.subscription.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { rider: { include: { user: { select: { name: true, email: true } } } } },
    }),
    prisma.subscription.count(),
  ]);

  sendSuccess(res, { items: subs, total, page, limit, totalPages: Math.ceil(total / limit) });
}
