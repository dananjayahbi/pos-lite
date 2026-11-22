import { describe, expect, it } from 'vitest';

import { ApiError } from '@/lib/api/errors';
import {
  assertRawMaterialDeletable,
  assertRawMaterialUnitChangeAllowed,
} from '@/lib/services/rawMaterialGuards.core';

/** ARGUS #241: delete and unit edits used to write stock off silently. */
function apiErrorOf(run: () => void): ApiError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error('expected the guard to throw');
}

describe('assertRawMaterialDeletable', () => {
  it('allows deletion when the material is empty and unused', () => {
    expect(() => assertRawMaterialDeletable({ quantityOnHand: 0, activeBomCount: 0 })).not.toThrow();
  });

  it('blocks deletion while units are on hand and names the count', () => {
    const error = apiErrorOf(() =>
      assertRawMaterialDeletable({ quantityOnHand: 42, activeBomCount: 0 }),
    );

    expect(error.status).toBe(409);
    expect(error.code).toBe('RAW_MATERIAL_HAS_STOCK');
    expect(error.message).toContain('42');
    expect(error.message).toMatch(/adjust the stock to zero/i);
  });

  it('reports stock before BOM usage when both block deletion', () => {
    const error = apiErrorOf(() =>
      assertRawMaterialDeletable({ quantityOnHand: 120, activeBomCount: 2 }),
    );

    expect(error.code).toBe('RAW_MATERIAL_HAS_STOCK');
  });

  it('blocks deletion while an active BOM still uses the material', () => {
    const error = apiErrorOf(() =>
      assertRawMaterialDeletable({ quantityOnHand: 0, activeBomCount: 2 }),
    );

    expect(error.status).toBe(409);
    expect(error.code).toBe('RAW_MATERIAL_IN_BOM');
    expect(error.message).toContain('2 active bills');
  });

  it('uses the singular form for one BOM', () => {
    const error = apiErrorOf(() =>
      assertRawMaterialDeletable({ quantityOnHand: 0, activeBomCount: 1 }),
    );

    expect(error.message).toContain('1 active bill ');
  });

  it('treats negative on-hand as empty (nothing to write off)', () => {
    expect(() => assertRawMaterialDeletable({ quantityOnHand: -1, activeBomCount: 0 })).not.toThrow();
  });
});

describe('assertRawMaterialUnitChangeAllowed', () => {
  it('allows keeping the same unit regardless of stock', () => {
    expect(() =>
      assertRawMaterialUnitChangeAllowed({
        currentUnit: 'KILOGRAMS',
        nextUnit: 'KILOGRAMS',
        quantityOnHand: 17,
      }),
    ).not.toThrow();
  });

  it('allows changing the unit when no stock is on hand', () => {
    expect(() =>
      assertRawMaterialUnitChangeAllowed({
        currentUnit: 'KILOGRAMS',
        nextUnit: 'LITERS',
        quantityOnHand: 0,
      }),
    ).not.toThrow();
  });

  it('blocks reinterpreting a positive quantity in another unit', () => {
    const error = apiErrorOf(() =>
      assertRawMaterialUnitChangeAllowed({
        currentUnit: 'KILOGRAMS',
        nextUnit: 'LITERS',
        quantityOnHand: 17,
      }),
    );

    expect(error.status).toBe(409);
    expect(error.code).toBe('RAW_MATERIAL_UNIT_HAS_STOCK');
    expect(error.message).toContain('17');
    expect(error.message).toMatch(/cannot be converted/i);
  });

  it('formats fractional quantities without trailing zeros', () => {
    const error = apiErrorOf(() =>
      assertRawMaterialUnitChangeAllowed({
        currentUnit: 'KILOGRAMS',
        nextUnit: 'UNITS',
        quantityOnHand: 2.5,
      }),
    );

    expect(error.message).toContain('2.5');
  });
});
