# COD reconciliation ledger — delivered orders (ARGUS #511)

Every **delivered, unpaid COD** delivery must have exactly one
`ReconciliationLedgerEntry` with the collectable receivable. The amount is the
single ARGUS #288 rule:

```
collectable = goods (Delivery.codAmount) + shipping (Delivery.shippingFee)
```

A `PAID` parcel collects `0` and never gets an entry.

## Live code path

`ensureDeliveredCodEntry` (server helper) is called from both places that can
move a delivery to `DELIVERED`:

- courier tracking (`applyTrackingUpdate`), and
- the manual/bulk order status route.

It upserts by `deliveryId`, so concurrent/back-to-back updates cannot create a
duplicate entry.

## Historical repair

Older deliveries may predate the hook. The backfill CLI is dry-run by default:

```bash
node --env-file=.env --import tsx scripts/backfill-cod-reconciliation.ts
node --env-file=.env --import tsx scripts/backfill-cod-reconciliation.ts --apply
node --env-file=.env --import tsx scripts/backfill-cod-reconciliation.ts --tenant=<tenantId> --apply
```

It plans only delivered unpaid COD deliveries with no existing entry, reports
the would-be count/total, and on `--apply` inserts the missing rows and writes
a `RECONCILIATION_COD_BACKFILLED` audit row per entry with the run reference
`argus-511-cod-reconciliation-backfill`. It never updates or deletes existing
ledger rows and is never invoked automatically.
