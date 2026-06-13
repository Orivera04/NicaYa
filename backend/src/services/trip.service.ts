import { prisma } from '../db';
import { AppError } from '../utils/AppError';
import { TripStatus, Role } from '../types';
import { suggestPrice, calculateDistance } from './pricing.service';
import { getIO } from '../sockets/trip.socket';

export async function createTrip(
  clientId: string,
  data: {
    originLat: number;
    originLng: number;
    originAddress: string;
    destLat: number;
    destLng: number;
    destAddress: string;
    negotiatedPrice?: number;
  }
) {
  const { price, currency, distance } = await suggestPrice(
    data.originLat,
    data.originLng,
    data.destLat,
    data.destLng
  );

  const trip = await prisma.trip.create({
    data: {
      clientId,
      originLat: data.originLat,
      originLng: data.originLng,
      originAddress: data.originAddress,
      destLat: data.destLat,
      destLng: data.destLng,
      destAddress: data.destAddress,
      suggestedPrice: price,
      negotiatedPrice: data.negotiatedPrice,
      currency,
      distance,
      status: TripStatus.REQUESTED,
    },
    include: { client: { select: { id: true, name: true, phone: true } } },
  });

  // Broadcast to nearby riders via Socket.io
  try {
    const io = getIO();
    io.emit('trip:new', { trip });
  } catch {
    // Socket.io may not be initialized in tests
  }

  return trip;
}

export async function acceptTrip(tripId: string, riderId: string) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) throw new AppError('Trip not found', 404, 'NOT_FOUND');
  if (trip.status !== TripStatus.REQUESTED) {
    throw new AppError('Trip is no longer available', 409, 'TRIP_UNAVAILABLE');
  }

  // Verify rider has active subscription
  const profile = await prisma.riderProfile.findUnique({
    where: { userId: riderId },
    select: { subscriptionStatus: true, id: true },
  });
  if (!profile || profile.subscriptionStatus !== 'ACTIVE') {
    throw new AppError('Active subscription required', 403, 'SUBSCRIPTION_REQUIRED');
  }

  const updated = await prisma.trip.update({
    where: { id: tripId },
    data: { riderId, status: TripStatus.ACCEPTED },
    include: {
      client: { select: { id: true, name: true, phone: true } },
      rider: { select: { id: true, name: true, phone: true } },
    },
  });

  try {
    const io = getIO();
    io.emit('trip:accepted', { trip: updated });
  } catch {
    // ignore in tests
  }

  return updated;
}

export async function updateTripStatus(tripId: string, userId: string, role: Role, newStatus: TripStatus) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) throw new AppError('Trip not found', 404, 'NOT_FOUND');

  // Authorization
  const isClient = role === Role.CLIENT && trip.clientId === userId;
  const isRider = role === Role.RIDER && trip.riderId === userId;
  const isAdmin = role === Role.ADMIN;

  if (!isClient && !isRider && !isAdmin) {
    throw new AppError('Not authorized to update this trip', 403, 'FORBIDDEN');
  }

  // Clients can only cancel
  if (isClient && newStatus !== TripStatus.CANCELLED) {
    throw new AppError('Clients can only cancel trips', 403, 'FORBIDDEN');
  }

  const updated = await prisma.trip.update({
    where: { id: tripId },
    data: {
      status: newStatus,
      finalPrice: newStatus === TripStatus.COMPLETED ? (trip.negotiatedPrice ?? trip.suggestedPrice) : undefined,
    },
  });

  try {
    const io = getIO();
    io.emit('trip:status_changed', { trip: updated });
  } catch {
    // ignore in tests
  }

  // Update rider stats on completion
  if (newStatus === TripStatus.COMPLETED && trip.riderId) {
    const profile = await prisma.riderProfile.findUnique({ where: { userId: trip.riderId } });
    if (profile) {
      await prisma.riderProfile.update({
        where: { userId: trip.riderId },
        data: { totalRides: profile.totalRides + 1 },
      });
    }
  }

  return updated;
}

export async function rateTrip(tripId: string, userId: string, role: Role, rating: number) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) throw new AppError('Trip not found', 404, 'NOT_FOUND');
  if (trip.status !== TripStatus.COMPLETED) {
    throw new AppError('Trip must be completed to rate', 400, 'INVALID_STATUS');
  }

  const isClient = role === Role.CLIENT && trip.clientId === userId;
  const isRider = role === Role.RIDER && trip.riderId === userId;

  if (!isClient && !isRider) {
    throw new AppError('Not authorized to rate this trip', 403, 'FORBIDDEN');
  }

  const field = isClient ? 'clientRating' : 'riderRating';
  const updated = await prisma.trip.update({
    where: { id: tripId },
    data: { [field]: rating },
  });

  // Update rider average rating if client rated
  if (isClient && trip.riderId) {
    const riderTrips = await prisma.trip.findMany({
      where: { riderId: trip.riderId, riderRating: { not: null } },
      select: { riderRating: true },
    });
    const avg =
      riderTrips.reduce((sum, t) => sum + (t.riderRating ?? 0), 0) / (riderTrips.length || 1);
    const profile = await prisma.riderProfile.findUnique({ where: { userId: trip.riderId } });
    if (profile) {
      await prisma.riderProfile.update({
        where: { userId: trip.riderId },
        data: { avgRating: Math.round(avg * 10) / 10 },
      });
    }
  }

  return updated;
}

export async function listTrips(userId: string, role: Role, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const where =
    role === Role.CLIENT
      ? { clientId: userId }
      : role === Role.RIDER
      ? { riderId: userId }
      : {};

  const [items, total] = await prisma.$transaction([
    prisma.trip.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, name: true } },
        rider: { select: { id: true, name: true } },
      },
    }),
    prisma.trip.count({ where }),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}
