# Packaging consumption history

Packaging Stock only showed balances. `PackagingConsumption` rows were written
on every dispatch and used by reconciliation, and the delete dialog promised
that history was kept, but there was no way to read it (ARGUS #281).

## Behaviour

- `GET /api/store/packaging/history` returns a newest-first ledger page scoped
  to the tenant. Query parameters: `page` (default 1), `pageSize` (default 25,
  max 100) and optional `itemId`.
- Each row carries the delivery/order reference (`delivery.orderRef`, falling
  back to the delivery id), the packaging item name/SKU, the consumed quantity
  with its unit, and the timestamp.
- Consumptions of soft-deleted items are included: the items keep their history
  after delete, as the delete dialog states.
- The Packaging Stock page renders the ledger below the inventory table, with an
  item filter and Previous/Next pagination. The request is only ever one page
  (max 100 rows), never an unbounded list.
- Mapping lives in the pure `lib/packaging/packagingHistory.core.ts` helper.

## Verification

`packagingHistory.core.test.ts` covers the delivery/order reference fallback,
the quantity/unit label and the timestamp mapping.
