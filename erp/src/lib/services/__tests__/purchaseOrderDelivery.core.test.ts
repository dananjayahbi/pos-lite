import { describe, expect, it } from 'vitest';

import { purchaseOrderDeliveryDateError } from '@/lib/services/purchaseOrderDelivery.core';

describe('purchase-order delivery validation (ARGUS #233)', () => {
  it('rejects a delivery instant before the order instant', () => {
    expect(
      purchaseOrderDeliveryDateError(
        new Date('2026-10-29T12:00:00'),
        new Date('2026-10-04T12:00:00'),
      ),
    ).toBe('Expected delivery date cannot be before the order date');
  });

  it('accepts the same day and a later day', () => {
    expect(
      purchaseOrderDeliveryDateError(
        new Date('2026-10-29T12:00:00'),
        new Date('2026-10-29T12:00:00'),
      ),
    ).toBeNull();
    expect(
      purchaseOrderDeliveryDateError(
        new Date('2026-10-29T12:00:00'),
        new Date('2026-11-05T12:00:00'),
      ),
    ).toBeNull();
  });

  it('ignores a missing or cleared delivery date', () => {
    expect(purchaseOrderDeliveryDateError(new Date(), null)).toBeNull();
    expect(purchaseOrderDeliveryDateError(new Date(), undefined)).toBeNull();
    expect(purchaseOrderDeliveryDateError(new Date(), '')).toBeNull();
  });
});
