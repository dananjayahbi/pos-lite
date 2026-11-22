/**
 * Low-stock shortfall (ARGUS #144).
 *
 * The low-stock table rendered `-${shortfall}`, so a variant at 3 against a
 * threshold of 5 read "-2" and one exactly at the threshold read "-0". The
 * API/CSV already report the positive gap; this helper keeps the UI on the
 * same definition and gives it an explicit, human-readable label:
 *
 * - below threshold → "2 short"
 * - exactly at threshold → "At threshold"
 * - above threshold → "Above threshold" (not shown by the low-stock list)
 *
 * The amount is floored at zero, so a negative requirement (and `-0`) cannot be
 * rendered. Values are rounded to 2dp for decimal stock (raw materials).
 */

export interface LowStockShortfall {
  /** `max(threshold - stock, 0)`, rounded to 2dp. */
  amount: number;
  label: string;
}

const DECIMAL_PLACES = 2;

function roundTo2(value: number): number {
  const factor = 10 ** DECIMAL_PLACES;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function resolveLowStockShortfall(
  stockQuantity: number,
  threshold: number,
): LowStockShortfall {
  if (!Number.isFinite(stockQuantity) || !Number.isFinite(threshold)) {
    return { amount: 0, label: 'At threshold' };
  }

  const gap = threshold - stockQuantity;
  if (gap > 0) {
    const amount = roundTo2(gap);
    // A sub-0.01 gap is presentation noise; do not render "0 short".
    if (amount > 0) {
      return { amount, label: `${amount} short` };
    }
    return { amount: 0, label: 'At threshold' };
  }

  return {
    amount: 0,
    label: stockQuantity > threshold ? 'Above threshold' : 'At threshold',
  };
}
