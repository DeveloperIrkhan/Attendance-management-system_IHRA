-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "editReason" TEXT,
ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "editedById" TEXT,
ADD COLUMN     "isManual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "punches" TEXT,
ADD COLUMN     "sourceBatchId" TEXT;
