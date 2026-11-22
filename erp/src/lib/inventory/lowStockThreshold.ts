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

/**
 * ARGUS #216 - the override input contract.
 *
 * The number input snapped an empty field back to 1 (so replacing 5 with 20
 * could become 120), accepted 9,999,999,999 (which the API clamped to int4) and
 * forced a minimum of 1 even though threshold `0` is the out-of-stock view.
 * The input is now kept as text and parsed here: empty is an explicit error
 * rather than a silent 1, `0` is valid, and values above a sane ceiling are
 * rejected before they reach the API.
 */
export const LOW_STOCK_OVERRIDE_MAX = 1_000_000;

export interface LowStockOverrideParseResult {
  /** Present only when the input is valid. */
  threshold?: number;
  error?: string;
}

export function parseLowStockOverrideInput(raw: string): LowStockOverrideParseResult {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { error: 'Enter a threshold - 0 shows out-of-stock variants only' };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { error: 'Enter a whole number' };
  }
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value)) {
    return { error: `Threshold cannot exceed ${LOW_STOCK_OVERRIDE_MAX.toLocaleString('en-GB')}` };
  }
  if (value > LOW_STOCK_OVERRIDE_MAX) {
    return { error: `Threshold cannot exceed ${LOW_STOCK_OVERRIDE_MAX.toLocaleString('en-GB')}` };
  }
  return { threshold: value };
}
