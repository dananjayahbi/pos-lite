# Stock movement date-range validation

ARGUS #204.

`From` and `To` were independent: `From 20 Nov` + `To 15 Nov` ran a query that
could never match and rendered the ordinary "No stock movements found" empty
state, so the operator had to infer the mistake.

- `movementDateRangeError` (`src/lib/stock/movement-date-range.ts`) returns
  `From must be on or before To` (or `Enter valid dates` for a malformed day)
  and is unit tested.
- The page shows that message inline under the date filters, replaces the table
  body with the same explanation, and disables Export CSV until the range is
  coherent. A rejected range is never presented as an empty ledger.
- `GET /api/store/stock-control/movements` resolves the inclusive day edges and
  returns `400 VALIDATION_ERROR` with the same message when `from > to`, so a
  direct API call cannot silently return zero rows either.
