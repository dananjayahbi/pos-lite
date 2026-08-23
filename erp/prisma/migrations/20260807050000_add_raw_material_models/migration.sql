-- AlterEnum (append)
ALTER TYPE "UserRole" ADD VALUE 'FACTORY_MANAGER';

-- CreateEnum
CREATE TYPE "RawMaterialCategory" AS ENUM ('OILS_LIQUIDS', 'POWDERS_HERBS', 'CHEMICALS');

-- CreateEnum
CREATE TYPE "Unit" AS ENUM ('LITERS', 'KILOGRAMS');

-- CreateTable
CREATE TABLE "raw_materials" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "RawMaterialCategory" NOT NULL,
    "unit" "Unit" NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lowStockThreshold" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "raw_materials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "raw_materials_tenantId_idx" ON "raw_materials"("tenantId");

-- CreateIndex
CREATE INDEX "raw_materials_tenantId_category_idx" ON "raw_materials"("tenantId", "category");

-- AddForeignKey
ALTER TABLE "raw_materials" ADD CONSTRAINT "raw_materials_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
