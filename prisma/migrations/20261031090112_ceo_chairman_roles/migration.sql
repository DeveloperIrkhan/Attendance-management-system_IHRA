-- AlterTable
ALTER TABLE "AttendanceSettings" ALTER COLUMN "defaultWeeklyOffDays" SET DEFAULT ARRAY[5, 6, 0]::INTEGER[];

-- CreateTable
CREATE TABLE "ActingApprover" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "level" "ApprovalLevel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActingApprover_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActingApprover_level_idx" ON "ActingApprover"("level");

-- CreateIndex
CREATE UNIQUE INDEX "ActingApprover_employeeId_level_key" ON "ActingApprover"("employeeId", "level");

-- AddForeignKey
ALTER TABLE "ActingApprover" ADD CONSTRAINT "ActingApprover_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
