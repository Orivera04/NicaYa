CREATE TYPE "ClientActivationStatus" AS ENUM ('REGISTERED', 'SEMI_ACTIVE', 'VERIFICATION_PENDING', 'ACTIVE', 'REQUIRES_CORRECTION', 'SUSPENDED', 'REJECTED', 'DEACTIVATED');
CREATE TYPE "RiderOnboardingStatus" AS ENUM ('REGISTERED', 'PROFILE_INCOMPLETE', 'DOCUMENTS_PENDING', 'UNDER_REVIEW', 'REQUIRES_CORRECTION', 'REJECTED', 'APPROVED', 'SUBSCRIPTION_REQUIRED', 'READY_TO_WORK');
CREATE TYPE "RiderDocumentType" AS ENUM ('NATIONAL_ID', 'DRIVER_LICENSE', 'VEHICLE_REGISTRATION');
CREATE TYPE "RiderDocumentStatus" AS ENUM ('NOT_SUBMITTED', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REQUIRES_CORRECTION', 'EXPIRED', 'EXPIRING_SOON');

ALTER TABLE "ClientProfile" ADD COLUMN "activationStatus" "ClientActivationStatus" NOT NULL DEFAULT 'SEMI_ACTIVE', ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3), ADD COLUMN "identityVerifiedAt" TIMESTAMP(3), ADD COLUMN "verificationNote" TEXT;
ALTER TABLE "RiderProfile" ADD COLUMN "onboardingStatus" "RiderOnboardingStatus" NOT NULL DEFAULT 'PROFILE_INCOMPLETE', ADD COLUMN "workZoneConfigured" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "onboardingNote" TEXT;

CREATE TABLE "RiderDocument" (
  "id" TEXT NOT NULL,
  "riderId" TEXT NOT NULL,
  "type" "RiderDocumentType" NOT NULL,
  "status" "RiderDocumentStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
  "reference" TEXT,
  "expiresAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RiderDocument_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RiderDocument_riderId_type_key" ON "RiderDocument"("riderId", "type");
CREATE INDEX "RiderDocument_status_expiresAt_idx" ON "RiderDocument"("status", "expiresAt");
ALTER TABLE "RiderDocument" ADD CONSTRAINT "RiderDocument_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "RiderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "RiderProfile" SET "onboardingStatus" = 'READY_TO_WORK', "workZoneConfigured" = true WHERE "approval" = 'APPROVED';
