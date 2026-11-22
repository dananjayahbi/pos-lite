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

/**
 * Completed-purchase spend rules (ARGUS #309).
 *
 * Customer.totalSpend / lastPurchaseAt are denormalised columns that can be
 * stale or seeded, and `_count.sales` counts voided/held sales too. Marketing
 * segments and the contact export must reflect money from COMPLETED sales only.
 */

export interface CompletedSpend {
  totalSpend: number;
  orderCount: number;
  lastPurchaseAt: Date | null;
}

/** A customer with no completed sale has spent 0 and never purchased. */
export const EMPTY_COMPLETED_SPEND: CompletedSpend = {
  totalSpend: 0,
  orderCount: 0,
  lastPurchaseAt: null,
};

export function matchesCompletedSpendRange(
  spend: number,
  minSpend?: number | undefined,
  maxSpend?: number | undefined,
): boolean {
  if (minSpend !== undefined && spend < minSpend) return false;
  if (maxSpend !== undefined && spend > maxSpend) return false;
  return true;
}

/** Ids whose completed spend falls inside the requested range. */
export function filterCustomerIdsBySpend(
  spendByCustomer: Map<string, CompletedSpend>,
  minSpend?: number | undefined,
  maxSpend?: number | undefined,
): string[] {
  const ids: string[] = [];
  for (const [customerId, spend] of spendByCustomer) {
    if (matchesCompletedSpendRange(spend.totalSpend, minSpend, maxSpend)) {
      ids.push(customerId);
    }
  }
  return ids;
}
