import { describe, expect, it } from 'vitest';

import { computePurchaseOrderPayable } from '@/lib/services/purchaseOrderPayable.core';

/**
 * ARGUS #225: the payable must follow the received value and actual invoice
 * cost, not the expected order total.
 */
describe('computePurchaseOrderPayable', () => {
  it('uses the actual received value when fully received (PO-202609-0001)', () => {
    const result = computePurchaseOrderPayable(
      [
        { orderedQty: 20, receivedQty: 20, expectedCostPrice: 840, actualCostPrice: 840 },
        { orderedQty: 15, receivedQty: 15, expectedCostPrice: 1200, actualCostPrice: 1200 },
      ],
      0,
      35000,
    );

    expect(result.receivedSubtotal).toBe(34800);
    expect(result.payable).toBe(34800);
    expect(result.hasReceipts).toBe(true);
  });

  it('pays only the received units of a partially received order (PO-202610-0002)', () => {
    const result = computePurchaseOrderPayable(
      [{ orderedQty: 4, receivedQty: 3, expectedCostPrice: 1076, actualCostPrice: 1076 }],
      0,
      4304,
    );

    expect(result.payable).toBe(3228);
    expect(result.expectedSubtotal).toBe(4304);
  });

  it('keeps the expected total before any goods arrive', () => {
    const result = computePurchaseOrderPayable(
      [{ orderedQty: 4, receivedQty: 0, expectedCostPrice: 1076 }],
      100,
      4204,
    );

    expect(result.hasReceipts).toBe(false);
    expect(result.payable).toBe(4204);
  });

  it('accepts a higher actual invoice than the expected total', () => {
    const result = computePurchaseOrderPayable(
      [{ orderedQty: 2, receivedQty: 2, expectedCostPrice: 100, actualCostPrice: 120 }],
      0,
      200,
    );

    expect(result.payable).toBe(240);
  });

  it('apportions a discount to the received share', () => {
    const result = computePurchaseOrderPayable(
      [
        { orderedQty: 1, receivedQty: 1, expectedCostPrice: 50 },
        { orderedQty: 1, receivedQty: 0, expectedCostPrice: 50 },
      ],
      10,
      90,
    );

    // Half the order received -> half of the 10 discount.
    expect(result.receivedSubtotal).toBe(50);
    expect(result.receivedDiscount).toBe(5);
    expect(result.payable).toBe(45);
  });

  it('falls back to the expected cost for a received line without actual cost', () => {
    const result = computePurchaseOrderPayable(
      [{ orderedQty: 10, receivedQty: 7, expectedCostPrice: '12.50' }],
      0,
      125,
    );

    expect(result.receivedSubtotal).toBe(87.5);
    expect(result.payable).toBe(87.5);
  });

  it('never lets the apportioned discount exceed the received value', () => {
    const result = computePurchaseOrderPayable(
      [{ orderedQty: 10, receivedQty: 1, expectedCostPrice: 10 }],
      100,
      0,
    );

    expect(result.receivedDiscount).toBe(10);
    expect(result.payable).toBe(0);
  });
});
