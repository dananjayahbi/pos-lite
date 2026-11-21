-- Raw materials were a quantity-only counter: no unit cost, no stock value and
-- no material cost on production logs, so they sat outside the financial supply
-- chain (ARGUS #243).
ALTER TABLE "raw_materials"
  ADD COLUMN IF NOT EXISTS "unitCost" DECIMAL(12, 4) NOT NULL DEFAULT 0;

ALTER TABLE "production_logs"
  ADD COLUMN IF NOT EXISTS "materialCost" DECIMAL(12, 2) NOT NULL DEFAULT 0;
