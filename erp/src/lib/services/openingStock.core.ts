/**
 * Opening-stock helpers for newly created product variants (ARGUS #139).
 *
 * The new-product wizard accepts an "Initial Stock" value. Writing it straight
 * onto `ProductVariant.stockQuantity` left the stock ledger with no provenance:
 * Stock History started with the first sale even though the variant already had
 * units. Opening stock must always be recorded as an `INITIAL_STOCK` movement
 * through `adjustStockInTx`.
 */

export interface OpeningStockInput {
  initialStock?: number | undefined;
  stockQuantity?: number | undefined;
}

/**
 * Normalise the opening quantity accepted by the creation form.
 *
 * Negative, fractional and non-finite values cannot become a stock movement, so
 * they resolve to zero instead of throwing mid-transaction.
 */
export function resolveOpeningStockQuantity(variant: OpeningStockInput): number {
  const raw = variant.initialStock ?? variant.stockQuantity ?? 0;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.floor(raw));
}
