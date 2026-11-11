-- Units are no longer a closed enum: tenants maintain their own unit catalog
-- (Settings → Units) and raw materials reference a unit key.
CREATE TABLE "raw_material_units" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortLabel" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "raw_material_units_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "raw_material_units_tenantId_key_key" ON "raw_material_units"("tenantId", "key");
CREATE INDEX "raw_material_units_tenantId_idx" ON "raw_material_units"("tenantId");

ALTER TABLE "raw_material_units" ADD CONSTRAINT "raw_material_units_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the built-in units for every tenant so existing materials keep working.
INSERT INTO "raw_material_units" ("id", "tenantId", "key", "name", "shortLabel", "isActive", "createdAt", "updatedAt")
SELECT 'rmu_' || t."id" || '_' || defaults."key", t."id", defaults."key", defaults."name", defaults."shortLabel", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "tenants" t
CROSS JOIN (
    VALUES
        ('LITERS', 'Liters', 'L'),
        ('KILOGRAMS', 'Kilograms', 'kg'),
        ('UNITS', 'Units', 'unit')
) AS defaults("key", "name", "shortLabel")
ON CONFLICT ("tenantId", "key") DO NOTHING;

-- Raw materials now store the tenant-defined unit key as text.
ALTER TABLE "raw_materials" ALTER COLUMN "unit" TYPE TEXT USING "unit"::text;

DROP TYPE IF EXISTS "Unit";
