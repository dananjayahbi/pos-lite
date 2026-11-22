import { describe, expect, it } from 'vitest';

import { formatEntryDate, formatEntryTime } from '@/components/payment-accounts/paymentAccountLabels';

/** ARGUS #433: same-day ledger rows need a visible time, not just a date. */
describe('ledger entry date presentation', () => {
  it('renders a day-first date', () => {
    expect(formatEntryDate('2026-09-17T10:32:00.000Z')).toMatch(/17 Sept? 2026/);
  });

  it('renders the recorded time so same-day rows can be ordered', () => {
    expect(formatEntryTime('2026-09-17T10:32:00.000Z')).toMatch(/^\d{2}:\d{2}$/);
  });

  it('never renders Invalid Date', () => {
    expect(formatEntryDate('not-a-date')).toBe('-');
    expect(formatEntryTime('not-a-date')).toBe('');
  });
});
