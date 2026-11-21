/**
 * ARGUS #194 - every React Query cache touched by a stock adjustment.
 *
 * Product, low-stock, summary, valuation and movement screens each hold their
 * own cache entry with a 30 s - 5 min staleTime. A successful single or bulk
 * adjustment must invalidate all of them, otherwise a screen keeps rendering
 * pre-adjustment numbers until its timer expires.
 *
 * React Query matches query keys by prefix, so one root per family is enough:
 * `['products']` covers every filtered product list, `['global-stock-movements']`
 * every page/filter combination, and so on.
 */

export const STOCK_ADJUSTMENT_QUERY_ROOTS = [
  // Catalog + product detail (variant stock columns).
  'products',
  'product',
  // POS product search/availability.
  'pos-products',
  // Low-stock banner, list and nav badge.
  'low-stock-variants',
  'low-stock-count',
  // Stock Control dashboard KPIs and valuation report.
  'stock-summary',
  'stock-valuation',
  // Movement feeds.
  'recent-movements',
  'global-stock-movements',
  'stock-movements',
] as const;

export type StockAdjustmentQueryRoot = (typeof STOCK_ADJUSTMENT_QUERY_ROOTS)[number];

/** Query keys ready for `queryClient.invalidateQueries({ queryKey })`. */
export function stockAdjustmentQueryKeys(): ReadonlyArray<readonly [StockAdjustmentQueryRoot]> {
  return STOCK_ADJUSTMENT_QUERY_ROOTS.map((root) => [root] as const);
}
