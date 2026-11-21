# Clearing a stock-take count (ARGUS #208)

`StockTakeItem.countedQuantity` is nullable, but the UI treated a blank input as
"no change" and the API validator rejected `null`. Clearing a mistaken count
therefore left the old value in the database, kept the row in the progress
count and kept its discrepancy; negative entries were silently discarded.

## Contract

Blank means **not counted** (`null`) everywhere:

- UI: clearing a count input and blurring sends `countedQuantity: null`.
- Validator: `StockTakeItemUpdateSchema` accepts a non-negative integer, `null`
  or an omitted field; a blank string is normalized to `null`.
- Route: `null` writes `countedQuantity = null` and `discrepancy = null`; a
  number writes the count and its computed discrepancy.
- Service: `updateStockTakeItem` accepts `number | null` and clears the
  discrepancy for `null`.

Omitting `countedQuantity` still means "leave the row unchanged" (used when a
request only toggles `isRecounted`).

Cleared rows are uncounted again: the progress bar decreases and completion
refuses the session until they are counted.

## Invalid entries

`parseStockTakeCountInput` in `src/lib/services/stockTakeCount.core.ts` is the
shared interpretation used by the session UI. A negative value shows
"Counted quantity cannot be negative"; a fractional or non-numeric value shows
"Counted quantity must be a whole number". The input restores the stored value
and nothing is written. The API independently rejects the same values with
`400 VALIDATION_ERROR`.

Tests: `src/lib/services/__tests__/stockTakeCount.core.test.ts`.
