import { z } from "zod";
import { prisma } from "../db.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { createSubscriptionOrder, markMotoExpressPaid, reviewPayment, submitTransfer } from "../services/subscription.service.js";
import { safeRouter } from "../middleware/safe-router.js";

export const subscriptionsRouter = safeRouter();
subscriptionsRouter.use(authenticate);
subscriptionsRouter.get("/plans", authorize("RIDER"), async (_req, res) => res.json(await prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" } })));
subscriptionsRouter.get("/methods", authorize("RIDER"), async (_req, res) => res.json(await prisma.paymentMethodConfig.findMany({ where: { isActive: true }, select: { code: true, name: true, instructions: true, configuration: true } })));
subscriptionsRouter.post("/orders", authorize("RIDER"), async (req, res) => { const data = z.object({ planId: z.string(), methodCode: z.enum(["MOTO_EXPRESS", "BANK_TRANSFER"]) }).parse(req.body); res.status(201).json(await createSubscriptionOrder(req.user!.id, data.planId, data.methodCode)); });
subscriptionsRouter.get("/orders", authorize("RIDER"), async (req, res) => res.json(await prisma.subscriptionOrder.findMany({ where: { rider: { userId: req.user!.id } }, include: { payments: { include: { method: true } } }, orderBy: { createdAt: "desc" } })));
subscriptionsRouter.post("/payments/:id/mark-paid", authorize("RIDER"), async (req, res) => {
  const data = z.object({ proofReference: z.string().max(500).optional() }).parse(req.body);
  res.json(await markMotoExpressPaid(req.user!.id, req.params.id, data.proofReference));
});
subscriptionsRouter.post("/payments/:id/transfer", authorize("RIDER"), async (req, res) => { const data = z.object({ bankName: z.string().min(2), transferReference: z.string().min(3), payerName: z.string().optional(), proofReference: z.string().max(500).optional() }).parse(req.body); res.json(await submitTransfer(req.user!.id, req.params.id, data)); });
subscriptionsRouter.get("/admin/plans", authorize("ADMIN"), async (_req, res) => res.json(await prisma.subscriptionPlan.findMany({ orderBy: { displayOrder: "asc" } })));
subscriptionsRouter.post("/admin/plans", authorize("ADMIN"), async (req, res) => { const data = z.object({ code: z.string().regex(/^[A-Z0-9_]+$/), name: z.string().min(2), description: z.string().min(2), price: z.number().positive(), currency: z.string().length(3).default("NIO"), durationDays: z.number().int().positive(), benefits: z.array(z.string()).default([]), isActive: z.boolean().default(true), displayOrder: z.number().int().default(0) }).parse(req.body); res.status(201).json(await prisma.subscriptionPlan.create({ data })); });
subscriptionsRouter.patch("/admin/plans/:id", authorize("ADMIN"), async (req, res) => { const data = z.object({ name: z.string().min(2).optional(), description: z.string().min(2).optional(), price: z.number().positive().optional(), durationDays: z.number().int().positive().optional(), benefits: z.array(z.string()).optional(), isActive: z.boolean().optional(), displayOrder: z.number().int().optional() }).parse(req.body); res.json(await prisma.subscriptionPlan.update({ where: { id: req.params.id }, data })); });
subscriptionsRouter.patch("/admin/methods/:code", authorize("ADMIN"), async (req, res) => { const data = z.object({ name: z.string().min(2).optional(), instructions: z.string().min(2).optional(), isActive: z.boolean().optional(), configuration: z.record(z.string(), z.string()).optional() }).parse(req.body); res.json(await prisma.paymentMethodConfig.update({ where: { code: req.params.code as "MOTO_EXPRESS" | "BANK_TRANSFER" }, data })); });
subscriptionsRouter.get("/admin/methods", authorize("ADMIN"), async (_req, res) => res.json(await prisma.paymentMethodConfig.findMany({ orderBy: { code: "asc" } })));
subscriptionsRouter.get("/admin/payments", authorize("ADMIN"), async (_req, res) => res.json(await prisma.payment.findMany({ include: { order: { include: { rider: { include: { user: true } }, plan: true } }, method: true }, orderBy: { createdAt: "desc" }, take: 100 })));
subscriptionsRouter.post("/admin/payments/:id/review", authorize("ADMIN"), async (req, res) => { const data = z.object({ approved: z.boolean(), reason: z.string().optional() }).parse(req.body); res.json(await reviewPayment(req.params.id, req.user!.id, data.approved, data.reason)); });
