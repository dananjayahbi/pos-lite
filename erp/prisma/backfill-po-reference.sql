-- Backfill purchase_orders.referenceNo before `prisma db push` adds the
-- NOT NULL + UNIQUE constraint. Four legacy rows exist and have no reference.
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "referenceNo" TEXT;

WITH numbered AS (
  SELECT
    "id",
    "createdAt",
    ROW_NUMBER() OVER (
      PARTITION BY "tenantId", to_char("createdAt", 'YYYYMM')
      ORDER BY "createdAt", "id"
    ) AS seq
  FROM "purchase_orders"
  WHERE "referenceNo" IS NULL
)
UPDATE "purchase_orders" po
SET "referenceNo" = 'PO-' || to_char(numbered."createdAt", 'YYYYMM') || '-' || LPAD(numbered.seq::text, 4, '0')
FROM numbered
WHERE po."id" = numbered."id";

ALTER TABLE "purchase_orders" ALTER COLUMN "referenceNo" SET NOT NULL;
