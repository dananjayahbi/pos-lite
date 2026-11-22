import { describe, expect, it } from 'vitest';
import {
  ATTENDANCE_RANGE_MAX_DAYS,
  resolveAttendanceDateRange,
} from '@/lib/attendance/attendanceRange.core';

describe('resolveAttendanceDateRange', () => {
  it('expands a single day to an inclusive one-day range', () => {
    const result = resolveAttendanceDateRange({ from: '2026-11-14' });
    expect(result).toEqual({ ok: true, from: '2026-11-14', to: '2026-11-14', dates: ['2026-11-14'] });
  });

  it('lists every day across a month boundary', () => {
    const result = resolveAttendanceDateRange({ from: '2026-10-30', to: '2026-11-02' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.dates).toEqual([
        '2026-10-30',
        '2026-10-31',
        '2026-11-01',
        '2026-11-02',
      ]);
    }
  });

  it('rejects invalid dates and an inverted range', () => {
    expect(resolveAttendanceDateRange({ from: '2026-02-30' }).ok).toBe(false);
    expect(resolveAttendanceDateRange({ from: '2026-11-02', to: '2026-11-01' }).ok).toBe(false);
    expect(resolveAttendanceDateRange({}).ok).toBe(false);
  });

  it('caps the range length', () => {
    const result = resolveAttendanceDateRange({ from: '2026-01-01', to: '2026-12-31' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain(String(ATTENDANCE_RANGE_MAX_DAYS));
  });

  it('uses the fallback date when no bounds are supplied', () => {
    const result = resolveAttendanceDateRange({ fallback: '2026-11-14' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.dates).toEqual(['2026-11-14']);
  });
});
