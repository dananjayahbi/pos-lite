import { describe, expect, it } from 'vitest';

import {
  LONG_OPEN_SHIFT_HOURS,
  isLongOpenShift,
  longShiftWarning,
  shiftOpenHours,
} from '@/lib/shifts/shift-age';

const OPENED = new Date('2026-11-14T20:24:00.000Z');

function plusHours(hours: number): Date {
  return new Date(OPENED.getTime() + hours * 3_600_000);
}

describe('long-open shift policy (ARGUS #115)', () => {
  it('measures the open duration and tolerates a clock skew', () => {
    expect(shiftOpenHours(OPENED, plusHours(127))).toBeCloseTo(127);
    expect(shiftOpenHours(OPENED, OPENED)).toBe(0);
    expect(shiftOpenHours(OPENED, plusHours(-2))).toBe(0);
    expect(shiftOpenHours('not-a-date')).toBeNull();
  });

  it('flags 127h open and leaves a normal shift alone', () => {
    expect(LONG_OPEN_SHIFT_HOURS).toBe(12);
    expect(isLongOpenShift(OPENED, plusHours(127))).toBe(true);
    expect(isLongOpenShift(OPENED, plusHours(12))).toBe(true);
    expect(isLongOpenShift(OPENED, plusHours(4))).toBe(false);
  });

  it('returns an explicit warning once past the threshold', () => {
    expect(longShiftWarning(OPENED, plusHours(127))).toBe(
      'Open for 127h - longer than the 12h shift limit. Close the shift to reconcile the drawer.',
    );
    expect(longShiftWarning(OPENED, plusHours(4))).toBeNull();
    expect(longShiftWarning('not-a-date')).toBeNull();
  });

  it('honours a custom threshold', () => {
    expect(isLongOpenShift(OPENED, plusHours(8), 8)).toBe(true);
    expect(longShiftWarning(OPENED, plusHours(8), 8)).toContain('8h shift limit');
  });
});
