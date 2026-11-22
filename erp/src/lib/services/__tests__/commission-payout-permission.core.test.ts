import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { canPayCommissionPayouts } from '@/lib/services/commission-payout-permission.core';

describe('canPayCommissionPayouts', () => {
  it('allows the owner by default', () => {
    expect(canPayCommissionPayouts({ role: 'OWNER' })).toBe(true);
  });

  it('denies managers by default (owner approval required)', () => {
    expect(canPayCommissionPayouts({ role: 'MANAGER' })).toBe(false);
  });

  it('denies cashiers and missing sessions', () => {
    expect(canPayCommissionPayouts({ role: 'CASHIER' })).toBe(false);
    expect(canPayCommissionPayouts(null)).toBe(false);
  });

  it('honours an explicit owner grant', () => {
    expect(
      canPayCommissionPayouts({
        role: 'MANAGER',
        permissions: [PERMISSIONS.PAYROLL.payCommission],
      }),
    ).toBe(true);
  });
});
