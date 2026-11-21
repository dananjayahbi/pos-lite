/**
 * ARGUS #195 - storefront revalidation arguments for stock adjustments.
 *
 * A stock change affects the product detail page(s) and the catalog
 * availability filters. Normalizing the product ids here keeps the single and
 * bulk adjustment routes (and their tests) in agreement, and drops duplicate
 * variants of the same product so the website is purged once per product.
 */

export interface StockAdjustmentRevalidationOptions {
  productIds: string[];
  catalog: true;
}

export function stockAdjustmentRevalidationOptions(
  productIds: readonly (string | null | undefined)[],
): StockAdjustmentRevalidationOptions {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const productId of productIds) {
    if (!productId || seen.has(productId)) continue;
    seen.add(productId);
    unique.push(productId);
  }
  return { productIds: unique, catalog: true };
}
