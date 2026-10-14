-- AlterTable
ALTER TABLE "ImportBatch" ADD COLUMN     "uploadedById" TEXT;

-- AlterTable
ALTER TABLE "ImportedAttendanceRow" ADD COLUMN     "sourceBiometricId" TEXT,
ADD COLUMN     "sourceEmployeeName" TEXT;

-- CreateIndex
CREATE INDEX "ImportBatch_fileHash_idx" ON "ImportBatch"("fileHash");

-- CreateIndex
CREATE INDEX "ImportBatch_year_month_idx" ON "ImportBatch"("year", "month");

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
