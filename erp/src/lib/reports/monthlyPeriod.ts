/**
 * Monthly trend scope (ARGUS #437).
 *
 * The P&L monthly table used to run from server `NOW() - 12 months`, ignoring
 * the selected From/To. A September-only statement therefore showed Aug-Nov.
 * These helpers keep the monthly detail inside the same selected period as the
 * statement totals.
 */

/** Local calendar month key (`YYYY-MM`) for a Date. */
export function monthKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Keep only month keys between the selected from/to months (inclusive).
 * Rows outside the period are dropped rather than displayed as trend context.
 */
export function filterMonthKeysInPeriod(
  keys: Iterable<string>,
  from: Date,
  to: Date,
): string[] {
  const fromKey = monthKey(from);
  const toKey = monthKey(to);
  return Array.from(new Set(keys))
    .filter((key) => key >= fromKey && key <= toKey)
    .sort((a, b) => a.localeCompare(b));
}
