/**
 * ARGUS #517 - with zero actionable outcomes (no redelivery, no cancellation)
 * the recovery rate was shown as 0%, implying a failed recovery programme. The
 * rate is undefined in that state and must display as an em dash.
 */

export function computeRecoveryRate(
  redelivered: number,
  cancelled: number,
): number | null {
  const actionable = redelivered + cancelled;
  if (actionable === 0) return null;
  return Math.round((redelivered / actionable) * 1000) / 10;
}

export function formatRecoveryRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return '-';
  return `${rate}%`;
}

/**
 * Sort comparator that keeps the undefined rate at the end in both directions,
 * so "worst first" never invents a 0% entry.
 */
export function compareRecoveryRate(
  a: number | null | undefined,
  b: number | null | undefined,
  direction: 'asc' | 'desc',
): number {
  const left = a ?? null;
  const right = b ?? null;
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return direction === 'asc' ? left - right : right - left;
}
