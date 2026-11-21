import Decimal from 'decimal.js';

type Decimalish = Decimal | { toString(): string } | number | string;

/**
 * Lifetime spend after voiding a sale (ARGUS #308).
 *
 * Sales increment `Customer.totalSpend` at creation; a void must subtract the
 * sale value without ever driving the lifetime figure negative (e.g. when the
 * customer's spend was manually adjusted, or a historical bug left it lower).
 */
export function netSpendAfterVoid(currentSpend: Decimalish, voidedAmount: Decimalish): Decimal {
  return Decimal.max(
    new Decimal(currentSpend.toString()).minus(new Decimal(voidedAmount.toString())),
    0,
  ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
