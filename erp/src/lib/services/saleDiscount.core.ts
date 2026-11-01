import Decimal from 'decimal.js';

/**
 * Split a cart-level discount across the cart's lines.
 *
 * The sales API taxes each line on what the customer actually pays for it, so
 * the cart discount (manual + promotions) has to be apportioned before tax is
 * computed. Shares are proportional to each line's post-line-discount total,
 * rounded to 2dp; the last line absorbs the rounding remainder so the shares
 * sum to the discount exactly. A share can never exceed its line total.
 */
export function allocateCartDiscountShares(
  lineTotals: Decimal[],
  cartDiscount: Decimal,
): Decimal[] {
  if (lineTotals.length === 0) return [];

  const subtotal = lineTotals.reduce((sum, total) => sum.plus(total), new Decimal(0));
  const discount = Decimal.max(cartDiscount, 0);

  if (subtotal.isZero() || discount.isZero()) {
    return lineTotals.map(() => new Decimal(0));
  }

  const shares: Decimal[] = [];
  let allocated = new Decimal(0);

  lineTotals.forEach((lineTotal, index) => {
    const isLast = index === lineTotals.length - 1;
    const share = isLast
      ? discount.minus(allocated)
      : discount
          .mul(lineTotal)
          .div(subtotal)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const bounded = Decimal.min(Decimal.max(share, 0), Decimal.max(lineTotal, 0));
    shares.push(bounded.toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
    allocated = allocated.plus(bounded);
  });

  return shares;
}
