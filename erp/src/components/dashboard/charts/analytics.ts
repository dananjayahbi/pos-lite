import Decimal from 'decimal.js';
import { allocateCartDiscountShares } from '@/lib/services/saleDiscount.core';
import type { PaymentBreakdown, TopProduct } from './types';

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
