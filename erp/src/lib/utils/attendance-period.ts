import { ApiError } from '@/lib/api/errors';

export interface AttendanceMonthRange {
  /** Canonical YYYY-MM key. */
  month: string;
  /** First calendar day (YYYY-MM-DD). */
  from: string;
  /** Last calendar day (YYYY-MM-DD). */
  to: string;
  periodStart: Date;
  periodEnd: Date;
  label: string;
}

function ymd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Resolve a `YYYY-MM` month (or the current month) to a full calendar range. */
export function resolveAttendanceMonth(monthValue?: string | null): AttendanceMonthRange {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const month = monthValue?.trim() || defaultMonth;

  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'month must be YYYY-MM');
  }

  const [yearRaw, monthRaw] = month.split('-');
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  if (!Number.isInteger(year) || monthIndex < 0 || monthIndex > 11) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid month');
  }

  const periodStart = new Date(year, monthIndex, 1);
  const periodEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  const label = periodStart.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });

  return {
    month,
    from: ymd(periodStart),
    to: ymd(periodEnd),
    periodStart,
    periodEnd,
    label,
  };
}

export function formatMinutesAsHm(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `${hours}h ${remaining}m`;
}
