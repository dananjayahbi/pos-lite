import { describe, expect, it } from 'vitest';

import { planCommissionReversal } from '@/lib/services/commissionClawback.core';

/**
 * ARGUS #361 — commission on returned/voided sales.
 *
 * The ledger is reconciled to a target base: a void removes the whole base, a
 * return removes the refunded share, and a repeated reconciliation is a no-op.
 */
const base = { originalBase: 1000, commissionRate: 10, existingBase: 1000 };

describe('planCommissionReversal', () => {
  it('claws the full commission when the sale is voided', () => {
    const plan = planCommissionReversal({ ...base, voided: true });
    expect(plan.targetBase.toNumber()).toBe(0);
    expect(plan.adjustmentBase.toNumber()).toBe(-1000);
    expect(plan.adjustmentEarned.toNumber()).toBe(-100);
    expect(plan.createsOutstandingAdjustment).toBe(true);
    expect(plan.noop).toBe(false);
  });

  it('reduces commission by the refunded share of a partial return', () => {
    const plan = planCommissionReversal({ ...base, returnedBase: 250 });
    expect(plan.targetBase.toNumber()).toBe(750);
    expect(plan.adjustmentBase.toNumber()).toBe(-250);
    expect(plan.adjustmentEarned.toNumber()).toBe(-25);
  });

  it('claws everything when the return refunds the whole sale', () => {
    const plan = planCommissionReversal({ ...base, returnedBase: 1000 });
    expect(plan.targetBase.toNumber()).toBe(0);
    expect(plan.adjustmentEarned.toNumber()).toBe(-100);
  });

  it('never lets an over-refund drive the target base negative', () => {
    const plan = planCommissionReversal({ ...base, returnedBase: 1200 });
    expect(plan.targetBase.toNumber()).toBe(0);
    expect(plan.adjustmentBase.toNumber()).toBe(-1000);
  });

  it('is idempotent: a second reconciliation after the clawback is a no-op', () => {
    const first = planCommissionReversal({ ...base, returnedBase: 250 });
    expect(first.adjustmentBase.toNumber()).toBe(-250);

    const replay = planCommissionReversal({
      ...base,
      returnedBase: 250,
      existingBase: 1000 + first.adjustmentBase.toNumber(), // 750
    });
    expect(replay.adjustmentBase.toNumber()).toBe(0);
    expect(replay.adjustmentEarned.toNumber()).toBe(0);
    expect(replay.noop).toBe(true);
  });

  it('reconciles a second partial return against the already-clawed ledger', () => {
    const plan = planCommissionReversal({
      ...base,
      returnedBase: 500,
      existingBase: 750, // first 250 return already clawed
    });
    expect(plan.targetBase.toNumber()).toBe(500);
    expect(plan.adjustmentBase.toNumber()).toBe(-250);
    expect(plan.adjustmentEarned.toNumber()).toBe(-25);
  });

  it('still emits the negative adjustment when the original was already paid', () => {
    // Paid money is never mutated; the new row stays unpaid/outstanding so the
    // next payout nets it (#337 paidAmount/payout model).
    const plan = planCommissionReversal({ ...base, returnedBase: 400 });
    expect(plan.createsOutstandingAdjustment).toBe(true);
    expect(plan.adjustmentEarned.lt(0)).toBe(true);
  });

  it('does not invent a positive adjustment when the ledger is already under target', () => {
    // e.g. a previous over-clawback; the plan never adds commission back.
    const plan = planCommissionReversal({ ...base, returnedBase: 100, existingBase: 500 });
    expect(plan.targetBase.toNumber()).toBe(900);
    expect(plan.adjustmentBase.toNumber()).toBe(0);
    expect(plan.noop).toBe(true);
  });

  it('handles a zero-original commission without throwing', () => {
    const plan = planCommissionReversal({
      originalBase: 0,
      commissionRate: 10,
      existingBase: 0,
    });
    expect(plan.noop).toBe(true);
  });
});
