import { describe, it, expect } from 'vitest';
import {
  buildPaymentBreakdown,
  buildTopProducts,
} from '@/components/dashboard/charts/analytics';
import type { AnalyticsSale } from '@/components/dashboard/charts/analytics';

function sale(overrides: Partial<AnalyticsSale> = {}): AnalyticsSale {
  return {
    totalAmount: 0,
    paymentMethod: 'CASH',
    completedAt: new Date(2026, 10, 20, 12, 0),
    discountAmount: 0,
    lines: [],
    ...overrides,
  };
}

describe('buildPaymentBreakdown', () => {
  it('groups by payment method and treats a missing method as OTHER', () => {
    const breakdown = buildPaymentBreakdown([
      sale({ totalAmount: 100, paymentMethod: 'CASH' }),
      sale({ totalAmount: 250, paymentMethod: 'CASH' }),
      sale({ totalAmount: 75, paymentMethod: null }),
    ]);

    expect(breakdown).toEqual(
      expect.arrayContaining([
        { method: 'CASH', count: 2, total: 350 },
        { method: 'OTHER', count: 1, total: 75 },
      ]),
    );
  });
});

describe('buildTopProducts', () => {
  it('reports collected revenue after the cart discount, not full line price (ARGUS #37)', () => {
    const products = buildTopProducts([
      sale({
        totalAmount: 1500,
        discountAmount: 500,
        lines: [
          { productNameSnapshot: 'Bhringraj', quantity: 2, lineTotalAfterDiscount: 1000 },
          { productNameSnapshot: 'Ashwagandha', quantity: 1, lineTotalAfterDiscount: 1000 },
        ],
      }),
    ]);

    expect(products).toEqual([
      { name: 'Bhringraj', quantity: 2, revenue: 750 },
      { name: 'Ashwagandha', quantity: 1, revenue: 750 },
    ]);
    // Bars add up to subtotal minus cart discount, never the pre-discount total.
    expect(products.reduce((sum, p) => sum + p.revenue, 0)).toBe(1500);
  });

  it('shows LKR 0.00 for fully discounted zero-value lines', () => {
    const products = buildTopProducts([
      sale({
        totalAmount: 0,
        discountAmount: 0,
        paymentMethod: 'NONE',
        lines: [
          { productNameSnapshot: 'Replacement Gift', quantity: 1, lineTotalAfterDiscount: 0 },
        ],
      }),
    ]);

    expect(products).toEqual([{ name: 'Replacement Gift', quantity: 1, revenue: 0 }]);
  });

  it('apportions the cart discount across lines proportionally', () => {
    const products = buildTopProducts([
      sale({
        totalAmount: 180,
        discountAmount: 20,
        lines: [
          // lineTotalAfterDiscount is already net of any line-level discount
          { productNameSnapshot: 'Discounted Oil', quantity: 1, lineTotalAfterDiscount: 100 },
          { productNameSnapshot: 'Full Price Oil', quantity: 1, lineTotalAfterDiscount: 100 },
        ],
      }),
    ]);

    expect(products).toEqual([
      { name: 'Discounted Oil', quantity: 1, revenue: 90 },
      { name: 'Full Price Oil', quantity: 1, revenue: 90 },
    ]);
  });

  it('aggregates the same product across sales and orders by collected revenue', () => {
    const products = buildTopProducts([
      sale({
        discountAmount: 0,
        lines: [
          { productNameSnapshot: 'Bhringraj', quantity: 2, lineTotalAfterDiscount: 300 },
        ],
      }),
      sale({
        discountAmount: 100,
        lines: [
          { productNameSnapshot: 'Bhringraj', quantity: 1, lineTotalAfterDiscount: 200 },
          { productNameSnapshot: 'Neem', quantity: 1, lineTotalAfterDiscount: 200 },
        ],
      }),
    ]);

    expect(products).toEqual([
      { name: 'Bhringraj', quantity: 3, revenue: 450 },
      { name: 'Neem', quantity: 1, revenue: 150 },
    ]);
  });
});
