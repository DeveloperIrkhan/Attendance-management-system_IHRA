-- AlterTable
ALTER TABLE "AttendanceSettings" ALTER COLUMN "defaultWeeklyOffDays" SET DEFAULT ARRAY[6, 0]::INTEGER[];
