import { describe, it, expect } from 'vitest';

import { staffDisplayName } from '@/lib/utils/staff-name';

describe('staffDisplayName', () => {
  it('capitalizes a single-word mailbox', () => {
    expect(staffDisplayName('owner@dilani-ayurwellness.lk')).toBe('Owner');
    expect(staffDisplayName('dispatch@ayurpos.dev')).toBe('Dispatch');
  });

  it('splits trailing digits into a readable suffix', () => {
    expect(staffDisplayName('cashier1@ayurpos.dev')).toBe('Cashier 1');
    expect(staffDisplayName('cashier2@ayurpos.dev')).toBe('Cashier 2');
  });

  it('turns separators into spaces', () => {
    expect(staffDisplayName('stock.clerk@shop.lk')).toBe('Stock Clerk');
    expect(staffDisplayName('front-desk_lead@shop.lk')).toBe('Front Desk Lead');
  });

  it('falls back to Unknown for a missing email', () => {
    expect(staffDisplayName(null)).toBe('Unknown');
    expect(staffDisplayName(undefined)).toBe('Unknown');
    expect(staffDisplayName('')).toBe('Unknown');
  });

  it('never leaks the domain', () => {
    expect(staffDisplayName('manager@example.com')).not.toContain('@');
  });
});
