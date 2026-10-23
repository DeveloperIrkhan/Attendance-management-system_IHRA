-- CreateEnum
CREATE TYPE "ApprovalLevel" AS ENUM ('STAFF', 'DD', 'CEO', 'CHAIRMAN');

-- AlterTable
ALTER TABLE "Designation" ADD COLUMN     "approvalLevel" "ApprovalLevel" NOT NULL DEFAULT 'STAFF';

-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "approverDepartmentId" TEXT,
ADD COLUMN     "approverLevel" "ApprovalLevel",
ADD COLUMN     "requestedById" TEXT,
ADD COLUMN     "routeNote" TEXT;
