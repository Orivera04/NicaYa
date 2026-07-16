import crypto from "crypto";
import { prisma } from "../db.js";
import { fail } from "../lib/error.js";

const catalog = [
  { code: "BASIC", name: "Basico", description: "Acceso a solicitudes y soporte estandar.", price: 150, benefits: ["Solicitudes", "Soporte estandar"], displayOrder: 1 },
  { code: "STANDARD", name: "Estandar", description: "Acceso completo para trabajar cada dia.", price: 200, benefits: ["Solicitudes", "Soporte prioritario"], displayOrder: 2 },
  { code: "PREMIUM", name: "Premium", description: "Plan mensual para riders frecuentes.", price: 300, benefits: ["Solicitudes", "Soporte prioritario", "Perfil destacado"], displayOrder: 3 },
];

export async function ensureSubscriptionCatalog() {
  await Promise.all(catalog.map((plan) => prisma.subscriptionPlan.upsert({ where: { code: plan.code }, update: {}, create: { ...plan, durationDays: 30, currency: "NIO" } })));
  await prisma.paymentMethodConfig.upsert({ where: { code: "MOTO_EXPRESS" }, update: { name: "Deposito", instructions: "Deposita el monto exacto usando tu referencia y adjunta el comprobante para revision." }, create: { code: "MOTO_EXPRESS", name: "Deposito", instructions: "Deposita el monto exacto usando tu referencia y adjunta el comprobante para revision.", configuration: { holderName: "Configurar titular", bank: "Configurar banco receptor", account: "Configurar numero de cuenta" } } });
  await prisma.paymentMethodConfig.upsert({ where: { code: "BANK_TRANSFER" }, update: { name: "Transferencia bancaria", instructions: "Transfiere el monto exacto y adjunta el comprobante para revision." }, create: { code: "BANK_TRANSFER", name: "Transferencia bancaria", instructions: "Transfiere el monto exacto y adjunta el comprobante para revision.", configuration: { holderName: "Configurar titular", bank: "Configurar banco receptor", account: "Configurar numero de cuenta" } } });
}

export async function createSubscriptionOrder(userId: string, planId: string, methodCode: "MOTO_EXPRESS" | "BANK_TRANSFER") {
  const rider = await prisma.riderProfile.findUniqueOrThrow({ where: { userId } });
  const [plan, method] = await Promise.all([prisma.subscriptionPlan.findFirst({ where: { id: planId, isActive: true } }), prisma.paymentMethodConfig.findFirst({ where: { code: methodCode, isActive: true } })]);
  if (!plan) fail(404, "PLAN_NOT_AVAILABLE", "El plan no esta disponible.");
  if (!method) fail(404, "PAYMENT_METHOD_NOT_AVAILABLE", "El metodo de pago no esta disponible.");
  const reference = `MS-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  return prisma.$transaction(async (tx) => {
    const order = await tx.subscriptionOrder.create({ data: { riderId: rider.id, planId: plan.id, planNameSnapshot: plan.name, priceSnapshot: plan.price, currencySnapshot: plan.currency, durationDaysSnapshot: plan.durationDays, status: "PENDING_PAYMENT", expiresAt: new Date(Date.now() + 60 * 60_000) } });
    const payment = await tx.payment.create({ data: { orderId: order.id, methodId: method.id, amount: plan.price, currency: plan.currency, externalReference: reference, status: "PENDING_PAYMENT" } });
    return { order, payment, method: { code: method.code, name: method.name, instructions: method.instructions, configuration: method.configuration } };
  }, { isolationLevel: "Serializable" });
}

async function ownedPayment(userId: string, paymentId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { order: { include: { rider: true } } } });
  if (!payment || payment.order.rider.userId !== userId) fail(404, "PAYMENT_NOT_FOUND", "Pago no encontrado.");
  return payment;
}

export async function submitTransfer(userId: string, paymentId: string, data: { bankName: string; transferReference: string; payerName?: string; proofReference: string }) {
  const payment = await ownedPayment(userId, paymentId);
  if (payment.status !== "PENDING_PAYMENT") fail(409, "PAYMENT_NOT_SUBMITTABLE", "El pago no puede enviarse a revision.");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.payment.update({ where: { id: payment.id }, data: { status: "PENDING_REVIEW", customerReference: data.transferReference, proofReference: data.proofReference, metadata: { bankName: data.bankName, payerName: data.payerName }, submittedAt: new Date() } });
    await tx.subscriptionOrder.update({ where: { id: payment.orderId }, data: { status: "PENDING_REVIEW" } });
    return updated;
  }, { isolationLevel: "Serializable" });
}

export async function markMotoExpressPaid(userId: string, paymentId: string, data: { bankName: string; proofReference: string }) {
  const payment = await ownedPayment(userId, paymentId);
  if (payment.status !== "PENDING_PAYMENT") fail(409, "PAYMENT_NOT_SUBMITTABLE", "El pago ya fue enviado.");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.payment.update({ where: { id: payment.id }, data: { status: "PENDING_REVIEW", proofReference: data.proofReference, metadata: { bankName: data.bankName }, submittedAt: new Date() } });
    await tx.subscriptionOrder.update({ where: { id: payment.orderId }, data: { status: "PENDING_REVIEW" } });
    return updated;
  }, { isolationLevel: "Serializable" });
}

export async function reviewPayment(paymentId: string, adminId: string, approved: boolean, reason?: string) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
    if (!payment || payment.status !== "PENDING_REVIEW") fail(409, "PAYMENT_NOT_REVIEWABLE", "El pago no esta pendiente de revision.");
    if (!approved && !reason) fail(400, "REJECTION_REASON_REQUIRED", "Indica el motivo del rechazo.");
    const now = new Date();
    if (!approved) {
      await tx.payment.update({ where: { id: paymentId }, data: { status: "REJECTED", rejectionReason: reason, reviewedAt: now, reviewedByAdminId: adminId } });
      await tx.subscriptionOrder.update({ where: { id: payment.orderId }, data: { status: "CANCELLED" } });
      return { approved: false };
    }
    const active = await tx.riderSubscription.findFirst({ where: { riderId: payment.order.riderId, status: "ACTIVE", expiresAt: { gt: now } }, orderBy: { expiresAt: "desc" } });
    const startsAt = active?.expiresAt && active.expiresAt > now ? active.expiresAt : now;
    const expiresAt = new Date(startsAt.getTime() + payment.order.durationDaysSnapshot * 864e5);
    const changed = await tx.payment.updateMany({ where: { id: paymentId, status: "PENDING_REVIEW" }, data: { status: "APPROVED", reviewedAt: now, reviewedByAdminId: adminId } });
    if (!changed.count) fail(409, "PAYMENT_ALREADY_REVIEWED", "El pago ya fue procesado.");
    await tx.subscriptionOrder.update({ where: { id: payment.orderId }, data: { status: "COMPLETED" } });
    const subscription = await tx.riderSubscription.create({ data: { riderId: payment.order.riderId, planId: payment.order.planId, paymentId, status: "ACTIVE", startsAt, expiresAt, pricePaid: payment.amount, currency: payment.currency, activatedById: adminId } });
    await tx.auditLog.create({ data: { actorId: adminId, action: "SUBSCRIPTION_PAYMENT_APPROVED", entity: "Payment", entityId: paymentId, metadata: { subscriptionId: subscription.id } } });
    return { approved: true, subscription };
  }, { isolationLevel: "Serializable" });
}

export async function expireSubscriptionData() {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const orders = await tx.subscriptionOrder.findMany({ where: { status: { in: ["PENDING_PAYMENT", "PENDING_REVIEW"] }, expiresAt: { lt: now } }, select: { id: true } });
    await tx.subscriptionOrder.updateMany({ where: { id: { in: orders.map((item) => item.id) } }, data: { status: "EXPIRED" } });
    await tx.payment.updateMany({ where: { orderId: { in: orders.map((item) => item.id) }, status: { in: ["PENDING_PAYMENT", "PENDING_REVIEW"] } }, data: { status: "EXPIRED" } });
    const expired = await tx.riderSubscription.findMany({ where: { status: "ACTIVE", expiresAt: { lt: now } }, select: { riderId: true } });
    await tx.riderSubscription.updateMany({ where: { status: "ACTIVE", expiresAt: { lt: now } }, data: { status: "EXPIRED" } });
    await tx.riderProfile.updateMany({ where: { id: { in: expired.map((item) => item.riderId) } }, data: { available: false } });
  });
}

export async function assertRiderCanOperate(userId: string) {
  const now = new Date();
  const rider = await prisma.riderProfile.findUnique({ where: { userId }, include: { user: true, subscriptions: { where: { status: "ACTIVE", startsAt: { lte: now }, expiresAt: { gt: now } }, take: 1 } } });
  if (!rider || rider.approval !== "APPROVED" || rider.onboardingStatus !== "READY_TO_WORK") fail(403, "RIDER_NOT_READY", "Completa la activacion de tu cuenta antes de trabajar.");
  if (rider.user.status !== "ACTIVE") fail(403, "ACCOUNT_INACTIVE", "Tu cuenta no esta activa.");
  const settings = await prisma.systemSetting.findUnique({ where: { key: "subscriptionRequiredForRiders" } });
  if (settings?.value !== "false" && rider.subscriptions.length === 0) fail(403, "SUBSCRIPTION_REQUIRED", "Necesitas una suscripcion activa para operar.");
  return rider;
}
