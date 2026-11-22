/**
 * Promotion stacking rules (ARGUS #322).
 *
 * Percentages used to be computed on the original subtotal and summed, so a 15%
 * category + 10% cart + 10% code took 35% instead of the sequential 31.15%, and
 * nothing prevented the total from exceeding the cart.
 *
 * Rule: line-level promotions (customer pricing, product, category, BOGO) are
 * applied first and are exclusive per line. The best cart-level promotion then
 * applies to what is left, and the promo code applies to what remains after
 * that. Every step is capped at the remaining amount, so the total can never
 * exceed the subtotal.
 */

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function remainingAfterDiscounts(subtotal: number, discounts: number[]): number {
  const total = discounts.reduce((sum, discount) => sum + discount, 0);
  return roundMoney(Math.max(0, subtotal - total));
}

/** Apply a percentage to a remaining base, capped at that base. */
export function applyPercentageToRemaining(remaining: number, percent: number): number {
  if (remaining <= 0) return 0;
  return roundMoney(Math.min(remaining, Math.max(0, remaining * (percent / 100))));
}

/** Apply a fixed amount to a remaining base, capped at that base. */
export function applyFixedToRemaining(remaining: number, amount: number): number {
  if (remaining <= 0) return 0;
  return roundMoney(Math.min(remaining, Math.max(0, amount)));
}
