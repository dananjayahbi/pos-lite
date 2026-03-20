-- CreateEnum
CREATE TYPE "StockTakeStatus" AS ENUM ('IN_PROGRESS', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "stock_take_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "categoryId" TEXT,
    "status" "StockTakeStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "initiatedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "stock_take_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_take_items" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "systemQuantity" INTEGER NOT NULL,
    "countedQuantity" INTEGER,
    "discrepancy" INTEGER,
    "isRecounted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_take_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_take_sessions_tenantId_status_idx" ON "stock_take_sessions"("tenantId", "status");

-- CreateIndex
CREATE INDEX "stock_take_items_sessionId_idx" ON "stock_take_items"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_take_items_sessionId_variantId_key" ON "stock_take_items"("sessionId", "variantId");

-- AddForeignKey
ALTER TABLE "stock_take_sessions" ADD CONSTRAINT "stock_take_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_take_sessions" ADD CONSTRAINT "stock_take_sessions_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_take_sessions" ADD CONSTRAINT "stock_take_sessions_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_take_items" ADD CONSTRAINT "stock_take_items_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "stock_take_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_take_items" ADD CONSTRAINT "stock_take_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
