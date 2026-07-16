-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('LOW_STOCK_ALERT', 'STOCK_TAKE_SUBMITTED', 'STOCK_TAKE_APPROVED', 'STOCK_TAKE_REJECTED', 'SYSTEM_ALERT');

-- CreateTable
CREATE TABLE "notification_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_records_tenantId_recipientId_isRead_idx" ON "notification_records"("tenantId", "recipientId", "isRead");

-- CreateIndex
CREATE INDEX "notification_records_tenantId_recipientId_createdAt_idx" ON "notification_records"("tenantId", "recipientId", "createdAt");

-- AddForeignKey
ALTER TABLE "notification_records" ADD CONSTRAINT "notification_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_records" ADD CONSTRAINT "notification_records_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
