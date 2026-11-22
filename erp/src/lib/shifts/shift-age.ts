/**
 * ARGUS #115: long-open shift policy.
 *
 * A shift left open for days is a reconciliation risk: the drawer is only
 * counted when the shift closes. The app deliberately does not auto-close (that
 * would invent a cash count), so both the POS clock and the shift ledger must
 * say, explicitly, when a shift has been open longer than the shop's tolerance.
 */

/** Open longer than this many hours triggers the warning. */
export const LONG_OPEN_SHIFT_HOURS = 12;

function toTime(value: string | number | Date): number | null {
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

/** Hours the shift has been open, or `null` for an invalid timestamp. */
export function shiftOpenHours(
  openedAt: string | number | Date,
  now: string | number | Date = Date.now(),
): number | null {
  const start = toTime(openedAt);
  const end = toTime(now);
  if (start === null || end === null) return null;
  if (end <= start) return 0;
  return (end - start) / 3_600_000;
}

export function isLongOpenShift(
  openedAt: string | number | Date,
  now: string | number | Date = Date.now(),
  thresholdHours: number = LONG_OPEN_SHIFT_HOURS,
): boolean {
  const hours = shiftOpenHours(openedAt, now);
  return hours !== null && hours >= thresholdHours;
}

/**
 * Cashier-facing warning for an over-long open shift, or `null` when the shift
 * is within the threshold (or the timestamp is invalid).
 */
export function longShiftWarning(
  openedAt: string | number | Date,
  now: string | number | Date = Date.now(),
  thresholdHours: number = LONG_OPEN_SHIFT_HOURS,
): string | null {
  const hours = shiftOpenHours(openedAt, now);
  if (hours === null || hours < thresholdHours) return null;
  return `Open for ${Math.floor(hours)}h - longer than the ${thresholdHours}h shift limit. Close the shift to reconcile the drawer.`;
}
