# BOM production → main inventory sync

Production must move finished goods into inventory across **three** records, all
inside one database transaction:

1. `ProductVariant.stockQuantity` — the quantity shown by `/inventory`.
2. `StockMovement` (`reason = MANUFACTURED`) — the stock ledger / product stock
   history.
3. `BatchTracking` (`source = MANUFACTURED`) — batch-aware inventory, expiry
   reporting and traceability.

## Flow (`produceGoods`)

`src/lib/services/bom.service.ts` now performs:

1. Validate the BOM, product source and raw-material availability.
2. Deduct each raw material.
3. Create the `ProductionLog` (its id seeds the batch number).
4. Create a `MANUFACTURED` batch named `MFG-YYYYMMDD-XXXXXXXX`
   (`buildProductionBatchNumber` in `bom.core.ts`).
5. Call `adjustStockInTx` with `reason: MANUFACTURED` and `batchId`, which
   increments `stockQuantity` and writes the linked stock movement.
6. Audit-log the production with the batch id/number.

Returned payload now includes `batchId` and `batchNumber` alongside
`productionLogId`.

## UI cache invalidation

`useProduceGoods` invalidates every dependent React Query key after a run:
`products`, `product`, `batches`, `stock-movements`, `stock-summary`,
`stock-valuation`, `low-stock-*`, `raw-materials`, and `raw-material-stats`.
Without this, `/inventory` could show a 30-second-stale stock figure after a
production run even though the database was already correct.

The production dialog toast also shows the generated batch number.

## Regression coverage

- `tests/22_factory_bom.spec.ts` T2 asserts variant stock +3, the MANUFACTURED
  batch with quantity 3, and a batch-linked MANUFACTURED stock movement.
- `src/lib/services/__tests__/bom.core.test.ts` covers batch-number generation.
