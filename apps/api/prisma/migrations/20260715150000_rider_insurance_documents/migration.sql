-- Insurance is part of the rider's required compliance file.
ALTER TYPE "RiderDocumentType" ADD VALUE IF NOT EXISTS 'INSURANCE';

ALTER TABLE "RiderProfile"
  ADD COLUMN IF NOT EXISTS "insuranceExpiresAt" TIMESTAMP(3);
