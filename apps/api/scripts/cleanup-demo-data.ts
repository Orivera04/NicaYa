import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const confirmation = "MOTOYA_CLEANUP_CONFIRMED";

const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .toLowerCase();

function shouldKeepUser(user: { name: string; email: string; role: string }) {
  if (user.role === "ADMIN") return true;
  const name = normalize(user.name);
  const email = normalize(user.email);
  return name === "rider4" || email.startsWith("rider4@") || name === "helda rueda" || email.includes("heldarueda");
}

async function main() {
  if (process.env.MOTOYA_MAINTENANCE_CONFIRM !== confirmation) {
    throw new Error("OperaciÃ³n bloqueada. Define MOTOYA_MAINTENANCE_CONFIRM=MOTOYA_CLEANUP_CONFIRMED para ejecutar la limpieza.");
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: { createdAt: "asc" },
  });
  const retainedUsers = users.filter(shouldKeepUser);
  const rider = retainedUsers.find((user) => user.role === "RIDER");
  const client = retainedUsers.find((user) => user.role === "CLIENT");
  const admins = retainedUsers.filter((user) => user.role === "ADMIN");

  if (!rider || !client || admins.length !== 1 || retainedUsers.length !== 3) {
    throw new Error(`No se pudo validar el conjunto a conservar. Detectados: ${retainedUsers.map((user) => `${user.role}:${user.email}`).join(", ") || "ninguno"}.`);
  }

  const retainedIds = retainedUsers.map((user) => user.id);
  const retainedRider = await prisma.riderProfile.findUniqueOrThrow({
    where: { userId: rider.id },
    select: { id: true },
  });

  const result = await prisma.$transaction(async (tx) => {
    // Reset only data created by test activity. Configuration and approved account
    // identity data remain intact.
    const trips = await tx.trip.deleteMany({});
    const savedPlaces = await tx.savedPlace.deleteMany({ where: { userId: { in: retainedIds } } });
    const refreshTokens = await tx.refreshToken.deleteMany({});
    await tx.auditLog.deleteMany({});

    const staleSubscriptions = await tx.riderSubscription.deleteMany({
      where: { riderId: retainedRider.id, status: { in: ["PENDING", "EXPIRED", "CANCELLED"] } },
    });
    const stalePayments = await tx.payment.deleteMany({
      where: {
        OR: [
          { order: { rider: { userId: { notIn: retainedIds } } } },
          { order: { riderId: retainedRider.id }, status: { in: ["PENDING_PAYMENT", "PENDING_REVIEW", "REJECTED", "EXPIRED"] } },
        ],
      },
    });
    const staleOrders = await tx.subscriptionOrder.deleteMany({
      where: {
        OR: [
          { rider: { userId: { notIn: retainedIds } } },
          { riderId: retainedRider.id, payments: { none: {} } },
        ],
      },
    });
    const legacyPayments = await tx.subscriptionPayment.deleteMany({
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
        actorId: admins[0].id,
        action: "DEMO_DATA_CLEANED",
        entity: "System",
        metadata: {
          retainedUsers: retainedUsers.map((user) => ({ id: user.id, role: user.role, email: user.email })),
          removedUsers: removedUsers.count,
          trips: trips.count,
          savedPlaces: savedPlaces.count,
          refreshTokens: refreshTokens.count,
          stalePayments: stalePayments.count,
          staleOrders: staleOrders.count,
          legacyPayments: legacyPayments.count,
          staleSubscriptions: staleSubscriptions.count,
        },
      },
    });

    return { removedUsers: removedUsers.count, trips: trips.count, stalePayments: stalePayments.count, staleOrders: staleOrders.count };
  }, { isolationLevel: "Serializable" });

  console.info(JSON.stringify({ message: "Limpieza completada. Se conservaron Admin, Rider4 y Helda Rueda.", ...result }));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Error durante la limpieza.");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
