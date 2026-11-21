# Stock adjustments refresh every affected cache (ARGUS #194)

The manual adjustment form reset itself after a successful POST but left the
React Query caches untouched. Product lists, low-stock screens, the Stock
Control summary, valuation and movement feeds all keep their own entry with a
30 s - 5 min `staleTime`, so they kept showing pre-adjustment numbers.

## Shared key list

`src/lib/stock/query-invalidation.ts` owns the roots:

| Root | Screen / cache |
| ---- | -------------- |
| `products`, `product` | Catalog list and product detail variant stock |
| `pos-products` | POS search / availability |
| `low-stock-variants`, `low-stock-count` | Low-stock list, banner and nav badge (the toast action target) |
| `stock-summary` | Stock Control KPI cards |
| `stock-valuation` | Valuation page/report |
| `recent-movements` | Dashboard recent movements |
| `global-stock-movements`, `stock-movements` | Movement History and product stock history |

React Query matches by prefix, so `['products']` also invalidates every filtered
list and `['global-stock-movements']` every page/filter combination.

`useInvalidateStockQueries` (`src/hooks/useInvalidateStockQueries.ts`) maps the
roots to `queryClient.invalidateQueries` and is awaited by the single-adjustment
form before it resets. Any bulk-adjust UI should call the same hook (or the key
list) after success; the bulk API route currently has no in-app client caller.
A cache-refresh failure is logged as best-effort and never turns a committed
adjustment into a network-error toast.

Tests: `src/lib/stock/__tests__/query-invalidation.test.ts`.
