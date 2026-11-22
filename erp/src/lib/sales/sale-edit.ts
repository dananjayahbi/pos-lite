/**
 * Selling-date edits (ARGUS #88).
 *
 * The edit sheet only exposes a day-granular `<input type="date">`, so a save
 * must not silently turn an evening sale into 12:00. Two layers cooperate:
 *
 * - the sheet omits `saleDate` when the chosen day is unchanged;
 * - the service preserves the recorded timestamp when the incoming date falls
 *   on the same calendar day, so another client cannot rewrite the clock time
 *   either.
 *
 * Only an intentional day change moves the timestamp, and that uses the
 * existing noon anchor so the calendar day stays stable across timezones.
 */

export function sameSellingDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Keep the recorded time-of-day unless the calendar day actually changed. */
export function preserveSellingTimestamp(current: Date, next: Date): Date {
  if (Number.isNaN(current.getTime())) return next;
  return sameSellingDay(current, next) ? current : next;
}
