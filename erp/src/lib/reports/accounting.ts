import Decimal from 'decimal.js';

import type { Prisma } from '@/generated/prisma/client';

/**
 * Sales are accounted on `saleDate` when present (backdated / missed sales),
 * otherwise on `createdAt`. Every revenue report must use the same rule so a
 * backdated sale lands in exactly one accounting period across the app.
 */
export function saleAccountingDateWhere(
  from: Date,
  to: Date,
): Prisma.SaleWhereInput {
  return {
    OR: [
      { saleDate: { gte: from, lte: to } },
      { saleDate: null, createdAt: { gte: from, lte: to } },
    ],
  };
}

/** JS-side equivalent for rows already loaded from Prisma. */
export function effectiveSaleDate(sale: {
  saleDate: Date | null;
  createdAt: Date;
}): Date {
  return sale.saleDate ?? sale.createdAt;
}

/**
 * Product revenue excludes tax and delivery, and includes the cart-level
 * discount. `subtotal` is the sum of post-line-discount line totals, so
 * `subtotal - discountAmount` is the amount the customer paid for goods.
 */
export function netProductRevenue(input: {
  subtotal: { toString(): string } | string | number;
  discountAmount: { toString(): string } | string | number;
}): string {
  return new Decimal(input.subtotal.toString())
    .minus(new Decimal(input.discountAmount.toString()))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toFixed(2);
}

/**
 * Refunds are stored as the post-line-discount product value, before the
 * original sale's cart discount. Restate them on the same basis as revenue.
 */
export function netRefundAmount(
  refundAmount: { toString(): string } | string | number,
  saleSubtotal: { toString(): string } | string | number,
  saleDiscount: { toString(): string } | string | number,
): Decimal {
  const subtotal = new Decimal(saleSubtotal.toString());
  if (subtotal.isZero()) {
    return new Decimal(refundAmount.toString()).toDecimalPlaces(
      2,
      Decimal.ROUND_HALF_UP,
    );
  }
  const paidRatio = Decimal.max(
    subtotal.minus(new Decimal(saleDiscount.toString())),
    0,
  ).div(subtotal);
  return new Decimal(refundAmount.toString())
    .mul(paidRatio)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
