import Decimal from 'decimal.js';

import type { DiscountType } from '@/generated/prisma/client';

/**
 * Purchase-order arithmetic, kept out of the service so the same rules apply to
 * the create form's live preview, the API validator and the persisted totals.
 *
 * Order of operations: line subtotal → discount → payable total. Discounts never
 * apply to a zero subtotal and can never produce a negative payable.
 */

export interface PurchaseOrderTotals {
  subtotal: number;
  discountAmount: number;
  total: number;
}

export interface DiscountInput {
  discountType?: DiscountType | null;
  discountValue?: number | string | null;
}

function money(value: Decimal): number {
  return value.toDecimalPlaces(2).toNumber();
}

/**
 * Resolve a percentage/fixed discount against a subtotal.
 *
 * A PERCENTAGE value is clamped to 0–100 and a FIXED value is clamped to the
 * subtotal, so a typo can't discount a PO into negative payable.
 */
export function computeDiscount(subtotal: number, discount: DiscountInput): number {
  const base = new Decimal(subtotal);
  if (base.lessThanOrEqualTo(0)) return 0;

  const raw = new Decimal(discount.discountValue ?? 0);
  if (raw.lessThanOrEqualTo(0)) return 0;

  if (discount.discountType === 'PERCENTAGE') {
    const pct = Decimal.min(raw, new Decimal(100));
    return money(base.times(pct).dividedBy(100));
  }

  if (discount.discountType === 'FIXED') {
    return money(Decimal.min(raw, base));
  }

  // A value with no type is treated as fixed — the least surprising fallback.
  return money(Decimal.min(raw, base));
}

/**
 * Compute a purchase order's subtotal, discount and payable total.
 *
 * `lines` takes the raw ordered qty and expected cost of each line; previews
 * and the API both feed the same shape so they can never disagree.
 */
export function computePurchaseOrderTotals(
  lines: Array<{ orderedQty: number; unitCost: number | string }>,
  discount: DiscountInput = {},
): PurchaseOrderTotals {
  const subtotal = lines.reduce(
    (sum, line) => sum.plus(new Decimal(line.unitCost).times(line.orderedQty)),
    new Decimal(0),
  );

  const roundedSubtotal = money(subtotal);
  const discountAmount = computeDiscount(roundedSubtotal, discount);

  return {
    subtotal: roundedSubtotal,
    discountAmount,
    total: money(new Decimal(roundedSubtotal).minus(discountAmount)),
  };
}
