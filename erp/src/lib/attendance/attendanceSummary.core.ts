/**
 * Pure daily attendance summary (ARGUS #354).
 *
 * The attendance page offered Holiday in the status dialog but the cards did
 * not always account for every row, so they did not reconcile to the active
 * headcount. This helper counts each staff member exactly once across:
 *
 *   Present + Absent + On Leave + Half Day + Holiday + Off + Scheduled = total
 *
 * `Absent` includes `INSUFFICIENT` (below half a day) because that is a no-pay
 * day in payroll; `insufficient` remains available as a sub-count.
 */

import type { AttendanceDisplayStatus } from '@/lib/attendance/attendanceCalendar.core';

export interface AttendanceSummaryRow {
  status: AttendanceDisplayStatus;
  overtimeMinutes: number;
}

export interface DailyAttendanceSummary {
  present: number;
  /** ABSENT + INSUFFICIENT (the payroll no-pay population). */
  absent: number;
  /** Subset of `absent`; shown as a note under the Absent card. */
  insufficient: number;
  onLeave: number;
  halfDay: number;
  holiday: number;
  off: number;
  scheduled: number;
  overtimeMinutes: number;
  /** Number of staff rows considered. */
  total: number;
  /** Sum of the displayed card counts (excluding the OT card). */
  accounted: number;
}

export function summarizeDailyAttendance(
  rows: readonly AttendanceSummaryRow[],
): DailyAttendanceSummary {
  const summary: DailyAttendanceSummary = {
    present: 0,
    absent: 0,
    insufficient: 0,
    onLeave: 0,
    halfDay: 0,
    holiday: 0,
    off: 0,
    scheduled: 0,
    overtimeMinutes: 0,
    total: rows.length,
    accounted: 0,
  };

  for (const row of rows) {
    switch (row.status) {
      case 'PRESENT':
        summary.present += 1;
        break;
      case 'ABSENT':
        summary.absent += 1;
        break;
      case 'INSUFFICIENT':
        // A no-pay day, but tracked separately for the note under Absent.
        summary.absent += 1;
        summary.insufficient += 1;
        break;
      case 'LEAVE':
        summary.onLeave += 1;
        break;
      case 'HALF_DAY':
        summary.halfDay += 1;
        break;
      case 'HOLIDAY':
        summary.holiday += 1;
        break;
      case 'SCHEDULED':
        summary.scheduled += 1;
        break;
      default:
        summary.off += 1;
    }
    summary.overtimeMinutes += Math.max(0, row.overtimeMinutes);
  }

  summary.accounted =
    summary.present +
    summary.absent +
    summary.onLeave +
    summary.halfDay +
    summary.holiday +
    summary.off +
    summary.scheduled;

  return summary;
}

/** True when every row lands in exactly one card. */
export function reconcilesToHeadcount(summary: DailyAttendanceSummary): boolean {
  return summary.accounted === summary.total;
}
