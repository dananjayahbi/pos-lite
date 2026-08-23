-- AlterEnum (append)
ALTER TYPE "StockMovementReason" ADD VALUE 'MANUFACTURED';

-- AlterEnum (append)
ALTER TYPE "NotificationType" ADD VALUE 'RAW_MATERIAL_LOW_STOCK';
ALTER TYPE "NotificationType" ADD VALUE 'RAW_MATERIAL_CRITICAL';

-- CreateTable
CREATE TABLE "bill_of_materials" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "bill_of_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_of_materials_items" (
    "id" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "quantityPerUnit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bill_of_materials_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "actorId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bill_of_materials_tenantId_variantId_key" ON "bill_of_materials"("tenantId", "variantId");

-- CreateIndex
CREATE INDEX "bill_of_materials_tenantId_idx" ON "bill_of_materials"("tenantId");

-- CreateIndex
CREATE INDEX "bill_of_materials_variantId_idx" ON "bill_of_materials"("variantId");

-- CreateIndex
CREATE INDEX "bill_of_materials_items_bomId_idx" ON "bill_of_materials_items"("bomId");

-- CreateIndex
CREATE INDEX "bill_of_materials_items_rawMaterialId_idx" ON "bill_of_materials_items"("rawMaterialId");

-- CreateIndex
CREATE UNIQUE INDEX "bill_of_materials_items_bomId_rawMaterialId_key" ON "bill_of_materials_items"("bomId", "rawMaterialId");

-- CreateIndex
CREATE INDEX "production_logs_tenantId_createdAt_idx" ON "production_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "production_logs_bomId_idx" ON "production_logs"("bomId");

-- CreateIndex
CREATE INDEX "production_logs_variantId_idx" ON "production_logs"("variantId");

-- AddForeignKey
ALTER TABLE "bill_of_materials" ADD CONSTRAINT "bill_of_materials_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_of_materials" ADD CONSTRAINT "bill_of_materials_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_of_materials_items" ADD CONSTRAINT "bill_of_materials_items_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "bill_of_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_of_materials_items" ADD CONSTRAINT "bill_of_materials_items_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "raw_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "bill_of_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
