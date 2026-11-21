import Decimal from 'decimal.js';

import { sumPaymentBreakdown } from '@/lib/services/paymentBreakdown';
import type { PaymentLegMethod } from '@/generated/prisma/client';

type Decimalish = Decimal | { toString(): string } | number | string;

export interface ShiftRefundRow {
  refundAmount: Decimalish;
  refundMethod: string;
  /** Tax component of `refundAmount`, when recorded (ARGUS #117). */
  taxAmount?: Decimalish | undefined;
}

export interface ShiftCashMovementRow {
  amount: Decimalish;
  type: string;
}

export interface ShiftAttributionWindow {
  id: string;
  cashierId: string;
  openedAt: Date;
  closedAt: Date | null;
}

export interface ReturnShiftAttribution {
  /** Shift that recorded the sale being returned (null for legacy shiftless sales). */
  originalSaleShiftId: string | null;
  /** Cashier who processed the return. */
  initiatedById: string;
  createdAt: Date;
}

/**
 * Which shift owns a return? (ARGUS #109)
 *
 * A return belongs to the shift that recorded the **original sale**: the money
 * was taken in that drawer, so the refund must be reconciled there even if a
 * different, overlapping shift (or a later shift) processes it. The old
 * `Return.createdAt` window rule counted the same refund in every overlapping
 * shift.
 *
 * Legacy returns whose original sale is shiftless fall back to the return
 * initiator's shift covering `createdAt`. If that cashier has several covering
 * shifts (historical overlap), the one with the latest `openedAt` wins, with
 * the shift id as a deterministic tie-break — so exactly one shift can own the
 * return and it is never guessed onto another cashier's shift.
 */
export function resolveReturnShiftId(
  ret: ReturnShiftAttribution,
  shifts: ShiftAttributionWindow[],
): string | null {
  if (ret.originalSaleShiftId) return ret.originalSaleShiftId;

  const created = ret.createdAt.getTime();
  let owner: ShiftAttributionWindow | null = null;
  for (const shift of shifts) {
    if (shift.cashierId !== ret.initiatedById) continue;
    if (shift.openedAt.getTime() > created) continue;
    if (shift.closedAt && shift.closedAt.getTime() < created) continue;

    if (
      !owner ||
      shift.openedAt.getTime() > owner.openedAt.getTime() ||
      (shift.openedAt.getTime() === owner.openedAt.getTime() && shift.id < owner.id)
    ) {
      owner = shift;
    }
  }
  return owner?.id ?? null;
}

/** Keep the rows this shift owns; never double-count an overlapping shift's rows. */
export function filterReturnsForShift<T extends ReturnShiftAttribution>(
  returns: T[],
  shifts: ShiftAttributionWindow[],
  shiftId: string,
): T[] {
  return returns.filter((ret) => resolveReturnShiftId(ret, shifts) === shiftId);
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

export interface ShiftClosureFigures {
  totalCash: Decimal;
  totalCard: Decimal;
  totalQr: Decimal;
  totalReturns: Decimal;
  totalReturnsCount: number;
  cashRefunds: Decimal;
  cashDeposited: Decimal;
  pettyOut: Decimal;
  expectedCash: Decimal;
}

/**
 * Every figure a shift closure stores, derived from the same payment legs,
 * refunds and cash movements. Used by `closeShift` and the historical
 * recomputation script so a stored closure can always be reproduced
 * (ARGUS #108).
 */
export function computeShiftClosureFigures(input: {
  payments: Array<{ method: PaymentLegMethod; amount: Decimalish }>;
  returns: ShiftRefundRow[];
  cashMovements: ShiftCashMovementRow[];
  openingFloat: Decimalish;
}): ShiftClosureFigures {
  const breakdown = sumPaymentBreakdown(
    input.payments.map((payment) => ({
      method: payment.method,
      amount: new Decimal(payment.amount.toString()),
    })),
  );
  const refunds = sumShiftRefunds(input.returns);
  const { deposited, pettyOut } = sumShiftCashMovements(input.cashMovements);
  const expectedCash = computeExpectedCash({
    openingFloat: input.openingFloat,
    cashSales: breakdown.cash,
    cashRefunds: refunds.cash,
    cashDeposited: deposited,
    pettyCashOut: pettyOut,
  });

  return {
    totalCash: breakdown.cash,
    totalCard: breakdown.card,
    totalQr: breakdown.lankaqr,
    totalReturns: refunds.total,
    totalReturnsCount: input.returns.length,
    cashRefunds: refunds.cash,
    cashDeposited: deposited,
    pettyOut,
    expectedCash,
  };
}

