import Decimal from 'decimal.js';

type Decimalish = Decimal | { toString(): string } | number | string;

export interface RefundSaleLine {
  id: string;
  quantity: number;
  lineTotalAfterDiscount: Decimalish;
  /** Tax charged on the line at sale time (0 for exempt / legacy rows). */
  lineTax?: Decimalish | null;
}

export interface RefundSaleForPricing {
  lines: RefundSaleLine[];
  /** Sale-level tax actually collected. */
  taxAmount?: Decimalish | null;
}

export interface RefundRequestLine {
  saleLineId: string;
  quantity: number;
}

export interface ComputedRefundLineAmount {
  saleLineId: string;
  quantity: number;
  /** Goods part of the refund (pre-tax). */
  goodsRefund: Decimal;
  /** Tax part of the refund. */
  taxRefund: Decimal;
  /** Total refund for the line, including tax. */
  lineRefundAmount: Decimal;
}

export interface ComputedRefundAmounts {
  lines: ComputedRefundLineAmount[];
  totalRefund: Decimal;
  totalTaxRefund: Decimal;
}

function toDecimal(value: Decimalish | null | undefined): Decimal {
  return new Decimal(value?.toString() ?? '0');
}

/**
 * Spread `total` across `weights` in proportion, rounded to 2dp, with the
 * rounding remainder moved onto the largest weight so the shares sum exactly.
 */
function allocateProportionally(weights: Decimal[], total: Decimal): Decimal[] {
  if (weights.length === 0) return [];

  const weightSum = weights.reduce((sum, weight) => sum.plus(weight), new Decimal(0));
  if (total.lessThanOrEqualTo(0) || weightSum.lessThanOrEqualTo(0)) {
    return weights.map(() => new Decimal(0));
  }

  const shares = weights.map((weight) =>
    total.mul(weight).div(weightSum).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
  );
  const allocated = shares.reduce((sum, share) => sum.plus(share), new Decimal(0));
  const remainder = total.minus(allocated);

  if (!remainder.isZero()) {
    let largestIndex = 0;
    for (let index = 1; index < weights.length; index += 1) {
      if (weights[index]!.greaterThan(weights[largestIndex]!)) largestIndex = index;
    }
    shares[largestIndex] = shares[largestIndex]!.plus(remainder);
  }

  return shares.map((share) => Decimal.max(share, 0));
}

/**
 * Tax per sale line to refund.
 *
 * New sales snapshot `SaleLine.lineTax`, so the refund returns exactly what was
 * charged. Legacy sales (and any row where no line tax was recorded) fall back
 * to apportioning the sale-level tax across the lines: by the recorded line tax
 * when some lines have it, otherwise by the post-discount line total.
 */
function allocateLineTax(sale: RefundSaleForPricing): Map<string, Decimal> {
  const saleTax = toDecimal(sale.taxAmount);
  const byLine = new Map<string, Decimal>();

  const recorded = sale.lines.map((line) => toDecimal(line.lineTax));
  const recordedTotal = recorded.reduce((sum, tax) => sum.plus(tax), new Decimal(0));

  if (saleTax.lessThanOrEqualTo(0)) {
    sale.lines.forEach((line) => byLine.set(line.id, new Decimal(0)));
    return byLine;
  }

  const weights = recordedTotal.greaterThan(0)
    ? recorded
    : sale.lines.map((line) => new Decimal(toDecimal(line.lineTotalAfterDiscount)));

  const shares = allocateProportionally(weights, saleTax);
  sale.lines.forEach((line, index) => byLine.set(line.id, shares[index]!));
  return byLine;
}

/**
 * Refund for the requested lines, including the tax that was collected.
 *
 * Delivery charges are intentionally excluded: they cover a service already
 * rendered for the original sale and are not part of the returned goods.
 */
export function computeReturnRefund(
  sale: RefundSaleForPricing,
  requestLines: RefundRequestLine[],
): ComputedRefundAmounts {
  const taxByLine = allocateLineTax(sale);
  const lines: ComputedRefundLineAmount[] = [];
  let totalRefund = new Decimal(0);
  let totalTaxRefund = new Decimal(0);

  for (const request of requestLines) {
    const saleLine = sale.lines.find((line) => line.id === request.saleLineId);
    if (!saleLine || saleLine.quantity <= 0 || request.quantity <= 0) continue;

    const ratio = new Decimal(request.quantity).div(saleLine.quantity);
    const goodsRefund = ratio
      .mul(toDecimal(saleLine.lineTotalAfterDiscount))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const taxRefund = ratio
      .mul(taxByLine.get(saleLine.id) ?? new Decimal(0))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const lineRefundAmount = goodsRefund.plus(taxRefund);

    totalRefund = totalRefund.plus(lineRefundAmount);
    totalTaxRefund = totalTaxRefund.plus(taxRefund);

    lines.push({
      saleLineId: saleLine.id,
      quantity: request.quantity,
      goodsRefund,
      taxRefund,
      lineRefundAmount,
    });
  }

  return {
    lines,
    totalRefund: totalRefund.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    totalTaxRefund: totalTaxRefund.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
  };
}
