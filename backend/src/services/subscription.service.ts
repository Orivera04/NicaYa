import { prisma } from '../db';
import { AppError } from '../utils/AppError';
import { SubscriptionStatus } from '../types';

export async function activateSubscription(
  riderId: string,
  months = 1
): Promise<{ subscription: object; expiresAt: Date }> {
  const profile = await prisma.riderProfile.findUnique({ where: { id: riderId } });
  if (!profile) throw new AppError('Rider profile not found', 404, 'NOT_FOUND');

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + months);

  const priceConfig = await prisma.appConfig.findUnique({
    where: { key: 'subscription_price_monthly' },
  });
  const amount = parseFloat(priceConfig?.value ?? '500');

  const currencyConfig = await prisma.appConfig.findUnique({ where: { key: 'currency' } });
  const currency = currencyConfig?.value ?? 'NIO';

  const [subscription] = await prisma.$transaction([
    prisma.subscription.create({
      data: {
        riderId,
        startDate: now,
        endDate: expiresAt,
        amount,
        currency,
        status: SubscriptionStatus.ACTIVE,
      },
    }),
    prisma.riderProfile.update({
      where: { id: riderId },
      data: {
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        subscriptionExpiresAt: expiresAt,
      },
    }),
  ]);

  return { subscription, expiresAt };
}

export async function checkAndExpireSubscriptions(): Promise<void> {
  const now = new Date();
  await prisma.riderProfile.updateMany({
    where: {
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      subscriptionExpiresAt: { lt: now },
    },
    data: { subscriptionStatus: SubscriptionStatus.EXPIRED, isAvailable: false },
  });
}
