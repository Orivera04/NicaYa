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
  return { status, profileComplete, documents: rider.documents, documentsSubmittedAt: rider.documentsSubmittedAt, workZoneConfigured: rider.workZoneConfigured, workZoneDepartment: rider.workZoneDepartment, subscriptionActive: hasSubscription, nextAction: actions[status] || "Revisa el estado de tu cuenta." };
}

ridersRouter.get("/me", async (req, res) => res.json(await prisma.riderProfile.findUnique({ where: { userId: req.user!.id }, include: { documents: true, subscriptions: { orderBy: { createdAt: "desc" } } } })));
ridersRouter.get("/me/activation", async (req, res) => res.json(await activation(req.user!.id)));
ridersRouter.patch("/me/onboarding/profile", async (req, res) => { const data = profileSchema.parse(req.body); await prisma.riderProfile.update({ where: { userId: req.user!.id }, data: { ...data, onboardingStatus: "DOCUMENTS_PENDING" } }); res.json(await activation(req.user!.id)); });
ridersRouter.post("/me/work-zone/detect", async (req, res) => { const data = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).parse(req.body); let department = "Zona detectada"; try { const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${data.lat}&lon=${data.lng}&format=jsonv2&zoom=10`, { headers: { "User-Agent": "MotoYa-MVP/1.0" } }); const place = await response.json() as { address?: Record<string, string> }; department = place.address?.state || place.address?.county || place.address?.city || department; } catch {} res.json({ department, ...data }); });
ridersRouter.patch("/me/work-zone", async (req, res) => { const data = z.object({ department: z.string().trim().min(2).max(80), lat: z.number(), lng: z.number() }).parse(req.body); await prisma.riderProfile.update({ where: { userId: req.user!.id }, data: { workZoneConfigured: true, workZoneDepartment: data.department, workZoneLat: data.lat, workZoneLng: data.lng, workZoneUpdatedAt: new Date() } }); res.json(await activation(req.user!.id)); });
ridersRouter.post("/me/documents/submit", async (req, res) => { const image = z.string().regex(/^data:image\/(jpeg|png|webp);base64,/).max(700000); const data = z.object({ documents: z.array(z.object({ type: documentType, frontImage: image, backImage: image })).length(3) }).parse(req.body); if (new Set(data.documents.map((document) => document.type)).size !== 3) return res.status(400).json({ error: { code: "DOCUMENT_SET_INVALID", message: "Debes enviar los tres documentos requeridos." } }); const rider = await prisma.riderProfile.findUniqueOrThrow({ where: { userId: req.user!.id } }); if (rider.documentsSubmittedAt) return res.status(409).json({ error: { code: "DOCUMENTS_ALREADY_SUBMITTED", message: "Tu expediente ya esta en revision." } }); await prisma.$transaction(async (tx) => { for (const document of data.documents) await tx.riderDocument.upsert({ where: { riderId_type: { riderId: rider.id, type: document.type } }, update: { frontImage: document.frontImage, backImage: document.backImage, status: "SUBMITTED", reviewedAt: null, reviewedById: null, rejectionReason: null }, create: { riderId: rider.id, type: document.type, frontImage: document.frontImage, backImage: document.backImage, status: "SUBMITTED" } }); await tx.riderProfile.update({ where: { id: rider.id }, data: { documentsSubmittedAt: new Date(), onboardingStatus: "UNDER_REVIEW" } }); }); res.status(201).json(await activation(req.user!.id)); });
ridersRouter.patch("/me/availability", async (req, res) => { const data = availabilitySchema.parse(req.body); if (data.available) { await activation(req.user!.id); await assertRiderCanOperate(req.user!.id); } const rider = await prisma.riderProfile.update({ where: { userId: req.user!.id }, data: { available: data.available } }); req.app.get("io")?.to("admins").emit("rider:availability-updated", rider); res.json(rider); });
ridersRouter.get("/me/subscription", async (req, res) => { const now = new Date(); const current = await prisma.riderSubscription.findFirst({ where: { rider: { userId: req.user!.id }, status: "ACTIVE", startsAt: { lte: now }, expiresAt: { gt: now } }, include: { plan: true, payment: true }, orderBy: { expiresAt: "desc" } }); res.json(current ?? await prisma.riderSubscription.findFirst({ where: { rider: { userId: req.user!.id } }, include: { plan: true, payment: true }, orderBy: { createdAt: "desc" } })); });
ridersRouter.get("/me/subscription/payments", async (req, res) => res.json(await prisma.subscriptionPayment.findMany({ where: { rider: { userId: req.user!.id } }, orderBy: { createdAt: "desc" }, take: 10 })));
ridersRouter.post("/me/subscription/payments", async (req, res) => { const data = z.object({ amount: z.number().positive().optional() }).parse(req.body); const rider = await prisma.riderProfile.findUniqueOrThrow({ where: { userId: req.user!.id } }); const settings = await getSettings(); const amount = data.amount ?? Number(settings.monthlySubscriptionPrice); if (amount < Number(settings.monthlySubscriptionPrice)) return res.status(422).json({ error: { code: "INVALID_PAYMENT_AMOUNT", message: `El monto minimo es ${settings.monthlySubscriptionPrice} ${settings.currency}.` } }); const payment = await prisma.subscriptionPayment.create({ data: { riderId: rider.id, reference: String(crypto.randomInt(100000, 1000000)), amount, currency: settings.currency, expiresAt: new Date(Date.now() + 60 * 60_000) } }); res.status(201).json(payment); });
ridersRouter.get("/available-trips", async (req, res) => { await assertRiderCanOperate(req.user!.id); res.json(await prisma.trip.findMany({ where: { status: "REQUESTED", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, take: 30 })); });
