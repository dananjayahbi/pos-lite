import { formatAttendanceYmd } from '@/lib/attendance/attendanceCalendar.core';

/**
 * A clock punch belongs to the day it started (ARGUS #359).
 *
 * Adjusting a forgotten clock-out may change the time, but moving the punch to
 * a different calendar day silently rewrites attendance and payroll entries for
 * two days. Such a correction must be an explicit delete/re-add, not an edit.
 */
export function punchDayChanged(original: Date, next: Date): boolean {
  if (Number.isNaN(original.getTime()) || Number.isNaN(next.getTime())) return false;
  return formatAttendanceYmd(original) !== formatAttendanceYmd(next);
}
