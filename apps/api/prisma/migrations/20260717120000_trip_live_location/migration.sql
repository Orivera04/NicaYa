ALTER TABLE "Trip"
  ADD COLUMN "riderLat" DOUBLE PRECISION,
  ADD COLUMN "riderLng" DOUBLE PRECISION,
  ADD COLUMN "riderAccuracy" DOUBLE PRECISION,
  ADD COLUMN "riderHeading" DOUBLE PRECISION,
  ADD COLUMN "riderLocationUpdatedAt" TIMESTAMP(3);

CREATE TABLE "TripLocation" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "accuracy" DOUBLE PRECISION,
  "heading" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TripLocation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TripLocation"
  ADD CONSTRAINT "TripLocation_tripId_fkey"
  FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "TripLocation_tripId_createdAt_idx" ON "TripLocation"("tripId", "createdAt");
