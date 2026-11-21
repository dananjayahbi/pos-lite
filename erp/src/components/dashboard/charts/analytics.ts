import Decimal from 'decimal.js';
import { allocateCartDiscountShares } from '@/lib/services/saleDiscount.core';
import type { DailyRevenue, PaymentBreakdown, TopProduct } from './types';

type Decimalish = number | string | { toString(): string };

export interface AnalyticsSaleLine {
  productNameSnapshot: string;
  quantity: number;
  lineTotalAfterDiscount: Decimalish;
}

export interface AnalyticsSale {
  totalAmount: Decimalish;
  paymentMethod: string | null;
  completedAt: Date | null;
  discountAmount: Decimalish;
  lines: AnalyticsSaleLine[];
}

/**
 * Calendar date in the store's local timezone.
 *
 * Deliberately not `toISOString()`: that renders the UTC date, which is a day
 * behind for positive offsets (e.g. Sri Lanka, UTC+5:30), so the dashboard
 * window used to miss today and show a day outside the 7-day range.
 */
export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Midnight at the start of the given date's local day. */
export function startOfLocalDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * Last `days` local calendar days, ending with today (inclusive), so the
 * window always contains exactly `days` buckets and today is the last one.
 */
export function buildDailyRevenue(
  sales: AnalyticsSale[],
  days = 7,
  now = new Date(),
): DailyRevenue[] {
  const buckets = new Map<string, { revenue: number; salesCount: number }>();
  for (let offset = days - 1; offset >= 0; offset--) {
    const day = startOfLocalDay(now);
    day.setDate(day.getDate() - offset);
    buckets.set(localDateKey(day), { revenue: 0, salesCount: 0 });
  }

  for (const sale of sales) {
    if (!sale.completedAt) continue;
    const bucket = buckets.get(localDateKey(new Date(sale.completedAt)));
    if (!bucket) continue;
    bucket.revenue += Number(sale.totalAmount);
    bucket.salesCount += 1;
  }

  return Array.from(buckets.entries()).map(([date, values]) => ({
    date,
    ...values,
  }));
}

export function buildPaymentBreakdown(sales: AnalyticsSale[]): PaymentBreakdown[] {
  const payMap = new Map<string, { count: number; total: number }>();
  for (const sale of sales) {
    const method = sale.paymentMethod ?? 'OTHER';
    const bucket = payMap.get(method) ?? { count: 0, total: 0 };
    bucket.count += 1;
    bucket.total += Number(sale.totalAmount);
    payMap.set(method, bucket);
  }

  return Array.from(payMap.entries()).map(([method, values]) => ({
    method,
    ...values,
  }));
}

/**
 * Revenue per product is the money actually collected for its lines: the
 * post-line-discount total minus the line's share of the cart-level discount
 * (the same allocation the POS uses before tax). Full unit price overstated
 * every cart-discounted sale, and tax/delivery are sale-level, not product
 * revenue. Fully discounted lines therefore report LKR 0.00.
 */
export function buildTopProducts(sales: AnalyticsSale[], limit = 7): TopProduct[] {
  const productMap = new Map<string, { quantity: number; revenue: Decimal }>();

  for (const sale of sales) {
    const lineTotals = sale.lines.map(
      (line) => new Decimal(line.lineTotalAfterDiscount.toString()),
    );
    const shares = allocateCartDiscountShares(
      lineTotals,
      new Decimal(sale.discountAmount.toString()),
    );

    sale.lines.forEach((line, index) => {
      const collected = lineTotals[index]!.minus(shares[index]!);
      const entry = productMap.get(line.productNameSnapshot) ?? {
        quantity: 0,
        revenue: new Decimal(0),
      };
      entry.quantity += line.quantity;
      entry.revenue = entry.revenue.plus(collected);
      productMap.set(line.productNameSnapshot, entry);
    });
  }

  return Array.from(productMap.entries())
    .map(([name, values]) => ({
      name,
      quantity: values.quantity,
      revenue: values.revenue.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}
