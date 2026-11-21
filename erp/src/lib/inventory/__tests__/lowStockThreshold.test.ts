import { describe, expect, it } from 'vitest';

import {
  lowStockThresholdCellLabel,
  lowStockThresholdRuleLabel,
  resolveEffectiveLowStockThreshold,
} from '@/lib/inventory/lowStockThreshold';

/**
 * ARGUS #214 - the list predicate, shortfall, threshold column and CSV must all
 * use the same (override-aware) threshold.
 */
describe('effective low-stock threshold', () => {
  it('uses the variant threshold when no override is active', () => {
    expect(resolveEffectiveLowStockThreshold(5, null)).toEqual({
      applied: 5,
      variant: 5,
      source: 'variant',
      isOverride: false,
    });
    expect(resolveEffectiveLowStockThreshold(5, undefined).applied).toBe(5);
  });

  it('uses the override for every row when it is active', () => {
    expect(resolveEffectiveLowStockThreshold(5, 50)).toEqual({
      applied: 50,
      variant: 5,
      source: 'override',
      isOverride: true,
    });
  });

  it('describes the applied rule for the subtitle', () => {
    expect(lowStockThresholdRuleLabel(null)).toBe(
      "at or below each variant's own low stock threshold",
    );
    expect(lowStockThresholdRuleLabel(50)).toBe(
      'at or below the 50-unit override threshold',
    );
  });

  it('labels the threshold cell with the override when active', () => {
    expect(lowStockThresholdCellLabel(5, null)).toBe('5');
    expect(lowStockThresholdCellLabel(5, 50)).toBe('50 (override)');
  });
});
