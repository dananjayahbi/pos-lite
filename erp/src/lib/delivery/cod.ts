import Decimal from 'decimal.js';

type Decimalish = Decimal | { toString(): string } | number | string;

export interface CodPaymentFields {
  /**
   * Goods value stored on the delivery. It doubles as the PayHere amount basis
   * and the invoice subtotal fallback, so it is NOT the courier-facing amount.
   */
  codAmount?: Decimalish | null | undefined;
  /** Delivery fee charged to the customer; collected on top for COD orders. */
  shippingFee?: Decimalish | null | undefined;
  paymentMethod?: string | null | undefined;
  paymentStatus?: string | null | undefined;
}

/**
 * True when the customer has already paid, so the courier must not collect
 * anything on delivery (ARGUS #297). A paid card (or any PAID) order that still
 * carries the goods value in `codAmount` must never be handed to the courier as
 * COD - the money was already collected at checkout.
 */
export function isPrepaidOrder(delivery: CodPaymentFields): boolean {
  return delivery.paymentStatus === 'PAID';
}

/**
 * The amount the courier may actually collect (ARGUS #288).
 *
 * One collectable total = goods + shipping for COD/unpaid orders. The checkout
 * charges goods + shipping, so collecting only `codAmount` left the delivery
 * fee unpaid and made reconciliation deduct it from the goods payout a second
 * time. Prepaid orders collect 0.
 *
 * `Delivery.codAmount` itself is left untouched (it is the goods value used by
 * PayHere and the invoice), so this helper is the single courier-facing /
 * printing / reconciliation view.
 */
export function collectableCodAmount(delivery: CodPaymentFields): Decimal {
  if (isPrepaidOrder(delivery)) return new Decimal(0);

  const goods = new Decimal(delivery.codAmount?.toString() ?? '0');
  const shipping = new Decimal(delivery.shippingFee?.toString() ?? '0');
  const total = Decimal.max(goods, 0).plus(Decimal.max(shipping, 0));

  return total.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
