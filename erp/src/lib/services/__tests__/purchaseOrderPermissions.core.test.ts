import { describe, expect, it } from 'vitest';

import { canCreatePurchaseOrderWithStatus, isPurchaseOrderFinanciallyLocked } from '@/lib/services/purchaseOrderPermissions.core';

/** ARGUS #224: creating as SENT must require purchase_order:approve. */
describe('canCreatePurchaseOrderWithStatus', () => {
  it('allows a draft for create-only roles', () => {
    expect(canCreatePurchaseOrderWithStatus('DRAFT', false)).toBe(true);
    expect(canCreatePurchaseOrderWithStatus(undefined, false)).toBe(true);
  });

  it('refuses SENT without the approval permission', () => {
    expect(canCreatePurchaseOrderWithStatus('SENT', false)).toBe(false);
  });

  it('allows SENT for approvers', () => {
    expect(canCreatePurchaseOrderWithStatus('SENT', true)).toBe(true);
  });
});

/** ARGUS #226: money applied freezes financial edits and cancellation. */
describe('isPurchaseOrderFinanciallyLocked', () => {
  it('locks the order once any payment exists', () => {
    expect(isPurchaseOrderFinanciallyLocked(0.01)).toBe(true);
    expect(isPurchaseOrderFinanciallyLocked('1048.41')).toBe(true);
  });

  it('leaves an unpaid order editable/cancellable', () => {
    expect(isPurchaseOrderFinanciallyLocked(0)).toBe(false);
    expect(isPurchaseOrderFinanciallyLocked('0.00')).toBe(false);
  });
});
