import { describe, expect, it } from 'vitest';

import {
  PREPARABLE_DELIVERY_STATUSES,
  canPrepareDelivery,
} from '@/components/delivery/prepareDelivery';

describe('canPrepareDelivery', () => {
  it('allows the pre-dispatch statuses that are not ready yet', () => {
    expect(PREPARABLE_DELIVERY_STATUSES).toEqual(['PLACED', 'HOLD']);
    expect(canPrepareDelivery('PLACED')).toBe(true);
    expect(canPrepareDelivery('HOLD')).toBe(true);
  });

  it('does not prepare an already prepared delivery', () => {
    expect(canPrepareDelivery('PENDING_DISPATCH')).toBe(false);
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
      expect(canPrepareDelivery(status)).toBe(false);
    }
  });
});
