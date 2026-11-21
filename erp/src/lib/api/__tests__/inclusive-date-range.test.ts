import { describe, expect, it } from 'vitest';

import {
  inclusiveRangeEnd,
  inclusiveRangeStart,
  resolveInclusiveDateRange,
} from '@/lib/api/inclusive-date-range';

/**
 * ARGUS #184 - a date-only filter means the whole local calendar day.
 */
describe('inclusive date range', () => {
  it('starts a date-only value at local midnight', () => {
    const start = inclusiveRangeStart('2026-11-15');
    expect(start).toBeDefined();
    expect(start!.getFullYear()).toBe(2026);
    expect(start!.getMonth()).toBe(10);
    expect(start!.getDate()).toBe(15);
    expect(start!.getHours()).toBe(0);
    expect(start!.getMinutes()).toBe(0);
    expect(start!.getSeconds()).toBe(0);
    expect(start!.getMilliseconds()).toBe(0);
  });

  it('ends a date-only value at the last millisecond of the local day', () => {
    const end = inclusiveRangeEnd('2026-11-15');
    expect(end).toBeDefined();
    expect(end!.getFullYear()).toBe(2026);
    expect(end!.getMonth()).toBe(10);
    expect(end!.getDate()).toBe(15);
    expect(end!.getHours()).toBe(23);
    expect(end!.getMinutes()).toBe(59);
    expect(end!.getSeconds()).toBe(59);
    expect(end!.getMilliseconds()).toBe(999);
  });

  it('includes a same-day evening timestamp', () => {
    const range = resolveInclusiveDateRange('2026-11-15', '2026-11-15');
    const evening = new Date(2026, 10, 15, 21, 30, 0, 0);
    expect(range.from!.getTime()).toBeLessThanOrEqual(evening.getTime());
    expect(range.to!.getTime()).toBeGreaterThanOrEqual(evening.getTime());
  });

  it('keeps full ISO timestamps as exact instants', () => {
    const from = '2026-11-15T08:30:00.000Z';
    const to = '2026-11-15T18:00:00.000Z';
    expect(inclusiveRangeStart(from)!.toISOString()).toBe(from);
    expect(inclusiveRangeEnd(to)!.toISOString()).toBe(to);
  });

  it('leaves missing or blank bounds open-ended', () => {
    expect(resolveInclusiveDateRange(null, null)).toEqual({});
    expect(resolveInclusiveDateRange('', '  ')).toEqual({});
    expect(resolveInclusiveDateRange('2026-11-15', null).to).toBeUndefined();
    expect(resolveInclusiveDateRange(null, '2026-11-15').from).toBeUndefined();
  });

  it('ignores an unparseable value rather than throwing Invalid Date', () => {
    expect(inclusiveRangeStart('not-a-date')).toBeUndefined();
    expect(inclusiveRangeEnd('not-a-date')).toBeUndefined();
  });
});
