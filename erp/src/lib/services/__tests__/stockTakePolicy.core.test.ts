import { describe, expect, it } from 'vitest';

import {
  canApproveStockTake,
  canCancelStockTake,
  canCompleteStockTake,
  canEditStockTake,
  cancelDisposition,
  invalidCountedQuantityRows,
  isCountedQuantityValid,
} from '@/lib/services/stockTakePolicy.core';

const base = {
  userId: 'user-initiator',
  initiatedById: 'user-initiator',
  canConduct: true,
  canApprove: false,
};

describe('stock-take policy (ARGUS #205/#206)', () => {
  it('allows counting only with stock:take on an in-progress session', () => {
    expect(canEditStockTake({ status: 'IN_PROGRESS', canConduct: true })).toBe(true);
    expect(canEditStockTake({ status: 'IN_PROGRESS', canConduct: false })).toBe(false);
    expect(canEditStockTake({ status: 'PENDING_APPROVAL', canConduct: true })).toBe(false);
    expect(canEditStockTake({ status: 'APPROVED', canConduct: true })).toBe(false);
  });

  it('allows completion only for the initiator with stock:take', () => {
    expect(canCompleteStockTake({ ...base, status: 'IN_PROGRESS' })).toBe(true);
    expect(
      canCompleteStockTake({ ...base, status: 'IN_PROGRESS', userId: 'someone-else' }),
    ).toBe(false);
    expect(canCompleteStockTake({ ...base, status: 'PENDING_APPROVAL' })).toBe(false);
    expect(
      canCompleteStockTake({ ...base, status: 'IN_PROGRESS', canConduct: false }),
    ).toBe(false);
  });

  it('lets the initiator or an approver discard an in-progress session', () => {
    expect(canCancelStockTake({ ...base, status: 'IN_PROGRESS' })).toBe(true);
    // An approver may cancel a session they did not initiate.
    expect(
      canCancelStockTake({
        ...base,
        status: 'IN_PROGRESS',
        userId: 'manager',
        canApprove: true,
      }),
    ).toBe(true);
    // A different clerk cannot cancel someone else's session.
    expect(
      canCancelStockTake({ ...base, status: 'IN_PROGRESS', userId: 'other-clerk' }),
    ).toBe(false);
    // An approver may discard a stale pending-approval session (ARGUS #147),
    // but the initiator cannot bypass approval by cancelling it.
    expect(
      canCancelStockTake({
        ...base,
        status: 'PENDING_APPROVAL',
        userId: 'manager',
        canApprove: true,
      }),
    ).toBe(true);
    expect(canCancelStockTake({ ...base, status: 'PENDING_APPROVAL' })).toBe(false);
  });

  it('never applies counts on cancel; apply must go through approval', () => {
    expect(cancelDisposition('apply')).toBe('reject');
    expect(cancelDisposition('discard')).toBe('discard');
    expect(cancelDisposition('none')).toBe('discard');
    expect(cancelDisposition(undefined)).toBe('discard');
  });
});

describe('stock-take maker-checker approval (ARGUS #187 / BUG-43)', () => {
  const pending = {
    status: 'PENDING_APPROVAL',
    userId: 'approver',
    initiatedById: 'initiator',
    canConduct: true,
    canApprove: true,
  };

  it('allows a different user with the approve permission', () => {
    expect(canApproveStockTake(pending)).toBe(true);
  });

  it('blocks the initiator even when they hold stock:take:approve', () => {
    expect(canApproveStockTake({ ...pending, userId: 'initiator' })).toBe(false);
  });

  it('requires both the approve permission and a pending session', () => {
    expect(canApproveStockTake({ ...pending, canApprove: false })).toBe(false);
    expect(canApproveStockTake({ ...pending, status: 'IN_PROGRESS' })).toBe(false);
    expect(canApproveStockTake({ ...pending, status: 'APPROVED' })).toBe(false);
  });
});

describe('stock-take counted quantity validation (ARGUS #187 / BUG-42)', () => {
  it('accepts null (uncounted) and non-negative integers', () => {
    expect(isCountedQuantityValid(null)).toBe(true);
    expect(isCountedQuantityValid(undefined)).toBe(true);
    expect(isCountedQuantityValid(0)).toBe(true);
    expect(isCountedQuantityValid(42)).toBe(true);
  });

  it('rejects negative, fractional, NaN and infinite counts', () => {
    for (const value of [-1, -0.5, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isCountedQuantityValid(value), String(value)).toBe(false);
    }
  });

  it('reports every invalid row without flagging valid or uncounted rows', () => {
    const invalid = invalidCountedQuantityRows([
      { variantId: 'v1', countedQuantity: 4 },
      { variantId: 'v2', countedQuantity: -3 },
      { variantId: 'v3', countedQuantity: null },
      { variantId: 'v4', countedQuantity: 2.5 },
    ]);

    expect(invalid.map((row) => row.variantId)).toEqual(['v2', 'v4']);
    expect(invalid.map((row) => row.label)).toEqual(['v2=-3', 'v4=2.5']);
  });
});
