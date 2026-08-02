-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "stops" JSONB,
ALTER COLUMN "estimatedDurationMin" DROP DEFAULT;
