-- Delivery packaging follow-up: tenant-managed packaging categories.
--
-- Categories were previously a closed enum, so a tenant could not add a
-- category (e.g. "Courier Bags") without a schema change. They are now
-- tenant-scoped rows, mirroring the raw-material category model. The five
-- built-in categories are seeded for every existing tenant before the column
-- becomes free-form text.

-- CreateTable
CREATE TABLE "packaging_category_options" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "packaging_category_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "packaging_category_options_tenantId_key_key" ON "packaging_category_options"("tenantId", "key");
CREATE INDEX "packaging_category_options_tenantId_idx" ON "packaging_category_options"("tenantId");

-- AddForeignKey
ALTER TABLE "packaging_category_options" ADD CONSTRAINT "packaging_category_options_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the built-in categories for every tenant.
INSERT INTO "packaging_category_options" ("id", "tenantId", "key", "name", "isActive", "createdAt", "updatedAt")
SELECT 'pco_' || t."id" || '_' || defaults."key", t."id", defaults."key", defaults."name", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "tenants" t
CROSS JOIN (
    VALUES
        ('POLYMAILER', 'Polymailer'),
        ('TAPE', 'Tape'),
        ('LABEL', 'Label'),
        ('BUBBLE_WRAP', 'Bubble Wrap'),
        ('OTHER', 'Other')
) AS defaults("key", "name")
ON CONFLICT ("tenantId", "key") DO NOTHING;

-- AlterTable: category keys are now tenant-defined strings.
ALTER TABLE "packaging_items" ALTER COLUMN "category" TYPE TEXT USING "category"::text;
