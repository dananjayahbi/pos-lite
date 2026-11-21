import { describe, expect, it } from 'vitest';

import {
  canCancelStockTake,
  canCompleteStockTake,
  canEditStockTake,
  cancelDisposition,
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
    expect(canCancelStockTake({ ...base, status: 'PENDING_APPROVAL' })).toBe(false);
  });

  it('never applies counts on cancel; apply must go through approval', () => {
    expect(cancelDisposition('apply')).toBe('reject');
    expect(cancelDisposition('discard')).toBe('discard');
    expect(cancelDisposition('none')).toBe('discard');
    expect(cancelDisposition(undefined)).toBe('discard');
  });
});
