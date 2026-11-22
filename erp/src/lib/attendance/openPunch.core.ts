import { formatAttendanceYmd } from '@/lib/attendance/attendanceCalendar.core';

/**
 * Forgotten clock-out handling (ARGUS #351).
 *
 * A `TimeClock` row with `clockedOutAt = null` used to grow without limit and
 * blocked every future clock-in. Rules here:
 *
 * - an open punch is capped at `maxShiftMinutes` (tenant setting, default 16h)
 *   for display and payroll so it can never accrue unbounded hours;
 * - a clock-in while an open punch from a previous local day exists raises a
 *   conflict with the punch details, so the UI can ask the person to close it
 *   at a real time instead of inventing one silently;
 * - a same-day open punch keeps the historical "already clocked in" conflict.
 */

/** 16 hours. */
export const DEFAULT_MAX_SHIFT_MINUTES = 960;

export interface OpenPunchSnapshot {
  id: string;
  clockedInAt: Date;
  clockedOutAt?: Date | null;
}

export type ClockInOpenPunchKind = 'NONE' | 'SAME_DAY' | 'PREVIOUS_DAY';

export interface ClockInOpenPunchState {
  kind: ClockInOpenPunchKind;
  maxShiftMinutes: number;
  punch: {
    id: string;
    clockedInAt: string;
    /** End used for capped duration/display. */
    cappedEndAt: string;
    durationMinutes: number;
    overdue: boolean;
    previousDay: boolean;
  } | null;
  /** Where the UI should offer to close a previous-day punch. */
  suggestedCloseAt: string | null;
}

/** min(now, clock-in + max shift). */
export function capPunchEnd(
  clockedInAt: Date,
  now: Date,
  maxShiftMinutes: number = DEFAULT_MAX_SHIFT_MINUTES,
): Date {
  const cap = clockedInAt.getTime() + Math.max(1, maxShiftMinutes) * 60_000;
  return new Date(Math.min(now.getTime(), cap));
}

export function isPunchOverdue(
  clockedInAt: Date,
  now: Date,
  maxShiftMinutes: number = DEFAULT_MAX_SHIFT_MINUTES,
): boolean {
  return now.getTime() - clockedInAt.getTime() > Math.max(1, maxShiftMinutes) * 60_000;
}

export function cappedOpenPunchMinutes(
  clockedInAt: Date,
  now: Date,
  maxShiftMinutes: number = DEFAULT_MAX_SHIFT_MINUTES,
): number {
  const end = capPunchEnd(clockedInAt, now, maxShiftMinutes);
  return Math.max(0, Math.round((end.getTime() - clockedInAt.getTime()) / 60_000));
}

/**
 * Describe the open punch a clock-in attempt collides with, or NONE.
 * `now` is injectable for tests.
 */
export function describeClockInConflict(
  openPunch: OpenPunchSnapshot | null,
  now: Date = new Date(),
  maxShiftMinutes: number = DEFAULT_MAX_SHIFT_MINUTES,
): ClockInOpenPunchState {
  if (!openPunch || openPunch.clockedOutAt) {
    return { kind: 'NONE', maxShiftMinutes, punch: null, suggestedCloseAt: null };
  }

  const previousDay =
    formatAttendanceYmd(openPunch.clockedInAt) !== formatAttendanceYmd(now);
  const cappedEnd = capPunchEnd(openPunch.clockedInAt, now, maxShiftMinutes);
  const overdue = isPunchOverdue(openPunch.clockedInAt, now, maxShiftMinutes);

  return {
    kind: previousDay ? 'PREVIOUS_DAY' : 'SAME_DAY',
    maxShiftMinutes,
    punch: {
      id: openPunch.id,
      clockedInAt: openPunch.clockedInAt.toISOString(),
      cappedEndAt: cappedEnd.toISOString(),
      durationMinutes: Math.max(
        0,
        Math.round((cappedEnd.getTime() - openPunch.clockedInAt.getTime()) / 60_000),
      ),
      overdue,
      previousDay,
    },
    suggestedCloseAt: previousDay ? cappedEnd.toISOString() : null,
  };
}
