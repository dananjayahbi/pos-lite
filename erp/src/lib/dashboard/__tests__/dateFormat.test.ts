import { describe, expect, it } from 'vitest';

import {
  formatDashboardDateTime,
  formatDashboardDay,
} from '@/lib/dashboard/dateFormat';

/** ARGUS #44 - the dashboard uses one day-first, 24-hour date style. */
describe('formatDashboardDateTime', () => {
  it('renders a day-first date with 24-hour time', () => {
    expect(formatDashboardDateTime(new Date(2026, 10, 15, 23, 7))).toBe(
      '15 Nov 2026, 23:07',
    );
    expect(formatDashboardDateTime(new Date(2026, 10, 5, 9, 0))).toBe(
      '05 Nov 2026, 09:00',
    );
  });

  it('uses midnight as 00:00, not 24:00', () => {
    expect(formatDashboardDateTime(new Date(2026, 10, 15, 0, 0))).toBe(
      '15 Nov 2026, 00:00',
    );
  });

  it('returns a dash for missing or invalid values', () => {
    expect(formatDashboardDateTime(null)).toBe('-');
    expect(formatDashboardDateTime(undefined)).toBe('-');
    expect(formatDashboardDateTime('not-a-date')).toBe('-');
  });
});

describe('formatDashboardDay', () => {
  it('renders a local calendar key as day then month', () => {
    expect(formatDashboardDay('2026-11-13')).toBe('13 Nov');
    expect(formatDashboardDay('2026-01-05')).toBe('05 Jan');
  });
});
