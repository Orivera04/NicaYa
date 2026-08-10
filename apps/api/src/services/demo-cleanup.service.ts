import { Prisma, PrismaClient } from "@prisma/client";
import { AppError } from "../lib/error.js";

export const demoCleanupConfirmation = "BORRAR DATOS DE PRUEBA";

const cleanupTargets = {
  admin: "admin@motoya.com",
  rider: "rider4@motoya.com",
  client: "heldarueda@gmail.com",
} as const;

export type DemoCleanupSummary = {
  retained: { role: string; email: string }[];
  removedUsers: number;
  trips: number;
  pendingPayments: number;
  pendingOrders: number;
  savedPlaces: number;
};

export async function cleanDemoData(prisma: PrismaClient): Promise<DemoCleanupSummary> {
  const retainedUsers = await prisma.user.findMany({
    where: { email: { in: [cleanupTargets.admin, cleanupTargets.rider, cleanupTargets.client], mode: "insensitive" } },
    select: { id: true, name: true, email: true, role: true },
  });
  const admin = retainedUsers.find((user) => user.role === "ADMIN" && user.email.toLowerCase() === cleanupTargets.admin);
  const rider = retainedUsers.find((user) => user.role === "RIDER" && user.email.toLowerCase() === cleanupTargets.rider);
  const client = retainedUsers.find((user) => user.role === "CLIENT" && user.email.toLowerCase() === cleanupTargets.client);

  if (!admin || !rider || !client || retainedUsers.length !== 3) {
    throw new AppError(
      409,
      "CLEANUP_TARGETS_NOT_FOUND",
      "No se encontraron las tres cuentas autorizadas para la limpieza. No se elimino ningun dato.",
    );
  }

  const retainedIds = retainedUsers.map((user) => user.id);
  const retainedRider = await prisma.riderProfile.findUnique({
    where: { userId: rider.id },
    select: { id: true },
  });
  if (!retainedRider) {
    throw new AppError(409, "CLEANUP_RIDER_PROFILE_MISSING", "Rider4 no tiene un perfil de rider valido. No se elimino ningun dato.");
  }

  return prisma.$transaction(async (tx) => {
    const trips = await tx.trip.deleteMany({});
    const savedPlaces = await tx.savedPlace.deleteMany({ where: { userId: { in: retainedIds } } });
    await tx.refreshToken.deleteMany({});
    await tx.auditLog.deleteMany({});

    await tx.riderSubscription.deleteMany({
      where: {
        OR: [
          { rider: { userId: { notIn: retainedIds } } },
          { riderId: retainedRider.id, status: { in: ["PENDING", "EXPIRED", "CANCELLED"] } },
        ],
      },
    });
    const pendingPayments = await tx.payment.deleteMany({
      where: {
        OR: [
          { order: { rider: { userId: { notIn: retainedIds } } } },
          { order: { riderId: retainedRider.id }, status: { in: ["PENDING_PAYMENT", "PENDING_REVIEW", "REJECTED", "EXPIRED", "CANCELLED"] } },
        ],
      },
    });
    const pendingOrders = await tx.subscriptionOrder.deleteMany({
      where: {
        OR: [
          { rider: { userId: { notIn: retainedIds } } },
          { riderId: retainedRider.id, payments: { none: {} } },
        ],
      },
    });
    await tx.subscriptionPayment.deleteMany({
      where: {
        OR: [
          { rider: { userId: { notIn: retainedIds } } },
          { riderId: retainedRider.id, status: { in: ["PENDING", "EXPIRED", "CANCELLED"] } },
        ],
      },
    });

    const removedUsers = await tx.user.deleteMany({ where: { id: { notIn: retainedIds } } });
    await tx.riderProfile.update({ where: { id: retainedRider.id }, data: { available: false } });
    await tx.auditLog.create({
      data: {
        actorId: admin.id,
        action: "DEMO_DATA_CLEANED",
        entity: "System",
        metadata: {
          retainedUsers: retainedUsers.map((user) => ({ role: user.role, email: user.email })),
          removedUsers: removedUsers.count,
          trips: trips.count,
          savedPlaces: savedPlaces.count,
          pendingPayments: pendingPayments.count,
          pendingOrders: pendingOrders.count,
        },
      },
    });

    return {
      retained: retainedUsers.map((user) => ({ role: user.role, email: user.email })),
      removedUsers: removedUsers.count,
      trips: trips.count,
      pendingPayments: pendingPayments.count,
      pendingOrders: pendingOrders.count,
      savedPlaces: savedPlaces.count,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 60_000 });
}