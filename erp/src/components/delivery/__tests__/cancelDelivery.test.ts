import { describe, expect, it } from 'vitest';

import {
  CANCELLABLE_DELIVERY_STATUSES,
  canCancelDelivery,
  cancellableStatusesLabel,
} from '@/components/delivery/cancelDelivery';

/**
 * ARGUS #272 - the detail used to cancel immediately and only for
 * PENDING_DISPATCH, while the list confirmed PLACED/PENDING_DISPATCH/HOLD.
 */
describe('cancellable statuses', () => {
  it('allows exactly the pre-dispatch statuses', () => {
    expect(CANCELLABLE_DELIVERY_STATUSES).toEqual([
      'PLACED',
      'PENDING_DISPATCH',
      'HOLD',
    ]);
  });

  it('returns true for PLACED, PENDING_DISPATCH and HOLD', () => {
    expect(canCancelDelivery('PLACED')).toBe(true);
    expect(canCancelDelivery('PENDING_DISPATCH')).toBe(true);
    expect(canCancelDelivery('HOLD')).toBe(true);
  });

  it('rejects dispatched, final and unknown statuses', () => {
    for (const status of [
      'DISPATCHED',
      'IN_TRANSIT',
      'OUT_FOR_DELIVERY',
      'PENDING_PICKUP',
      'DELIVERED',
      'FAILED',
      'RETURNED',
      'CANCELED',
      null,
      undefined,
    ]) {
      expect(canCancelDelivery(status)).toBe(false);
    }
  });

  it('labels the allowed statuses for the dialog', () => {
    expect(cancellableStatusesLabel()).toBe('PLACED, PENDING_DISPATCH, HOLD');
  });
});
