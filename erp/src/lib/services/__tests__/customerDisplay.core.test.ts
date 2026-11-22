import { describe, expect, it } from 'vitest';

import { formatCustomerPhone } from '@/lib/services/customerDisplay.core';

/** ARGUS #319: one readable SL phone form across +94, 0 and legacy rows. */
describe('formatCustomerPhone', () => {
  it('groups +94, local and legacy 0-prefixed numbers identically', () => {
    expect(formatCustomerPhone('+94771234567')).toBe('+94 77 123 4567');
    expect(formatCustomerPhone('0771234567')).toBe('+94 77 123 4567');
    expect(formatCustomerPhone('077-123 4567')).toBe('+94 77 123 4567');
    // Legacy landline prefix keeps its digits, only the country code changes.
    expect(formatCustomerPhone('0887878787')).toBe('+94 88 787 8787');
  });

  it('leaves genuinely unrecognizable values untouched', () => {
    expect(formatCustomerPhone('+15551234567')).toBe('+15551234567');
    expect(formatCustomerPhone('not a phone')).toBe('not a phone');
  });

  it('renders a dash for an empty value', () => {
    expect(formatCustomerPhone(null)).toBe('-');
    expect(formatCustomerPhone(undefined)).toBe('-');
    expect(formatCustomerPhone('   ')).toBe('-');
  });
});
