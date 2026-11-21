import Decimal from 'decimal.js';

type Decimalish = Decimal | { toString(): string } | number | string;

export interface ShiftRefundRow {
  refundAmount: Decimalish;
  refundMethod: string;
}

export interface ShiftCashMovementRow {
  amount: Decimalish;
  type: string;
}

/**
 * Expected cash in the drawer, shared by the close snapshot, the shift-detail
 * API and the Z-report so all three can never disagree (ARGUS #106).
 *
 * Opening float + cash tenders − cash refunds + cash deposited − petty cash out.
 * Cash tenders include the cash leg of SPLIT sales; tender totals come from
 * payment legs, never from `Sale.paymentMethod`.
 */
export function computeExpectedCash(input: {
  openingFloat: Decimalish;
  cashSales: Decimalish;
  cashRefunds: Decimalish;
  cashDeposited: Decimalish;
  pettyCashOut: Decimalish;
}): Decimal {
  return new Decimal(input.openingFloat.toString())
    .plus(new Decimal(input.cashSales.toString()))
    .minus(new Decimal(input.cashRefunds.toString()))
    .plus(new Decimal(input.cashDeposited.toString()))
    .minus(new Decimal(input.pettyCashOut.toString()))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function sumShiftRefunds(returns: ShiftRefundRow[]): {
  total: Decimal;
  cash: Decimal;
} {
  let total = new Decimal(0);
  let cash = new Decimal(0);
  for (const row of returns) {
    const amount = new Decimal(row.refundAmount.toString());
    total = total.plus(amount);
    if (row.refundMethod === 'CASH') cash = cash.plus(amount);
  }
  return { total, cash };
}

export function sumShiftCashMovements(movements: ShiftCashMovementRow[]): {
  deposited: Decimal;
  pettyOut: Decimal;
} {
  let deposited = new Decimal(0);
  let pettyOut = new Decimal(0);
  for (const movement of movements) {
    const amount = new Decimal(movement.amount.toString());
    if (movement.type === 'MANUAL_IN') {
      deposited = deposited.plus(amount);
    } else if (movement.type === 'PETTY_CASH_OUT' || movement.type === 'MANUAL_OUT') {
      pettyOut = pettyOut.plus(amount);
    }
  }
  return { deposited, pettyOut };
}
