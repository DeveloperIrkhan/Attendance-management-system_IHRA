-- CreateTable
CREATE TABLE "AttendanceSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "shiftStart" TEXT NOT NULL DEFAULT '08:00',
    "shiftEnd" TEXT NOT NULL DEFAULT '16:00',
    "graceMinutes" INTEGER NOT NULL DEFAULT 15,
    "halfDayAfterMinutes" INTEGER NOT NULL DEFAULT 180,
    "duplicatePunchMinutes" INTEGER NOT NULL DEFAULT 15,
    "earliestPunch" TEXT NOT NULL DEFAULT '07:00',
    "latestPunch" TEXT NOT NULL DEFAULT '22:00',
    "overtimeMinMinutes" INTEGER NOT NULL DEFAULT 0,
    "offDayWorkIsOvertime" BOOLEAN NOT NULL DEFAULT false,
    "defaultWeeklyOffDays" INTEGER[] DEFAULT ARRAY[5, 6, 0]::INTEGER[],
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyOffDays" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "weeklyOffDays" INTEGER[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyOffDays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyOffDays_year_month_key" ON "MonthlyOffDays"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");
