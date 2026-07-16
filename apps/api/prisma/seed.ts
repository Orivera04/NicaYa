import { PrismaClient, RiderDocumentType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const documentTypes: RiderDocumentType[] = ["NATIONAL_ID", "DRIVER_LICENSE", "VEHICLE_REGISTRATION", "INSURANCE"];

async function main() {
  const hash = await bcrypt.hash("password123", 12);
  const admin = await prisma.user.upsert({ where: { email: "admin@motoya.local" }, update: {}, create: { name: "Admin MotoYa", email: "admin@motoya.local", passwordHash: await bcrypt.hash("admin123", 12), role: "ADMIN" } });
  const client = await prisma.user.upsert({ where: { email: "client@motoya.local" }, update: {}, create: { name: "Cliente Demo", email: "client@motoya.local", passwordHash: hash, role: "CLIENT", clientProfile: { create: {} } } });
  const insuranceExpiresAt = new Date(Date.now() + 365 * 864e5);
  const rider = await prisma.user.upsert({ where: { email: "rider@motoya.local" }, update: {}, create: { name: "Rider Activo", email: "rider@motoya.local", passwordHash: hash, role: "RIDER", riderProfile: { create: { approval: "APPROVED", available: true, nationalId: "001-000000-0000A", driverLicense: "LIC-0001", vehiclePlate: "M-001", vehicleModel: "Moto demo", insuranceExpiresAt, onboardingStatus: "READY_TO_WORK", workZoneConfigured: true, workZoneDepartment: "Managua" } } } });
  const profile = await prisma.riderProfile.findUniqueOrThrow({ where: { userId: rider.id } });
  await prisma.riderProfile.update({ where: { id: profile.id }, data: { insuranceExpiresAt, nationalId: profile.nationalId || "001-000000-0000A", driverLicense: profile.driverLicense || "LIC-0001", vehiclePlate: profile.vehiclePlate || "M-001", vehicleModel: profile.vehicleModel || "Moto demo" } });
  for (const type of documentTypes) await prisma.riderDocument.upsert({ where: { riderId_type: { riderId: profile.id, type } }, update: { status: "APPROVED", expiresAt: type === "INSURANCE" ? insuranceExpiresAt : null }, create: { riderId: profile.id, type, status: "APPROVED", reference: "seed-verified", expiresAt: type === "INSURANCE" ? insuranceExpiresAt : null } });
  const settings = { launchPhase: "1", baseFare: "50", pricePerKm: "15", minimumFare: "50", currency: "NIO", monthlySubscriptionPrice: "200", freePlanCommissionPercent: "0", premiumPlanCommissionPercent: "5", standardPlanCommissionPercent: "15" };
  for (const [key, value] of Object.entries(settings)) await prisma.systemSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
  console.log({ admin: admin.email, client: client.email, rider: rider.email, phase: 1 });
}
main().finally(() => prisma.$disconnect());
