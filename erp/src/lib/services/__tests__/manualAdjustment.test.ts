import { describe, expect, it } from 'vitest';

import {
  MANUAL_ADJUSTMENT_REASONS,
  isManualAdjustmentReason,
  isManualReasonDirectionValid,
  manualAdjustmentDirectionError,
  validManualReasonsForDirection,
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

describe('manual adjustment reason direction (ARGUS #193)', () => {
  it('allows Found and Data Error in both directions', () => {
    for (const reason of ['FOUND', 'DATA_ERROR'] as const) {
      expect(isManualReasonDirectionValid(reason, 5)).toBe(true);
      expect(isManualReasonDirectionValid(reason, -5)).toBe(true);
    }
  });

  it('only allows loss reasons when removing stock', () => {
    for (const reason of ['DAMAGED', 'STOLEN', 'RETURNED_TO_SUPPLIER'] as const) {
      expect(isManualReasonDirectionValid(reason, -3)).toBe(true);
      expect(isManualReasonDirectionValid(reason, 3)).toBe(false);
      expect(manualAdjustmentDirectionError(reason, 3)).toContain('removing stock');
    }
  });

  it('rejects zero and unknown reasons', () => {
    expect(isManualReasonDirectionValid('FOUND', 0)).toBe(false);
    expect(isManualReasonDirectionValid('SALE', 1)).toBe(false);
    expect(manualAdjustmentDirectionError('FOUND', 0)).toContain('cannot be zero');
    expect(manualAdjustmentDirectionError('SALE', 1)).toBeNull();
  });

  it('derives the selectable reasons for each direction', () => {
    expect([...validManualReasonsForDirection('add')]).toEqual([
      'FOUND',
      'DATA_ERROR',
    ]);
    expect([...validManualReasonsForDirection('remove')]).toEqual([
      'FOUND',
      'DAMAGED',
      'STOLEN',
      'DATA_ERROR',
      'RETURNED_TO_SUPPLIER',
    ]);
  });

  it('keeps every direction-filtered reason valid for that direction', () => {
    for (const direction of ['add', 'remove'] as const) {
      const delta = direction === 'add' ? 1 : -1;
      for (const reason of validManualReasonsForDirection(direction)) {
        expect(isManualReasonDirectionValid(reason, delta), `${reason} ${direction}`).toBe(true);
      }
    }
  });

  it('covers every manual reason in the direction map', () => {
    for (const reason of MANUAL_ADJUSTMENT_REASONS) {
      const directions = (['add', 'remove'] as const).filter((d) =>
        validManualReasonsForDirection(d).includes(reason),
      );
      expect(directions.length, reason).toBeGreaterThan(0);
    }
  });
});
