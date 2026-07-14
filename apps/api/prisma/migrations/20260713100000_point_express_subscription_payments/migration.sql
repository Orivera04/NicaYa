-- Punto Xpress payments for simulated rider subscription renewals.
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "PaymentMethod" AS ENUM ('POINT_EXPRESS');

CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NIO',
    "method" "PaymentMethod" NOT NULL DEFAULT 'POINT_EXPRESS',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SubscriptionPayment_reference_key" ON "SubscriptionPayment"("reference");
CREATE INDEX "SubscriptionPayment_riderId_status_idx" ON "SubscriptionPayment"("riderId", "status");
CREATE INDEX "SubscriptionPayment_status_expiresAt_idx" ON "SubscriptionPayment"("status", "expiresAt");
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "RiderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
