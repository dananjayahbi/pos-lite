import { describe, expect, it } from 'vitest';

import {
  readProductionBatchNumber,
  scaleProductionConsumption,
} from '@/lib/services/productionHistory.core';

describe('readProductionBatchNumber (ARGUS #259)', () => {
  it('reads the batch number from the audit after payload', () => {
    expect(readProductionBatchNumber({ batchNumber: 'MFG-20261122-01' })).toBe(
      'MFG-20261122-01',
    );
  });

  it('returns null for missing, empty or non-object payloads', () => {
    expect(readProductionBatchNumber(null)).toBeNull();
    expect(readProductionBatchNumber(undefined)).toBeNull();
    expect(readProductionBatchNumber('MFG-1')).toBeNull();
    expect(readProductionBatchNumber({ batchNumber: '   ' })).toBeNull();
    expect(readProductionBatchNumber({ batchNumber: 42 })).toBeNull();
    expect(readProductionBatchNumber({})).toBeNull();
  });
});

describe('scaleProductionConsumption (ARGUS #259)', () => {
  const recipe = [
    { rawMaterialId: 'rm-1', rawMaterialName: 'Neem oil', unit: 'LITERS', quantityPerUnit: 0.25 },
    { rawMaterialId: 'rm-2', rawMaterialName: 'Turmeric', unit: 'KILOGRAMS', quantityPerUnit: '1.5' },
  ];

  it('scales the frozen recipe by the produced quantity', () => {
    const rows = scaleProductionConsumption(recipe, 4);

    expect(rows.map((row) => row.quantity)).toEqual([1, 6]);
    expect(rows[0]).toMatchObject({ rawMaterialName: 'Neem oil', unit: 'LITERS' });
  });

  it('returns zero consumption for a zero or invalid produced quantity', () => {
    expect(scaleProductionConsumption(recipe, 0).map((row) => row.quantity)).toEqual([0, 0]);
    expect(scaleProductionConsumption(recipe, Number.NaN).map((row) => row.quantity)).toEqual([
      0, 0,
    ]);
  });

  it('rounds to the shared four-decimal quantity scale', () => {
    const rows = scaleProductionConsumption(
      [{ rawMaterialId: 'rm', rawMaterialName: 'Powder', unit: 'KILOGRAMS', quantityPerUnit: '0.3333' }],
      3,
    );

    expect(rows[0]?.quantity).toBe(0.9999);
  });
});
