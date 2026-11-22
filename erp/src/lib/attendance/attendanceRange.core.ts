/**
 * Attendance export date range (ARGUS #359).
 *
 * The daily page only showed one day and the only CSV lived on a staff detail
 * page. A tenant-wide export needs a bounded range so one request cannot walk
 * years of history.
 */

export const ATTENDANCE_RANGE_MAX_DAYS = 92;

export type AttendanceRangeResult =
  | { ok: true; from: string; to: string; dates: string[] }
  | { ok: false; message: string };

function parseYmd(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [yearRaw, monthRaw, dayRaw] = value.split('-');
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  const day = Number(dayRaw);
  const date = new Date(year, monthIndex, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function ymd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Resolve an inclusive local date range. Missing bounds fall back to the other
 * bound, so a single `date` behaves like a one-day range.
 */
export function resolveAttendanceDateRange(input: {
  from?: string | null;
  to?: string | null;
  fallback?: string | null;
}): AttendanceRangeResult {
  const rawFrom = input.from?.trim() || input.to?.trim() || input.fallback?.trim() || '';
  const rawTo = input.to?.trim() || input.from?.trim() || input.fallback?.trim() || '';
  const from = parseYmd(rawFrom);
  const to = parseYmd(rawTo);
  if (!from) return { ok: false, message: 'from must be a valid YYYY-MM-DD date' };
  if (!to) return { ok: false, message: 'to must be a valid YYYY-MM-DD date' };
  if (to.getTime() < from.getTime()) {
    return { ok: false, message: 'to must not be before from' };
  }

  const dates: string[] = [];
  const cursor = new Date(from);
  while (cursor.getTime() <= to.getTime()) {
    dates.push(ymd(cursor));
    if (dates.length > ATTENDANCE_RANGE_MAX_DAYS) {
      return {
        ok: false,
        message: `Attendance exports are limited to ${ATTENDANCE_RANGE_MAX_DAYS} days`,
      };
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return { ok: true, from: ymd(from), to: ymd(to), dates };
}
