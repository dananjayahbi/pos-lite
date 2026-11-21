import { describe, expect, it } from 'vitest';

import { formatShortDate, formatShortDateTime, formatShortTime } from '@/lib/format';

describe('ledger date formatting', () => {
  const value = new Date(2026, 9, 28, 20, 45, 0);

  it('uses one day-first date format', () => {
    expect(formatShortDate(value)).toBe('28 Oct 2026');
    expect(formatShortDate(value.toISOString())).toBe('28 Oct 2026');
  });

  it('uses a 24-hour time and a comma before it', () => {
    expect(formatShortTime(value)).toBe('20:45');
    expect(formatShortDateTime(value)).toBe('28 Oct 2026, 20:45');
  });

  it('renders a dash for missing or invalid input', () => {
    expect(formatShortDate(null)).toBe('-');
    expect(formatShortDateTime('not-a-date')).toBe('-');
    expect(formatShortTime(undefined)).toBe('-');
  });
});
