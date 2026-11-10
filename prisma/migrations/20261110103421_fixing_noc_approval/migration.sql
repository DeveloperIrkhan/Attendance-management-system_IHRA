-- CreateEnum
CREATE TYPE "NocStatus" AS ENUM ('PENDING_DD', 'PENDING_FINAL', 'APPROVED', 'ISSUED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "decidedByOverride" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "decisionNote" TEXT;

-- CreateTable
CREATE TABLE "NocRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "addressedTo" TEXT,
    "neededBy" DATE,
    "status" "NocStatus" NOT NULL DEFAULT 'PENDING_DD',
    "approverLevel" "ApprovalLevel",
    "approverDepartmentId" TEXT,
    "ddDecidedById" TEXT,
    "ddDecidedAt" TIMESTAMP(3),
    "ddNote" TEXT,
    "finalDecidedById" TEXT,
    "finalDecidedAt" TIMESTAMP(3),
    "finalNote" TEXT,
    "rejectedStage" TEXT,
    "issuedById" TEXT,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NocRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NocDocument" (
    "id" TEXT NOT NULL,
    "nocRequestId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NocDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncStatus" (
    "id" TEXT NOT NULL,
    "lastAttemptAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastRetrieved" INTEGER NOT NULL DEFAULT 0,
    "lastInserted" INTEGER NOT NULL DEFAULT 0,
    "intervalSeconds" INTEGER NOT NULL DEFAULT 60,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NocRequest_employeeId_idx" ON "NocRequest"("employeeId");

-- CreateIndex
CREATE INDEX "NocRequest_status_idx" ON "NocRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "NocDocument_nocRequestId_key" ON "NocDocument"("nocRequestId");

-- AddForeignKey
ALTER TABLE "NocRequest" ADD CONSTRAINT "NocRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NocDocument" ADD CONSTRAINT "NocDocument_nocRequestId_fkey" FOREIGN KEY ("nocRequestId") REFERENCES "NocRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
