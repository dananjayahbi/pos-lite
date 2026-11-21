import Decimal from 'decimal.js';

/**
 * ARGUS #117: "Net Revenue" must compare sales and refunds on the same tax
 * basis.
 *
 * `Sale.totalAmount` includes tax. Refunds are stored as the amount the
 * customer received; `Return.taxAmount` records how much of it was tax. The old
 * formula (`totalSalesAmount - totalRefundAmount`) subtracted a refund total
 * that could be pre-tax from a tax-inclusive sales total, overstating revenue.
 *
 * Both sides are reduced to their goods (tax-exclusive) value before the
 * subtraction:
 *
 *   net = (sales - salesTax) - (refund - refundTax)
 *
 * Legacy refunds recorded before tax tracking carry `taxAmount = 0` and a
 * goods-only `refundAmount`, so they land on the same basis automatically.
 */

type Decimalish = { toString(): string } | number | string;

export interface NetRevenueInput {
  /** Tax-inclusive completed-sales total. */
  salesTotal: Decimalish;
  /** Tax component of the completed sales. */
  salesTax: Decimalish;
  /** Refund total (tax-inclusive where recorded). */
  refundTotal: Decimalish;
  /** Tax component of the refunds (0 for legacy rows). */
  refundTax: Decimalish;
}

export function netRevenueOnSameTaxBasis(input: NetRevenueInput): Decimal {
  const salesGoods = new Decimal(input.salesTotal.toString()).minus(
    new Decimal(input.salesTax.toString()),
  );
  const refundGoods = new Decimal(input.refundTotal.toString()).minus(
    new Decimal(input.refundTax.toString()),
  );
  return salesGoods
    .minus(refundGoods)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
