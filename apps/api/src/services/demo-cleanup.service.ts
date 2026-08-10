import { Prisma, PrismaClient } from "@prisma/client";

export const demoCleanupConfirmation = "BORRAR DATOS DE PRUEBA";

const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .toLowerCase();

const shouldKeepUser = (user: { name: string; email: string; role: string }) => {
  if (user.role === "ADMIN") return true;
  const name = normalize(user.name);
  const email = normalize(user.email);
  return name === "rider4" || email.startsWith("rider4@") || name === "helda rueda" || email.includes("heldarueda");
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
  const retainedUsers = users.filter(shouldKeepUser);
  const rider = retainedUsers.find((user) => user.role === "RIDER");
  const client = retainedUsers.find((user) => user.role === "CLIENT");
  const admins = retainedUsers.filter((user) => user.role === "ADMIN");

  if (!rider || !client || admins.length !== 1 || retainedUsers.length !== 3) {
    throw new Error(
      `No se pudo validar el conjunto a conservar. Detectados: ${retainedUsers.map((user) => `${user.role}:${user.email}`).join(", ") || "ninguno"}.`,
    );
  }

  const retainedIds = retainedUsers.map((user) => user.id);
  const retainedRider = await prisma.riderProfile.findUniqueOrThrow({
    where: { userId: rider.id },
    select: { id: true },
  });

  return prisma.$transaction(async (tx) => {
    const trips = await tx.trip.deleteMany({});
    const savedPlaces = await tx.savedPlace.deleteMany({ where: { userId: { in: retainedIds } } });
    await tx.refreshToken.deleteMany({});
    await tx.auditLog.deleteMany({});

    await tx.riderSubscription.deleteMany({
      where: { OR: [{ rider: { userId: { notIn: retainedIds } } }, { riderId: retainedRider.id, status: { in: ["PENDING", "EXPIRED", "CANCELLED"] } }] },
    });
    const pendingPayments = await tx.payment.deleteMany({
      where: {
        OR: [
          { order: { rider: { userId: { notIn: retainedIds } } } },
          { order: { riderId: retainedRider.id }, status: { in: ["PENDING_PAYMENT", "PENDING_REVIEW", "REJECTED", "EXPIRED"] } },
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
        actorId: actorId ?? admins[0].id,
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
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
