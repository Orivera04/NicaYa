import 'dotenv/config';
import { PrismaClient, Role, RiderStatus, SubscriptionStatus, TripStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hash(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

async function main() {
  console.log('Seeding database...');

  // App config
  await prisma.appConfig.upsert({
    where: { key: 'subscription_price_monthly' },
    update: { value: '500' },
    create: { key: 'subscription_price_monthly', value: '500' },
  });

  await prisma.appConfig.upsert({
    where: { key: 'currency' },
    update: { value: 'NIO' },
    create: { key: 'currency', value: 'NIO' },
  });

  await prisma.appConfig.upsert({
    where: { key: 'available_cities' },
    update: { value: JSON.stringify(['Managua', 'León', 'Granada', 'Masaya']) },
    create: { key: 'available_cities', value: JSON.stringify(['Managua', 'León', 'Granada', 'Masaya']) },
  });

  // Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@motoya.com' },
    update: {},
    create: {
      name: 'Admin MotoYa',
      email: 'admin@motoya.com',
      phone: '+50588000000',
      passwordHash: await hash('admin123'),
      role: Role.ADMIN,
    },
  });
  console.log('Admin created:', admin.email);

  // Clients
  const clientData = [
    { name: 'María López', email: 'maria@example.com', phone: '+50588111111' },
    { name: 'Carlos Pérez', email: 'carlos@example.com', phone: '+50588222222' },
    { name: 'Ana García', email: 'ana@example.com', phone: '+50588333333' },
  ];

  const clients = await Promise.all(
    clientData.map(async (c) =>
      prisma.user.upsert({
        where: { email: c.email },
        update: {},
        create: {
          ...c,
          passwordHash: await hash('client123'),
          role: Role.CLIENT,
        },
      })
    )
  );
  console.log('Clients created:', clients.map((c) => c.email).join(', '));

  // Riders (with profiles)
  const riderData = [
    {
      name: 'Juan Hernández',
      email: 'juan.rider@example.com',
      phone: '+50588444444',
      status: RiderStatus.APPROVED,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isAvailable: true,
      latitude: 12.1364,
      longitude: -86.2514,
    },
    {
      name: 'Pedro Martínez',
      email: 'pedro.rider@example.com',
      phone: '+50588555555',
      status: RiderStatus.PENDING,
      subscriptionStatus: SubscriptionStatus.PENDING,
      subscriptionExpiresAt: null,
      isAvailable: false,
      latitude: null,
      longitude: null,
    },
    {
      name: 'Luis Rodríguez',
      email: 'luis.rider@example.com',
      phone: '+50588666666',
      status: RiderStatus.APPROVED,
      subscriptionStatus: SubscriptionStatus.EXPIRED,
      subscriptionExpiresAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      isAvailable: false,
      latitude: 12.1394,
      longitude: -86.2730,
    },
  ];

  const riders = await Promise.all(
    riderData.map(async ({ subscriptionStatus, subscriptionExpiresAt, isAvailable, latitude, longitude, status, ...userData }) => {
      const user = await prisma.user.upsert({
        where: { email: userData.email },
        update: {},
        create: {
          ...userData,
          passwordHash: await hash('rider123'),
          role: Role.RIDER,
        },
      });

      await prisma.riderProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          status,
          subscriptionStatus,
          subscriptionExpiresAt,
          isAvailable,
          latitude,
          longitude,
          avgRating: status === RiderStatus.APPROVED ? 4.5 : 0,
          totalRides: status === RiderStatus.APPROVED ? 12 : 0,
        },
      });

      return user;
    })
  );
  console.log('Riders created:', riders.map((r) => r.email).join(', '));

  // Subscription for active rider
  const activeRider = await prisma.riderProfile.findFirst({
    where: { subscriptionStatus: SubscriptionStatus.ACTIVE },
  });
  if (activeRider) {
    const existingSubscription = await prisma.subscription.findFirst({
      where: { riderId: activeRider.id },
    });
    if (!existingSubscription) {
      await prisma.subscription.create({
        data: {
          riderId: activeRider.id,
          startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          amount: 500,
          currency: 'NIO',
          status: SubscriptionStatus.ACTIVE,
        },
      });
    }
  }

  // Sample trips
  const activeRiderUser = riders[0];
  const tripData = [
    {
      clientId: clients[0].id,
      riderId: activeRiderUser.id,
      status: TripStatus.COMPLETED,
      originLat: 12.1364,
      originLng: -86.2514,
      originAddress: 'Rotonda El Güegüense, Managua',
      destLat: 12.1504,
      destLng: -86.2694,
      destAddress: 'Metrocentro, Managua',
      suggestedPrice: 45,
      finalPrice: 45,
      currency: 'NIO',
      distance: 2.5,
      clientRating: 5,
      riderRating: 4,
    },
    {
      clientId: clients[1].id,
      riderId: activeRiderUser.id,
      status: TripStatus.COMPLETED,
      originLat: 12.1494,
      originLng: -86.2784,
      originAddress: 'Plaza Inter, Managua',
      destLat: 12.1204,
      destLng: -86.2514,
      destAddress: 'Villa Fontana, Managua',
      suggestedPrice: 60,
      finalPrice: 55,
      currency: 'NIO',
      distance: 3.1,
      clientRating: 4,
      riderRating: 5,
    },
    {
      clientId: clients[2].id,
      riderId: activeRiderUser.id,
      status: TripStatus.COMPLETED,
      originLat: 12.1314,
      originLng: -86.2614,
      originAddress: 'Camino de Oriente, Managua',
      destLat: 12.1464,
      destLng: -86.2414,
      destAddress: 'Galerías Santo Domingo, Managua',
      suggestedPrice: 35,
      finalPrice: 35,
      currency: 'NIO',
      distance: 1.8,
      clientRating: 5,
      riderRating: 5,
    },
    {
      clientId: clients[0].id,
      riderId: activeRiderUser.id,
      status: TripStatus.COMPLETED,
      originLat: 12.1554,
      originLng: -86.2834,
      originAddress: 'UCA, Managua',
      destLat: 12.1354,
      destLng: -86.2634,
      destAddress: 'Ciudad Jardín, Managua',
      suggestedPrice: 50,
      finalPrice: 50,
      currency: 'NIO',
      distance: 2.8,
      clientRating: 4,
      riderRating: 4,
    },
    {
      clientId: clients[1].id,
      riderId: null,
      status: TripStatus.CANCELLED,
      originLat: 12.1404,
      originLng: -86.2504,
      originAddress: 'Mercado Huembes, Managua',
      destLat: 12.1604,
      destLng: -86.2704,
      destAddress: 'Altamira D\'Este, Managua',
      suggestedPrice: 40,
      finalPrice: null,
      currency: 'NIO',
      distance: 2.2,
      clientRating: null,
      riderRating: null,
    },
  ];

  for (const tripInput of tripData) {
    const existing = await prisma.trip.findFirst({
      where: {
        clientId: tripInput.clientId,
        originAddress: tripInput.originAddress,
        status: tripInput.status,
      },
    });
    if (!existing) {
      await prisma.trip.create({ data: tripInput });
    }
  }

  console.log('Sample trips created');
  console.log('\n✅ Seed complete!');
  console.log('\nCredentials:');
  console.log('  Admin:   admin@motoya.com / admin123');
  console.log('  Client:  maria@example.com / client123');
  console.log('  Rider:   juan.rider@example.com / rider123');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
