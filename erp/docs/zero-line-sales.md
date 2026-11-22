# Zero-line completed sales (ARGUS #76)

## What was wrong

Four `COMPLETED` CASH sales from 17 Sep 2026 each carried `totalAmount =
2500.00` with **zero `sale_lines`**, **zero `payments`** and no shift. They showed
as `Items 0` in the custom-range ledger and their detail pages had an empty Items
table and no Payments section, yet they counted as Rs. 10,000 of completed
revenue — money with no goods and no tender.

They were written by the **legacy appointment conversion**, which inserted a bare
sale row at the service price without lines, tax, payments or account entries.
That path is fixed (ARGUS #119): `convertAppointmentToSale` now always writes a
service line, payment legs, account entries and customer spend inside one
transaction (see `appointment-conversion-sale.md`). There is no remaining code
path that creates a completed sale without a line.

## Invariant

`assertCompletedSaleShape` in
`src/lib/services/saleCompleteness.core.ts` guards the shape of a completed sale:

- `COMPLETED` requires **at least one line item** (`422 SALE_REQUIRES_LINE`).
- `COMPLETED` with `totalAmount > 0` requires **at least one payment leg**
  (`422 SALE_REQUIRES_PAYMENT`).
- A **zero-value sale** (line present, total `<= 0`) is explicitly allowed
  without a payment leg — replacements and fully discounted carts are legitimate.
- `OPEN` (held) and `VOIDED` sales are not constrained; they are partial by design.

`createSale` builds the tender legs and calls the guard **before** writing the
sale row, so an invalid sale never reaches the database even when an internal
caller bypasses the HTTP validator (which also requires `lines.min(1)`).
`createSale` is the only writer of `COMPLETED` sales; appointment conversion
always supplies its service line.

## Repairing the legacy rows

`scripts/repair-zero-line-sales.ts` lists zero-line completed sales and voids
them only with an explicit `--apply`. It is dry-run by default and is **never**
invoked by seed/import paths.

```bash
# from erp/ — list only, no writes
node --env-file=.env --import tsx scripts/repair-zero-line-sales.ts

# void the safe rows (status = VOIDED + audit row)
node --env-file=.env --import tsx scripts/repair-zero-line-sales.ts --apply

# scope to one tenant
node --env-file=.env --import tsx scripts/repair-zero-line-sales.ts --tenant=<tenantId> --apply
```

A candidate is only voided when it has **no lines, no payments, no completed
returns and no payment-account entries**. That makes the repair a minimal
`status = VOIDED` / `voidedAt = now()` flip with an audit row — there is no
stock, payment or ledger to reverse. Anything with a side effect is skipped and
printed as `SKIP: ...` for manual review; it must not be silently altered.

Voided sales drop out of completed revenue immediately (all reports filter on
`status = 'COMPLETED'`), while the row and its audit trail remain for history.

### Read-only SQL to find them

```sql
SELECT s.id,
       s."tenantId",
       s."totalAmount",
       s."paymentMethod",
       COALESCE(s."saleDate", s."createdAt") AS sale_date
FROM sales s
LEFT JOIN sale_lines l ON l."saleId" = s.id
LEFT JOIN payments p ON p."saleId" = s.id
WHERE s.status = 'COMPLETED'
GROUP BY s.id
HAVING COUNT(l.id) = 0
   AND COUNT(p.id) = 0
ORDER BY sale_date;
```

The SQL equivalent of the repair, for stores that prefer to apply it by hand,
is the same `UPDATE ... WHERE` narrow filter (inside one transaction, with an
`audit_logs` insert):

```sql
UPDATE sales
SET status = 'VOIDED', "voidedAt" = now(), "updatedAt" = now()
WHERE status = 'COMPLETED'
  AND NOT EXISTS (SELECT 1 FROM sale_lines WHERE "saleId" = sales.id)
  AND NOT EXISTS (SELECT 1 FROM payments   WHERE "saleId" = sales.id)
  AND id = '<sale-id>';
```

Prefer the script: it also writes the audit row (with a generated id) and skips
rows that have returns or account entries.

## Verification

`src/lib/services/__tests__/saleCompleteness.core.test.ts` covers the reject and
allow cases: zero lines, lines without payment, a legitimate zero-value sale,
and held/voided sales left alone. Run:

```bash
npx vitest run src/lib/services/__tests__/saleCompleteness.core.test.ts
npx tsc --noEmit
```
