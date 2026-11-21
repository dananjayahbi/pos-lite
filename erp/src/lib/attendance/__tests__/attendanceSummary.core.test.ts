/**
 * ARGUS #354 — the cards must reconcile to the active headcount, including
 * Holiday, Off and Scheduled rows.
 */
import { describe, expect, it } from 'vitest';
import {
  reconcilesToHeadcount,
  summarizeDailyAttendance,
  type AttendanceSummaryRow,
} from '@/lib/attendance/attendanceSummary.core';
import type { AttendanceDisplayStatus } from '@/lib/attendance/attendanceCalendar.core';

function row(
  status: AttendanceDisplayStatus,
  overtimeMinutes = 0,
): AttendanceSummaryRow {
  return { status, overtimeMinutes };
}

describe('summarizeDailyAttendance', () => {
  it('counts every offered status exactly once', () => {
    const summary = summarizeDailyAttendance([
      row('PRESENT', 60),
      row('ABSENT'),
      row('LEAVE'),
      row('HALF_DAY'),
      row('HOLIDAY'),
      row('OFF'),
      row('SCHEDULED'),
    ]);

    expect(summary).toEqual({
      present: 1,
      absent: 1,
      insufficient: 0,
      onLeave: 1,
      halfDay: 1,
      holiday: 1,
      off: 1,
      scheduled: 1,
      overtimeMinutes: 60,
      total: 7,
      accounted: 7,
    });
    expect(reconcilesToHeadcount(summary)).toBe(true);
  });

  it('keeps Holiday separate from Off instead of hiding it in a combined card', () => {
    const summary = summarizeDailyAttendance([
      row('HOLIDAY'),
      row('HOLIDAY'),
      row('OFF'),
    ]);

    expect(summary.holiday).toBe(2);
    expect(summary.off).toBe(1);
    expect(summary.accounted).toBe(3);
  });

  it('counts INSUFFICIENT as Absent and reports it as a subset', () => {
    const summary = summarizeDailyAttendance([
      row('INSUFFICIENT'),
      row('ABSENT'),
    ]);

    expect(summary.absent).toBe(2);
    expect(summary.insufficient).toBe(1);
    expect(summary.accounted).toBe(2);
  });

  it('handles a full working day of present and absent staff', () => {
    const summary = summarizeDailyAttendance([
      row('PRESENT'),
      row('PRESENT'),
      row('ABSENT'),
      row('SCHEDULED'),
    ]);

    expect(summary.present).toBe(2);
    expect(summary.absent).toBe(1);
    expect(summary.scheduled).toBe(1);
    expect(reconcilesToHeadcount(summary)).toBe(true);
  });

  it('sums overtime and never returns negative overtime', () => {
    const summary = summarizeDailyAttendance([
      row('PRESENT', 30),
      row('PRESENT', -10),
    ]);
    expect(summary.overtimeMinutes).toBe(30);
  });

  it('returns a reconciling zero summary for no staff', () => {
    const summary = summarizeDailyAttendance([]);
    expect(summary.total).toBe(0);
    expect(summary.accounted).toBe(0);
    expect(reconcilesToHeadcount(summary)).toBe(true);
  });
});
