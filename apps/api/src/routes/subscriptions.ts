import { z } from "zod";
import { prisma } from "../db.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { cancelPendingSubscriptionOrder, createSubscriptionOrder, markMotoExpressPaid, reviewPayment, submitTransfer } from "../services/subscription.service.js";
import { safeRouter } from "../middleware/safe-router.js";
import { decryptProtectedImage, protectImageInput } from "../lib/protected-media.js";

export const subscriptionsRouter = safeRouter();
subscriptionsRouter.use(authenticate);
function readablePayment<T extends { proofReference: string | null }>(payment: T) {
  return { ...payment, proofReference: decryptProtectedImage(payment.proofReference) };
}
subscriptionsRouter.get("/plans", authorize("RIDER"), async (_req, res) => res.json(await prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" } })));
subscriptionsRouter.get("/methods", authorize("RIDER"), async (_req, res) => res.json(await prisma.paymentMethodConfig.findMany({ where: { isActive: true }, select: { code: true, name: true, instructions: true, configuration: true } })));
subscriptionsRouter.post("/orders", authorize("RIDER"), async (req, res) => { const data = z.object({ planId: z.string(), methodCode: z.enum(["MOTO_EXPRESS", "BANK_TRANSFER"]) }).parse(req.body); res.status(201).json(await createSubscriptionOrder(req.user!.id, data.planId, data.methodCode)); });
subscriptionsRouter.post("/orders/:id/cancel", authorize("RIDER"), async (req, res) => res.json(await cancelPendingSubscriptionOrder(req.user!.id, req.params.id)));
subscriptionsRouter.get("/orders", authorize("RIDER"), async (req, res) => {
  const orders = await prisma.subscriptionOrder.findMany({ where: { rider: { userId: req.user!.id } }, include: { plan: true, payments: { include: { method: true } } }, orderBy: { createdAt: "desc" } });
  res.json(orders.map((order) => ({ ...order, payments: order.payments.map(readablePayment) })));
});
subscriptionsRouter.post("/payments/:id/mark-paid", authorize("RIDER"), async (req, res) => {
  const data = z.object({ bankName: z.string().min(2).max(100), proofReference: z.string().max(500_000) }).parse(req.body);
  res.json(readablePayment(await markMotoExpressPaid(req.user!.id, req.params.id, { ...data, proofReference: protectImageInput(data.proofReference) })));
});
subscriptionsRouter.post("/payments/:id/transfer", authorize("RIDER"), async (req, res) => { const data = z.object({ bankName: z.string().min(2).max(100), transferReference: z.string().min(3).max(100), payerName: z.string().max(100).optional(), proofReference: z.string().max(500_000) }).parse(req.body); res.json(readablePayment(await submitTransfer(req.user!.id, req.params.id, { ...data, proofReference: protectImageInput(data.proofReference) }))); });
subscriptionsRouter.get("/admin/plans", authorize("ADMIN"), async (_req, res) => res.json(await prisma.subscriptionPlan.findMany({ orderBy: { displayOrder: "asc" } })));
subscriptionsRouter.post("/admin/plans", authorize("ADMIN"), async (req, res) => { const data = z.object({ code: z.string().regex(/^[A-Z0-9_]+$/), name: z.string().min(2), description: z.string().min(2), price: z.number().positive(), currency: z.string().length(3).default("NIO"), durationDays: z.number().int().positive(), dailyTripLimit: z.number().int().positive().max(100).default(5), benefits: z.array(z.string()).default([]), isActive: z.boolean().default(true), displayOrder: z.number().int().default(0) }).parse(req.body); res.status(201).json(await prisma.subscriptionPlan.create({ data })); });
subscriptionsRouter.patch("/admin/plans/:id", authorize("ADMIN"), async (req, res) => { const data = z.object({ name: z.string().min(2).optional(), description: z.string().min(2).optional(), price: z.number().positive().optional(), durationDays: z.number().int().positive().optional(), dailyTripLimit: z.number().int().positive().max(100).optional(), benefits: z.array(z.string()).optional(), isActive: z.boolean().optional(), displayOrder: z.number().int().optional() }).parse(req.body); res.json(await prisma.subscriptionPlan.update({ where: { id: req.params.id }, data })); });
subscriptionsRouter.patch("/admin/methods/:code", authorize("ADMIN"), async (req, res) => { const data = z.object({ name: z.string().min(2).optional(), instructions: z.string().min(2).optional(), isActive: z.boolean().optional(), configuration: z.record(z.string(), z.string()).optional() }).parse(req.body); res.json(await prisma.paymentMethodConfig.update({ where: { code: req.params.code as "MOTO_EXPRESS" | "BANK_TRANSFER" }, data })); });
subscriptionsRouter.get("/admin/methods", authorize("ADMIN"), async (_req, res) => res.json(await prisma.paymentMethodConfig.findMany({ orderBy: { code: "asc" } })));
subscriptionsRouter.get("/admin/payments", authorize("ADMIN"), async (_req, res) => {
  const payments = await prisma.payment.findMany({ include: { order: { include: { rider: { include: { user: { select: { id: true, name: true, email: true, phone: true, status: true } } } }, plan: true } }, method: true }, orderBy: { createdAt: "desc" }, take: 100 });
  res.json(payments.map(readablePayment));
});
subscriptionsRouter.post("/admin/payments/:id/review", authorize("ADMIN"), async (req, res) => { const data = z.object({ approved: z.boolean(), reason: z.string().optional() }).parse(req.body); res.json(await reviewPayment(req.params.id, req.user!.id, data.approved, data.reason)); });
