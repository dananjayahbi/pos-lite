-- Factory M8 follow-up: tenant-managed raw-material categories + "unit" count unit.
--
-- Categories were previously a closed enum. They are now tenant-scoped rows so
-- factories can add categories (e.g. Bottles & Caps) from the UI. The built-in
-- categories are seeded for every existing tenant before the column becomes
-- free-form text.

-- AlterEnum
ALTER TYPE "Unit" ADD VALUE IF NOT EXISTS 'UNITS';

-- CreateTable
CREATE TABLE "raw_material_categories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "raw_material_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "raw_material_categories_tenantId_key_key" ON "raw_material_categories"("tenantId", "key");
CREATE INDEX "raw_material_categories_tenantId_idx" ON "raw_material_categories"("tenantId");

-- AddForeignKey
ALTER TABLE "raw_material_categories" ADD CONSTRAINT "raw_material_categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed built-in categories for every tenant.
INSERT INTO "raw_material_categories" ("id", "tenantId", "key", "name", "isActive", "createdAt", "updatedAt")
SELECT 'rmc_' || t."id" || '_' || defaults."key", t."id", defaults."key", defaults."name", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "tenants" t
CROSS JOIN (
    VALUES
        ('OILS_LIQUIDS', 'Oils & Liquids'),
        ('POWDERS_HERBS', 'Powders & Herbs'),
        ('CHEMICALS', 'Chemicals')
) AS defaults("key", "name")
ON CONFLICT ("tenantId", "key") DO NOTHING;

-- AlterTable: category keys are now tenant-defined strings.
ALTER TABLE "raw_materials" ALTER COLUMN "category" TYPE TEXT USING "category"::text;
