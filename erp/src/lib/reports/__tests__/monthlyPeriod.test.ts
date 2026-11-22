import { describe, expect, it } from 'vitest';

import { filterMonthKeysInPeriod, monthKey } from '@/lib/reports/monthlyPeriod';

/** ARGUS #437: monthly detail must follow the selected period. */
describe('monthly period scope', () => {
  it('builds a local YYYY-MM key', () => {
    expect(monthKey(new Date(2026, 8, 1))).toBe('2026-09');
    expect(monthKey(new Date(2026, 11, 31))).toBe('2026-12');
  });

  it('drops months outside a September-only statement', () => {
    const keys = ['2026-08', '2026-09', '2026-10', '2026-11'];
    expect(
      filterMonthKeysInPeriod(keys, new Date(2026, 8, 1), new Date(2026, 8, 30)),
    ).toEqual(['2026-09']);
  });

  it('keeps every month in a multi-month period and sorts them', () => {
    expect(
      filterMonthKeysInPeriod(
        ['2026-11', '2026-09', '2026-10'],
        new Date(2026, 8, 15),
        new Date(2026, 10, 20),
      ),
    ).toEqual(['2026-09', '2026-10', '2026-11']);
  });

  it('returns an empty list when no row falls in the period', () => {
    expect(
      filterMonthKeysInPeriod(
        ['2026-08', '2026-10'],
        new Date(2026, 8, 1),
        new Date(2026, 8, 30),
      ),
    ).toEqual([]);
  });
});
