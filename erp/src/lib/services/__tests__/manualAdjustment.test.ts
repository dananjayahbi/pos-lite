import { describe, expect, it } from 'vitest';

import {
  MANUAL_ADJUSTMENT_REASONS,
  isManualAdjustmentReason,
} from '@/lib/services/manualAdjustment.core';

/**
 * ARGUS #181 — system-only movement reasons must never be accepted as manual
 * adjustments.
 */
describe('manual adjustment reasons', () => {
  it('lists exactly the five manual reasons', () => {
    expect([...MANUAL_ADJUSTMENT_REASONS]).toEqual([
      'FOUND',
      'DAMAGED',
      'STOLEN',
      'DATA_ERROR',
      'RETURNED_TO_SUPPLIER',
    ]);
  });

  it('accepts every manual reason', () => {
    for (const reason of MANUAL_ADJUSTMENT_REASONS) {
      expect(isManualAdjustmentReason(reason)).toBe(true);
    }
  });

  it.each([
    'SALE',
    'VOID_REVERSAL',
    'PURCHASE_RECEIVED',
    'SALE_RETURN',
    'INITIAL_STOCK',
    'STOCK_TAKE_ADJUSTMENT',
    'NOT_A_REASON',
    '',
    null,
    undefined,
  ])('rejects system-only or unknown reason %s', (reason) => {
    expect(isManualAdjustmentReason(reason)).toBe(false);
  });
});
