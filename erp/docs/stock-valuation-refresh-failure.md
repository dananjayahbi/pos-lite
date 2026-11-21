# Stock Valuation refresh failure (ARGUS #221)

`useInvalidateStockValuation()` returned a promise that resolves after the
refetch settles, whether it succeeded or failed. The page awaited it and always
toasted "Valuation refreshed", so a forced 500 left stale figures with a success
confirmation.

- `handleRefresh()` now awaits `refetch()` and passes its `error` to
  `valuationRefreshOutcome()` (`src/components/stock-control/valuationRefresh.ts`).
- Success: `Valuation refreshed`.
- Failure: `Refresh failed: <server message>` (or "figures may be out of date"
  when the error carries no message). No success toast is shown.
- While the last refetch is in error but old data is still cached, the header
  reads `Last successful snapshot: <timestamp>` instead of `As of`, so the stale
  numbers are labelled.
