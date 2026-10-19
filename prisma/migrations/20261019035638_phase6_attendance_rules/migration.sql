-- AlterEnum
ALTER TYPE "AttendanceStatus" ADD VALUE 'SHORT_LEAVE';

-- AlterTable
ALTER TABLE "ImportBatch" ADD COLUMN     "processedAt" TIMESTAMP(3);
