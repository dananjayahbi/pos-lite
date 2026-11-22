import Decimal from 'decimal.js';

import { POS_DISCOUNT_THRESHOLDS } from '@/config/pos.config';

type Decimalish = Decimal | { toString(): string } | number | string;

/** Sum the discount amounts claimed by the client's promotion records. */
export function sumClientPromotionDiscount(appliedPromotions: unknown): Decimal {
  if (!Array.isArray(appliedPromotions)) return new Decimal(0);
  let total = new Decimal(0);
  for (const entry of appliedPromotions) {
    if (typeof entry !== 'object' || entry === null) continue;
    const amount = (entry as { discountAmount?: unknown }).discountAmount;
    const parsed = Number(amount);
    if (Number.isFinite(parsed) && parsed > 0) total = total.plus(parsed);
  }
  return total.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export interface ReconciledSaleDiscount {
  cartDiscount: Decimal;
  manualDiscount: Decimal;
  clientPromoTotal: Decimal;
  serverPromoTotal: Decimal;
  /** Promotion money actually applied after the manual-discount clamp. */
  appliedPromotionTotal: Decimal;
}

/**
 * Clamp promotion records to the remaining amount after manual discounts.
 *
 * A 100% manual cart discount leaves no capacity for a promotion; charging the
 * promotion on top would make the sale negative. Amounts are scaled
 * proportionally so the records still add up to the applied total.
 */
export function clampPromotionDiscounts<T extends { discountAmount: Decimalish }>(
  promotions: readonly T[],
  cap: Decimalish,
): Array<T & { discountAmount: string }> {
  const maxTotal = Decimal.max(new Decimal(cap.toString()), 0).toDecimalPlaces(
    2,
    Decimal.ROUND_HALF_UP,
  );
  const amounts = promotions.map((promotion) =>
    Decimal.max(new Decimal(promotion.discountAmount.toString()), 0),
  );
  const total = amounts.reduce((sum, amount) => sum.plus(amount), new Decimal(0));

  if (total.lessThanOrEqualTo(maxTotal) || total.isZero()) {
    return promotions.map((promotion, index) => ({
      ...promotion,
      discountAmount: amounts[index]!.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
    }));
  }

  const ratio = maxTotal.div(total);
  let allocated = new Decimal(0);
  return promotions.map((promotion, index) => {
    const isLast = index === promotions.length - 1;
    const share = isLast
      ? maxTotal.minus(allocated)
      : amounts[index]!.times(ratio).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    allocated = allocated.plus(share);
    return { ...promotion, discountAmount: share.toFixed(2) };
  });
}

/**
 * Reconcile the client's single `cartDiscountAmount` (manual cart discount +
 * promotions folded together) against the promotions the server just
 * re-evaluated (ARGUS #321).
 *
 * - A mismatch between the claimed and server promotion totals is rejected:
 *   the client's cart/prices are stale (a promo expired/changed), so charging
 *   its total would either over-discount or under-collect.
 * - The remainder is the manual cart discount, which must not be negative.
 * - The resulting discount is capped at the subtotal.
 */
export function reconcileSaleDiscount(input: {
  subtotal: Decimalish;
  submittedDiscount: Decimalish;
  clientPromoTotal: Decimalish;
  serverPromoTotal: Decimalish;
  /**
   * ARGUS #65: the POS sends its manual cart discount explicitly. Without it
   * a fully-discounted cart cannot be distinguished from a 100% promotion.
   */
  manualDiscount?: Decimalish | undefined;
}): ReconciledSaleDiscount {
  const subtotal = new Decimal(input.subtotal.toString());
  const submitted = Decimal.max(new Decimal(input.submittedDiscount.toString()), 0).toDecimalPlaces(
    2,
    Decimal.ROUND_HALF_UP,
  );
  const clientPromoTotal = new Decimal(input.clientPromoTotal.toString()).toDecimalPlaces(
    2,
    Decimal.ROUND_HALF_UP,
  );
  const serverPromoTotal = new Decimal(input.serverPromoTotal.toString()).toDecimalPlaces(
    2,
    Decimal.ROUND_HALF_UP,
  );

  if (clientPromoTotal.minus(serverPromoTotal).abs().greaterThan(0.01)) {
    throw new Error(
      `PROMOTION_MISMATCH: claimed ${clientPromoTotal.toFixed(2)} vs server ${serverPromoTotal.toFixed(2)}`,
    );
  }

  const manualDiscount =
    input.manualDiscount !== undefined
      ? Decimal.min(
          Decimal.max(new Decimal(input.manualDiscount.toString()), 0),
          subtotal,
        )
      : submitted.minus(clientPromoTotal);
  if (manualDiscount.isNegative()) {
    throw new Error('INVALID_DISCOUNT: cart discount is smaller than its promotion total');
  }

  // ARGUS #65: promotions may only consume what manual/line discounts left.
  const promotionCapacity = Decimal.max(subtotal.minus(manualDiscount), 0);
  const appliedPromotionTotal = Decimal.min(serverPromoTotal, promotionCapacity)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const cartDiscount = Decimal.min(
    manualDiscount.plus(appliedPromotionTotal),
    subtotal,
  ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    cartDiscount,
    manualDiscount: manualDiscount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    clientPromoTotal,
    serverPromoTotal,
    appliedPromotionTotal,
  };
}

/** Cart-level discount as a percentage of the subtotal (0 when empty). */
export function cartDiscountPercent(manualDiscount: Decimalish, subtotal: Decimalish): Decimal {
  const base = new Decimal(subtotal.toString());
  if (base.lessThanOrEqualTo(0)) return new Decimal(0);
  return new Decimal(manualDiscount.toString())
    .div(base)
    .times(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Enforce the cashier discount thresholds. Managers/owners (`canOverride`) are
 * exempt; everyone else needs an override for a line or cart discount above the
 * configured maxima. The UI enforced this client-side only, so an API caller
 * could submit any discount (ARGUS #321).
 */
export function assertDiscountsAuthorized(input: {
  canOverride: boolean;
  lineDiscountPercents: number[];
  cartDiscountPercent: Decimalish;
}): void {
  if (input.canOverride) return;

  const overLine = input.lineDiscountPercents.some(
    (percent) => percent > POS_DISCOUNT_THRESHOLDS.lineItemMaxPercent,
  );
  if (overLine) {
    throw new Error(
      `DISCOUNT_REQUIRES_MANAGER: line discounts above ${POS_DISCOUNT_THRESHOLDS.lineItemMaxPercent}% need a manager override`,
    );
  }

  if (
    new Decimal(input.cartDiscountPercent.toString()).greaterThan(
      POS_DISCOUNT_THRESHOLDS.cartMaxPercent,
    )
  ) {
    throw new Error(
      `DISCOUNT_REQUIRES_MANAGER: cart discounts above ${POS_DISCOUNT_THRESHOLDS.cartMaxPercent}% need a manager override`,
    );
  }
}
