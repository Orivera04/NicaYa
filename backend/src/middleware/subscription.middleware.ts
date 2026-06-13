import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { sendError } from '../utils/response';
import { Role } from '../types';

export async function requireActiveSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user || req.user.role !== Role.RIDER) {
    next();
    return;
  }

  const profile = await prisma.riderProfile.findUnique({
    where: { userId: req.user.userId },
    select: { subscriptionStatus: true },
  });

  if (!profile || profile.subscriptionStatus !== 'ACTIVE') {
    sendError(res, 'Active subscription required to accept trips', 403, 'SUBSCRIPTION_REQUIRED');
    return;
  }

  next();
}
