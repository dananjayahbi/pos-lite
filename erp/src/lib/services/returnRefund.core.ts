import Decimal from 'decimal.js';

import { allocateCartDiscountShares } from '@/lib/services/saleDiscount.core';

type Decimalish = Decimal | { toString(): string } | number | string;

export interface RefundSaleLine {
  id: string;
  quantity: number;
  lineTotalAfterDiscount: Decimalish;
  /** Tax charged on the line at sale time (0 for exempt / legacy rows). */
  lineTax?: Decimalish | null;
  /**
   * Units already returned on completed returns (ARGUS #104). The remaining
   * refund is derived from the remaining balance, not from the original line
   * total, so repeated partial returns cannot leave a rounding residual.
   */
  returnedQuantity?: number;
  /** Goods + tax already refunded for this line (optional on legacy callers). */
  returnedRefundAmount?: Decimalish | null;
  /** Tax already refunded for this line (optional on legacy callers). */
  returnedTaxAmount?: Decimalish | null;
}

export interface RefundSaleForPricing {
  lines: RefundSaleLine[];
  /** Sale-level tax actually collected. */
  taxAmount?: Decimalish | null;
  /**
   * Combined cart-level discount (manual + promotions) applied to the sale.
   * Omitted on legacy callers → treated as 0.
   */
  discountAmount?: Decimalish | null;
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
function allocateLineTax(
  sale: RefundSaleForPricing,
  fallbackBases: Map<string, Decimal>,
): Map<string, Decimal> {
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
    : sale.lines.map((line) => fallbackBases.get(line.id) ?? new Decimal(0));

  const shares = allocateProportionally(weights, saleTax);
  sale.lines.forEach((line, index) => byLine.set(line.id, shares[index]!));
  return byLine;
}

/**
 * Refund for the requested lines, including the tax that was collected.
 *
 * The sale's cart-level discount (manual + promotions) is apportioned across
 * the lines exactly as `createSale` did, so the refund is based on what the
 * customer actually paid — never the list line value. A fully discounted
 * (zero-value) sale therefore refunds zero (ARGUS #91).
 *
 * A line may carry its already-returned quantity and refunded amounts. The
 * refund is then a share of the **remaining** balance, and the final unit
 * return takes exactly that remainder. Three separate 1-of-3 returns on a
 * Rs. 100 line therefore refund 33.33 + 33.34 + 33.33 = 100.00 instead of
 * leaving a 0.01 residual (ARGUS #104).
 *
 * Delivery charges are intentionally excluded: they cover a service already
 * rendered for the original sale and are not part of the returned goods.
 */
export function computeReturnRefund(
  sale: RefundSaleForPricing,
  requestLines: RefundRequestLine[],
): ComputedRefundAmounts {
  // The same proportional allocation the sale used, so the paid base per line
  // matches what was charged (and what tax was computed on).
  const lineTotals = sale.lines.map((line) => toDecimal(line.lineTotalAfterDiscount));
  const discountShares = allocateCartDiscountShares(lineTotals, toDecimal(sale.discountAmount));
  const paidBaseByLine = new Map<string, Decimal>();
  sale.lines.forEach((line, index) => {
    const paidBase = Decimal.max(lineTotals[index]!.minus(discountShares[index]!), 0);
    paidBaseByLine.set(line.id, paidBase);
  });

  const taxByLine = allocateLineTax(sale, paidBaseByLine);

  const lines: ComputedRefundLineAmount[] = [];
  let totalRefund = new Decimal(0);
  let totalTaxRefund = new Decimal(0);

  for (const request of requestLines) {
    const saleLine = sale.lines.find((line) => line.id === request.saleLineId);
    if (!saleLine || saleLine.quantity <= 0 || request.quantity <= 0) continue;

    const originalQty = saleLine.quantity;
    const priorQty = Decimal.min(
      Decimal.max(toDecimal(saleLine.returnedQuantity), 0),
      originalQty,
    );
    const remainingQty = originalQty - priorQty.toNumber();
    if (remainingQty <= 0) continue;

    const quantity = Math.min(request.quantity, remainingQty);
    const lineTax = taxByLine.get(saleLine.id) ?? new Decimal(0);
    const lineTotal = (paidBaseByLine.get(saleLine.id) ?? new Decimal(0)).plus(lineTax);

    // Unknown prior amounts (legacy callers) are estimated pro-rata from the
    // already-returned quantity; an explicit zero means "nothing refunded yet".
    const priorRefund =
      saleLine.returnedRefundAmount === undefined || saleLine.returnedRefundAmount === null
        ? priorQty.gt(0)
          ? lineTotal.mul(priorQty).div(originalQty).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          : new Decimal(0)
        : toDecimal(saleLine.returnedRefundAmount);
    const priorTax =
      saleLine.returnedTaxAmount === undefined || saleLine.returnedTaxAmount === null
        ? priorQty.gt(0)
          ? lineTax.mul(priorQty).div(originalQty).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          : new Decimal(0)
        : toDecimal(saleLine.returnedTaxAmount);

    const remainingRefund = Decimal.max(lineTotal.minus(priorRefund), 0);
    const remainingTax = Decimal.max(lineTax.minus(priorTax), 0);
    const remainingGoods = Decimal.max(remainingRefund.minus(remainingTax), 0);

    const isFinal = quantity >= remainingQty;
    const ratio = isFinal ? new Decimal(1) : new Decimal(quantity).div(remainingQty);
    const goodsRefund = isFinal
      ? remainingGoods
      : remainingGoods.mul(ratio).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const taxRefund = isFinal
      ? remainingTax
      : remainingTax.mul(ratio).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const lineRefundAmount = goodsRefund.plus(taxRefund);

    totalRefund = totalRefund.plus(lineRefundAmount);
    totalTaxRefund = totalTaxRefund.plus(taxRefund);

    lines.push({
      saleLineId: saleLine.id,
      quantity,
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
