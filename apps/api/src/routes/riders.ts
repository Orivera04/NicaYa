import crypto from "crypto";
import { z } from "zod";
import { availabilitySchema } from "@motoya/shared";
import { prisma } from "../db.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { safeRouter } from "../middleware/safe-router.js";
import { getSettings } from "../services/settings.service.js";
import { assertRiderCanOperate } from "../services/subscription.service.js";

export const ridersRouter = safeRouter();
ridersRouter.use(authenticate, authorize("RIDER"));

const profileSchema = z.object({ nationalId: z.string().trim().min(5).max(40), driverLicense: z.string().trim().min(5).max(40), vehiclePlate: z.string().trim().min(3).max(20), vehicleModel: z.string().trim().min(2).max(80) });
const documentType = z.enum(["NATIONAL_ID", "DRIVER_LICENSE", "VEHICLE_REGISTRATION"]);
const requiredDocuments = ["NATIONAL_ID", "DRIVER_LICENSE", "VEHICLE_REGISTRATION"] as const;

async function activation(userId: string) {
  const now = new Date();
  const rider = await prisma.riderProfile.findUniqueOrThrow({ where: { userId }, include: { documents: true, subscriptions: { where: { status: "ACTIVE", startsAt: { lte: now }, expiresAt: { gt: now } }, orderBy: { expiresAt: "desc" }, take: 1 } } });
  const profileComplete = Boolean(rider.nationalId && rider.driverLicense && rider.vehiclePlate && rider.vehicleModel);
  const docs = requiredDocuments.map((type) => rider.documents.find((document) => document.type === type));
  const allDocumentsApproved = docs.every((document) => document?.status === "APPROVED");
  const allDocumentsSubmitted = docs.every((document) => document && ["SUBMITTED", "UNDER_REVIEW", "APPROVED"].includes(document.status));
  const hasSubscription = rider.subscriptions.length > 0;
  let status = rider.onboardingStatus;
  if (!profileComplete) status = "PROFILE_INCOMPLETE";
  else if (rider.approval === "REJECTED") status = "REJECTED";
  else if (!allDocumentsSubmitted) status = "DOCUMENTS_PENDING";
  else if (rider.approval !== "APPROVED" || !allDocumentsApproved) status = "UNDER_REVIEW";
  else if (!hasSubscription) status = "SUBSCRIPTION_REQUIRED";
  else if (!rider.workZoneConfigured) status = "APPROVED";
  else status = "READY_TO_WORK";
  if (status !== rider.onboardingStatus) await prisma.riderProfile.update({ where: { id: rider.id }, data: { onboardingStatus: status } });
  const actions: Record<string, string> = { PROFILE_INCOMPLETE: "Completa tus datos de identidad y vehiculo.", DOCUMENTS_PENDING: "Envia los tres documentos requeridos.", UNDER_REVIEW: "Tus documentos estan en revision administrativa.", REQUIRES_CORRECTION: "Corrige los documentos indicados por el administrador.", REJECTED: "Tu solicitud fue rechazada. Contacta soporte para mas informacion.", SUBSCRIPTION_REQUIRED: "Activa una suscripcion para poder trabajar.", APPROVED: "Configura tu zona de trabajo para habilitarte.", READY_TO_WORK: "Ya puedes activar tu disponibilidad." };
  return { status, profileComplete, documents: rider.documents, workZoneConfigured: rider.workZoneConfigured, subscriptionActive: hasSubscription, nextAction: actions[status] || "Revisa el estado de tu cuenta." };
}

ridersRouter.get("/me", async (req, res) => res.json(await prisma.riderProfile.findUnique({ where: { userId: req.user!.id }, include: { documents: true, subscriptions: { orderBy: { createdAt: "desc" } } } })));
ridersRouter.get("/me/activation", async (req, res) => res.json(await activation(req.user!.id)));
ridersRouter.patch("/me/onboarding/profile", async (req, res) => { const data = profileSchema.parse(req.body); await prisma.riderProfile.update({ where: { userId: req.user!.id }, data: { ...data, onboardingStatus: "DOCUMENTS_PENDING" } }); res.json(await activation(req.user!.id)); });
ridersRouter.patch("/me/work-zone", async (req, res) => { const data = z.object({ configured: z.boolean() }).parse(req.body); await prisma.riderProfile.update({ where: { userId: req.user!.id }, data: { workZoneConfigured: data.configured } }); res.json(await activation(req.user!.id)); });
ridersRouter.post("/me/documents/:type", async (req, res) => { const type = documentType.parse(req.params.type); const data = z.object({ reference: z.string().trim().min(3).max(500), expiresAt: z.string().datetime().optional() }).parse(req.body); const rider = await prisma.riderProfile.findUniqueOrThrow({ where: { userId: req.user!.id } }); const document = await prisma.riderDocument.upsert({ where: { riderId_type: { riderId: rider.id, type } }, update: { reference: data.reference, expiresAt: data.expiresAt ? new Date(data.expiresAt) : null, status: "SUBMITTED", reviewedAt: null, reviewedById: null, rejectionReason: null }, create: { riderId: rider.id, type, reference: data.reference, expiresAt: data.expiresAt ? new Date(data.expiresAt) : null, status: "SUBMITTED" } }); res.status(201).json({ document, activation: await activation(req.user!.id) }); });
ridersRouter.patch("/me/availability", async (req, res) => { const data = availabilitySchema.parse(req.body); if (data.available) { await activation(req.user!.id); await assertRiderCanOperate(req.user!.id); } const rider = await prisma.riderProfile.update({ where: { userId: req.user!.id }, data: { available: data.available } }); req.app.get("io")?.to("admins").emit("rider:availability-updated", rider); res.json(rider); });
ridersRouter.get("/me/subscription", async (req, res) => { const now = new Date(); const current = await prisma.riderSubscription.findFirst({ where: { rider: { userId: req.user!.id }, status: "ACTIVE", startsAt: { lte: now }, expiresAt: { gt: now } }, include: { plan: true, payment: true }, orderBy: { expiresAt: "desc" } }); res.json(current ?? await prisma.riderSubscription.findFirst({ where: { rider: { userId: req.user!.id } }, include: { plan: true, payment: true }, orderBy: { createdAt: "desc" } })); });
ridersRouter.get("/me/subscription/payments", async (req, res) => res.json(await prisma.subscriptionPayment.findMany({ where: { rider: { userId: req.user!.id } }, orderBy: { createdAt: "desc" }, take: 10 })));
ridersRouter.post("/me/subscription/payments", async (req, res) => { const data = z.object({ amount: z.number().positive().optional() }).parse(req.body); const rider = await prisma.riderProfile.findUniqueOrThrow({ where: { userId: req.user!.id } }); const settings = await getSettings(); const amount = data.amount ?? Number(settings.monthlySubscriptionPrice); if (amount < Number(settings.monthlySubscriptionPrice)) return res.status(422).json({ error: { code: "INVALID_PAYMENT_AMOUNT", message: `El monto minimo es ${settings.monthlySubscriptionPrice} ${settings.currency}.` } }); const payment = await prisma.subscriptionPayment.create({ data: { riderId: rider.id, reference: String(crypto.randomInt(100000, 1000000)), amount, currency: settings.currency, expiresAt: new Date(Date.now() + 60 * 60_000) } }); res.status(201).json(payment); });
ridersRouter.get("/available-trips", async (req, res) => { await assertRiderCanOperate(req.user!.id); res.json(await prisma.trip.findMany({ where: { status: "REQUESTED", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, take: 30 })); });
