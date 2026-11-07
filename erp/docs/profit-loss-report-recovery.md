# Profit & Loss report recovery (missing cost snapshot column)

## Symptom

Opening **Reports → Profit & Loss** rendered:

```
Failed to load report: Failed to fetch report
```

The API returned `500 INTERNAL_ERROR` from
`GET /api/reports/profit-loss`.

## Root cause

The P&L aggregation (and the monthly COGS series) reads
`SaleLine.costPriceSnapshot`:

```sql
SELECT COALESCE(SUM(COALESCE(sl."costPriceSnapshot", pv."costPrice") * sl."quantity"), 0)
FROM sale_lines sl
...
```

The column is introduced by migration
`20261102010000_add_sale_line_cost_snapshot`. In the affected environment the
migration was recorded/applied without the column actually existing, so Prisma
raised:

```
The column `sale_lines.costPriceSnapshot` does not exist in the current database.
```

and the report route converted that into a generic 500, which the client showed
as "Failed to fetch report".

## Fix

Migration `20261106010000_ensure_sale_line_cost_snapshot` re-asserts the
nullable column idempotently:

```sql
ALTER TABLE "sale_lines"
  ADD COLUMN IF NOT EXISTS "costPriceSnapshot" DECIMAL(12,2);
```

- Existing cost snapshots are untouched.
- Fresh databases keep the column from the original migration; the repair is a
  no-op.
- Databases with the drift recover on the next `prisma migrate deploy` (or the
  equivalent one-off `prisma db execute --file ...`).

## Verification

1. `GET /api/reports/profit-loss` returns `200` with `success: true` for the
   owner account.
2. The Profit & Loss page renders Net Revenue / Gross Profit / Net Profit cards
   and the statement table instead of the error message.
3. Zero-sale ranges (e.g. `2020-01-01` → `2020-01-31`) also return a well-formed
   body with zero totals.

`tests/34_reports_analytics.spec.ts` P2 continues to pin 2-dp-safe P&L figures.
