import { describe, it, expect } from 'vitest';

import {
  effectiveSaleDate,
  netProductRevenue,
  netRefundAmount,
  saleAccountingDateWhere,
} from '@/lib/reports/accounting';

describe('reporting accounting helpers', () => {
  it('uses saleDate and falls back to createdAt for the accounting period', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-01-31T23:59:59.999Z');

    expect(saleAccountingDateWhere(from, to)).toEqual({
      OR: [
        { saleDate: { gte: from, lte: to } },
        { saleDate: null, createdAt: { gte: from, lte: to } },
      ],
    });
  });

  it('prefers saleDate for a concrete sale', () => {
    const saleDate = new Date('2026-02-01T10:00:00.000Z');
    const createdAt = new Date('2026-03-01T10:00:00.000Z');

    expect(effectiveSaleDate({ saleDate, createdAt })).toBe(saleDate);
    expect(effectiveSaleDate({ saleDate: null, createdAt })).toBe(createdAt);
  });

  it('excludes tax and delivery by deriving revenue from subtotal minus cart discount', () => {
    expect(
      netProductRevenue({ subtotal: '1000.00', discountAmount: '125.50' }),
    ).toBe('874.50');
    expect(
      netProductRevenue({ subtotal: '0.10', discountAmount: '0.00' }),
    ).toBe('0.10');
  });

  it('restates refunds on the same post-cart-discount basis as revenue', () => {
    // 10% cart discount → a 100.00 refund is worth 90.00 of net revenue.
    expect(
      netRefundAmount('100.00', '1000.00', '100.00').toFixed(2),
    ).toBe('90.00');
    // No cart discount → unchanged.
    expect(
      netRefundAmount('100.00', '1000.00', '0.00').toFixed(2),
    ).toBe('100.00');
    // Fully discounted sale → refund cannot be negative.
    expect(
      netRefundAmount('100.00', '1000.00', '1000.00').toFixed(2),
    ).toBe('0.00');
  });
});
