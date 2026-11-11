-- Per-staff, per-day attendance status overlay. TimeClock punches stay the
-- source of truth for hours; this table records Leave/Absent/Half Day/Holiday
-- decisions made from the all-staff attendance view.
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LEAVE', 'HALF_DAY', 'HOLIDAY');

CREATE TABLE "attendance_days" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
  "notes" TEXT,
  "recordedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "attendance_days_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendance_days_tenantId_userId_date_key"
  ON "attendance_days"("tenantId", "userId", "date");

CREATE INDEX "attendance_days_tenantId_date_idx"
  ON "attendance_days"("tenantId", "date");

ALTER TABLE "attendance_days"
  ADD CONSTRAINT "attendance_days_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendance_days"
  ADD CONSTRAINT "attendance_days_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendance_days"
  ADD CONSTRAINT "attendance_days_recordedById_fkey"
  FOREIGN KEY ("recordedById") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
