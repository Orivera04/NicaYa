/*
  Warnings:

  - Added the required column `estimatedDurationMin` to the `Trip` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "estimatedDurationMin" INTEGER NOT NULL,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "finalPrice" DECIMAL(10,2),
ADD COLUMN     "proposedPrice" DECIMAL(10,2),
ADD COLUMN     "serviceCode" TEXT NOT NULL DEFAULT 'MOTO';

-- CreateTable
CREATE TABLE "TripOffer" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NIO',
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TripOffer_tripId_status_idx" ON "TripOffer"("tripId", "status");

-- CreateIndex
CREATE INDEX "TripOffer_riderId_status_idx" ON "TripOffer"("riderId", "status");

-- AddForeignKey
ALTER TABLE "TripOffer" ADD CONSTRAINT "TripOffer_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripOffer" ADD CONSTRAINT "TripOffer_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
