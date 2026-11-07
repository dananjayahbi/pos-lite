-- P&L and the other COGS-based reports read `sale_lines.costPriceSnapshot`.
-- In environments where the earlier 20261102010000 migration was recorded as
-- applied but the nullable column was never actually created, every
-- /api/reports/profit-loss request fails with a Prisma column-not-found error.
-- Re-assert the column idempotently so the next deploy repairs the schema
-- without touching existing cost snapshots.
ALTER TABLE "sale_lines"
  ADD COLUMN IF NOT EXISTS "costPriceSnapshot" DECIMAL(12,2);
