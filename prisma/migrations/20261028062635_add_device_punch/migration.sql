-- CreateTable
CREATE TABLE "DevicePunch" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceUserId" TEXT NOT NULL,
    "punchedAt" TIMESTAMP(3) NOT NULL,
    "punchState" INTEGER,
    "verifyMode" INTEGER,
    "sourceKey" TEXT NOT NULL,
    "rawData" JSONB NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DevicePunch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DevicePunch_sourceKey_key" ON "DevicePunch"("sourceKey");

-- CreateIndex
CREATE INDEX "DevicePunch_deviceId_punchedAt_idx" ON "DevicePunch"("deviceId", "punchedAt");

-- CreateIndex
CREATE INDEX "DevicePunch_deviceUserId_punchedAt_idx" ON "DevicePunch"("deviceUserId", "punchedAt");
