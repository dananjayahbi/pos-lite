import { describe, it, expect } from 'vitest';
import {
  computeConsumptionPlan,
  computeIngredientRequirement,
  getInsufficientIngredients,
  hasInsufficientIngredients,
  isSourceEligibleForProduction,
  toBomIngredient,
  type BomIngredient,
} from '@/lib/services/bom.core';
import { Prisma } from '@/generated/prisma/client';

describe('bom.core — computeIngredientRequirement', () => {
  it('multiplies quantity per unit by units produced', () => {
    expect(computeIngredientRequirement(0.5, 10)).toBe(5);
    expect(computeIngredientRequirement(2, 3)).toBe(6);
  });

  it('throws on zero/negative/float units', () => {
    expect(() => computeIngredientRequirement(1, 0)).toThrow();
    expect(() => computeIngredientRequirement(1, -2)).toThrow();
    expect(() => computeIngredientRequirement(1, 2.5)).toThrow();
  });

  it('throws on negative quantity per unit', () => {
    expect(() => computeIngredientRequirement(-1, 5)).toThrow();
  });
});

describe('bom.core — computeConsumptionPlan', () => {
  const ingredients: BomIngredient[] = [
    {
      rawMaterialId: 'a',
      rawMaterialName: 'Oil',
      unit: 'LITERS',
      quantityPerUnit: 0.5,
      available: 3,
    },
    {
      rawMaterialId: 'b',
      rawMaterialName: 'Herb',
      unit: 'KILOGRAMS',
      quantityPerUnit: 1,
      available: 2,
    },
  ];

  it('marks lines insufficient when required exceeds available', () => {
    const plan = computeConsumptionPlan(ingredients, 3);
    expect(plan).toHaveLength(2);
    expect(plan[0]).toMatchObject({ required: 1.5, available: 3, insufficient: false });
    expect(plan[1]).toMatchObject({ required: 3, available: 2, insufficient: true });
  });

  it('flags the whole plan as insufficient when any line is short', () => {
    const plan = computeConsumptionPlan(ingredients, 3);
    expect(hasInsufficientIngredients(plan)).toBe(true);
  });

  it('reports a sufficient plan when available stock covers the run', () => {
    const plan = computeConsumptionPlan(ingredients, 1);
    expect(hasInsufficientIngredients(plan)).toBe(false);
    expect(getInsufficientIngredients(plan)).toEqual([]);
  });

  it('sorts insufficient lines by largest shortfall first', () => {
    const big: BomIngredient = {
      rawMaterialId: 'c',
      rawMaterialName: 'Chemical',
      unit: 'KILOGRAMS',
      quantityPerUnit: 5,
      available: 1,
    };
    const plan = computeConsumptionPlan([...ingredients, big], 3);
    const short = getInsufficientIngredients(plan);
    expect(short.map((s) => s.rawMaterialId)).toEqual(['c', 'b']);
  });
});

describe('bom.core — toBomIngredient', () => {
  it('converts Prisma decimal fields to numbers', () => {
    const ingredient = toBomIngredient({
      id: 'i1',
      rawMaterialId: 'rm1',
      quantityPerUnit: new Prisma.Decimal('1.25'),
      rawMaterial: {
        id: 'rm1',
        name: 'Coconut oil',
        unit: 'LITERS',
        quantity: new Prisma.Decimal('4.5'),
      },
    });
    expect(ingredient).toMatchObject({
      rawMaterialId: 'rm1',
      rawMaterialName: 'Coconut oil',
      unit: 'LITERS',
      quantityPerUnit: 1.25,
      available: 4.5,
    });
  });

  it('falls back to safe defaults when raw material is missing', () => {
    const ingredient = toBomIngredient({
      id: 'i2',
      rawMaterialId: 'rmX',
      quantityPerUnit: new Prisma.Decimal('2'),
      rawMaterial: null,
    });
    expect(ingredient).toMatchObject({
      rawMaterialName: 'Unknown material',
      unit: 'KILOGRAMS',
      available: 0,
      quantityPerUnit: 2,
    });
  });
});

describe('bom.core — isSourceEligibleForProduction', () => {
  it('returns true for manufactured goods', () => {
    expect(isSourceEligibleForProduction('MANUFACTURED')).toBe(true);
  });

  it('returns false for traded goods', () => {
    expect(isSourceEligibleForProduction('TRADED')).toBe(false);
  });
});
