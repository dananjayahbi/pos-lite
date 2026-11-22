import { describe, expect, it } from 'vitest';
import {
  formatAttendanceDate,
  formatAttendanceDateTime,
  shiftReferenceLabel,
} from '@/lib/attendance/attendancePresentation.core';

describe('attendance presentation', () => {
  it('renders dates as 14 Nov 2026, not 11/14/2026', () => {
    expect(formatAttendanceDate('2026-11-14T09:05:00.000Z')).toMatch(
      /^1[34] Nov 2026$/,
    );
    expect(formatAttendanceDate('2026-11-14T09:05:00.000Z')).not.toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });

  it('includes the time for a date-time label', () => {
    expect(formatAttendanceDateTime('2026-11-14T09:05:00.000Z')).toMatch(
      /^1[34] Nov 2026, \d{2}:\d{2}$/,
    );
  });

  it('returns a dash for missing or invalid dates', () => {
    expect(formatAttendanceDate(null)).toBe('-');
    expect(formatAttendanceDate('nope')).toBe('-');
    expect(formatAttendanceDateTime(undefined)).toBe('-');
  });

  it('labels a shift by its opened time and keeps the id as a title', () => {
    const reference = shiftReferenceLabel({
      id: 'clx1234567890abcdef',
      openedAt: '2026-11-14T09:00:00.000Z',
      closedAt: '2026-11-14T17:00:00.000Z',
    });
    expect(reference.label).toMatch(/^Shift 1[34] Nov 2026, \d{2}:\d{2}$/);
    expect(reference.title).toBe('clx1234567890abcdef');
  });

  it('does not show an 8-character fragment as the primary label', () => {
    const reference = shiftReferenceLabel({
      id: 'clx1234567890abcdef',
      openedAt: 'invalid',
      closedAt: null,
    });
    expect(reference.label).toBe('Shift clx12345');
    expect(reference.title).toBe('clx1234567890abcdef');
    expect(shiftReferenceLabel(null).label).toBe('-');
  });
});
