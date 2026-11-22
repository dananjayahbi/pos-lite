# Purchase-order date filter follows the displayed Order Date

The list table shows `PurchaseOrder.orderDate`, but the date filter compared the
UTC `createdAt` timestamp. An order dated 29 Oct that was created late on 28 Oct
UTC therefore disappeared from a 29 Oct filter. The two date inputs also had no
visible label (ARGUS #230).

## Rule

`buildPurchaseOrderDateRange(from, to)` in
`src/lib/services/purchaseOrderDateRange.core.ts` turns the bare
`yyyy-mm-dd` input days into an inclusive local range on `orderDate`:

| Input  | Bound                              |
| ------ | ---------------------------------- |
| `from` | local `00:00:00.000` of that day    |
| `to`   | local `23:59:59.999` of that day    |

An order dated 29 Oct is stored at local noon by the form (`poDates.ts`), so it
always falls inside the 29 Oct range. Both edges are inclusive, and an empty
input omits that bound.

`isValidIsoDay` rejects malformed or rollover days (`2026-02-31`). The GET route
validates `from`/`to` with it and returns 400 `VALIDATION_ERROR` for a bad day
instead of silently widening the results.

## UI

The two controls now carry visible labels, **Order date from** and
**Order date to**, instead of relying on an aria-label that no sighted user can
see. Query parameters are unchanged (`from`, `to`).

## Verification

`src/lib/services/__tests__/purchaseOrderDateRange.core.test.ts` covers an empty
range, each bound, same-day inclusion at local noon, multi-day ranges, invalid
days and rollover rejection. Expectations use local `Date` construction so the
suite is timezone-independent.
