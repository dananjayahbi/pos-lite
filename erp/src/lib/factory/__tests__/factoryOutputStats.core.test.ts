import { describe, expect, it } from 'vitest';

import { summarizeFactoryOutput } from '@/lib/factory/factoryOutputStats.core';

describe('summarizeFactoryOutput (ARGUS #261)', () => {
  it('summarises production runs, units and finished-goods value', () => {
    const stats = summarizeFactoryOutput({
      productionRunCount: 4,
      totalProduced: 10,
      totalMaterialCost: 125.5,
      finishedGoods: [
        { stockQuantity: 6, costPrice: 12.25 },
        { stockQuantity: 4, costPrice: 3 },
      ],
    });

    expect(stats.productionRunCount).toBe(4);
    expect(stats.totalProduced).toBe(10);
    expect(stats.averageUnitsPerRun).toBe(2.5);
    expect(stats.totalMaterialCost).toBe(125.5);
    expect(stats.finishedGoodsUnits).toBe(10);
    expect(stats.finishedGoodsValue).toBe(85.5);
  });

  it('returns zeroes for a factory with no runs and no finished goods', () => {
    const stats = summarizeFactoryOutput({
      productionRunCount: 0,
      totalProduced: 0,
      totalMaterialCost: 0,
      finishedGoods: [],
    });

    expect(stats).toEqual({
      productionRunCount: 0,
      totalProduced: 0,
      totalMaterialCost: 0,
      averageUnitsPerRun: 0,
      finishedGoodsUnits: 0,
      finishedGoodsValue: 0,
    });
  });

  it('ignores negative or non-finite values instead of producing a negative KPI', () => {
    const stats = summarizeFactoryOutput({
      productionRunCount: -2,
      totalProduced: Number.NaN,
      totalMaterialCost: -10,
      finishedGoods: [
        { stockQuantity: -3, costPrice: 5 },
        { stockQuantity: 2, costPrice: Number.POSITIVE_INFINITY },
      ],
    });

    expect(stats.productionRunCount).toBe(0);
    expect(stats.totalProduced).toBe(0);
    expect(stats.totalMaterialCost).toBe(0);
    expect(stats.finishedGoodsUnits).toBe(2);
    expect(stats.finishedGoodsValue).toBe(0);
  });

  it('rounds money to two decimals', () => {
    const stats = summarizeFactoryOutput({
      productionRunCount: 3,
      totalProduced: 1,
      totalMaterialCost: 0.005,
      finishedGoods: [{ stockQuantity: 3, costPrice: 0.5 }],
    });

    expect(stats.totalMaterialCost).toBe(0.01);
    expect(stats.finishedGoodsValue).toBe(1.5);
  });
});
