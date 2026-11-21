import { describe, expect, it } from 'vitest';

import { formatRecentSaleTimestamp } from '@/components/dashboard/recentSaleTime';

/**
 * ARGUS #40 — recent sales spanning two days must show which day each row is.
 */
describe('formatRecentSaleTimestamp', () => {
  const now = new Date(2026, 10, 15, 23, 30); // 15 Nov 2026, local

  it('labels a row from today', () => {
    const label = formatRecentSaleTimestamp(new Date(2026, 10, 15, 23, 6), now);
    expect(label).toMatch(/^Today,/);
    expect(label).toContain('11:06');
  });

  it('labels a row from yesterday', () => {
    const label = formatRecentSaleTimestamp(new Date(2026, 10, 14, 22, 8), now);
    expect(label).toMatch(/^Yesterday,/);
    expect(label).toContain('10:08');
  });

  it('shows the calendar day for older rows', () => {
    const label = formatRecentSaleTimestamp(new Date(2026, 10, 9, 21, 0), now);
    expect(label).not.toMatch(/^Today|^Yesterday/);
    expect(label).toMatch(/9/);
    expect(label).toMatch(/Nov/i);
    expect(label).toContain('9:00');
  });

  it('keeps same-day rows on Today right up to midnight', () => {
    expect(
      formatRecentSaleTimestamp(new Date(2026, 10, 15, 0, 0), now),
    ).toMatch(/^Today,/);
    expect(
      formatRecentSaleTimestamp(new Date(2026, 10, 15, 23, 59), now),
    ).toMatch(/^Today,/);
  });

  it('moves to Yesterday exactly one calendar day back', () => {
    expect(
      formatRecentSaleTimestamp(new Date(2026, 10, 14, 23, 59), now),
    ).toMatch(/^Yesterday,/);
    expect(
      formatRecentSaleTimestamp(new Date(2026, 10, 13, 0, 0), now),
    ).not.toMatch(/^Yesterday/);
  });

  it('returns a dash for missing or invalid values', () => {
    expect(formatRecentSaleTimestamp(null, now)).toBe('-');
    expect(formatRecentSaleTimestamp(undefined, now)).toBe('-');
    expect(formatRecentSaleTimestamp('not-a-date', now)).toBe('-');
  });
});
