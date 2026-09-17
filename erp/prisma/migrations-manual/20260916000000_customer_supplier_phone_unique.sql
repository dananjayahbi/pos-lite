-- ============================================================================
-- M05-03 / M06-01 (XC-06 constraint sweep) — tenant-scoped phone uniqueness
--
--   Customer.phone  : @@index([tenantId, phone])  -> @@unique([tenantId, phone])
--   Supplier.phone  : (no phone index)            -> @@unique([tenantId, phone])
--
-- D4 policy (99-ROADMAP §5): soft-deleted / archived rows RESERVE the phone,
-- so this is a FULL unique index — NOT a partial (`WHERE deletedAt IS NULL`)
-- one. Duplicate creates return 409 with the "(an archived record uses this
-- phone)" variant; self-service restore for CRM masters is deferred to XC-05.
--
-- NOTE: the repo's active dev workflow is `prisma db push` (the gate's
-- `db push --force-reset` applies the schema change directly). This file is
-- the PRODUCTION migration deliverable — apply with
-- `scripts/apply-sql-migration.mjs` against a live DB, never via the Prisma
-- migrate engine auto-discovery (kept out of prisma/migrations/ on purpose).
--
-- Index names below match what `prisma db push` generates for the @@unique
-- declarations (`<mapped_table>_<columns>_key`), so a later `prisma diff`
-- sees them as equivalent.
-- ============================================================================

BEGIN;

-- ── Pre-flight: fail loudly on existing duplicates ─────────────────────────
-- QA runs may have left duplicate phones behind. Per the micro-docs we must
-- NOT auto-delete or auto-merge customer/supplier rows — a human reviews the
-- report, retires/merges the surplus rows (rename + archive), and re-runs.

DO $$
DECLARE
    dup_record_count BIGINT;
    dup_supplier_count BIGINT;
    report TEXT;
BEGIN
    SELECT COUNT(*) INTO dup_record_count
    FROM (
        SELECT "tenantId", "phone"
        FROM customers
        GROUP BY "tenantId", "phone"
        HAVING COUNT(*) > 1
    ) d;

    SELECT COUNT(*) INTO dup_supplier_count
    FROM (
        SELECT "tenantId", "phone"
        FROM suppliers
        GROUP BY "tenantId", "phone"
        HAVING COUNT(*) > 1
    ) d;

    IF dup_record_count > 0 OR dup_supplier_count > 0 THEN
        SELECT string_agg(line, E'\n')
        INTO report
        FROM (
            SELECT 'customers: tenant=' || "tenantId" || ' phone=' || "phone"
                   || ' rows=' || COUNT(*) AS line
            FROM customers
            GROUP BY "tenantId", "phone"
            HAVING COUNT(*) > 1
            UNION ALL
            SELECT 'suppliers: tenant=' || "tenantId" || ' phone=' || "phone"
                   || ' rows=' || COUNT(*) AS line
            FROM suppliers
            GROUP BY "tenantId", "phone"
            HAVING COUNT(*) > 1
        ) r;

        RAISE EXCEPTION
            E'DEDUP REQUIRED before adding phone uniqueness (merge/retire these manually — never auto-delete):\n%',
            report;
    END IF;
END
$$;

-- ── Customer: (tenantId, phone) unique ─────────────────────────────────────
-- The old non-unique index is subsumed by the unique constraint.
DROP INDEX IF EXISTS "customers_tenantId_phone_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "customers_tenantId_phone_key"
    ON "customers" ("tenantId", "phone");

-- ── Supplier: (tenantId, phone) unique ─────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_tenantId_phone_key"
    ON "suppliers" ("tenantId", "phone");

COMMIT;

-- ── Verification (run after COMMIT) ────────────────────────────────────────
-- SELECT conname, contype FROM pg_constraint
-- WHERE conname IN ('customers_tenantId_phone_key', 'suppliers_tenantId_phone_key');
-- SELECT indexname FROM pg_indexes
-- WHERE indexname IN ('customers_tenantId_phone_key', 'suppliers_tenantId_phone_key');
