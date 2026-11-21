/**
 * Inclusive date-range parsing for report filters (ARGUS #394).
 *
 * Date inputs send `YYYY-MM-DD`. `new Date('2026-09-16')` is midnight at the
 * START of the day, so using it as an upper bound excluded everything recorded
 * later that day. Date-only end values are expanded to 23:59:59.999; full
 * timestamps are preserved.
 */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function parseRangeStart(value: string | Date): Date {
  if (value instanceof Date) return value;
  if (DATE_ONLY.test(value)) return new Date(`${value}T00:00:00.000Z`);
  return new Date(value);
}

export function parseRangeEnd(value: string | Date): Date {
  if (value instanceof Date) return value;
  if (DATE_ONLY.test(value)) return new Date(`${value}T23:59:59.999Z`);
  return new Date(value);
}
