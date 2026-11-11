import { describe, expect, it } from 'vitest';
import {
  formatMinutesAsHm,
  resolveAttendanceMonth,
} from '@/lib/utils/attendance-period';

describe('resolveAttendanceMonth', () => {
  it('resolves a month to its full calendar range', () => {
    const range = resolveAttendanceMonth('2026-02');
    expect(range.month).toBe('2026-02');
    expect(range.from).toBe('2026-02-01');
    expect(range.to).toBe('2026-02-28');
    expect(range.label).toContain('February');
  });

  it('handles leap years', () => {
    const range = resolveAttendanceMonth('2028-02');
    expect(range.to).toBe('2028-02-29');
  });

  it('defaults to the current month', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    expect(resolveAttendanceMonth().month).toBe(expected);
  });

  it('rejects malformed months', () => {
    expect(() => resolveAttendanceMonth('2026-13')).toThrow();
    expect(() => resolveAttendanceMonth('11-2026')).toThrow();
    expect(() => resolveAttendanceMonth('2026-1')).toThrow();
  });
});

describe('formatMinutesAsHm', () => {
  it('formats regular and overtime minutes', () => {
    expect(formatMinutesAsHm(0)).toBe('0h 0m');
    expect(formatMinutesAsHm(480)).toBe('8h 0m');
    expect(formatMinutesAsHm(570)).toBe('9h 30m');
  });
});
