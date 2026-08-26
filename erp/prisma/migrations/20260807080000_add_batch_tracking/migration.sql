-- CreateEnum
CREATE TYPE "BatchSource" AS ENUM ('PURCHASE', 'MANUFACTURED');

-- AlterEnum (append)
ALTER TYPE "NotificationType" ADD VALUE 'BATCH_EXPIRY_SOON';
ALTER TYPE "NotificationType" ADD VALUE 'BATCH_EXPIRED';

-- CreateTable
CREATE TABLE "batch_trackings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "quantity" INTEGER NOT NULL,
    "source" "BatchSource" NOT NULL DEFAULT 'PURCHASE',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batch_trackings_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN "batchId" TEXT;

-- AlterTable
ALTER TABLE "sale_lines" ADD COLUMN "batchId" TEXT;

-- AlterTable
ALTER TABLE "purchase_order_lines" ADD COLUMN "receivedBatchNumber" TEXT;
ALTER TABLE "purchase_order_lines" ADD COLUMN "receivedExpiryDate" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "batch_trackings_tenantId_variantId_batchNumber_key" ON "batch_trackings"("tenantId", "variantId", "batchNumber");

-- CreateIndex
CREATE INDEX "batch_trackings_tenantId_variantId_expiryDate_idx" ON "batch_trackings"("tenantId", "variantId", "expiryDate");

-- CreateIndex
CREATE INDEX "batch_trackings_tenantId_expiryDate_idx" ON "batch_trackings"("tenantId", "expiryDate");

-- CreateIndex
CREATE INDEX "stock_movements_batchId_idx" ON "stock_movements"("batchId");

-- CreateIndex
CREATE INDEX "sale_lines_batchId_idx" ON "sale_lines"("batchId");

-- AddForeignKey
ALTER TABLE "batch_trackings" ADD CONSTRAINT "batch_trackings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_trackings" ADD CONSTRAINT "batch_trackings_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batch_trackings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_lines" ADD CONSTRAINT "sale_lines_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batch_trackings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
