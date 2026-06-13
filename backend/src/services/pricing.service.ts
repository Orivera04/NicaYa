import { prisma } from '../db';

const BASE_PRICE_NIO = 20;
const PRICE_PER_KM_NIO = 5;
const EARTH_RADIUS_KM = 6371;

export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function suggestPrice(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<{ price: number; currency: string; distance: number }> {
  const distance = calculateDistance(originLat, originLng, destLat, destLng);

  const currencyConfig = await prisma.appConfig.findUnique({ where: { key: 'currency' } });
  const currency = currencyConfig?.value ?? 'NIO';

  const price = Math.round(BASE_PRICE_NIO + PRICE_PER_KM_NIO * distance);

  return { price, currency, distance: Math.round(distance * 100) / 100 };
}
