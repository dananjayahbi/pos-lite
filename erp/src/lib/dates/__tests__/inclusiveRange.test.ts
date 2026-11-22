import { describe, expect, it } from 'vitest';

import {
  formatLocalDateInput,
  parseRangeEnd,
  parseRangeStart,
} from '@/lib/dates/inclusiveRange';

/** ARGUS #429: date-only filters mean the local calendar day, not UTC. */
describe('inclusive date range', () => {
  it('starts a date-only range at local midnight', () => {
    const start = parseRangeStart('2026-09-16');
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(8);
    expect(start.getDate()).toBe(16);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
  });

  it('ends a date-only range at the last millisecond of the local day', () => {
    const end = parseRangeEnd('2026-09-16');
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(8);
    expect(end.getDate()).toBe(16);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
    expect(end.getMilliseconds()).toBe(999);
  });

  it('includes a record later on the end date, even late local evening', () => {
    const end = parseRangeEnd('2026-09-16');
    const lateEvening = new Date(2026, 8, 16, 22, 30, 0, 0);
    const nextLocalDay = new Date(2026, 8, 17, 0, 0, 0, 0);

    expect(lateEvening <= end).toBe(true);
    expect(nextLocalDay <= end).toBe(false);
  });

  it('preserves full timestamps', () => {
    expect(parseRangeEnd('2026-09-16T12:00:00.000Z').toISOString()).toBe(
      '2026-09-16T12:00:00.000Z',
    );
    expect(parseRangeStart('2026-09-16T12:00:00.000Z').toISOString()).toBe(
      '2026-09-16T12:00:00.000Z',
    );
  });

  it('passes Date objects through unchanged', () => {
    const date = new Date('2026-09-16T12:00:00.000Z');
    expect(parseRangeStart(date)).toBe(date);
    expect(parseRangeEnd(date)).toBe(date);
  });

  it('formats a date input from local parts rather than the UTC day', () => {
    expect(formatLocalDateInput(new Date(2026, 10, 15, 23, 30))).toBe('2026-11-15');
    expect(formatLocalDateInput(new Date(2026, 0, 1, 0, 15))).toBe('2026-01-01');
  });
});
