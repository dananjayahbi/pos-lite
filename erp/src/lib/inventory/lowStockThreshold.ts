/**
 * ARGUS #214 - which threshold the low-stock list actually applied.
 *
 * With an override of 50, the list/shortfall/count use 50 while the table used
 * to print the variant's own threshold (for example 5), so the numbers did not
 * reconcile. One pure helper now describes the effective threshold and the
 * rule sentence for the page, table and CSV.
 */

export type LowStockThresholdSource = 'variant' | 'override';

export interface EffectiveLowStockThreshold {
  applied: number;
  variant: number;
  source: LowStockThresholdSource;
  /** True when an explicit override drove the list predicate. */
  isOverride: boolean;
}

export function resolveEffectiveLowStockThreshold(
  variantThreshold: number,
  override?: number | null,
): EffectiveLowStockThreshold {
  const isOverride = override !== null && override !== undefined && Number.isFinite(override);
  return {
    applied: isOverride ? override : variantThreshold,
    variant: variantThreshold,
    source: isOverride ? 'override' : 'variant',
    isOverride,
  };
}

/** Subtitle/empty-state sentence describing the rule actually applied. */
export function lowStockThresholdRuleLabel(
  override?: number | null,
): string {
  const resolved = resolveEffectiveLowStockThreshold(0, override);
  return resolved.isOverride
    ? `at or below the ${resolved.applied}-unit override threshold`
    : "at or below each variant's own low stock threshold";
}

/** Compact label for the Threshold column. */
export function lowStockThresholdCellLabel(
  variantThreshold: number,
  override?: number | null,
): string {
  const resolved = resolveEffectiveLowStockThreshold(variantThreshold, override);
  return resolved.isOverride ? `${resolved.applied} (override)` : String(resolved.applied);
}
