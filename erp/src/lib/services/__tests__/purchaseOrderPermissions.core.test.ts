import { describe, expect, it } from 'vitest';

import { canCreatePurchaseOrderWithStatus } from '@/lib/services/purchaseOrderPermissions.core';

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
