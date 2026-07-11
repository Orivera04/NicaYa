-- AlterTable
ALTER TABLE "RiderProfile" ADD COLUMN     "documentsVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "driverLicense" TEXT,
ADD COLUMN     "nationalId" TEXT;
