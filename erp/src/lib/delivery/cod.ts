import Decimal from 'decimal.js';

type Decimalish = Decimal | { toString(): string } | number | string;

export interface CodPaymentFields {
  codAmount?: Decimalish | null | undefined;
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
 * The amount the courier may actually collect.
 *
 * `Delivery.codAmount` doubles as the goods value (PayHere amount, invoice
 * totals), so it is not zeroed in the database. This helper is the single
 * courier-facing/printing view: prepaid orders collect 0, COD/unpaid orders
 * collect the recorded amount.
 */
export function collectableCodAmount(delivery: CodPaymentFields): Decimal {
  if (isPrepaidOrder(delivery)) return new Decimal(0);
  return Decimal.max(new Decimal(delivery.codAmount?.toString() ?? '0'), 0).toDecimalPlaces(
    2,
    Decimal.ROUND_HALF_UP,
  );
}
