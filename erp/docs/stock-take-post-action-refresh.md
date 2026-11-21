# Stock-take actions refresh stock caches and the storefront (ARGUS #210)

Approval applies stock corrections, and cancellation discards counted data.
The review/list screens only invalidated `['stock-take-session']` /
`['stock-take-sessions']`, so the dashboard, low-stock, valuation, product and
movement screens kept pre-action numbers, and the website kept stale
availability.

## Client caches

`StockTakeReview` (approve) and `StockTakeList` (cancel) now also call
`useInvalidateStockQueries` from ARGUS #194. That reuses
`STOCK_ADJUSTMENT_QUERY_ROOTS` (`src/lib/stock/query-invalidation.ts`), so the
same families are refreshed:

- products / product detail / POS products,
- low-stock list, count and nav badge,
- stock summary and valuation,
- recent, global and per-product movements.

Cache failure is swallowed; the stock-take action is already committed.

## Storefront

Both routes call `revalidateTenantStorefront` with
`stockAdjustmentRevalidationOptions` (ARGUS #195), exactly like the adjustment
routes:

- approve revalidates each product that received a non-zero correction plus the
  catalog filters;
- cancel revalidates the counted products plus the catalog filters (the stock
  is unchanged, but the route keeps the same contract).

Revalidation failures use `console.warn` and never turn a successful action into
an error.

Tests: `src/lib/stock/__tests__/stock-take-invalidation.test.ts`.
