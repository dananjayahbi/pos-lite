import { describe, it, expect } from 'vitest';

import {
  buildPackagingSkuBase,
  isPackagingItemLowStock,
  nextAvailablePackagingSku,
  packagingCategoryLabel,
  packagingConsumptionUnits,
  packagingItemHasStock,
  packagingQuantityLabel,
  planPackagingDeduction,
} from '@/lib/services/packaging.core';
import {
  DEFAULT_PACKAGING_CATEGORIES,
  comparePackagingItems,
  getPackagingCategoryLabel,
  getPackagingUnitShortLabel,
  humanizePackagingCategoryKey,
  slugifyPackagingCategoryKey,
} from '@/lib/constants/packaging';

describe('packagingConsumptionUnits', () => {
  it('rounds fractional per-parcel rates half-up', () => {
    expect(packagingConsumptionUnits(1.6)).toBe(2);
    expect(packagingConsumptionUnits(2.4)).toBe(2);
    expect(packagingConsumptionUnits('0.5')).toBe(1);
  });

  it('never deducts less than one unit when a consumption is configured', () => {
    expect(packagingConsumptionUnits(0.1)).toBe(1);
  });

  it('deducts nothing for a zero or negative rate', () => {
    expect(packagingConsumptionUnits(0)).toBe(0);
    expect(packagingConsumptionUnits(-2)).toBe(0);
  });

  it('keeps whole rates whole', () => {
    expect(packagingConsumptionUnits(3)).toBe(3);
  });
});

describe('planPackagingDeduction', () => {
  it('plans one parcel worth of stock for a new dispatch', () => {
    expect(
      planPackagingDeduction({
        perParcel: 1.6,
        quantityOnHand: 10,
        existingConsumptions: 0,
        parcelCount: 1,
      }),
    ).toEqual({
      missingParcels: 1,
      unitsPerParcel: 2,
      unitsToDeduct: 2,
      insufficient: false,
    });
  });

  it('is idempotent for a retry of the same parcel', () => {
    expect(
      planPackagingDeduction({
        perParcel: 1.6,
        quantityOnHand: 8,
        existingConsumptions: 1,
        parcelCount: 1,
      }),
    ).toMatchObject({ missingParcels: 0, unitsToDeduct: 0, insufficient: false });
  });

  it('catches up exactly one parcel for a redelivery', () => {
    expect(
      planPackagingDeduction({
        perParcel: 1.6,
        quantityOnHand: 8,
        existingConsumptions: 1,
        parcelCount: 2,
      }),
    ).toMatchObject({ missingParcels: 1, unitsToDeduct: 2, insufficient: false });
  });

  it('caps at stock and flags the 10 m / 16 parcel shortage', () => {
    const plan = planPackagingDeduction({
      perParcel: 1.6,
      quantityOnHand: 10,
      existingConsumptions: 0,
      parcelCount: 16,
    });
    expect(plan.missingParcels).toBe(16);
    expect(plan.unitsToDeduct).toBe(10);
    expect(plan.insufficient).toBe(true);
  });

  it('never deducts a negative amount', () => {
    expect(
      planPackagingDeduction({
        perParcel: 1.6,
        quantityOnHand: 0,
        existingConsumptions: 0,
        parcelCount: 4,
      }),
    ).toMatchObject({ unitsToDeduct: 0, insufficient: true });
  });

  it('treats a zero rate as nothing to deduct', () => {
    expect(
      planPackagingDeduction({
        perParcel: 0,
        quantityOnHand: 10,
        existingConsumptions: 0,
        parcelCount: 3,
      }),
    ).toMatchObject({ unitsPerParcel: 0, unitsToDeduct: 0, insufficient: false });
  });
});

describe('buildPackagingSkuBase', () => {
  it('derives a stable category + name stem', () => {
    expect(buildPackagingSkuBase('BUBBLE_WRAP', 'Bubble Wrap 50m')).toBe('BUBB-BUBBLE-WRAP-50M');
  });

  it('collapses separators and trims edges', () => {
    expect(buildPackagingSkuBase('TAPE', '  Brown  48mm / 100m  ')).toBe('TAPE-BROWN-48MM-100M');
  });

  it('falls back to ITEM when the name has no alphanumerics', () => {
    expect(buildPackagingSkuBase('LABEL', 'ටේප්')).toBe('LABE-ITEM');
  });
});

describe('nextAvailablePackagingSku', () => {
  it('returns the base when free', () => {
    expect(nextAvailablePackagingSku('PM-1', [])).toBe('PM-1');
  });

  it('suffixes around taken values', () => {
    expect(nextAvailablePackagingSku('PM-1', ['PM-1', 'PM-1-2'])).toBe('PM-1-3');
  });
});

describe('low-stock + label helpers', () => {
  it('treats quantity at or below the threshold as low', () => {
    expect(isPackagingItemLowStock(5, 5)).toBe(true);
    expect(isPackagingItemLowStock(4, 5)).toBe(true);
    expect(isPackagingItemLowStock(6, 5)).toBe(false);
  });

  it('treats any positive quantity as stock that blocks a delete', () => {
    expect(packagingItemHasStock(10)).toBe(true);
    expect(packagingItemHasStock(1)).toBe(true);
    expect(packagingItemHasStock(0)).toBe(false);
    expect(packagingItemHasStock(-1)).toBe(false);
  });

  it('prefers the tenant category name and falls back to the built-in label', () => {
    expect(packagingCategoryLabel('COURIER_BAGS')).toBe('Courier Bags');
    expect(packagingCategoryLabel('POLYMAILER', new Map([['POLYMAILER', 'Mailers']]))).toBe(
      'Mailers',
    );
  });

  it('renders quantity with a compact unit suffix', () => {
    expect(packagingQuantityLabel(10, 'METER')).toBe('10 m');
    expect(packagingQuantityLabel(3, 'PIECE')).toBe('3 pcs');
    expect(getPackagingUnitShortLabel('BOX')).toBe('boxes');
  });
});

describe('category constants', () => {
  it('ships the five built-in categories', () => {
    expect(DEFAULT_PACKAGING_CATEGORIES.map((c) => c.key)).toEqual([
      'POLYMAILER',
      'TAPE',
      'LABEL',
      'BUBBLE_WRAP',
      'OTHER',
    ]);
  });

  it('slugifies display names into stable keys', () => {
    expect(slugifyPackagingCategoryKey('Courier Bags')).toBe('COURIER_BAGS');
    expect(slugifyPackagingCategoryKey('  Boxes / Containers  ')).toBe('BOXES_CONTAINERS');
  });

  it('humanises custom keys and labels built-ins', () => {
    expect(humanizePackagingCategoryKey('COURIER_BAGS')).toBe('Courier Bags');
    expect(getPackagingCategoryLabel('BUBBLE_WRAP')).toBe('Bubble Wrap');
    expect(getPackagingCategoryLabel('COURIER_BAGS')).toBe('Courier Bags');
  });

  it('orders items by category then name', () => {
    const items = [
      { category: 'TAPE', name: 'B' },
      { category: 'LABEL', name: 'Z' },
      { category: 'LABEL', name: 'A' },
    ];
    expect(items.slice().sort(comparePackagingItems)).toEqual([
      { category: 'LABEL', name: 'A' },
      { category: 'LABEL', name: 'Z' },
      { category: 'TAPE', name: 'B' },
    ]);
  });
});
