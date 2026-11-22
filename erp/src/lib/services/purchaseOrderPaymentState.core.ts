/**
 * Payment state for a purchase order (ARGUS #228).
 *
 * `PurchaseOrder.paidAt` is stamped only when the accumulated payments cover the
 * whole payable amount, so a list that keys "Paid" off `paidAt` reports every
 * partially paid order as "Unpaid" even though money was received. The list
 * therefore derives its state from the paid total and the server-computed
 * payable, exactly like the payment API caps instalments.
 */
import Decimal from 'decimal.js';

export type PurchaseOrderPaymentState = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export interface PurchaseOrderPaymentSummary {
  paidTotal: number;
  payable: number;
  outstanding: number;
  state: PurchaseOrderPaymentState;
}

function money(value: number | string): number {
  const parsed = new Decimal(value);
  if (!parsed.isFinite()) return 0;
  return parsed.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * - no money applied -> UNPAID (even when the payable is zero);
 * - money covers a positive payable -> PAID;
 * - anything in between -> PARTIALLY_PAID, with the amount still outstanding.
 *
 * An overpayment is clamped to zero outstanding rather than a negative figure.
 */
export function computePurchaseOrderPaymentState(
  payable: number | string,
  paidTotal: number | string,
): PurchaseOrderPaymentSummary {
  const owed = money(payable);
  const paid = money(paidTotal);
  const outstanding = Math.max(0, money(owed - paid));

  let state: PurchaseOrderPaymentState;
  if (paid <= 0) {
    state = 'UNPAID';
  } else if (owed > 0 && paid >= owed) {
    state = 'PAID';
  } else {
    state = 'PARTIALLY_PAID';
  }

  return { paidTotal: paid, payable: owed, outstanding, state };
}
