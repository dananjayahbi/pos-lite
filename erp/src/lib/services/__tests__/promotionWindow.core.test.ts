import { describe, expect, it } from 'vitest';

import {
  isValidIsoDay,
  isValidWindowInput,
  toWindowDate,
  windowIssues,
} from '@/lib/services/promotionWindow.core';

/**
 * ARGUS #327: date-only bounds are inclusive LOCAL days. Expectations use the
 * local Date constructor, so the suite passes in every timezone.
 */
describe('toWindowDate (date-only boundaries)', () => {
  it('starts a date-only window at local 00:00:00.000', () => {
    const start = toWindowDate('2026-10-29', 'start');
    expect(start?.getTime()).toBe(new Date(2026, 9, 29, 0, 0, 0, 0).getTime());
  });

  it('ends a date-only window at local 23:59:59.999', () => {
    const end = toWindowDate('2026-10-29', 'end');
    expect(end?.getTime()).toBe(new Date(2026, 9, 29, 23, 59, 59, 999).getTime());
  });

  it('keeps a same-day window non-empty and covers local noon', () => {
    const start = toWindowDate('2026-10-29', 'start')!;
    const end = toWindowDate('2026-10-29', 'end')!;
    const noon = new Date(2026, 9, 29, 12, 0, 0, 0);

    expect(start.getTime()).toBeLessThan(end.getTime());
    expect(start.getTime()).toBeLessThanOrEqual(noon.getTime());
    expect(end.getTime()).toBeGreaterThanOrEqual(noon.getTime());
  });

  it('preserves an explicit ISO datetime instead of snapping to the day edge', () => {
    const instant = '2026-10-29T18:30:00.000Z';
    expect(toWindowDate(instant, 'end')?.getTime()).toBe(new Date(instant).getTime());
    expect(toWindowDate(instant, 'start')?.getTime()).toBe(new Date(instant).getTime());
  });

  it('maps empty/null to no bound and undefined to untouched', () => {
    expect(toWindowDate('', 'start')).toBeNull();
    expect(toWindowDate(null, 'end')).toBeNull();
    expect(toWindowDate(undefined, 'start')).toBeUndefined();
  });

  it('throws on an invalid value rather than widening the window', () => {
    expect(() => toWindowDate('not-a-date', 'start')).toThrow('INVALID_PROMOTION_DATE');
    expect(() => toWindowDate('2026-02-31', 'end')).toThrow('INVALID_PROMOTION_DATE');
  });
});

describe('windowIssues', () => {
  it('accepts a same-day date-only window', () => {
    expect(windowIssues('2026-10-29', '2026-10-29')).toEqual([]);
  });

  it('accepts a multi-day window and one-sided bounds', () => {
    expect(windowIssues('2026-10-01', '2026-10-31')).toEqual([]);
    expect(windowIssues('2026-10-01', null)).toEqual([]);
    expect(windowIssues(undefined, '2026-10-31')).toEqual([]);
  });

  it('rejects an end day before the start day', () => {
    const issues = windowIssues('2026-10-29', '2026-10-28');
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toBe('endsAt');
    expect(issues[0]?.message).toMatch(/after the start/i);
  });

  it('rejects a zero-length explicit instant window', () => {
    expect(windowIssues('2026-10-29T10:00:00Z', '2026-10-29T10:00:00Z')).toHaveLength(1);
  });

  it('reports malformed start/end values by field', () => {
    expect(windowIssues('nope', '2026-10-29')[0]?.path).toBe('startsAt');
    expect(windowIssues('2026-10-01', '2026-02-31')[0]?.path).toBe('endsAt');
  });
});

describe('isValidIsoDay / isValidWindowInput', () => {
  it('accepts real calendar days and ISO datetimes', () => {
    expect(isValidIsoDay('2026-10-29')).toBe(true);
    expect(isValidIsoDay('2024-02-29')).toBe(true);
    expect(isValidWindowInput('2026-10-29')).toBe(true);
    expect(isValidWindowInput('2026-10-29T08:30:00+05:30')).toBe(true);
    expect(isValidWindowInput('2999-01-01T00:00:00.000Z')).toBe(true);
  });

  it('rejects malformed and rollover values', () => {
    expect(isValidIsoDay('2026-2-9')).toBe(false);
    expect(isValidIsoDay('2026-02-31')).toBe(false);
    expect(isValidWindowInput('not-a-date')).toBe(false);
    expect(isValidWindowInput('2026-13-01')).toBe(false);
  });
});
