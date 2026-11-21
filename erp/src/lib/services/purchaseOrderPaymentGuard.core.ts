import Decimal from 'decimal.js';

/**
 * Pure guard for applying a purchase-order payment (ARGUS #231).
 *
 * `payPurchaseOrder` reads the paid total and validates the request inside one
 * transaction after locking the PO row, so two concurrent instalments serialise
 * instead of both passing the outstanding check. This helper owns the money
 * arithmetic so the check and the tests cannot drift:
 *
 * - the requested amount must be positive;
 * - an order with nothing outstanding cannot take another payment;
 * - a payment can never exceed the outstanding balance, so the new paid total
 *   can never exceed the payable.
 */

export type PurchaseOrderPaymentRejection =
  | 'NOT_POSITIVE'
  | 'ALREADY_SETTLED'
  | 'EXCEEDS_OUTSTANDING';

export interface PurchaseOrderPaymentEvaluation {
  payable: number;
  paidTotal: number;
  requested: number;
  outstanding: number;
  /** Hypothetical total after this payment (never above the payable when allowed). */
  newPaidTotal: number;
  allowed: boolean;
  rejection: PurchaseOrderPaymentRejection | null;
}

function money(value: Decimal): number {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

function decimal(value: number | string): Decimal {
  const parsed = new Decimal(value);
  return parsed.isFinite() ? parsed : new Decimal(0);
}

export function evaluatePurchaseOrderPayment(
  payable: number | string,
  paidTotal: number | string,
  requested: number | string,
): PurchaseOrderPaymentEvaluation {
  const owed = decimal(payable);
  const paid = decimal(paidTotal);
  const request = decimal(requested);

  const outstanding = money(Decimal.max(0, owed.minus(paid)));
  const newPaidTotal = money(paid.plus(Decimal.max(0, request)));
  const base = {
    payable: money(owed),
    paidTotal: money(paid),
    requested: money(request),
    outstanding,
    newPaidTotal,
  };

  if (request.lessThanOrEqualTo(0)) {
    return { ...base, allowed: false, rejection: 'NOT_POSITIVE' };
  }
  if (outstanding <= 0 || owed.lessThanOrEqualTo(0)) {
    return { ...base, allowed: false, rejection: 'ALREADY_SETTLED' };
  }
  if (request.greaterThan(outstanding)) {
    return { ...base, allowed: false, rejection: 'EXCEEDS_OUTSTANDING' };
  }

  return { ...base, allowed: true, rejection: null };
}
