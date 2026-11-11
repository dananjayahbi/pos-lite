import Decimal from 'decimal.js';

/**
 * Pure commission payout allocation.
 *
 * Commission records can be settled partially: the owner pays Rs. 100 of a
 * Rs. 144.39 balance, leaving Rs. 44.39 open for next month. This module owns
 * the oldest-first allocation so the database transaction and the unit tests
 * use exactly the same arithmetic.
 */

export interface CommissionRecordBalance {
  id: string;
  earnedAmount: Decimal.Value;
  paidAmount: Decimal.Value;
  createdAt?: Date;
}

export interface OpenCommissionRecord extends CommissionRecordBalance {
  earned: Decimal;
  paid: Decimal;
  outstanding: Decimal;
}

export interface CommissionAllocation {
  id: string;
  /** New cumulative paid amount, cents-rounded. */
  newPaid: string;
  /** True when this record is now fully settled. */
  isPaid: boolean;
}

export function summarizeOpenCommission(records: CommissionRecordBalance[]): {
  netOutstanding: Decimal;
  records: OpenCommissionRecord[];
} {
  const open = records
    .map((record) => {
      const earned = new Decimal(record.earnedAmount.toString());
      const paid = new Decimal(record.paidAmount.toString());
      return { ...record, earned, paid, outstanding: earned.minus(paid) };
    })
    .filter((record) => !record.outstanding.isZero())
    .sort(
      (a, b) =>
        (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0) ||
        a.id.localeCompare(b.id),
    );

  const netOutstanding = open.reduce(
    (sum, record) => sum.plus(record.outstanding),
    new Decimal(0),
  );

  return { netOutstanding, records: open };
}

/**
 * Allocate `amount` against the open records.
 *
 * - Full settlement (amount ≥ net outstanding) settles every record, including
 *   negative commission adjustments created by refunds.
 * - A partial payment walks positive outstanding records oldest-first; negative
 *   adjustments stay open until a full settlement.
 */
export function allocateCommissionPayment(
  records: OpenCommissionRecord[],
  amount: Decimal.Value,
): CommissionAllocation[] {
  const payment = new Decimal(amount);
  const netOutstanding = records.reduce(
    (sum, record) => sum.plus(record.outstanding),
    new Decimal(0),
  );

  if (payment.gte(netOutstanding.minus(0.005))) {
    return records.map((record) => ({
      id: record.id,
      newPaid: record.earned.toFixed(2),
      isPaid: true,
    }));
  }

  const allocations: CommissionAllocation[] = [];
  let remaining = payment;

  for (const record of records) {
    if (remaining.lte(0)) break;
    if (record.outstanding.lte(0)) continue;

    const take = Decimal.min(record.outstanding, remaining);
    const newPaid = record.paid.plus(take);
    allocations.push({
      id: record.id,
      newPaid: newPaid.toFixed(2),
      isPaid: newPaid.gte(record.earned),
    });
    remaining = remaining.minus(take);
  }

  return allocations;
}
