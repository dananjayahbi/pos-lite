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

export interface CommissionAllocationSummary {
  recordCount: number;
  /** Paid against positive earning records (includes netted adjustments). */
  grossAllocated: string;
  /** Absolute negative return adjustments settled in this payout. */
  adjustmentsSettled: string;
  /** Cash paid: grossAllocated - adjustmentsSettled. */
  netAllocated: string;
}

export function summarizeCommissionAllocation(
  records: readonly OpenCommissionRecord[],
  allocations: readonly CommissionAllocation[],
): CommissionAllocationSummary {
  const byId = new Map(records.map((record) => [record.id, record]));
  let gross = new Decimal(0);
  let adjustments = new Decimal(0);
  let count = 0;

  for (const allocation of allocations) {
    const record = byId.get(allocation.id);
    if (!record) continue;
    count += 1;
    const delta = new Decimal(allocation.newPaid).minus(record.paid);
    if (record.earned.gt(0)) gross = gross.plus(delta);
    else if (record.earned.lt(0)) adjustments = adjustments.plus(delta.abs());
  }

  const net = gross.minus(adjustments);
  return {
    recordCount: count,
    grossAllocated: gross.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
    adjustmentsSettled: adjustments.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
    netAllocated: net.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
  };
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
 * Allocate `amount` against the open records using a documented net model.
 *
 * Negative return adjustments are settled first against positive earnings:
 * they do not consume cash but reduce what the positive records owe. The cash
 * payment is then allocated to positive records oldest-first. Algebraically:
 *
 *   gross allocated = cash payment + negative adjustments settled
 *   net paid        = gross allocated - negative adjustments settled
 *
 * so the sum of per-record paidAmount changes always equals the cash payout,
 * and partial payouts keep receipts tied to the net liability instead of
 * leaving negatives open until a full settlement.
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

  if (payment.lte(0) || netOutstanding.lte(0)) return [];

  const allocated = new Map<string, CommissionAllocation>();
  let adjustmentCapacity = new Decimal(0);

  for (const record of records) {
    if (record.outstanding.gte(0)) continue;
    // Settle the remaining negative adjustment against the positive side.
    allocated.set(record.id, {
      id: record.id,
      newPaid: record.earned.toFixed(2),
      isPaid: true,
    });
    adjustmentCapacity = adjustmentCapacity.plus(record.outstanding.abs());
  }

  let remaining = payment.plus(adjustmentCapacity);
  for (const record of records) {
    if (record.outstanding.lte(0)) continue;
    if (remaining.lte(0)) break;

    const take = Decimal.min(record.outstanding, remaining);
    const newPaid = record.paid.plus(take);
    allocated.set(record.id, {
      id: record.id,
      newPaid: newPaid.toFixed(2),
      isPaid: newPaid.gte(record.earned.minus(0.005)),
    });
    remaining = remaining.minus(take);
  }

  // Preserve the caller's oldest-first order for deterministic writes/tests.
  return records
    .filter((record) => allocated.has(record.id))
    .map((record) => allocated.get(record.id)!);
}
