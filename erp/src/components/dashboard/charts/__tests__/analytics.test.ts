import { describe, it, expect } from 'vitest';
import {
  buildDailyRevenue,
  buildPaymentBreakdown,
  buildTopProducts,
  endOfLocalDay,
  localDateKey,
  startOfLocalDay,
} from '@/components/dashboard/charts/analytics';
import type { AnalyticsSale } from '@/components/dashboard/charts/analytics';

function sale(overrides: Partial<AnalyticsSale> = {}): AnalyticsSale {
  return {
    totalAmount: 0,
    paymentMethod: 'CASH',
    saleDate: null,
    createdAt: new Date(2026, 10, 20, 12, 0),
    discountAmount: 0,
    lines: [],
    ...overrides,
  };
}

describe('localDateKey', () => {
  it('uses the local calendar day, not the UTC day', () => {
    // Late evening local time is already the next UTC day for negative
    // offsets (and the previous UTC day for positive offsets like LK).
    expect(localDateKey(new Date(2026, 10, 20, 23, 30))).toBe('2026-11-20');
    expect(localDateKey(new Date(2026, 10, 20, 0, 5))).toBe('2026-11-20');
  });

  it('zero-pads month and day', () => {
    expect(localDateKey(new Date(2026, 0, 5, 9, 0))).toBe('2026-01-05');
  });
});

describe('startOfLocalDay', () => {
  it('returns local midnight without mutating the input', () => {
    const input = new Date(2026, 10, 20, 18, 45, 12, 500);
    const start = startOfLocalDay(input);

    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
    expect(input.getHours()).toBe(18);
  });
});

describe('endOfLocalDay', () => {
  it('returns the last millisecond of the local day without mutating the input', () => {
    const input = new Date(2026, 10, 20, 18, 45, 12, 500);
    const end = endOfLocalDay(input);

    expect(end.getDate()).toBe(20);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
    expect(end.getMilliseconds()).toBe(999);
    expect(input.getHours()).toBe(18);
  });

  it('handles the last day of a month', () => {
    const end = endOfLocalDay(new Date(2026, 10, 30, 8, 0));
    expect(end.getMonth()).toBe(10);
    expect(end.getDate()).toBe(30);
    expect(end.getMilliseconds()).toBe(999);
  });
});

describe('buildDailyRevenue', () => {
  const now = new Date(2026, 10, 20, 15, 0);

  it('ends with today and covers exactly seven local days', () => {
    const days = buildDailyRevenue([], 7, now);

    expect(days).toHaveLength(7);
    expect(days.map((d) => d.date)).toEqual([
      '2026-11-14',
      '2026-11-15',
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
    ]);
  });

  it("counts a sale just after local midnight on today's bucket (ARGUS #38)", () => {
    const days = buildDailyRevenue(
      [sale({ totalAmount: 1500, createdAt: new Date(2026, 10, 20, 0, 5) })],
      7,
      now,
    );

    const today = days[days.length - 1]!;
    expect(today.date).toBe('2026-11-20');
    expect(today.revenue).toBe(1500);
    expect(today.salesCount).toBe(1);
  });

  it('drops sales before the seven-day window', () => {
    const days = buildDailyRevenue(
      [
        sale({ totalAmount: 999, createdAt: new Date(2026, 10, 13, 23, 59) }),
        sale({ totalAmount: 10, createdAt: new Date(2026, 10, 14, 0, 1) }),
      ],
      7,
      now,
    );

    expect(days.reduce((sum, d) => sum + d.revenue, 0)).toBe(10);
    expect(days[0]!.date).toBe('2026-11-14');
  });

  it('buckets a backdated sale on its recorded sale date, not completion time (ARGUS #50)', () => {
    const days = buildDailyRevenue(
      [
        sale({
          totalAmount: 500,
          createdAt: new Date(2026, 10, 20, 18, 0), // completed today
          saleDate: new Date(2026, 10, 16, 12, 0), // recorded for the 16th
        }),
      ],
      7,
      now,
    );

    expect(days.find((d) => d.date === '2026-11-16')!.revenue).toBe(500);
    expect(days.find((d) => d.date === '2026-11-20')!.revenue).toBe(0);
  });

  it('ignores a sale whose recorded date is outside the window even if completed today (ARGUS #50)', () => {
    const days = buildDailyRevenue(
      [
        sale({
          totalAmount: 500,
          createdAt: new Date(2026, 10, 20, 18, 0),
          saleDate: new Date(2026, 10, 1, 12, 0),
        }),
      ],
      7,
      now,
    );

    expect(days.reduce((sum, d) => sum + d.revenue, 0)).toBe(0);
  });

  it('prefers the recorded sale date when both dates fall in the window (ARGUS #50)', () => {
    const days = buildDailyRevenue(
      [
        sale({
          totalAmount: 250,
          createdAt: new Date(2026, 10, 20, 18, 0),
          saleDate: new Date(2026, 10, 18, 9, 0),
        }),
      ],
      7,
      now,
    );

    expect(days.find((d) => d.date === '2026-11-18')!.revenue).toBe(250);
    expect(days.find((d) => d.date === '2026-11-20')!.revenue).toBe(0);
  });
});

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
