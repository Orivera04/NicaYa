import { Prisma, PrismaClient } from "@prisma/client";
import { AppError } from "../lib/error.js";

export const demoCleanupConfirmation = "BORRAR DATOS DE PRUEBA";

const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .toLowerCase();

type CleanupUser = { id: string; name: string; email: string; role: string };

const isRider4 = (user: CleanupUser) => {
  const name = normalize(user.name);
  const email = normalize(user.email);
  return user.role === "RIDER" && (name === "rider4" || email.startsWith("rider4@"));
};

const isHeldaRueda = (user: CleanupUser) => {
  const name = normalize(user.name);
  const email = normalize(user.email);
  return user.role === "CLIENT" && (name === "helda rueda" || email.includes("heldarueda"));
};

export type DemoCleanupSummary = {
  retained: { role: string; email: string }[];
  removedUsers: number;
  trips: number;
  pendingPayments: number;
  pendingOrders: number;
  savedPlaces: number;
};

export async function cleanDemoData(prisma: PrismaClient, actorId?: string): Promise<DemoCleanupSummary> {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: { createdAt: "asc" },
  });
  const admin = actorId
    ? users.find((user) => user.id === actorId && user.role === "ADMIN")
    : users.find((user) => user.role === "ADMIN");
  const riders = users.filter(isRider4);
  const clients = users.filter(isHeldaRueda);

  if (!admin || riders.length !== 1 || clients.length !== 1) {
    throw new AppError(
      409,
      "CLEANUP_TARGETS_NOT_FOUND",
      "No fue posible identificar de forma segura al administrador actual, Rider4 y Helda Rueda. No se elimino ningun dato.",
    );
  }

  const rider = riders[0];
  const client = clients[0];
  const retainedUsers = [admin, rider, client];
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