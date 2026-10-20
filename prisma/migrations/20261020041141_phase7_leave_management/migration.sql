-- AlterTable
ALTER TABLE "AttendanceSettings" ADD COLUMN     "shortLeaveExcusesLateArrival" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "shortLeaveMaxMinutes" INTEGER NOT NULL DEFAULT 180,
ADD COLUMN     "shortLeaveMonthlyLimit" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "days" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "decidedById" TEXT;

-- AlterTable
ALTER TABLE "LeaveType" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "yearlyQuotaDays" INTEGER;

-- AlterTable
ALTER TABLE "ShortLeave" ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "decidedById" TEXT,
ADD COLUMN     "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING';
