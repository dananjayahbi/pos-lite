import { describe, expect, it } from 'vitest';

import {
  formatAccountTimestamp,
  resolveAccountDisplayName,
} from '@/lib/services/accountProfile.core';

/** ARGUS #506: stored full name and day-first 24-hour timestamps. */
describe('resolveAccountDisplayName', () => {
  it('prefers a stored full name', () => {
    expect(
      resolveAccountDisplayName({ email: 'owner@ayurpos.dev', fullName: 'Dilani Perera' }),
    ).toBe('Dilani Perera');
  });

  it('trims the stored name and ignores a blank one', () => {
    expect(
      resolveAccountDisplayName({ email: 'cashier1@ayurpos.dev', fullName: '   ' }),
    ).toBe('Cashier 1');
    expect(
      resolveAccountDisplayName({ email: 'cashier1@ayurpos.dev', fullName: ' Nimal ' }),
    ).toBe('Nimal');
  });

  it('falls back to the mailbox alias when the name is missing', () => {
    expect(resolveAccountDisplayName({ email: 'cashier1@ayurpos.dev' })).toBe('Cashier 1');
  });
});

describe('formatAccountTimestamp', () => {
  it('uses the ERP day-first, 24-hour convention', () => {
    // Constructed as local time so the expectation is timezone-independent.
    const value = new Date(2026, 10, 20, 14, 2, 0);
    expect(formatAccountTimestamp(value)).toBe('20 Nov 2026, 14:02');
  });

  it('renders a dash for missing or invalid values', () => {
    expect(formatAccountTimestamp(null)).toBe('-');
    expect(formatAccountTimestamp(undefined)).toBe('-');
    expect(formatAccountTimestamp('not-a-date')).toBe('-');
  });
});
