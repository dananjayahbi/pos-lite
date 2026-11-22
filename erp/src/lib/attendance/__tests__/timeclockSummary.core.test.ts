/**
 * ARGUS #352 — full-history week/month hour aggregation.
 */
import { describe, expect, it } from 'vitest';
import {
  punchHours,
  startOfLocalMonth,
  startOfLocalWeek,
  summarizeTimeClockHours,
} from '@/lib/attendance/timeclockSummary.core';

const NOW = new Date(2026, 10, 20, 18, 0, 0, 0); // Fri 20 Nov 2026, 18:00 local
const WEEK_START = startOfLocalWeek(NOW); // Mon 16 Nov
const MONTH_START = startOfLocalMonth(NOW); // Sun 1 Nov

function punch(day: number, inHour: number, outHour: number | null) {
  return {
    clockedInAt: new Date(2026, 10, day, inHour, 0, 0, 0),
    clockedOutAt: outHour === null ? null : new Date(2026, 10, day, outHour, 0, 0, 0),
  };
}

describe('punchHours', () => {
  it('returns the closed-punch duration', () => {
    expect(punchHours(punch(16, 8, 16), NOW, 960)).toBe(8);
  });

  it('caps an open punch at the maximum shift', () => {
    expect(punchHours(punch(16, 8, null), NOW, 960)).toBe(16);
  });

  it('never returns negative hours', () => {
    expect(
      punchHours(
        {
          clockedInAt: new Date(2026, 10, 20, 20, 0, 0, 0),
          clockedOutAt: new Date(2026, 10, 20, 18, 0, 0, 0),
        },
        NOW,
        960,
      ),
    ).toBe(0);
  });
});

describe('summarizeTimeClockHours', () => {
  it('sums the FULL history, not just the first page', () => {
    const records = [
      punch(16, 8, 16),
      punch(17, 8, 16),
      punch(18, 8, 16),
      punch(19, 8, 16),
      punch(20, 8, 12),
    ];

    const summary = summarizeTimeClockHours({
      records,
      weekStart: WEEK_START,
      monthStart: MONTH_START,
      now: NOW,
      maxShiftMinutes: 960,
    });

    expect(summary.hoursThisWeek).toBe(36);
    expect(summary.hoursThisMonth).toBe(36);
  });

  it('does not count records before the month boundary', () => {
    const records = [punch(1, 8, 16), punch(16, 8, 16)];

    const summary = summarizeTimeClockHours({
      records,
      weekStart: WEEK_START,
      monthStart: MONTH_START,
      now: NOW,
      maxShiftMinutes: 960,
    });

    expect(summary.hoursThisWeek).toBe(8);
    expect(summary.hoursThisMonth).toBe(16);
  });

  it('handles a week that starts in the previous month', () => {
    const now = new Date(2026, 10, 1, 12, 0, 0, 0); // Sun 1 Nov 2026
    const weekStart = startOfLocalWeek(now); // Mon 26 Oct
    const monthStart = startOfLocalMonth(now); // Sun 1 Nov
    const records = [
      {
        clockedInAt: new Date(2026, 9, 27, 8, 0, 0, 0),
        clockedOutAt: new Date(2026, 9, 27, 12, 0, 0, 0),
      },
      {
        clockedInAt: new Date(2026, 10, 1, 8, 0, 0, 0),
        clockedOutAt: new Date(2026, 10, 1, 10, 0, 0, 0),
      },
    ];

    const summary = summarizeTimeClockHours({
      records,
      weekStart,
      monthStart,
      now,
      maxShiftMinutes: 960,
    });

    expect(summary.hoursThisWeek).toBe(6);
    expect(summary.hoursThisMonth).toBe(2);
  });

  it('rounds to two decimals and returns zero for no records', () => {
    const summary = summarizeTimeClockHours({
      records: [
        {
          clockedInAt: new Date(2026, 10, 20, 8, 0, 0, 0),
          clockedOutAt: new Date(2026, 10, 20, 8, 20, 0, 0),
        },
      ],
      weekStart: WEEK_START,
      monthStart: MONTH_START,
      now: NOW,
      maxShiftMinutes: 960,
    });
    expect(summary.hoursThisWeek).toBe(0.33);
    expect(summary.hoursThisMonth).toBe(0.33);

    expect(
      summarizeTimeClockHours({
        records: [],
        weekStart: WEEK_START,
        monthStart: MONTH_START,
        now: NOW,
        maxShiftMinutes: 960,
      }),
    ).toEqual({ hoursThisWeek: 0, hoursThisMonth: 0 });
  });
});
