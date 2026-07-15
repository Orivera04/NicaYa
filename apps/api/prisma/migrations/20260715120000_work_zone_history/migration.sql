CREATE TABLE "WorkZoneHistory" (
  "id" TEXT NOT NULL,
  "riderId" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkZoneHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkZoneHistory_riderId_createdAt_idx" ON "WorkZoneHistory"("riderId", "createdAt");
ALTER TABLE "WorkZoneHistory" ADD CONSTRAINT "WorkZoneHistory_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "RiderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
