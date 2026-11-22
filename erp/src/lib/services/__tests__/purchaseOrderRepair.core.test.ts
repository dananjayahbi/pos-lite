import { describe, expect, it } from 'vitest';

import {
  computePurchaseOrderLinesSubtotal,
  planPurchaseOrderSubtotalRepair,
  planReceiptMovementRepair,
} from '@/lib/services/purchaseOrderRepair.core';

/** ARGUS #232: legacy/demo PO rows must be repairable without guessing. */
describe('computePurchaseOrderLinesSubtotal', () => {
  it('sums ordered quantity x expected cost', () => {
    expect(
      computePurchaseOrderLinesSubtotal([
        { orderedQty: 20, expectedCostPrice: 850, receivedQty: 20 },
        { orderedQty: 15, expectedCostPrice: '1200', receivedQty: 15 },
      ]),
    ).toBe(35000);
  });

  it('rounds to cents', () => {
    expect(
      computePurchaseOrderLinesSubtotal([
        { orderedQty: 3, expectedCostPrice: '99.995', receivedQty: 0 },
      ]),
    ).toBe(299.99);
  });
});

describe('planPurchaseOrderSubtotalRepair', () => {
  const lines35000 = [
    { orderedQty: 20, expectedCostPrice: 850, receivedQty: 20 },
    { orderedQty: 15, expectedCostPrice: 1200, receivedQty: 15 },
  ];

  it('repairs a seeded zero subtotal when the total matches the lines', () => {
    expect(
      planPurchaseOrderSubtotalRepair(
        { subtotalAmount: 0, discountAmount: 0, totalAmount: 35000 },
        lines35000,
      ),
    ).toEqual({ status: 'repair', subtotal: 35000, previousSubtotal: 0 });
  });

  it('covers the other reported demo rows', () => {
    expect(
      planPurchaseOrderSubtotalRepair(
        { subtotalAmount: 0, discountAmount: 0, totalAmount: 40500 },
        [
          { orderedQty: 30, expectedCostPrice: 900, receivedQty: 0 },
          { orderedQty: 10, expectedCostPrice: 1350, receivedQty: 0 },
        ],
      ).status,
    ).toBe('repair');

    expect(
      planPurchaseOrderSubtotalRepair(
        { subtotalAmount: 0, discountAmount: 0, totalAmount: 4304 },
        [{ orderedQty: 4, expectedCostPrice: 1076, receivedQty: 3 }],
      ).status,
    ).toBe('repair');
  });

  it('leaves a consistent order alone (idempotent)', () => {
    expect(
      planPurchaseOrderSubtotalRepair(
        { subtotalAmount: 35000, discountAmount: 0, totalAmount: 35000 },
        lines35000,
      ),
    ).toEqual({ status: 'ok', subtotal: 35000 });
  });

  it('accounts for a real discount in the totals equation', () => {
    expect(
      planPurchaseOrderSubtotalRepair(
        { subtotalAmount: '0', discountAmount: '500', totalAmount: '34500' },
        lines35000,
      ),
    ).toMatchObject({ status: 'repair', subtotal: 35000 });
  });

  it('reports a total that disagrees with the lines instead of rewriting money', () => {
    const plan = planPurchaseOrderSubtotalRepair(
      { subtotalAmount: 0, discountAmount: 0, totalAmount: 30000 },
      lines35000,
    );
    expect(plan.status).toBe('manual');
    if (plan.status === 'manual') {
      expect(plan.reason).toContain('does not equal lines subtotal');
    }
  });
});

describe('planReceiptMovementRepair', () => {
  it('reconstructs the legacy seed shape without changing stock', () => {
    expect(
      planReceiptMovementRepair({
        receivedQty: 20,
        hasReceiptMovement: false,
        ledgerTail: 100,
        currentStock: 120,
      }),
    ).toEqual({ status: 'create', quantityDelta: 20, quantityBefore: 100, quantityAfter: 120 });
  });

  it('is a no-op once the receipt movement exists', () => {
    expect(
      planReceiptMovementRepair({
        receivedQty: 20,
        hasReceiptMovement: true,
        ledgerTail: 120,
        currentStock: 120,
      }),
    ).toEqual({ status: 'already' });
  });

  it('treats no receipt quantity as nothing to do', () => {
    expect(
      planReceiptMovementRepair({
        receivedQty: 0,
        hasReceiptMovement: false,
        ledgerTail: 10,
        currentStock: 10,
      }),
    ).toEqual({ status: 'none' });
  });

  it('refuses to invent a receipt when stock already matches the ledger', () => {
    const plan = planReceiptMovementRepair({
      receivedQty: 20,
      hasReceiptMovement: false,
      ledgerTail: 120,
      currentStock: 120,
    });
    expect(plan.status).toBe('manual');
  });

  it('reports a gap that later ledger activity makes ambiguous', () => {
    const plan = planReceiptMovementRepair({
      receivedQty: 20,
      hasReceiptMovement: false,
      ledgerTail: 5,
      currentStock: 100,
    });
    expect(plan.status).toBe('manual');
    if (plan.status === 'manual') {
      expect(plan.reason).toContain('gap 95');
    }
  });

  it('refuses a negative ledger tail', () => {
    expect(
      planReceiptMovementRepair({
        receivedQty: 5,
        hasReceiptMovement: false,
        ledgerTail: -1,
        currentStock: 4,
      }).status,
    ).toBe('manual');
  });

  it('handles a variant with no prior movements', () => {
    expect(
      planReceiptMovementRepair({
        receivedQty: 7,
        hasReceiptMovement: false,
        ledgerTail: null,
        currentStock: 7,
      }),
    ).toEqual({ status: 'create', quantityDelta: 7, quantityBefore: 0, quantityAfter: 7 });
  });
});
