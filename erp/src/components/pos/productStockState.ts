/**
 * ARGUS #73: the POS product card's stock badge.
 *
 * The "Low" badge used to look at the summed stock of every variant
 * (`totalStock <= 5`), so a product whose 500 ml variant sat exactly on its
 * low-stock threshold showed no badge as long as the other variants kept the
 * total above five. The badge must reflect the variant picker: any variant at
 * or below its own `lowStockThreshold` makes the card low.
 */

export interface PosVariantStock {
  stockQuantity: number;
  /** Per-variant threshold; legacy rows without one fall back to 5. */
  lowStockThreshold?: number | null | undefined;
}

export interface ProductStockState {
  /** Sum of every variant's on-hand quantity. */
  totalStock: number;
  outOfStock: boolean;
  /** Variants with stock > 0 and stock <= their threshold. */
  lowStockVariantCount: number;
  hasLowStockVariant: boolean;
}

export const DEFAULT_POS_LOW_STOCK_THRESHOLD = 5;

export function isLowStockVariant(
  variant: PosVariantStock,
  fallbackThreshold: number = DEFAULT_POS_LOW_STOCK_THRESHOLD,
): boolean {
  if (variant.stockQuantity <= 0) return false;
  const threshold = variant.lowStockThreshold ?? fallbackThreshold;
  return variant.stockQuantity <= threshold;
}

export function productCardStockState(
  variants: readonly PosVariantStock[],
): ProductStockState {
  const totalStock = variants.reduce((sum, variant) => sum + variant.stockQuantity, 0);
  const lowStockVariantCount = variants.filter((variant) => isLowStockVariant(variant)).length;

  return {
    totalStock,
    outOfStock: totalStock === 0,
    lowStockVariantCount,
    hasLowStockVariant: lowStockVariantCount > 0,
  };
}
