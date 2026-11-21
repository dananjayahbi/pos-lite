import { describe, expect, it } from 'vitest';

import { parseRangeStart, parseRangeEnd } from '@/lib/dates/inclusiveRange';

/** ARGUS #394: a date-only "To" must include the whole chosen day. */
describe('inclusive date range', () => {
  it('starts a date-only range at midnight UTC', () => {
    expect(parseRangeStart('2026-09-16').toISOString()).toBe('2026-09-16T00:00:00.000Z');
  });

  it('ends a date-only range at the last millisecond of the day', () => {
    expect(parseRangeEnd('2026-09-16').toISOString()).toBe('2026-09-16T23:59:59.999Z');
  });

  it('includes a record later on the end date', () => {
    const end = parseRangeEnd('2026-09-16');
    expect(new Date('2026-09-16T10:30:00.000Z') <= end).toBe(true);
    expect(new Date('2026-09-16T00:00:00.000Z') <= end).toBe(true);
    expect(new Date('2026-09-17T00:00:00.000Z') <= end).toBe(false);
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
});
