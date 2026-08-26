-- CRM: track each customer's most recent finalized sale date (doc 21).
ALTER TABLE "customers" ADD COLUMN "lastPurchaseAt" TIMESTAMP(3);

-- Backfill from the most recent completed sale per customer.
UPDATE "customers" c
SET "lastPurchaseAt" = sub.max_completed_at
FROM (
  SELECT s."customerId" AS cid, MAX(COALESCE(s."completedAt", s."createdAt")) AS max_completed_at
  FROM "sales" s
  WHERE s."customerId" IS NOT NULL AND s."status" = 'COMPLETED'
  GROUP BY s."customerId"
) sub
WHERE c.id = sub.cid;
