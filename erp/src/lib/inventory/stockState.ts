/**
 * One stock-state rule for the inventory list (ARGUS #142).
 *
 * Before this module the status badge and the low/out-of-stock filters each had
 * their own definition:
 * - the badge said "Out of Stock" when ANY variant was exactly 0;
 * - the out-of-stock filter required EVERY variant <= 0;
 * - the low-stock filter looked at 0 < qty <= threshold, while the badge's
 *   low-stock branch included 0.
 *
 * The rule below is the shared definition used by both the API filter and the
 * badge, so the row label always agrees with the filter that produced the row.
 */

export type StockState = 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK';

export interface StockStateVariant {
  stockQuantity: number;
  lowStockThreshold: number;
}

/** A variant is out of stock at or below zero, low inside its threshold. */
export function getVariantStockState(variant: StockStateVariant): StockState {
  if (variant.stockQuantity <= 0) return 'OUT_OF_STOCK';
  if (variant.stockQuantity <= variant.lowStockThreshold) return 'LOW_STOCK';
  return 'IN_STOCK';
}

/**
 * A product is out of stock only when no variant is sellable; it is low stock
 * when at least one sellable variant is at or below its threshold. A product
 * without variants keeps the historical "in stock" presentation.
 */
export function getProductStockState(variants: StockStateVariant[]): StockState {
  if (variants.length === 0) return 'IN_STOCK';

  const states = variants.map(getVariantStockState);
  if (states.every((state) => state === 'OUT_OF_STOCK')) return 'OUT_OF_STOCK';
  if (states.some((state) => state === 'LOW_STOCK')) return 'LOW_STOCK';
  return 'IN_STOCK';
}

/** True when the product matches an inventory `low_stock` / `out_of_stock` filter. */
export function matchesStockStatusFilter(
  variants: StockStateVariant[],
  status: 'low_stock' | 'out_of_stock',
): boolean {
  const state = getProductStockState(variants);
  return status === 'low_stock' ? state === 'LOW_STOCK' : state === 'OUT_OF_STOCK';
}
