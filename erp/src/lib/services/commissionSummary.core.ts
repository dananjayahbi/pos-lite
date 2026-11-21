import Decimal from 'decimal.js';

/**
 * Commission balance rule (ARGUS #337).
 *
 * "Paid" is money that actually left the business, i.e. the sum of
 * `CommissionRecord.paidAmount` written by a `CommissionPayout` allocation.
 * `isPaid` on its own is a derived flag and legacy rows carry `isPaid = true`
 * with `paidAmount = 0` and no payout — those are NOT paid.
 *
 * Kept pure so the staff detail tab, the Commission Reports page and the
 * payroll/payslip summaries all share one definition.
 */

type Decimalish = Decimal | { toString(): string } | number | string | null | undefined;

/** Two-decimal tolerance for "settled" (matches payout rounding). */
const SETTLED_EPSILON = 0.005;

export type CommissionRecordStatus = 'PAID' | 'PARTIAL' | 'UNPAID';

export interface CommissionAmountRow {
  earnedAmount: Decimalish;
  paidAmount?: Decimalish;
  /** Ignored for money math — kept so callers can pass full records. */
  isPaid?: boolean | null | undefined;
  payoutId?: string | null | undefined;
}

export interface CommissionBalance {
  totalEarned: string;
  totalPaid: string;
  /** totalEarned − totalPaid across the full ledger (can be negative for net credits). */
  unpaid: string;
}

export interface CommissionLedgerTotals extends CommissionBalance {
  counts: {
    total: number;
    paid: number;
    partial: number;
    unpaid: number;
  };
}

function toDecimal(value: Decimalish): Decimal {
  if (value === null || value === undefined) return new Decimal(0);
  try {
    return new Decimal(value.toString());
  } catch {
    return new Decimal(0);
  }
}

function round2(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Per-record display status, driven by money only:
 * - PAID    settled by `paidAmount` reaching `earnedAmount`;
 * - PARTIAL some money recorded, balance still open;
 * - UNPAID  no money recorded (including legacy `isPaid` with `paidAmount` 0).
 */
export function getCommissionRecordStatus(row: CommissionAmountRow): CommissionRecordStatus {
  const earned = toDecimal(row.earnedAmount);
  const paid = toDecimal(row.paidAmount);

  if (!earned.isZero() && paid.minus(earned).abs().lessThanOrEqualTo(SETTLED_EPSILON)) {
    return 'PAID';
  }
  if (paid.greaterThan(0) && earned.minus(paid).greaterThan(SETTLED_EPSILON)) {
    return 'PARTIAL';
  }
  return 'UNPAID';
}

/**
 * Balance for a full ledger (or any complete set of records). Deliberately
 * ignores `isPaid`/`payoutId`: only `paidAmount` counts as paid.
 */
export function summarizeCommissionAmounts(
  rows: readonly CommissionAmountRow[],
): CommissionLedgerTotals {
  let earned = new Decimal(0);
  let paid = new Decimal(0);
  const counts = { total: 0, paid: 0, partial: 0, unpaid: 0 };

  for (const row of rows) {
    earned = earned.plus(toDecimal(row.earnedAmount));
    paid = paid.plus(toDecimal(row.paidAmount));

    counts.total += 1;
    const status = getCommissionRecordStatus(row);
    if (status === 'PAID') counts.paid += 1;
    else if (status === 'PARTIAL') counts.partial += 1;
    else counts.unpaid += 1;
  }

  return {
    ...describeCommissionBalance({ totalEarned: earned, totalPaid: paid }),
    counts,
  };
}

/**
 * Format pre-aggregated sums (the shape Prisma `aggregate` returns). Keeping
 * this separate is what makes the summary pagination-independent: the totals
 * come from the ledger aggregates, never from the current page's rows.
 */
export function describeCommissionBalance(input: {
  totalEarned: Decimalish;
  totalPaid: Decimalish;
}): CommissionBalance {
  const earned = toDecimal(input.totalEarned);
  const paid = toDecimal(input.totalPaid);

  return {
    totalEarned: round2(earned).toFixed(2),
    totalPaid: round2(paid).toFixed(2),
    unpaid: round2(earned.minus(paid)).toFixed(2),
  };
}
