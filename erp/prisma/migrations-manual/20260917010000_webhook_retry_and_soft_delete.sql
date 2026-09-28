-- ============================================================================
-- M33-02 / M33-03 — Webhook auto-retry bookkeeping + soft-deleted endpoints.
--
--   WebhookEndpoint.deletedAt            : TIMESTAMP NULL
--       M33-03 (OBS-63) / XC-05. `DELETE /api/webhooks/endpoints/[id]` used to be
--       a hard delete, and `webhook_deliveries.webhookEndpointId` carries
--       ON DELETE CASCADE — so removing an endpoint destroyed its entire
--       delivery ledger. The delete is now a soft delete; the cascade therefore
--       never fires and the history survives.
--
--   WebhookDelivery.attempt              : INTEGER NOT NULL DEFAULT 1
--   WebhookDelivery.nextRetryAt          : TIMESTAMP NULL  (+ index)
--       M33-02 (OBS-62). `attempt` counts dispatches for one delivery row
--       (1 = the original attempt). `nextRetryAt` is when the `cron/webhook-retries`
--       route may re-dispatch it; NULL means "not scheduled" (never selected as
--       due), which is the correct state for every pre-existing row.
--
--   enum WebhookDeliveryStatus gains 'EXHAUSTED'
--       Terminal dead-letter state reached after MAX_ATTEMPTS auto-retries.
--
-- Backfill note: existing rows get attempt = 1 and nextRetryAt = NULL, so no
-- previously-failed delivery is suddenly re-dispatched by the new cron.
--
-- NOTE: the repo's active dev workflow is `prisma db push` / `prisma generate`.
-- Both are intentionally NOT run by this change (other agents share the DB), so
-- this file is the migration deliverable. Apply against a live DB with
--   node scripts/apply-sql-migration.mjs prisma/migrations-manual/<this file>
-- and then run `prisma generate` so the typed client knows the new fields/enum.
-- ============================================================================

-- 1. Status enum value
ALTER TYPE "WebhookDeliveryStatus" ADD VALUE IF NOT EXISTS 'EXHAUSTED';

-- 2. Soft-delete marker on endpoints
ALTER TABLE "webhook_endpoints"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- 3. Retry bookkeeping on deliveries
ALTER TABLE "webhook_deliveries"
  ADD COLUMN IF NOT EXISTS "attempt" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "webhook_deliveries"
  ADD COLUMN IF NOT EXISTS "nextRetryAt" TIMESTAMP(3);

-- 4. Index for the retry sweep (due-row selection)
CREATE INDEX IF NOT EXISTS "webhook_deliveries_nextRetryAt_idx"
  ON "webhook_deliveries" ("nextRetryAt");