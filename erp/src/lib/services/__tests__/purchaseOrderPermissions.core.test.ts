import { describe, expect, it } from 'vitest';

import {
  canCancelPurchaseOrder,
  canCreatePurchaseOrderWithStatus,
  isPurchaseOrderFinanciallyLocked,
} from '@/lib/services/purchaseOrderPermissions.core';

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

/** ARGUS #227: only the statuses cancelPO accepts may offer Cancel. */
describe('canCancelPurchaseOrder', () => {
  it('allows the pre-receipt statuses', () => {
    expect(canCancelPurchaseOrder('DRAFT')).toBe(true);
    expect(canCancelPurchaseOrder('SENT')).toBe(true);
  });

  it('refuses once goods have been received', () => {
    expect(canCancelPurchaseOrder('PARTIALLY_RECEIVED')).toBe(false);
    expect(canCancelPurchaseOrder('RECEIVED')).toBe(false);
  });

  it('refuses an already cancelled order', () => {
    expect(canCancelPurchaseOrder('CANCELLED')).toBe(false);
  });

  it('refuses unknown statuses', () => {
    expect(canCancelPurchaseOrder('')).toBe(false);
    expect(canCancelPurchaseOrder('PENDING')).toBe(false);
  });
});
