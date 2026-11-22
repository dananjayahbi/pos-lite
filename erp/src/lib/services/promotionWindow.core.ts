/**
 * Promotion / customer-pricing window boundaries (ARGUS #327).
 *
 * A native `<input type="date">` submits a bare `YYYY-MM-DD`. `new Date('2026-
 * 10-29')` parses that as UTC midnight, so in a UTC+05:30 store the window
 * starts at 05:30 and a same-day window (start = end = that day) is empty:
 * `new Date('2026-10-29') < new Date('2026-10-29')` is false and the end is
 * never reached.
 *
 * This module expands a date-only value into an inclusive LOCAL-day bound:
 *  - start -> 00:00:00.000 local
 *  - end   -> 23:59:59.999 local
 *
 * An explicit ISO datetime is kept as the instant the caller supplied (a
 * promotion that ends at `2026-10-29T18:00:00+05:30` ends at 18:00, not at the
 * end of the day). Keeping this pure makes the arithmetic testable in any
 * timezone, the same contract `purchaseOrderDateRange.core.ts` uses.
 *
 * The server process timezone is the store timezone by convention; see
 * `docs/promotion-window-boundaries.md`.
 */

const ISO_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** `YYYY-MM-DD` plus an explicit time (T or space) and optional zone. */
const ISO_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/;

/** True for a real `YYYY-MM-DD` calendar day (rejects 2026-02-31 rollovers). */
export function isValidIsoDay(value: string): boolean {
  if (!ISO_DAY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  const parsed = new Date(year, month - 1, day, 0, 0, 0, 0);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

export type WindowBoundary = 'start' | 'end';

/**
 * True when the value is either a real date-only day or a parseable ISO
 * datetime. Used by the request validators so a malformed date is a typed 400
 * instead of reaching Prisma.
 */
export function isValidWindowInput(value: string): boolean {
  if (ISO_DAY_PATTERN.test(value)) return isValidIsoDay(value);
  if (!ISO_DATE_TIME_PATTERN.test(value)) return false;
  return !Number.isNaN(new Date(value).getTime());
}

/**
 * Convert one request bound to the instant stored in Prisma.
 *
 *  - `undefined` = field untouched (PATCH) -> `undefined`
 *  - `null` / `''` = no bound -> `null`
 *  - date-only -> inclusive local-day edge
 *  - explicit ISO datetime -> that exact instant
 *
 * An invalid non-empty value throws rather than silently widening the window;
 * validators reject it as a 400 before this point, and the service checks the
 * same pure `windowIssues` as a second line of defence.
 */
export function toWindowDate(
  value: string | null | undefined,
  boundary: WindowBoundary,
): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === '') return null;

  const trimmed = value.trim();
  if (ISO_DAY_PATTERN.test(trimmed)) {
    if (!isValidIsoDay(trimmed)) {
      throw new RangeError(`INVALID_PROMOTION_DATE: "${trimmed}" is not a real calendar day`);
    }
    const [year, month, day] = trimmed.split('-').map(Number) as [number, number, number];
    return boundary === 'start'
      ? new Date(year, month - 1, day, 0, 0, 0, 0)
      : new Date(year, month - 1, day, 23, 59, 59, 999);
  }

  if (!isValidWindowInput(trimmed)) {
    throw new RangeError(`INVALID_PROMOTION_DATE: "${trimmed}" is not a valid date`);
  }
  return new Date(trimmed);
}

export interface WindowIssue {
  path: 'startsAt' | 'endsAt';
  message: string;
}

/**
 * Validate a window before it is stored.
 *
 * Same-day date-only windows are VALID: the start expands to local midnight
 * and the end to local 23:59:59.999, so `start < end`. An explicit datetime
 * window must still be strictly increasing (a zero-length instant window is
 * empty and almost certainly a mistake).
 */
export function windowIssues(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
): WindowIssue[] {
  const issues: WindowIssue[] = [];
  const hasStart = startsAt !== undefined && startsAt !== null && startsAt.trim() !== '';
  const hasEnd = endsAt !== undefined && endsAt !== null && endsAt.trim() !== '';

  if (hasStart && !isValidWindowInput(startsAt)) {
    issues.push({
      path: 'startsAt',
      message: 'Start date must be a valid date (YYYY-MM-DD or ISO datetime)',
    });
  }
  if (hasEnd && !isValidWindowInput(endsAt)) {
    issues.push({
      path: 'endsAt',
      message: 'End date must be a valid date (YYYY-MM-DD or ISO datetime)',
    });
  }
  if (issues.length > 0 || !hasStart || !hasEnd) return issues;

  const start = toWindowDate(startsAt, 'start');
  const end = toWindowDate(endsAt, 'end');
  if (start && end && end.getTime() <= start.getTime()) {
    issues.push({ path: 'endsAt', message: 'End date must be after the start date' });
  }
  return issues;
}
