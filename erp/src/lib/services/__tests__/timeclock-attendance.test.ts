import { describe, expect, it } from 'vitest';
import {
  STANDARD_WORKDAY_MINUTES,
  computeAttendanceTotals,
  formatAttendanceDate,
  parseAttendanceDate,
} from '@/lib/services/timeclock.service';

function at(hour: number, minute = 0): Date {
  return new Date(2026, 10, 6, hour, minute, 0, 0);
}

describe('computeAttendanceTotals — 8-hour standard and OT', () => {
  it('reports no overtime for a standard 8-hour day', () => {
    const result = computeAttendanceTotals([
      { clockedInAt: at(8), clockedOutAt: at(16) },
    ]);
    expect(result.totalMinutes).toBe(480);
    expect(result.regularMinutes).toBe(480);
    expect(result.overtimeMinutes).toBe(0);
    expect(result.hasOpen).toBe(false);
  });

  it('splits time beyond 8 hours into OT', () => {
    const result = computeAttendanceTotals([
      { clockedInAt: at(8), clockedOutAt: at(17, 30) },
    ]);
    expect(result.totalMinutes).toBe(570); // 9h 30m
    expect(result.regularMinutes).toBe(480);
    expect(result.overtimeMinutes).toBe(90); // 1h 30m
  });

  it('sums multiple punches in the day before calculating OT', () => {
    const result = computeAttendanceTotals([
      { clockedInAt: at(7), clockedOutAt: at(11) }, // 4h
      { clockedInAt: at(12), clockedOutAt: at(17) }, // 5h
    ]);
    expect(result.totalMinutes).toBe(540);
    expect(result.overtimeMinutes).toBe(60);
  });

  it('counts an open punch up to now and leaves clockOutAt empty', () => {
    const now = at(18);
    const result = computeAttendanceTotals(
      [{ clockedInAt: at(8), clockedOutAt: null }],
      now,
    );
    expect(result.totalMinutes).toBe(600);
    expect(result.overtimeMinutes).toBe(120);
    expect(result.clockOutAt).toBeNull();
    expect(result.hasOpen).toBe(true);
  });

  it('never reports negative duration when the punch is in the future', () => {
    const result = computeAttendanceTotals(
      [{ clockedInAt: at(10), clockedOutAt: null }],
      at(9),
    );
    expect(result.totalMinutes).toBe(0);
    expect(result.overtimeMinutes).toBe(0);
  });

  it('exposes the standard 8-hour workday constant', () => {
    expect(STANDARD_WORKDAY_MINUTES).toBe(480);
  });
});

describe('attendance date helpers', () => {
  it('parses YYYY-MM-DD to local midnight', () => {
    const date = parseAttendanceDate('2026-11-06');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(10);
    expect(date.getDate()).toBe(6);
    expect(date.getHours()).toBe(0);
  });

  it('defaults to today when the value is omitted', () => {
    const date = parseAttendanceDate();
    const today = new Date();
    expect(formatAttendanceDate(date)).toBe(formatAttendanceDate(today));
  });

  it('rejects malformed dates', () => {
    expect(() => parseAttendanceDate('2026/11/06')).toThrow('YYYY-MM-DD');
    expect(() => parseAttendanceDate('2026-13-99')).toThrow();
  });

  it('formats a local date back to YYYY-MM-DD', () => {
    expect(formatAttendanceDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
