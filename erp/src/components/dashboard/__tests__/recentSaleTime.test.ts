import { describe, expect, it } from 'vitest';

import { formatRecentSaleTimestamp } from '@/components/dashboard/recentSaleTime';

/**
 * ARGUS #40 - rows spanning two days must show which day each row is.
 * ARGUS #44 - every dashboard timestamp uses the day-first 24-hour style.
 */
describe('formatRecentSaleTimestamp', () => {
  const now = new Date(2026, 10, 15, 23, 30); // 15 Nov 2026, local

  it('renders a day-first date and 24-hour time', () => {
    expect(formatRecentSaleTimestamp(new Date(2026, 10, 15, 23, 6), now)).toBe(
      '15 Nov 2026, 23:06',
    );
  });

  it('shows the calendar day for older rows instead of a bare clock time', () => {
    expect(formatRecentSaleTimestamp(new Date(2026, 10, 9, 21, 0), now)).toBe(
      '09 Nov 2026, 21:00',
    );
  });

  it('keeps midnight on the same day as 00:00', () => {
    expect(formatRecentSaleTimestamp(new Date(2026, 10, 15, 0, 0), now)).toBe(
      '15 Nov 2026, 00:00',
    );
  });

  it('returns a dash for missing or invalid values', () => {
    expect(formatRecentSaleTimestamp(null, now)).toBe('-');
    expect(formatRecentSaleTimestamp(undefined, now)).toBe('-');
    expect(formatRecentSaleTimestamp('not-a-date', now)).toBe('-');
  });
});
