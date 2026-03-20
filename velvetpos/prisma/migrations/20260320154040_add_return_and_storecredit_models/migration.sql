-- CreateEnum
CREATE TYPE "ReturnRefundMethod" AS ENUM ('CASH', 'CARD_REVERSAL', 'STORE_CREDIT', 'EXCHANGE');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('COMPLETED');

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "linkedReturnId" TEXT;

-- CreateTable
CREATE TABLE "returns" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "originalSaleId" TEXT NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "authorizedById" TEXT NOT NULL,
    "refundMethod" "ReturnRefundMethod" NOT NULL,
    "refundAmount" DECIMAL(12,2) NOT NULL,
    "restockItems" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_lines" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "originalSaleLineId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "variantDescriptionSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineRefundAmount" DECIMAL(12,2) NOT NULL,
    "isRestocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_credits" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "usedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_credits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "returns_tenantId_createdAt_idx" ON "returns"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "returns_originalSaleId_idx" ON "returns"("originalSaleId");

-- CreateIndex
CREATE INDEX "return_lines_returnId_idx" ON "return_lines"("returnId");

-- CreateIndex
CREATE INDEX "store_credits_tenantId_idx" ON "store_credits"("tenantId");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_linkedReturnId_fkey" FOREIGN KEY ("linkedReturnId") REFERENCES "returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_originalSaleId_fkey" FOREIGN KEY ("originalSaleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_lines" ADD CONSTRAINT "return_lines_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_lines" ADD CONSTRAINT "return_lines_originalSaleLineId_fkey" FOREIGN KEY ("originalSaleLineId") REFERENCES "sale_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_credits" ADD CONSTRAINT "store_credits_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
