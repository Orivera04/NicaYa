ALTER TABLE "ClientProfile" ALTER COLUMN "activationStatus" SET DEFAULT 'ACTIVE';
UPDATE "ClientProfile" SET "activationStatus" = 'ACTIVE' WHERE "activationStatus" IN ('REGISTERED', 'SEMI_ACTIVE');

ALTER TABLE "RiderProfile"
  ADD COLUMN "workZoneDepartment" TEXT,
  ADD COLUMN "workZoneLat" DOUBLE PRECISION,
  ADD COLUMN "workZoneLng" DOUBLE PRECISION,
  ADD COLUMN "workZoneUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "documentsSubmittedAt" TIMESTAMP(3);

ALTER TABLE "RiderDocument"
  ADD COLUMN "frontImage" TEXT,
  ADD COLUMN "backImage" TEXT;
