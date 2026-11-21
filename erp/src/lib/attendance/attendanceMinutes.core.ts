/**
 * Status override vs worked minutes (ARGUS #358).
 *
 * An explicit AttendanceDay status is authoritative for payroll. Before this,
 * marking Leave/Absent/Half Day on a day with punches left the worked, regular
 * and overtime minutes untouched, so a Leave row could still show 8h worked and
 * feed OT into payroll.
 *
 * Rule:
 * - LEAVE / ABSENT / HOLIDAY clear worked, regular and overtime to zero;
 * - HALF_DAY caps worked/regular at the tenant half-day threshold and clears OT;
 * - PRESENT (and non-override/derived statuses) keep the real punched minutes.
 *
 * The TimeClock punches themselves are never edited; only the derived
 * attendance view/payroll inputs are reconciled.
 */

import type {
  AttendanceCalendarSettings,
  AttendanceDisplayStatus,
} from '@/lib/attendance/attendanceCalendar.core';

export interface AttendanceMinutes {
  totalMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
}

export type HoursAdjustment = 'NONE' | 'CLEARED' | 'HALF_DAY_CAP';

export interface AdjustedAttendanceMinutes extends AttendanceMinutes {
  /** What the punches actually totalled before the status rule. */
  originalTotalMinutes: number;
  adjustment: HoursAdjustment;
}

export interface ApplyStatusOverrideInput {
  /** Explicit AttendanceDay status, or null when the status is derived. */
  override: AttendanceDisplayStatus | null | undefined;
  minutes: AttendanceMinutes;
  calendar: Pick<AttendanceCalendarSettings, 'halfDayMinutes'>;
}

function nonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function applyStatusOverrideToMinutes(
  input: ApplyStatusOverrideInput,
): AdjustedAttendanceMinutes {
  const totalMinutes = nonNegative(input.minutes.totalMinutes);
  const regularMinutes = nonNegative(input.minutes.regularMinutes);
  const overtimeMinutes = nonNegative(input.minutes.overtimeMinutes);

  const unchanged: AdjustedAttendanceMinutes = {
    totalMinutes,
    regularMinutes,
    overtimeMinutes,
    originalTotalMinutes: totalMinutes,
    adjustment: 'NONE',
  };

  if (!input.override || input.override === 'PRESENT') return unchanged;

  if (
    input.override === 'LEAVE' ||
    input.override === 'ABSENT' ||
    input.override === 'HOLIDAY'
  ) {
    return {
      totalMinutes: 0,
      regularMinutes: 0,
      overtimeMinutes: 0,
      originalTotalMinutes: totalMinutes,
      adjustment: 'CLEARED',
    };
  }

  if (input.override === 'HALF_DAY') {
    const cap = nonNegative(input.calendar.halfDayMinutes);
    const cappedTotal = Math.min(totalMinutes, cap);
    if (cappedTotal === totalMinutes && overtimeMinutes === 0) return unchanged;
    return {
      totalMinutes: cappedTotal,
      regularMinutes: Math.min(regularMinutes, cap),
      overtimeMinutes: 0,
      originalTotalMinutes: totalMinutes,
      adjustment: 'HALF_DAY_CAP',
    };
  }

  return unchanged;
}
