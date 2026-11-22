import { describe, expect, it } from 'vitest';
import {
  commissionPayoutAmount,
  formatCommissionDate,
  formatCommissionDateTime,
  formatCommissionWindow,
} from '@/lib/services/commissionPayoutPresentation.core';

describe('commission payout presentation', () => {
  it('prefers amountPaid and falls back to the legacy totalEarned field', () => {
    expect(commissionPayoutAmount({ amountPaid: '1250.5', totalEarned: '9999.00' })).toBe(
      '1250.50',
    );
    expect(commissionPayoutAmount({ totalEarned: '700' })).toBe('700.00');
    expect(commissionPayoutAmount({})).toBe('0.00');
  });

  it('formats dates in en-GB style, not the browser default', () => {
    const iso = '2026-11-14T09:05:00.000Z';
    expect(formatCommissionDate(iso)).toMatch(/^\d{2} Nov 2026$/);
    expect(formatCommissionDate(iso)).not.toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    expect(formatCommissionDateTime(iso)).toMatch(/^\d{2} Nov 2026,? \d{2}:\d{2}$/);
  });

  it('returns a dash for missing or invalid values', () => {
    expect(formatCommissionDate(null)).toBe('-');
    expect(formatCommissionDate('not-a-date')).toBe('-');
    expect(formatCommissionDateTime(undefined)).toBe('-');
  });

  it('formats the commission window with both boundaries', () => {
    expect(formatCommissionWindow('2026-11-01', '2026-11-30')).toBe(
      '01 Nov 2026 - 30 Nov 2026',
    );
  });
});
