import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';

import { computeDiscount, computePurchaseOrderTotals } from '@/lib/services/purchaseOrderTotals';

/**
 * PO money arithmetic. These are pure functions precisely so the create form's
 * live preview and the persisted totals can be asserted to agree.
 */

describe('computeDiscount', () => {
  it('applies a percentage of the subtotal', () => {
    expect(computeDiscount(10000, { discountType: 'PERCENTAGE', discountValue: 10 })).toBe(1000);
  });

  it('rounds a percentage to two decimals', () => {
    expect(computeDiscount(999.99, { discountType: 'PERCENTAGE', discountValue: 7.5 })).toBe(75);
  });

  it('clamps a percentage above 100 to the full subtotal', () => {
    expect(computeDiscount(500, { discountType: 'PERCENTAGE', discountValue: 250 })).toBe(500);
  });

  it('applies a fixed amount', () => {
    expect(computeDiscount(1000, { discountType: 'FIXED', discountValue: 250 })).toBe(250);
  });

  it('clamps a fixed amount to the subtotal so the payable cannot go negative', () => {
    expect(computeDiscount(300, { discountType: 'FIXED', discountValue: 999999 })).toBe(300);
  });

  it('returns zero for a zero or negative subtotal', () => {
    expect(computeDiscount(0, { discountType: 'PERCENTAGE', discountValue: 10 })).toBe(0);
    expect(computeDiscount(-50, { discountType: 'FIXED', discountValue: 10 })).toBe(0);
  });

  it('returns zero when the value is missing, zero or negative', () => {
    expect(computeDiscount(1000, {})).toBe(0);
    expect(computeDiscount(1000, { discountType: 'FIXED', discountValue: 0 })).toBe(0);
    expect(computeDiscount(1000, { discountType: 'FIXED', discountValue: -20 })).toBe(0);
  });

  it('treats a value with no type as fixed', () => {
    expect(computeDiscount(1000, { discountValue: 100 })).toBe(100);
  });
});

describe('computePurchaseOrderTotals', () => {
  it('multiplies quantity by unit cost and sums the lines', () => {
    const totals = computePurchaseOrderTotals([
      { orderedQty: 10, unitCost: 1000 },
      { orderedQty: 2, unitCost: 500.25 },
    ]);

    expect(totals.subtotal).toBe(11000.5);
    expect(totals.discountAmount).toBe(0);
    expect(totals.total).toBe(11000.5);
  });

  it('subtracts a percentage discount from the subtotal', () => {
    const totals = computePurchaseOrderTotals([{ orderedQty: 10, unitCost: 1000 }], {
      discountType: 'PERCENTAGE',
      discountValue: 10,
    });

    expect(totals.subtotal).toBe(10000);
    expect(totals.discountAmount).toBe(1000);
    expect(totals.total).toBe(9000);
  });

  it('never produces a negative total when the discount exceeds the subtotal', () => {
    const totals = computePurchaseOrderTotals([{ orderedQty: 1, unitCost: 300 }], {
      discountType: 'FIXED',
      discountValue: 999999,
    });

    expect(totals.total).toBe(0);
  });

  it('accepts a numeric string unit cost', () => {
    const totals = computePurchaseOrderTotals([{ orderedQty: 3, unitCost: '19.99' }]);

    expect(totals.subtotal).toBe(59.97);
    expect(totals.total).toBe(59.97);
  });

  it('handles an empty line list', () => {
    const totals = computePurchaseOrderTotals([]);

    expect(totals.subtotal).toBe(0);
    expect(totals.total).toBe(0);
  });

  it('keeps subtotal - discount === total', () => {
    const totals = computePurchaseOrderTotals(
      [
        { orderedQty: 7, unitCost: 1234.56 },
        { orderedQty: 13, unitCost: 9.99 },
      ],
      { discountType: 'PERCENTAGE', discountValue: 12.5 },
    );

    const recomposed = new Decimal(totals.subtotal).minus(totals.discountAmount).toNumber();
    expect(recomposed).toBeCloseTo(totals.total, 2);
  });
});
