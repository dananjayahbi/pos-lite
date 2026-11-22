/**
 * Petty-cash low-balance presentation (ARGUS #414).
 *
 * The balance-equation block highlighted only a negative balance, so a fund
 * sitting at a positive amount below its configured threshold looked healthy.
 * The page also had no badge at all. This helper is the single display rule for
 * both surfaces.
 */

export interface LowBalanceDisplay {
  /** At or below the configured threshold (0 and negatives included). */
  isLow: boolean;
  /** Strictly negative balance. */
  isNegative: boolean;
  /** Short badge label, or null when the fund is healthy. */
  label: string | null;
}

export function resolveLowBalanceDisplay(
  currentBalance: number | string,
  threshold: number | string | null | undefined,
): LowBalanceDisplay {
  const balance = Number(currentBalance);
  const limit =
    threshold === null || threshold === undefined || threshold === ''
      ? null
      : Number(threshold);
  const hasLimit = limit !== null && Number.isFinite(limit);
  const isNegative = Number.isFinite(balance) && balance < 0;
  const isLow = isNegative || (hasLimit && Number.isFinite(balance) && balance <= limit);

  return {
    isLow,
    isNegative,
    label: isLow ? (isNegative ? 'Negative balance' : 'Low balance') : null,
  };
}
