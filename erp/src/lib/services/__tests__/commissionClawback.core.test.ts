import { describe, expect, it } from 'vitest';

import {
  planCommissionReversal,
  resolveCommissionSaleDate,
  resolveOriginalCommissionBase,
  resolveOriginalCommissionRate,
} from '@/lib/services/commissionClawback.core';

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

/**
 * ARGUS #345 — the earning and reversal bases are both the tax-inclusive sale
 * total. A full VAT-inclusive refund must reverse the whole commission.
 */
describe('tax-inclusive reversal base (ARGUS #345)', () => {
  it('zeros the commission when the full tax-inclusive total is refunded', () => {
    const plan = planCommissionReversal({
      originalBase: 1100, // sale 1000 goods + 100 VAT
      commissionRate: 10,
      saleBase: 1100,
      returnedBase: 1100, // Return.refundAmount includes the VAT
      existingBase: 1100,
    });
    expect(plan.targetBase.toNumber()).toBe(0);
    expect(plan.adjustmentBase.toNumber()).toBe(-1100);
    expect(plan.adjustmentEarned.toNumber()).toBe(-110);
  });

  it('reverses the same tax-inclusive share on a partial return', () => {
    const plan = planCommissionReversal({
      originalBase: 1100,
      commissionRate: 10,
      saleBase: 1100,
      returnedBase: 550,
      existingBase: 1100,
    });
    expect(plan.targetBase.toNumber()).toBe(550);
    expect(plan.adjustmentBase.toNumber()).toBe(-550);
    expect(plan.adjustmentEarned.toNumber()).toBe(-55);
  });

  it('scales the refund to a legacy original base that differs from the sale total', () => {
    const plan = planCommissionReversal({
      originalBase: 1000, // legacy row earned before a later sale amendment
      commissionRate: 10,
      saleBase: 1100,
      returnedBase: 1100,
      existingBase: 1000,
    });
    expect(plan.targetBase.toNumber()).toBe(0);
    expect(plan.adjustmentBase.toNumber()).toBe(-1000);
  });
});

describe('original commission basis (ARGUS #345)', () => {
  it('uses the stored rate of the single original record, not a current rate', () => {
    expect(
      resolveOriginalCommissionRate([
        { baseAmount: 1100, earnedAmount: 55, commissionRate: 5 },
      ]).toNumber(),
    ).toBe(5);
  });

  it('uses the earned/base weighted rate for mixed legacy records', () => {
    expect(
      resolveOriginalCommissionRate([
        { baseAmount: 1000, earnedAmount: 50, commissionRate: 5 },
        { baseAmount: 1000, earnedAmount: 100, commissionRate: 10 },
      ]).toNumber(),
    ).toBe(7.5);
  });

  it('sums only positive original bases', () => {
    expect(
      resolveOriginalCommissionBase([
        { baseAmount: 1000, earnedAmount: 100, commissionRate: 10 },
        { baseAmount: -200, earnedAmount: -20, commissionRate: 10 },
      ]).toNumber(),
    ).toBe(1000);
  });

  it('dates the reversal by the sale, not by the return', () => {
    const created = new Date('2026-10-01T10:00:00Z');
    const completed = new Date('2026-10-01T10:05:00Z');
    expect(resolveCommissionSaleDate({ createdAt: created, completedAt: completed })).toBe(
      completed,
    );
    expect(resolveCommissionSaleDate({ createdAt: created, completedAt: null })).toBe(created);
  });
});
