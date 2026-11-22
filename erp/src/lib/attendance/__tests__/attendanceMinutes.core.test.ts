/**
 * ARGUS #358 — explicit status overrides reconcile worked minutes.
 */
import { describe, expect, it } from 'vitest';
import { applyStatusOverrideToMinutes } from '@/lib/attendance/attendanceMinutes.core';

const CALENDAR = { halfDayMinutes: 240 };
const EIGHT_HOURS = { totalMinutes: 480, regularMinutes: 480, overtimeMinutes: 0 };
const NINE_HOURS = { totalMinutes: 540, regularMinutes: 480, overtimeMinutes: 60 };

describe('applyStatusOverrideToMinutes', () => {
  it('clears worked, regular and overtime for Leave', () => {
    const result = applyStatusOverrideToMinutes({
      override: 'LEAVE',
      minutes: EIGHT_HOURS,
      calendar: CALENDAR,
    });
    expect(result).toEqual({
      totalMinutes: 0,
      regularMinutes: 0,
      overtimeMinutes: 0,
      originalTotalMinutes: 480,
      adjustment: 'CLEARED',
    });
  });

  it('clears Absent and Holiday too', () => {
    for (const status of ['ABSENT', 'HOLIDAY'] as const) {
      const result = applyStatusOverrideToMinutes({
        override: status,
        minutes: EIGHT_HOURS,
        calendar: CALENDAR,
      });
      expect(result.adjustment).toBe('CLEARED');
      expect(result.totalMinutes).toBe(0);
      expect(result.overtimeMinutes).toBe(0);
    }
  });

  it('caps a Half Day at the tenant half-day threshold and clears OT', () => {
    const result = applyStatusOverrideToMinutes({
      override: 'HALF_DAY',
      minutes: NINE_HOURS,
      calendar: CALENDAR,
    });
    expect(result.totalMinutes).toBe(240);
    expect(result.regularMinutes).toBe(240);
    expect(result.overtimeMinutes).toBe(0);
    expect(result.originalTotalMinutes).toBe(540);
    expect(result.adjustment).toBe('HALF_DAY_CAP');
  });

  it('does not inflate a short Half Day', () => {
    const result = applyStatusOverrideToMinutes({
      override: 'HALF_DAY',
      minutes: { totalMinutes: 180, regularMinutes: 180, overtimeMinutes: 0 },
      calendar: CALENDAR,
    });
    expect(result.totalMinutes).toBe(180);
    expect(result.regularMinutes).toBe(180);
    expect(result.overtimeMinutes).toBe(0);
    expect(result.adjustment).toBe('NONE');
  });

  it('keeps the real minutes for an explicit Present override', () => {
    const result = applyStatusOverrideToMinutes({
      override: 'PRESENT',
      minutes: NINE_HOURS,
      calendar: CALENDAR,
    });
    expect(result).toEqual({
      ...NINE_HOURS,
      originalTotalMinutes: 540,
      adjustment: 'NONE',
    });
  });

  it('does not re-cap a derived Half Day (no explicit override)', () => {
    const result = applyStatusOverrideToMinutes({
      override: null,
      minutes: { totalMinutes: 360, regularMinutes: 360, overtimeMinutes: 0 },
      calendar: CALENDAR,
    });
    expect(result.totalMinutes).toBe(360);
    expect(result.adjustment).toBe('NONE');
  });

  it('never returns negative minutes', () => {
    const result = applyStatusOverrideToMinutes({
      override: null,
      minutes: { totalMinutes: -10, regularMinutes: -5, overtimeMinutes: -2 },
      calendar: CALENDAR,
    });
    expect(result.totalMinutes).toBe(0);
    expect(result.regularMinutes).toBe(0);
    expect(result.overtimeMinutes).toBe(0);
  });
});
