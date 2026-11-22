import { describe, expect, it } from 'vitest';

import { computeStockTakeApprovalPlan } from '@/lib/services/stockTakeApproval.core';

/**
 * ARGUS #138: approval must reconcile the physical count with the stock level at
 * approval time, not the level captured when the count started.
 */
describe('computeStockTakeApprovalPlan', () => {
  it('applies the delta against current stock, not the session snapshot', () => {
    const plan = computeStockTakeApprovalPlan(
      [
        {
          variantId: 'DAB-05-CAP-120CAPS',
          systemQuantity: 48,
          countedQuantity: 48,
          discrepancy: 0,
        },
      ],
      () => 50,
    );

    expect(plan.missingVariantIds).toEqual([]);
    expect(plan.adjustments).toEqual([
      {
        variantId: 'DAB-05-CAP-120CAPS',
        systemQuantity: 48,
        countedQuantity: 48,
        currentQuantity: 50,
        quantityDelta: -2,
      },
    ]);
  });

  it('keeps the legacy behaviour when stock has not moved', () => {
    const plan = computeStockTakeApprovalPlan(
      [{ variantId: 'v1', systemQuantity: 10, countedQuantity: 7, discrepancy: -3 }],
      () => 10,
    );

    expect(plan.adjustments[0]?.quantityDelta).toBe(-3);
  });

  it('adds stock that arrived after the count', () => {
    const plan = computeStockTakeApprovalPlan(
      [{ variantId: 'v1', systemQuantity: 10, countedQuantity: 12, discrepancy: 2 }],
      () => 8,
    );

    expect(plan.adjustments[0]?.quantityDelta).toBe(4);
  });

  it('produces no adjustment when the count equals current stock', () => {
    const plan = computeStockTakeApprovalPlan(
      [{ variantId: 'v1', systemQuantity: 10, countedQuantity: 12, discrepancy: 2 }],
      () => 12,
    );

    expect(plan.adjustments[0]?.quantityDelta).toBe(0);
  });

  it('ignores uncounted items', () => {
    const plan = computeStockTakeApprovalPlan(
      [{ variantId: 'v1', systemQuantity: 10, countedQuantity: null, discrepancy: null }],
      () => 10,
    );

    expect(plan.adjustments).toEqual([]);
    expect(plan.missingVariantIds).toEqual([]);
  });

  it('reports variants that disappeared instead of using a stale delta', () => {
    const plan = computeStockTakeApprovalPlan(
      [{ variantId: 'gone', systemQuantity: 5, countedQuantity: 5, discrepancy: 0 }],
      () => undefined,
    );

    expect(plan.adjustments).toEqual([]);
    expect(plan.missingVariantIds).toEqual(['gone']);
  });

  it('never produces negative stock when the snapshot is stale (ARGUS #207)', () => {
    // Snapshot 50, stock has since fallen to 0, the operator counted 10. The
    // old current + (counted - snapshot) produced -40; approval must set 10.
    const plan = computeStockTakeApprovalPlan(
      [{ variantId: 'v1', systemQuantity: 50, countedQuantity: 10, discrepancy: -40 }],
      () => 0,
    );

    const adjustment = plan.adjustments[0]!;
    expect(adjustment.quantityDelta).toBe(10);
    expect(adjustment.currentQuantity + adjustment.quantityDelta).toBe(10);
    expect(adjustment.currentQuantity + adjustment.quantityDelta).toBeGreaterThanOrEqual(0);
  });
});
