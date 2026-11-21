# Repairing legacy production runs without a batch

ARGUS #253: three of four production runs had no batch. Only the newest run had
`MFG-...`, a `batchId` on its MANUFACTURED stock movement, and batch fields in
its production audit. The current `produceGoods` service always creates all
three records, so these are historical rows written before that guarantee.

`scripts/repair-production-batches.ts` repairs them. **Dry run by default.**

## What it changes

For each safely matched run it only:

1. creates the missing `BatchTracking` row
   (`source = MANUFACTURED`, `quantity` copied from the production log,
   `receivedAt` set to the run time), or reuses it if a previous attempt
   created the batch but crashed before linking, and
2. sets `StockMovement.batchId` on the existing MANUFACTURED movement, and
3. writes a `PRODUCTION_BATCH_REPAIRED` audit row (`actorRole = SYSTEM`) with
   the log, movement, batch id/number and quantity.

It never changes `ProductVariant.stockQuantity`, `StockMovement.quantityDelta`,
`quantityBefore/After`, raw-material stock or batch quantities.

## Matching rules

The planner is in `src/lib/services/productionBatchRepair.core.ts`:

- the production log's batch-number suffix is derived from its id (the same
  suffix `buildProductionBatchNumber` uses, so a run near midnight still
  matches),
- a run is already repaired when that batch exists **and** a movement links to
  it (`HAS_BATCH`),
- otherwise the movement must be `MANUFACTURED`, for the same variant,
  unlinked, with `quantityDelta === log.quantity`, and recorded within the
  match window (10 minutes forward, 1 minute backward for clock skew),
- exactly one candidate must match. Two identical runs close together are
  reported as `AMBIGUOUS_MOVEMENT` rather than paired by guesswork,
- a missing movement is `NO_MOVEMENT`, a different quantity is
  `QUANTITY_MISMATCH`. Both are printed as MANUAL and left untouched,
- unclaimed unlinked MANUFACTURED movements are printed as orphans and are
  never modified.

## Usage

```sh
# dry run, all tenants
node --env-file=.env --import tsx scripts/repair-production-batches.ts

# one tenant
node --env-file=.env --import tsx scripts/repair-production-batches.ts --tenant=<tenantId>

# one or more runs (repeatable or comma-separated)
node --env-file=.env --import tsx scripts/repair-production-batches.ts \
  --tenant=<tenantId> --log=<productionLogId> --log=<anotherId>

# write the repairs
node --env-file=.env --import tsx scripts/repair-production-batches.ts --apply
```

Each write runs in its own transaction, locks the production-log and
stock-movement rows with `SELECT ... FOR UPDATE`, re-reads them, verifies they
still match the plan, and creates/links the batch. Re-running the script is
idempotent: repaired runs report `HAS_BATCH`, and a half-finished repair is
completed by reusing the existing batch.

The script is never called by seeds, migrations or application code.

## Verification

- `src/lib/services/__tests__/productionBatchRepair.core.test.ts` covers the
  suffix match, a normal repair, crash recovery, missing/mismatched movements,
  the time window, ambiguous identical runs, and movement double-claiming.
- `npx tsc --noEmit` type-checks the CLI.
