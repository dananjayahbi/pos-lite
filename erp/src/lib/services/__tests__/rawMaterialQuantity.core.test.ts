import { describe, expect, it } from 'vitest';

import { computeConsumptionPlan, computeIngredientRequirement } from '@/lib/services/bom.core';
import {
  applyQuantityDeltaDecimal,
  consumeRawMaterialQuantity,
  isRawMaterialQuantitySufficient,
  RAW_MATERIAL_QUANTITY_SCALE,
  roundRawMaterialQuantity,
} from '@/lib/services/rawMaterial.core';

/** ARGUS #245: Decimal quantities at a fixed scale, never JS float noise. */
describe('raw material quantity policy', () => {
  it('uses four decimal places', () => {
    expect(RAW_MATERIAL_QUANTITY_SCALE).toBe(4);
  });

  it('rounds half-up to the shared scale', () => {
    expect(roundRawMaterialQuantity('1.23456').toFixed(4)).toBe('1.2346');
    expect(roundRawMaterialQuantity('0.00005').toFixed(4)).toBe('0.0001');
    expect(roundRawMaterialQuantity('0.00004').toFixed(4)).toBe('0.0000');
  });

  it('rejects a non-finite quantity', () => {
    expect(() => roundRawMaterialQuantity('NaN')).toThrow('finite');
  });
});

describe('applyQuantityDeltaDecimal', () => {
  it('adds without binary float noise', () => {
    expect(applyQuantityDeltaDecimal('0.1', '0.2').toFixed(4)).toBe('0.3000');
  });

  it('subtracts without binary float noise', () => {
    expect(applyQuantityDeltaDecimal('0.3', '-0.1').toFixed(4)).toBe('0.2000');
  });

  it('allows a delta that lands exactly at zero', () => {
    expect(applyQuantityDeltaDecimal('1', '-1').toFixed(4)).toBe('0.0000');
  });

  it('refuses a negative result', () => {
    expect(() => applyQuantityDeltaDecimal('0.1', '-0.2')).toThrow('Insufficient stock');
  });
});

describe('sufficiency and consumption', () => {
  it('compares at the shared scale', () => {
    expect(isRawMaterialQuantitySufficient('1.0000', '1')).toBe(true);
    expect(isRawMaterialQuantitySufficient('0.3000', '0.3')).toBe(true);
    expect(isRawMaterialQuantitySufficient('0.9999', '1')).toBe(false);
  });

  it('subtracts a consumption amount exactly', () => {
    expect(consumeRawMaterialQuantity('1', '0.3').toFixed(4)).toBe('0.7000');
  });

  it('refuses consumption beyond the available quantity', () => {
    expect(() => consumeRawMaterialQuantity('0.2', '0.3')).toThrow('Insufficient stock');
  });
});

describe('BOM requirement precision', () => {
  it('multiplies decimal ingredients without float noise', () => {
    expect(computeIngredientRequirement(0.1, 3)).toBe(0.3);
    expect(computeIngredientRequirement(0.1, 3)).not.toBe(0.30000000000000004);
  });

  it('marks a run sufficient when required exactly equals available', () => {
    const plan = computeConsumptionPlan(
      [
        {
          rawMaterialId: 'rm1',
          rawMaterialName: 'Oil',
          unit: 'LITERS',
          quantityPerUnit: 0.1,
          available: 0.3,
        },
      ],
      3,
    );
    expect(plan[0]?.required).toBe(0.3);
    expect(plan[0]?.insufficient).toBe(false);
  });

  it('marks a run insufficient when available is below the decimal requirement', () => {
    const plan = computeConsumptionPlan(
      [
        {
          rawMaterialId: 'rm1',
          rawMaterialName: 'Oil',
          unit: 'LITERS',
          quantityPerUnit: 0.1,
          available: 0.2999,
        },
      ],
      3,
    );
    expect(plan[0]?.insufficient).toBe(true);
  });
});
