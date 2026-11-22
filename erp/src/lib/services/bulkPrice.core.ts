export interface BulkPriceUpdate {
  mode: 'FIXED' | 'PERCENT';
  costPrice?: number | undefined;
  retailPrice?: number | undefined;
  percentage?: number | undefined;
  direction?: 'INCREASE' | 'DECREASE' | undefined;
  target?: 'COST' | 'RETAIL' | 'BOTH' | undefined;
}

export type BulkVariantPriceResult =
  | { ok: true; costPrice: number; retailPrice: number }
  | { ok: false; reason: 'NON_POSITIVE_PRICE' | 'RETAIL_BELOW_COST' };

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Compute the prices a bulk update would write, enforcing catalogue invariants
 * (ARGUS #140):
 *
 * - cost and retail must stay strictly positive (a 150% decrease used to write
 *   -1,383.20);
 * - retail must not fall below cost (the product/variant forms already reject
 *   that combination, so the bulk path must too).
 *
 * Invalid rows are rejected individually so one bad variant cannot block an
 * otherwise valid batch.
 */
export function computeBulkVariantPrice(
  current: { costPrice: number; retailPrice: number },
  update: BulkPriceUpdate,
): BulkVariantPriceResult {
  let costPrice = current.costPrice;
  let retailPrice = current.retailPrice;

  if (update.mode === 'FIXED') {
    if (update.costPrice === undefined || update.retailPrice === undefined) {
      return { ok: false, reason: 'NON_POSITIVE_PRICE' };
    }
    costPrice = round2(update.costPrice);
    retailPrice = round2(update.retailPrice);
  } else {
    if (update.percentage === undefined || update.direction === undefined || update.target === undefined) {
      return { ok: false, reason: 'NON_POSITIVE_PRICE' };
    }
    const multiplier =
      update.direction === 'INCREASE' ? 1 + update.percentage / 100 : 1 - update.percentage / 100;
    if (update.target === 'COST' || update.target === 'BOTH') {
      costPrice = round2(current.costPrice * multiplier);
    }
    if (update.target === 'RETAIL' || update.target === 'BOTH') {
      retailPrice = round2(current.retailPrice * multiplier);
    }
  }

  if (!Number.isFinite(costPrice) || !Number.isFinite(retailPrice)) {
    return { ok: false, reason: 'NON_POSITIVE_PRICE' };
  }
  if (costPrice <= 0 || retailPrice <= 0) {
    return { ok: false, reason: 'NON_POSITIVE_PRICE' };
  }
  if (retailPrice < costPrice) {
    return { ok: false, reason: 'RETAIL_BELOW_COST' };
  }

  return { ok: true, costPrice, retailPrice };
}
