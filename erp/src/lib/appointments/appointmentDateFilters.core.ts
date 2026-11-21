/**
 * ARGUS #130 — appointment From/To filters are local calendar days.
 *
 * `new Date('2026-10-29')` is UTC midnight. In Sri Lanka (UTC+5:30) that is
 * 05:30 local, so a 03:00 appointment on the selected day fell outside the
 * filter. Date-only values are now expanded to local 00:00:00.000 and
 * 23:59:59.999; full timestamps are preserved for calendar callers.
 */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function localDayParts(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function parseAppointmentDateStart(value: string | Date): Date {
  if (value instanceof Date) return value;
  if (DATE_ONLY.test(value)) {
    const parts = localDayParts(value);
    if (parts) return new Date(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0);
  }
  return new Date(value);
}

export function parseAppointmentDateEnd(value: string | Date): Date {
  if (value instanceof Date) return value;
  if (DATE_ONLY.test(value)) {
    const parts = localDayParts(value);
    if (parts) return new Date(parts.year, parts.month - 1, parts.day, 23, 59, 59, 999);
  }
  return new Date(value);
}
